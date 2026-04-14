"""
Color / White Balance Auto-Fix

Corrects color temperature and removes color casts.
Uses a gray-world assumption combined with detected issues
to neutralize unwanted color shifts.

Handles:
- Green cast from fluorescent lighting
- Orange cast from tungsten bulbs
- Blue cast from shade/overcast
- Mixed color temperatures from flash/ambient blend
"""

import cv2
import numpy as np
import tempfile


def fix_color(image_path: str, color_result: dict) -> str | None:
    """
    Auto-correct white balance and color temperature issues.

    Args:
        image_path: Path to the image
        color_result: Output from check_color()

    Returns:
        Path to the corrected image, or None if correction failed
    """
    img = cv2.imread(image_path)
    if img is None:
        return None

    img_float = img.astype(np.float64)
    b, g, r = cv2.split(img_float)

    color_cast = color_result.get("color_cast")
    detected_temp = color_result.get("color_temp", 5500)

    # Method 1: Gray-world white balance
    # Assumes the average of all colors should be neutral gray
    avg_b = np.mean(b)
    avg_g = np.mean(g)
    avg_r = np.mean(r)
    avg_all = (avg_b + avg_g + avg_r) / 3

    # Scale channels to balance
    scale_b = avg_all / max(avg_b, 1)
    scale_g = avg_all / max(avg_g, 1)
    scale_r = avg_all / max(avg_r, 1)

    # Don't over-correct - limit scaling to 30% adjustment
    scale_b = np.clip(scale_b, 0.7, 1.3)
    scale_g = np.clip(scale_g, 0.7, 1.3)
    scale_r = np.clip(scale_r, 0.7, 1.3)

    # Apply targeted corrections based on detected cast
    if color_cast == "green":
        # Reduce green channel more aggressively
        scale_g *= 0.92
        # Boost magenta (red + blue) slightly
        scale_r *= 1.03
        scale_b *= 1.03
    elif color_cast == "orange":
        # Reduce red, boost blue
        scale_r *= 0.93
        scale_b *= 1.05
    elif color_cast == "blue":
        # Reduce blue, boost red slightly
        scale_b *= 0.93
        scale_r *= 1.04
    elif color_cast == "warm":
        # Cool it down slightly
        scale_r *= 0.95
        scale_b *= 1.03

    # Apply corrections
    b_corrected = np.clip(b * scale_b, 0, 255)
    g_corrected = np.clip(g * scale_g, 0, 255)
    r_corrected = np.clip(r * scale_r, 0, 255)

    corrected = cv2.merge([
        b_corrected.astype(np.uint8),
        g_corrected.astype(np.uint8),
        r_corrected.astype(np.uint8),
    ])

    # Save
    suffix = "." + image_path.split(".")[-1]
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    cv2.imwrite(tmp.name, corrected, [cv2.IMWRITE_JPEG_QUALITY, 95])

    return tmp.name
