"""
Exposure Analysis

Checks for overexposure (blown highlights) and underexposure (crushed blacks).
Real estate photos need proper exposure especially for:
- Interior rooms (should be well-lit, not dark)
- Window views (should not be completely blown out)
- Shadow detail in corners and under furniture

Standards:
- Blown highlights (>250): should be <5% of total pixels
- Crushed blacks (<5): should be <3% of total pixels
- Mean luminance: target 100-180 for interiors
"""

import cv2
import numpy as np


def check_exposure(
    image_path: str,
    ev_min: float = -1.0,
    ev_max: float = 1.5,
) -> dict:
    img = cv2.imread(image_path)
    if img is None:
        return {
            "exposure": 0,
            "overexposed": False,
            "underexposed": False,
            "severity": 0,
        }

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    total_pixels = gray.size

    # Calculate histogram
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
    hist = hist.flatten() / total_pixels

    # Blown highlights: pixels > 250
    blown = np.sum(hist[250:]) * 100
    # Crushed blacks: pixels < 5
    crushed = np.sum(hist[:5]) * 100

    # Mean luminance
    mean_lum = np.mean(gray)

    # Estimate EV offset from ideal (128 = middle gray)
    # log2 relationship
    if mean_lum > 0:
        ev_offset = np.log2(mean_lum / 128)
    else:
        ev_offset = -5.0

    overexposed = blown > 5.0 or mean_lum > 200
    underexposed = crushed > 3.0 or mean_lum < 60

    severity = 0
    if overexposed:
        severity = min(blown / 20.0, 1.0)
    if underexposed:
        severity = max(severity, min(crushed / 10.0, 1.0))

    # Also check for flat histogram (low dynamic range, signs of bad HDR)
    hist_std = np.std(hist)
    low_dynamic_range = hist_std < 0.002

    return {
        "exposure": round(ev_offset, 2),
        "mean_luminance": round(float(mean_lum), 1),
        "blown_percentage": round(blown, 1),
        "crushed_percentage": round(crushed, 1),
        "overexposed": overexposed,
        "underexposed": underexposed,
        "low_dynamic_range": low_dynamic_range,
        "severity": round(severity, 2),
    }
