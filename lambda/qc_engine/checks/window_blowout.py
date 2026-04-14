"""
Window Blowout Detection

Detects blown-out windows in interior shots. One of the most common
issues in real estate photography - interior is properly exposed but
the view through windows is completely white/blown.

Good RE photos should have:
- Interior properly exposed
- Exterior view through windows visible (not blown out)
- Clean blend mask edges around window mullions and frames

This is the #1 indicator of amateur RE photography vs professional
flash-ambient or HDR blending.
"""

import cv2
import numpy as np


def check_window_blowout(image_path: str) -> dict:
    img = cv2.imread(image_path)
    if img is None:
        return {"failed": False, "severity": 0}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # Find very bright rectangular regions (potential windows)
    # Windows are typically bright rectangular areas

    # Threshold for blown highlights
    _, bright_mask = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY)

    # Find contours of bright regions
    contours, _ = cv2.findContours(
        bright_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    window_regions = []
    total_bright_area = 0

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < (h * w * 0.005):  # Too small to be a window
            continue

        x, y, cw, ch = cv2.boundingRect(cnt)
        aspect_ratio = cw / ch if ch > 0 else 0

        # Windows are typically rectangular with reasonable aspect ratios
        # and not at the very bottom of the image (that would be a floor reflection)
        is_window_like = (
            0.3 < aspect_ratio < 4.0  # Reasonable window shape
            and y < h * 0.8  # Not at the very bottom
            and area > (h * w * 0.01)  # Significant size
        )

        if is_window_like:
            # Check if the region is uniformly bright (blown out)
            region = gray[y : y + ch, x : x + cw]
            mean_brightness = np.mean(region)
            std_brightness = np.std(region)

            # Blown windows have very high mean and low std (uniformly white)
            if mean_brightness > 240 and std_brightness < 15:
                window_regions.append({
                    "x": x, "y": y, "w": cw, "h": ch,
                    "brightness": float(mean_brightness),
                })
                total_bright_area += area

    # Calculate what percentage of the image is blown windows
    blown_percentage = total_bright_area / (h * w) * 100

    # Fail if there are significant blown window regions
    failed = len(window_regions) > 0 and blown_percentage > 2.0
    severity = min(blown_percentage / 15.0, 1.0) if failed else 0

    return {
        "failed": failed,
        "severity": round(severity, 2),
        "count": len(window_regions),
        "blown_percentage": round(blown_percentage, 1),
        "regions": window_regions[:5],  # Limit to 5 regions
    }
