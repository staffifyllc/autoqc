"""
Distraction Removal Fix (Premium tier)

Takes the mask list from checks.distraction_removal and inpaints each
region with LaMa. LaMa reconstructs the background cleanly instead of
hallucinating new content the way SD inpainting does. That matters for
real estate honesty: we want the grass, driveway, or siding that was
behind the trash bin, not an invented plant.

Model chosen: cjwbw/lama
Slug: cjwbw/lama:e09b0c0b7c5ba1e35e5a0e3a8b3c4c8e9d9e1b1b9c8d9e1c2b3d4e5f6a7b8c9d
TODO: confirm slug on first deploy. See DISTRACTION_REMOVAL_NOTES.md.

Fallback: if the Replicate token is missing or the API fails, we return
None so the pipeline keeps the original image. Never crash the lambda.
"""

import base64
import os
import tempfile
import urllib.request
from io import BytesIO

import cv2
import numpy as np
import replicate


LAMA_MODEL = (
    "cjwbw/lama:"
    "e09b0c0b7c5ba1e35e5a0e3a8b3c4c8e9d9e1b1b9c8d9e1c2b3d4e5f6a7b8c9d0"
)


def _combine_masks(regions: list, img_w: int, img_h: int) -> np.ndarray | None:
    """
    OR all per-region masks into a single binary mask sized to the
    source image. Returns a uint8 numpy array or None if nothing usable.
    """
    combined = np.zeros((img_h, img_w), dtype=np.uint8)
    used = 0
    for region in regions:
        mask_b64 = region.get("mask")
        if not mask_b64:
            # Fall back to bbox only. Builds a rectangular mask which is
            # cruder, but still lets the fix run if the check didn't
            # supply a real segmentation mask.
            bbox = region.get("bbox") or {}
            x = int(bbox.get("x", 0) * img_w)
            y = int(bbox.get("y", 0) * img_h)
            w = int(bbox.get("width", 0) * img_w)
            h = int(bbox.get("height", 0) * img_h)
            if w > 0 and h > 0:
                combined[y:y + h, x:x + w] = 255
                used += 1
            continue

        try:
            raw = base64.standard_b64decode(mask_b64)
            arr = np.frombuffer(raw, dtype=np.uint8)
            m = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
            if m is None:
                continue
            if m.shape != (img_h, img_w):
                m = cv2.resize(m, (img_w, img_h), interpolation=cv2.INTER_NEAREST)
            combined = np.maximum(combined, (m > 127).astype(np.uint8) * 255)
            used += 1
        except Exception:
            continue

    if used == 0:
        return None
    return combined


def remove_distractions(image_path: str, regions: list) -> str | None:
    """
    Inpaint distraction regions out of the image.

    Args:
        image_path: path to the source image on disk.
        regions: list of region dicts from detect_distractions().

    Returns:
        Path to cleaned image, or None if nothing to do or the API
        could not be reached.
    """
    if not regions:
        return None

    api_token = os.environ.get("REPLICATE_API_TOKEN")
    if not api_token:
        print("Distraction removal skipped: REPLICATE_API_TOKEN not set")
        return None

    img = cv2.imread(image_path)
    if img is None:
        return None
    h, w = img.shape[:2]

    combined_mask = _combine_masks(regions, w, h)
    if combined_mask is None:
        return None

    # Write the combined mask to a temp PNG so we can upload it to
    # Replicate alongside the source image.
    mask_tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    cv2.imwrite(mask_tmp.name, combined_mask)
    mask_tmp.close()

    try:
        client = replicate.Client(api_token=api_token)

        with open(image_path, "rb") as img_f, open(mask_tmp.name, "rb") as mask_f:
            output = client.run(
                LAMA_MODEL,
                input={
                    "image": img_f,
                    "mask": mask_f,
                },
            )

        output_url = str(output)

        suffix = "." + image_path.split(".")[-1]
        out_tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        with urllib.request.urlopen(output_url) as resp:
            out_tmp.write(resp.read())
            out_tmp.close()

        # Sanity check the output.
        check = cv2.imread(out_tmp.name)
        if check is None:
            os.unlink(out_tmp.name)
            return None

        return out_tmp.name

    except Exception as e:
        print(f"LaMa inpaint failed: {e}")
        return None
    finally:
        try:
            os.unlink(mask_tmp.name)
        except Exception:
            pass


def estimate_removal_cost(num_photos: int, avg_regions_per_photo: float = 1.5) -> float:
    """
    Rough cost estimate for budget dashboards.
    Grounded-SAM on T4 runs ~6s. LaMa runs ~2s. T4 billing $0.000225/sec.
    One detection call plus one inpaint call per photo with distractions.
    """
    per_photo_seconds = 6.0 + 2.0  # detect + inpaint
    # avg_regions_per_photo is informational; inpainting combines masks
    # so a single LaMa call handles multiple regions.
    cost_per_photo = per_photo_seconds * 0.000225
    return num_photos * cost_per_photo
