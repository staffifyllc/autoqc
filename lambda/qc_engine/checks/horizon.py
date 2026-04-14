"""
Horizon Level Detection

Detects horizontal architectural lines (countertops, tables, baseboards,
ceiling lines) and measures deviation from true horizontal.

Standard: horizon should be within 0.5 degrees.
"""

import cv2
import numpy as np


def check_horizon(image_path: str, tolerance: float = 0.5) -> dict:
    img = cv2.imread(image_path)
    if img is None:
        return {"deviation": 0, "failed": False}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150, apertureSize=3)

    # Focus on middle portion
    margin_x = int(w * 0.1)
    margin_y = int(h * 0.15)
    edges_cropped = edges[margin_y : h - margin_y, margin_x : w - margin_x]

    lines = cv2.HoughLinesP(
        edges_cropped,
        rho=1,
        theta=np.pi / 180,
        threshold=80,
        minLineLength=w * 0.15,
        maxLineGap=10,
    )

    if lines is None or len(lines) == 0:
        return {"deviation": 0, "failed": False}

    horizontal_angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        length = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

        # Only consider lines that are significantly wide
        if abs(x2 - x1) < length * 0.7:
            continue

        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        if abs(angle) < 15:  # Within 15 degrees of horizontal
            horizontal_angles.append(angle)

    if not horizontal_angles:
        return {"deviation": 0, "failed": False}

    median_angle = np.median(horizontal_angles)
    deviation = abs(median_angle)

    return {
        "deviation": round(deviation, 2),
        "failed": deviation > tolerance,
        "line_count": len(horizontal_angles),
    }
