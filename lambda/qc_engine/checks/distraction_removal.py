"""
Distraction Detection (Premium tier)

Detects transient distractions in real estate photos: trash bins, garden
hoses, kids toys, cables, pool floats, porta potties, construction gear,
etc. Returns normalized bounding boxes and segmentation masks so the
inpaint fix can cleanly remove them.

Uses Grounding DINO + SAM 2 via Replicate. Grounding DINO takes a free-text
prompt and returns detections; SAM 2 refines those detections into pixel
masks. Some Replicate models combine both steps.

Model chosen: schananas/grounded_sam
Slug: schananas/grounded_sam:ee871c19befb1d7875444a94d75b604f00e5d4fbdaaaf0c8a13ce2b0a122a40d
Rationale: one-shot text-prompt to mask, accepts comma-separated prompts,
returns PNG masks we can consume directly. TODO flagged in notes file if
the slug drifts: update here and requirements.txt stays the same (already
has replicate SDK).

If the Replicate token is absent or the API call fails we return an empty
regions list so the pipeline keeps moving. Never crash.
"""

import base64
import os
import urllib.request
from io import BytesIO

import cv2
import numpy as np
import replicate


# Grounded-SAM: text prompt to segmentation masks in one call.
# See notes file for verification steps.
GROUNDED_SAM_MODEL = (
    "schananas/grounded_sam:"
    "ee871c19befb1d7875444a94d75b604f00e5d4fbdaaaf0c8a13ce2b0a122a40d"
)


# Safe defaults. These are transient objects an agent would want gone
# before listing photos go live. Paul can extend per agency / per property.
DEFAULT_CATEGORIES = [
    "trash_bin",
    "garbage_can",
    "recycling_bin",
    "garden_hose",
    "kids_toy",
    "pool_float",
    "extension_cord",
    "cables",
    "porta_potty",
    "construction_equipment",
]

# Risky categories. Agencies must opt in explicitly. Removing permanent
# features like a satellite dish or power line can raise MLS ethics
# questions in some jurisdictions.
RISKY_CATEGORIES = [
    "parked_car",
    "satellite_dish",
    "power_line",
]

ALL_CATEGORIES = DEFAULT_CATEGORIES + RISKY_CATEGORIES


# Human readable prompt fragment used by Grounding DINO.
# Keep this short and concrete. Long prompts confuse the detector.
CATEGORY_PROMPTS = {
    "trash_bin": "trash bin",
    "garbage_can": "garbage can",
    "recycling_bin": "recycling bin",
    "garden_hose": "garden hose",
    "kids_toy": "children toy",
    "pool_float": "pool float",
    "extension_cord": "extension cord",
    "cables": "visible electrical cable",
    "porta_potty": "porta potty",
    "construction_equipment": "construction equipment",
    "parked_car": "parked car",
    "satellite_dish": "satellite dish",
    "power_line": "power line",
}


def _dilate_mask_png(png_bytes: bytes, pad_px: int = 6) -> bytes:
    """
    Dilate a binary mask PNG so the inpaint step also captures the
    shadow / fringe on grass, pavement, siding. Returns PNG bytes.
    """
    arr = np.frombuffer(png_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return png_bytes
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (pad_px * 2 + 1, pad_px * 2 + 1))
    dilated = cv2.dilate(img, kernel, iterations=1)
    _, buf = cv2.imencode(".png", dilated)
    return buf.tobytes()


def _bbox_from_mask(mask_png_bytes: bytes, img_w: int, img_h: int) -> dict:
    """Compute a normalized bbox from a mask PNG."""
    arr = np.frombuffer(mask_png_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0}
    # Resize the mask to the image dims if the model returns a different size
    if img.shape != (img_h, img_w):
        img = cv2.resize(img, (img_w, img_h), interpolation=cv2.INTER_NEAREST)
    ys, xs = np.where(img > 127)
    if len(xs) == 0 or len(ys) == 0:
        return {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0}
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    return {
        "x": x0 / img_w,
        "y": y0 / img_h,
        "width": (x1 - x0) / img_w,
        "height": (y1 - y0) / img_h,
    }


def detect_distractions(image_path: str, enabled_categories: list) -> dict:
    """
    Detect distractions in a real estate photo.

    Args:
        image_path: local path to a JPEG or PNG.
        enabled_categories: list of category keys from ALL_CATEGORIES.
            Empty list means skip the check entirely.

    Returns a dict shaped like personal_images.detect_personal_images:
        {
            "has_distractions": bool,
            "regions": [
                {
                    "type": str,
                    "description": str,
                    "bbox": {x, y, width, height},   # normalized 0-1
                    "mask": str,                     # base64 PNG, dilated
                    "confidence": float,
                }
            ],
            "summary": str,
        }
    """
    if not enabled_categories:
        return {"has_distractions": False, "regions": [], "summary": "No categories enabled"}

    # Strip unknown categories silently; the UI validates, but be defensive.
    enabled = [c for c in enabled_categories if c in ALL_CATEGORIES]
    if not enabled:
        return {"has_distractions": False, "regions": [], "summary": "No valid categories"}

    api_token = os.environ.get("REPLICATE_API_TOKEN")
    if not api_token:
        return {
            "has_distractions": False,
            "regions": [],
            "summary": "Replicate API not configured",
        }

    # Build the combined text prompt. Grounded-SAM takes a dot separated
    # list of nouns.
    prompts = [CATEGORY_PROMPTS[c] for c in enabled]
    text_prompt = ". ".join(prompts)

    # Read image dims for bbox normalization.
    img_cv = cv2.imread(image_path)
    if img_cv is None:
        return {
            "has_distractions": False,
            "regions": [],
            "summary": "Could not read image",
        }
    img_h, img_w = img_cv.shape[:2]

    try:
        client = replicate.Client(api_token=api_token)

        with open(image_path, "rb") as f:
            output = client.run(
                GROUNDED_SAM_MODEL,
                input={
                    "image": f,
                    "mask_prompt": text_prompt,
                    "negative_mask_prompt": "person, face, house, building, roof, window, door",
                    "adjustment_factor": 0,
                },
            )

        # Grounded SAM returns a list of mask URLs, one per matched label,
        # and optionally one per-label bbox + score. Handle both shapes.
        regions = []
        mask_entries = []
        if isinstance(output, dict):
            mask_entries = output.get("masks") or output.get("mask") or []
            labels = output.get("labels") or enabled
            scores = output.get("scores") or [0.85] * len(mask_entries)
        elif isinstance(output, list):
            mask_entries = output
            labels = enabled * ((len(output) // max(1, len(enabled))) + 1)
            scores = [0.85] * len(output)
        else:
            mask_entries = [output]
            labels = enabled[:1] or ["distraction"]
            scores = [0.85]

        for i, mask_ref in enumerate(mask_entries):
            try:
                url = str(mask_ref)
                with urllib.request.urlopen(url) as resp:
                    mask_bytes = resp.read()
            except Exception:
                continue

            dilated = _dilate_mask_png(mask_bytes, pad_px=6)
            bbox = _bbox_from_mask(dilated, img_w, img_h)
            # Skip tiny masks. They are almost always noise.
            if bbox["width"] < 0.01 or bbox["height"] < 0.01:
                continue

            label = labels[i] if i < len(labels) else enabled[0]
            score = float(scores[i]) if i < len(scores) else 0.85

            regions.append({
                "type": label,
                "description": f"Detected {label.replace('_', ' ')}",
                "bbox": bbox,
                "mask": base64.standard_b64encode(dilated).decode("utf-8"),
                "confidence": score,
            })

        summary = (
            f"{len(regions)} distraction(s) detected"
            if regions else "No distractions found"
        )

        return {
            "has_distractions": len(regions) > 0,
            "regions": regions,
            "summary": summary,
        }

    except Exception as e:
        print(f"Distraction detection failed: {e}")
        return {
            "has_distractions": False,
            "regions": [],
            "summary": f"Detection error: {str(e)[:100]}",
        }
