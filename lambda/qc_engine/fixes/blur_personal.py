"""
Privacy Blur Fix

Applies heavy Gaussian blur to regions containing personal/private content
(family photos, kids' pics, diplomas with names, etc.).

Uses normalized bounding boxes (0-1) from Claude Vision detection.
"""

import cv2
import numpy as np
import tempfile


def apply_privacy_blur(image_path: str, regions: list) -> str | None:
    """
    Blur the specified regions in the image.

    Args:
        image_path: Path to image file
        regions: List of dicts with bbox = {x, y, width, height} (normalized 0-1)

    Returns:
        Path to blurred image, or None if no regions or error.
    """
    if not regions:
        return None

    img = cv2.imread(image_path)
    if img is None:
        return None

    h, w = img.shape[:2]
    blurred_img = img.copy()

    # Privacy blur intentionally subtle. Enough to kill face/text legibility,
    # not so much that the frame becomes a smeared blob. Sigma scales with
    # the image dimensions so a 2000 px photo gets roughly the same visual
    # strength as a 4000 px photo.
    blur_sigma = max(6.0, min(img.shape[:2]) / 220.0)
    full_blur = cv2.GaussianBlur(img, (0, 0), sigmaX=blur_sigma, sigmaY=blur_sigma)

    for region in regions:
        bbox = region.get("bbox", {})
        x = int(bbox.get("x", 0) * w)
        y = int(bbox.get("y", 0) * h)
        box_w = int(bbox.get("width", 0) * w)
        box_h = int(bbox.get("height", 0) * h)

        # Detection prompt already pads the bbox by ~5% on each side.
        # Do NOT pad again here or the blur bleeds visibly past the frame.
        x = max(0, x)
        y = max(0, y)
        x2 = min(w, x + box_w)
        y2 = min(h, y + box_h)

        if x2 <= x or y2 <= y:
            continue

        # Soft edge so the mask doesn't have a hard rectangular cut, but
        # feather radius is tied to the region size (not a fixed 15 px) so
        # small frames get a small soft edge and large frames get a larger
        # one. Capped at 8 px either way, keeping bleed under ~2% of frame.
        feather = int(max(2, min(8, min(box_w, box_h) * 0.04)))
        mask = np.zeros((h, w), dtype=np.float32)
        mask[y:y2, x:x2] = 1.0
        mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=feather, sigmaY=feather)

        # Blend: where mask is 1, use full_blur; where 0, use original
        mask_3c = np.stack([mask, mask, mask], axis=2)
        blurred_img = (
            blurred_img.astype(np.float32) * (1 - mask_3c)
            + full_blur.astype(np.float32) * mask_3c
        ).astype(np.uint8)

    # Save result
    suffix = "." + image_path.split(".")[-1]
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    cv2.imwrite(tmp.name, blurred_img, [cv2.IMWRITE_JPEG_QUALITY, 95])

    return tmp.name
