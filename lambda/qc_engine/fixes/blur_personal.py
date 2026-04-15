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

    # Pre-compute a heavily-blurred version of the whole image for compositing
    full_blur = cv2.GaussianBlur(img, (0, 0), sigmaX=35, sigmaY=35)

    for region in regions:
        bbox = region.get("bbox", {})
        x = int(bbox.get("x", 0) * w)
        y = int(bbox.get("y", 0) * h)
        box_w = int(bbox.get("width", 0) * w)
        box_h = int(bbox.get("height", 0) * h)

        # Add padding to ensure full coverage (+5% on each side)
        pad_x = int(box_w * 0.05)
        pad_y = int(box_h * 0.05)
        x = max(0, x - pad_x)
        y = max(0, y - pad_y)
        x2 = min(w, x + box_w + 2 * pad_x)
        y2 = min(h, y + box_h + 2 * pad_y)

        if x2 <= x or y2 <= y:
            continue

        # Create a soft mask with feathered edges so the blur doesn't have
        # a harsh rectangular boundary
        mask = np.zeros((h, w), dtype=np.float32)
        mask[y:y2, x:x2] = 1.0
        mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=15, sigmaY=15)

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
