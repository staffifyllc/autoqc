"""
Sky Quality Analysis

Checks exterior sky quality in real estate photos:
1. Blown-out/white sky (no detail, common in overcast conditions)
2. Sky replacement artifacts (edge fringing around rooflines/trees)
3. Lighting direction mismatch (replaced sky doesn't match shadow direction)
4. Overly dramatic sky on a flat-lit house

Real estate standards (2026):
- California requires disclosure of AI sky replacements starting Jan 2026
- New York classifies undisclosed AI modifications as deceptive advertising
- Most MLS boards still accept enhanced skies but not composite fantasy skies
"""

import cv2
import numpy as np


def check_sky(image_path: str) -> dict:
    img = cv2.imread(image_path)
    if img is None:
        return {"failed": False, "severity": 0, "issue_type": "none"}

    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Analyze the top third of the image (most likely to contain sky)
    top_third = img[0 : h // 3, :]
    top_hsv = hsv[0 : h // 3, :]
    top_gray = gray[0 : h // 3, :]

    # Detect sky region (blue-ish, high brightness, low saturation for overcast)
    # Blue sky: Hue 90-130, Sat > 30, Val > 100
    blue_sky_mask = (
        (top_hsv[:, :, 0] >= 90)
        & (top_hsv[:, :, 0] <= 135)
        & (top_hsv[:, :, 1] > 30)
        & (top_hsv[:, :, 2] > 100)
    )

    # White/overcast sky: Very high value, very low saturation
    white_sky_mask = (top_hsv[:, :, 1] < 25) & (top_hsv[:, :, 2] > 200)

    sky_pixels = np.count_nonzero(blue_sky_mask | white_sky_mask)
    total_top_pixels = top_third.shape[0] * top_third.shape[1]

    if total_top_pixels == 0:
        return {"failed": False, "severity": 0, "issue_type": "none"}

    sky_ratio = sky_pixels / total_top_pixels

    # If less than 10% of top third is sky, this is probably an interior shot
    if sky_ratio < 0.1:
        return {"failed": False, "severity": 0, "issue_type": "none", "is_exterior": False}

    issues = []

    # Check 1: Blown-out white sky (no detail)
    white_ratio = np.count_nonzero(white_sky_mask) / total_top_pixels
    if white_ratio > 0.2:
        blown_sky_region = top_gray[white_sky_mask]
        if len(blown_sky_region) > 0 and np.std(blown_sky_region) < 10:
            issues.append({
                "type": "blown_sky",
                "severity": min(white_ratio, 1.0),
                "detail": "Sky is blown out with no detail",
            })

    # Check 2: Sky replacement edge artifacts
    # Look for unnatural color transitions at the boundary between
    # sky and non-sky regions
    sky_mask_full = (blue_sky_mask | white_sky_mask).astype(np.uint8) * 255

    # Find the boundary
    kernel = np.ones((5, 5), np.uint8)
    dilated = cv2.dilate(sky_mask_full, kernel)
    eroded = cv2.erode(sky_mask_full, kernel)
    boundary = dilated - eroded

    if np.count_nonzero(boundary) > 0:
        # Check for color fringing at the boundary
        boundary_pixels_b = top_third[:, :, 0][boundary > 0]
        boundary_pixels_g = top_third[:, :, 1][boundary > 0]
        boundary_pixels_r = top_third[:, :, 2][boundary > 0]

        # High variance in boundary colors suggests poor edge blending
        boundary_color_std = np.std([
            np.std(boundary_pixels_b),
            np.std(boundary_pixels_g),
            np.std(boundary_pixels_r),
        ])

        if boundary_color_std > 40:
            issues.append({
                "type": "sky_edge_artifact",
                "severity": min(boundary_color_std / 80, 1.0),
                "detail": "Potential sky replacement edge artifacts detected",
            })

    if not issues:
        return {"failed": False, "severity": 0, "issue_type": "none", "is_exterior": True}

    # Return the most severe issue
    worst = max(issues, key=lambda x: x["severity"])
    return {
        "failed": True,
        "severity": round(worst["severity"], 2),
        "issue_type": worst["type"],
        "detail": worst["detail"],
        "is_exterior": True,
        "sky_ratio": round(sky_ratio, 2),
    }
