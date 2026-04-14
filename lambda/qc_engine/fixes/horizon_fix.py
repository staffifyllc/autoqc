"""
Horizon Level Auto-Fix

Rotates the image to level the horizon.
Applies a simple rotation correction for tilted horizons
up to 3 degrees.
"""

import cv2
import numpy as np
import tempfile


def fix_horizon(image_path: str, deviation: float) -> str | None:
    """
    Correct horizon tilt by rotating the image.

    Args:
        image_path: Path to the image
        deviation: Degrees off horizontal (positive = clockwise tilt)

    Returns:
        Path to the corrected image, or None if correction failed
    """
    if deviation > 3.0:
        return None  # Too much tilt, needs manual correction

    img = cv2.imread(image_path)
    if img is None:
        return None

    h, w = img.shape[:2]
    center = (w // 2, h // 2)

    # Rotate to level
    matrix = cv2.getRotationMatrix2D(center, deviation, 1.0)

    # Calculate new bounds
    cos = abs(matrix[0, 0])
    sin = abs(matrix[0, 1])
    new_w = int(h * sin + w * cos)
    new_h = int(h * cos + w * sin)
    matrix[0, 2] += (new_w - w) / 2
    matrix[1, 2] += (new_h - h) / 2

    rotated = cv2.warpAffine(img, matrix, (new_w, new_h))

    # Crop back to original aspect ratio
    crop_x = (new_w - w) // 2
    crop_y = (new_h - h) // 2
    # Add small extra crop to remove any black edges from rotation
    extra_crop = int(max(w, h) * np.sin(np.radians(deviation)) * 0.5)
    cx = crop_x + extra_crop
    cy = crop_y + extra_crop
    cw = w - extra_crop * 2
    ch = h - extra_crop * 2

    if cx >= 0 and cy >= 0 and cx + cw <= new_w and cy + ch <= new_h:
        corrected = rotated[cy : cy + ch, cx : cx + cw]
    else:
        corrected = rotated[crop_y : crop_y + h, crop_x : crop_x + w]

    # Resize back to original dimensions
    corrected = cv2.resize(corrected, (w, h), interpolation=cv2.INTER_LANCZOS4)

    # Save
    suffix = "." + image_path.split(".")[-1]
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    cv2.imwrite(tmp.name, corrected, [cv2.IMWRITE_JPEG_QUALITY, 95])

    return tmp.name
