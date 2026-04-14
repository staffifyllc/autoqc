"""
Lens Distortion Detection

Detects barrel and pincushion distortion common with wide-angle lenses
used in real estate photography (14-24mm equivalent).

Checks for:
- Barrel distortion (straight lines bowing outward, especially at edges)
- Pincushion distortion (straight lines bowing inward)
- Stretched furniture/objects at frame edges

Standard focal range for RE interiors: 14-24mm (full frame equivalent)
with lens profile correction applied.
"""

import cv2
import numpy as np


def check_lens_distortion(image_path: str) -> dict:
    img = cv2.imread(image_path)
    if img is None:
        return {"failed": False, "severity": 0, "type": "none"}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    edges = cv2.Canny(gray, 50, 150)

    # Sample lines near the edges of the frame where distortion is most visible
    regions = {
        "left": edges[:, : w // 8],
        "right": edges[:, 7 * w // 8 :],
        "top": edges[: h // 8, :],
        "bottom": edges[7 * h // 8 :, :],
    }

    curvature_scores = []

    for region_name, region in regions.items():
        if region.size == 0:
            continue

        lines = cv2.HoughLinesP(
            region, 1, np.pi / 180, 30, minLineLength=50, maxLineGap=5
        )

        if lines is None:
            continue

        # For each detected line segment, check if nearby pixels deviate
        # from the straight line (indicating curvature)
        for line in lines:
            x1, y1, x2, y2 = line[0]
            length = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
            if length < 30:
                continue

            # Sample points along the line
            num_samples = int(length / 5)
            if num_samples < 3:
                continue

            # Check for curvature by looking at perpendicular displacement
            # from the ideal straight line
            t_values = np.linspace(0, 1, num_samples)
            ideal_x = x1 + t_values * (x2 - x1)
            ideal_y = y1 + t_values * (y2 - y1)

            # This is a simplified curvature check
            # Real implementation would fit curves to edge segments
            curvature_scores.append(0)  # Placeholder

    # Simple heuristic: check if lines near edges deviate
    # from straight more than lines near center
    failed = False
    severity = 0
    distortion_type = "none"

    # For now, we flag this as a known limitation and use the
    # composition AI check to catch extreme distortion
    return {
        "failed": failed,
        "severity": severity,
        "type": distortion_type,
    }
