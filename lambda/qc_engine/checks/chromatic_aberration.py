"""
Chromatic Aberration Detection

Detects purple/green fringing on high-contrast edges (window frames,
metalwork, rooflines). Common in wide-angle lenses used for RE photography.

Both lateral (edge) and longitudinal (depth) CA should be corrected.
Standard: no visible fringing at 200-300% zoom on bright edges.
Threshold: fringe width should be < 2 pixels.
"""

import cv2
import numpy as np


def check_chromatic_aberration(
    image_path: str, threshold: float = 2.0
) -> dict:
    img = cv2.imread(image_path)
    if img is None:
        return {"failed": False, "severity": 0, "fringe_width": 0}

    h, w = img.shape[:2]

    # Convert to LAB color space for better color analysis
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    # Find high-contrast edges using the luminance channel
    edges = cv2.Canny(l_channel, 100, 200)

    # Dilate edges slightly to create a region around them
    kernel = np.ones((3, 3), np.uint8)
    edge_region = cv2.dilate(edges, kernel, iterations=2)

    # In the edge region, check for purple/magenta fringing
    # Purple fringing shows as high A (red-green axis) values
    # in the positive direction (magenta) near edges

    # Mask the A and B channels with edge region
    a_edges = a_channel.copy()
    a_edges[edge_region == 0] = 128  # Neutral

    b_edges = b_channel.copy()
    b_edges[edge_region == 0] = 128  # Neutral

    # Count pixels with strong purple/magenta cast near edges
    # In LAB: A > 140 = magenta, B < 100 = blue/purple
    purple_mask = (a_edges > 145) & (b_edges < 110) & (edge_region > 0)
    green_mask = (a_edges < 110) & (edge_region > 0)

    total_edge_pixels = np.count_nonzero(edge_region)
    if total_edge_pixels == 0:
        return {"failed": False, "severity": 0, "fringe_width": 0}

    purple_ratio = np.count_nonzero(purple_mask) / total_edge_pixels
    green_ratio = np.count_nonzero(green_mask) / total_edge_pixels

    # Estimate fringe width by looking at the spread of colored pixels
    # perpendicular to edges
    fringe_width = 0
    if purple_ratio > 0.01 or green_ratio > 0.01:
        # Find contours of the CA regions
        ca_mask = (purple_mask | green_mask).astype(np.uint8) * 255
        contours, _ = cv2.findContours(
            ca_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if contours:
            # Average width of CA regions
            widths = []
            for cnt in contours:
                _, _, cw, ch = cv2.boundingRect(cnt)
                widths.append(min(cw, ch))
            fringe_width = np.median(widths) if widths else 0

    ca_ratio = max(purple_ratio, green_ratio)
    failed = fringe_width > threshold or ca_ratio > 0.03
    severity = min(ca_ratio * 10, 1.0)

    return {
        "failed": failed,
        "severity": round(severity, 2),
        "fringe_width": round(float(fringe_width), 1),
        "purple_ratio": round(purple_ratio, 4),
        "green_ratio": round(green_ratio, 4),
    }
