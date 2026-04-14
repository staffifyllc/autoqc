"""
Vertical Correction Auto-Fix

Applies perspective correction to straighten vertical lines.
Uses OpenCV's warpPerspective to correct tilted verticals without
introducing excessive distortion.

Important: only corrects deviations up to 5 degrees.
Beyond that, the image quality loss from warping is too significant
and it should be flagged for manual correction (reshoot or manual edit).
"""

import cv2
import numpy as np
import tempfile


def fix_verticals(
    image_path: str, deviation: float, direction: str
) -> str | None:
    """
    Correct vertical tilt by rotating/warping the image.

    Args:
        image_path: Path to the image
        deviation: Degrees off vertical
        direction: 'left' or 'right'

    Returns:
        Path to the corrected image, or None if correction failed
    """
    if deviation > 5.0:
        return None  # Too much correction needed

    img = cv2.imread(image_path)
    if img is None:
        return None

    h, w = img.shape[:2]

    # For small corrections (< 2 degrees), simple rotation is fine
    if deviation < 2.0:
        angle = deviation if direction == "right" else -deviation
        center = (w // 2, h // 2)
        matrix = cv2.getRotationMatrix2D(center, angle, 1.0)

        # Calculate new bounding box to avoid cutting off corners
        cos = abs(matrix[0, 0])
        sin = abs(matrix[0, 1])
        new_w = int(h * sin + w * cos)
        new_h = int(h * cos + w * sin)
        matrix[0, 2] += (new_w - w) / 2
        matrix[1, 2] += (new_h - h) / 2

        rotated = cv2.warpAffine(img, matrix, (new_w, new_h))

        # Crop back to original aspect ratio from center
        crop_x = (new_w - w) // 2
        crop_y = (new_h - h) // 2
        corrected = rotated[crop_y : crop_y + h, crop_x : crop_x + w]

    else:
        # For larger corrections (2-5 degrees), use perspective transform
        # to correct converging verticals
        angle_rad = np.radians(deviation)

        # Amount of horizontal shift at top/bottom
        shift = int(h * np.tan(angle_rad) / 2)

        if direction == "right":
            src_pts = np.float32([[0, 0], [w, 0], [0, h], [w, h]])
            dst_pts = np.float32([
                [shift, 0], [w - shift, 0],
                [0, h], [w, h]
            ])
        else:
            src_pts = np.float32([[0, 0], [w, 0], [0, h], [w, h]])
            dst_pts = np.float32([
                [0, 0], [w, 0],
                [shift, h], [w - shift, h]
            ])

        matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)
        corrected = cv2.warpPerspective(img, matrix, (w, h))

    # Save corrected image
    suffix = "." + image_path.split(".")[-1]
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    cv2.imwrite(tmp.name, corrected, [cv2.IMWRITE_JPEG_QUALITY, 95])

    return tmp.name
