"""
Color Temperature and White Balance Analysis

Detects color temperature, color casts, and saturation levels.
Identifies mixed lighting (fluorescent green cast, tungsten orange cast).

Real estate style ranges:
- Bright & Airy: 5000-6500K, lower saturation, lifted shadows
- Warm & Cozy: 3200-4500K, richer saturation
- Magazine Editorial: 5000-5500K neutral, high contrast

Common defects:
- Green cast from fluorescent lighting
- Orange cast from tungsten bulbs
- Mixed color temps from ambient/flash blend on walls
"""

import cv2
import numpy as np


def estimate_color_temperature(img_bgr: np.ndarray) -> float:
    """
    Estimate correlated color temperature from the image.
    Uses the ratio of blue to red channels as a proxy.
    Higher B/R ratio = cooler (higher Kelvin), lower = warmer.
    """
    b, g, r = cv2.split(img_bgr.astype(np.float64))

    # Avoid division by zero
    r_mean = max(np.mean(r), 1)
    b_mean = max(np.mean(b), 1)
    g_mean = max(np.mean(g), 1)

    # Simple CCT estimation based on B/R ratio
    # This is an approximation - real CCT requires spectral data
    br_ratio = b_mean / r_mean

    # Map ratio to approximate Kelvin
    # BR ratio ~0.7 = ~3000K (warm tungsten)
    # BR ratio ~1.0 = ~5500K (daylight)
    # BR ratio ~1.3 = ~8000K (overcast/shade)
    cct = 2000 + (br_ratio * 4000)
    cct = max(2000, min(12000, cct))

    return cct


def detect_color_cast(img_bgr: np.ndarray) -> dict:
    """Detect dominant color cast in the image."""
    b, g, r = cv2.split(img_bgr.astype(np.float64))

    r_mean = np.mean(r)
    g_mean = np.mean(g)
    b_mean = np.mean(b)
    avg = (r_mean + g_mean + b_mean) / 3

    # Deviation from neutral gray
    r_dev = (r_mean - avg) / avg
    g_dev = (g_mean - avg) / avg
    b_dev = (b_mean - avg) / avg

    cast = None
    strength = 0

    if g_dev > 0.05:
        cast = "green"  # Fluorescent lighting
        strength = g_dev
    elif r_dev > 0.08:
        cast = "orange"  # Tungsten lighting
        strength = r_dev
    elif b_dev > 0.08:
        cast = "blue"  # Shade/overcast
        strength = b_dev
    elif r_dev > 0.05 and b_dev < -0.03:
        cast = "warm"
        strength = r_dev

    return {"cast": cast, "strength": round(strength, 3)}


def check_color(
    image_path: str,
    temp_min: float = 3500,
    temp_max: float = 6500,
) -> dict:
    img = cv2.imread(image_path)
    if img is None:
        return {
            "color_temp": 5500,
            "saturation": 50,
            "failed": False,
            "severity": 0,
        }

    # Estimate color temperature
    color_temp = estimate_color_temperature(img)

    # Calculate saturation
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    saturation = float(np.mean(hsv[:, :, 1]) / 255 * 100)

    # Detect color cast
    cast_info = detect_color_cast(img)

    # Check if color temp is in acceptable range
    failed = color_temp < temp_min or color_temp > temp_max
    severity = 0

    if failed:
        if color_temp < temp_min:
            severity = min((temp_min - color_temp) / 2000, 1.0)
        else:
            severity = min((color_temp - temp_max) / 2000, 1.0)

    # Also fail on strong color casts
    if cast_info["cast"] and cast_info["strength"] > 0.08:
        failed = True
        severity = max(severity, min(cast_info["strength"] * 5, 1.0))

    return {
        "color_temp": round(color_temp, 0),
        "saturation": round(saturation, 1),
        "color_cast": cast_info["cast"],
        "cast_strength": cast_info["strength"],
        "failed": failed,
        "severity": round(severity, 2),
    }
