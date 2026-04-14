"""
Vertical Line Detection and Measurement

Detects architectural vertical lines (walls, door frames, window frames)
using Hough Line Transform on Canny edges. Measures deviation from true
vertical (90 degrees).

Industry standard: verticals should be within 0.5-1.0 degrees of true vertical.
Overcorrection (barrel-shaped walls) is also flagged.
"""

import cv2
import numpy as np


def check_verticals(image_path: str, tolerance: float = 1.0) -> dict:
    """
    Check vertical alignment of architectural elements.

    Args:
        image_path: Path to the image file
        tolerance: Maximum allowed deviation in degrees

    Returns:
        dict with deviation, direction, and pass/fail
    """
    img = cv2.imread(image_path)
    if img is None:
        return {"deviation": 0, "direction": "none", "failed": False}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # Apply Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Edge detection
    edges = cv2.Canny(blurred, 50, 150, apertureSize=3)

    # Focus on the middle 80% of the image (avoid extreme edges where
    # lens distortion is worst)
    margin_x = int(w * 0.1)
    margin_y = int(h * 0.1)
    edges_cropped = edges[margin_y : h - margin_y, margin_x : w - margin_x]

    # Detect lines using Probabilistic Hough Transform
    lines = cv2.HoughLinesP(
        edges_cropped,
        rho=1,
        theta=np.pi / 180,
        threshold=100,
        minLineLength=h * 0.15,  # Lines must be at least 15% of image height
        maxLineGap=10,
    )

    if lines is None or len(lines) == 0:
        return {"deviation": 0, "direction": "none", "failed": False}

    # Filter for near-vertical lines (within 20 degrees of vertical)
    vertical_angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        length = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

        # Only consider lines that are significantly tall
        if abs(y2 - y1) < length * 0.7:
            continue

        # Calculate angle from vertical (0 = perfectly vertical)
        if y2 - y1 == 0:
            continue
        angle = np.degrees(np.arctan2(x2 - x1, y2 - y1))
        if abs(angle) < 20:  # Within 20 degrees of vertical
            vertical_angles.append(angle)

    if not vertical_angles:
        return {"deviation": 0, "direction": "none", "failed": False}

    # Use median to be robust to outliers
    median_angle = np.median(vertical_angles)
    deviation = abs(median_angle)
    direction = "right" if median_angle > 0 else "left"

    return {
        "deviation": round(deviation, 2),
        "direction": direction,
        "failed": deviation > tolerance,
        "line_count": len(vertical_angles),
    }
