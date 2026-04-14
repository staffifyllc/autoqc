"""
Sharpness / Focus Detection

Uses Laplacian variance to detect blur/soft focus.
Also checks sharpness in different regions to detect
selective focus issues (e.g., focused on foreground but
background is critical).

Real estate photos must be sharp edge-to-edge since the
entire room needs to be in focus.
"""

import cv2
import numpy as np


def check_sharpness(image_path: str, threshold: float = 100.0) -> dict:
    img = cv2.imread(image_path)
    if img is None:
        return {"sharpness": 0, "failed": False, "severity": 0}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # Overall sharpness via Laplacian variance
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    overall_sharpness = float(laplacian.var())

    # Check sharpness in quadrants (detect uneven focus)
    quad_h, quad_w = h // 2, w // 2
    quadrants = [
        gray[0:quad_h, 0:quad_w],           # top-left
        gray[0:quad_h, quad_w:w],            # top-right
        gray[quad_h:h, 0:quad_w],            # bottom-left
        gray[quad_h:h, quad_w:w],            # bottom-right
    ]

    quad_sharpness = []
    for quad in quadrants:
        lap = cv2.Laplacian(quad, cv2.CV_64F)
        quad_sharpness.append(float(lap.var()))

    min_quad = min(quad_sharpness)
    max_quad = max(quad_sharpness)

    # If the weakest quadrant is less than 30% of the strongest,
    # there's likely a focus issue
    uneven_focus = min_quad < (max_quad * 0.3) if max_quad > 0 else False

    failed = overall_sharpness < threshold
    severity = 0
    if failed:
        severity = min((threshold - overall_sharpness) / threshold, 1.0)

    return {
        "sharpness": round(overall_sharpness, 1),
        "min_quadrant": round(min_quad, 1),
        "max_quadrant": round(max_quad, 1),
        "uneven_focus": uneven_focus,
        "failed": failed,
        "severity": round(severity, 2),
    }
