"""
White Balance & Color Detection (Real Estate Edition)

Built on research findings: gray-world fails catastrophically on outdoor scenes
because grass + sky + pool dominate average chromaticity, causing magenta/pink casts
when "corrected." Industry best practice:

1. SKIP outdoor exteriors entirely (sky-present scenes never need auto-WB)
2. Pre-gate using Lab chromaticity - if already neutral, skip
3. Use neutral-surface anchors (ceiling, trim) when present
4. Default to FLAG, not FIX - only auto-fix clear pathologies (green fluorescent)
5. Clamp any correction to small magnitude (no destructive shifts)

Sources: Van de Weijer & Gevers 2007, Finlayson & Trezzi 2004 (Shades of Gray),
Hsu et al. SIGGRAPH 2008 (mixed lighting), Imagen AI / professional QC practice.
"""

import cv2
import numpy as np


def is_exterior_scene(img_bgr: np.ndarray) -> bool:
    """
    Detect if image is an outdoor/exterior shot.
    These should NEVER receive auto-WB correction - too much chromatic
    variation (grass, sky, water) breaks every classical WB algorithm.
    """
    h, w = img_bgr.shape[:2]
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)

    # Check top 25% of image for sky-like pixels
    top = hsv[: h // 4, :]
    # Blue sky: hue 90-130, saturation > 25, brightness > 100
    blue_sky_mask = (
        (top[:, :, 0] >= 90) & (top[:, :, 0] <= 135) &
        (top[:, :, 1] > 25) & (top[:, :, 2] > 100)
    )
    # Bright overcast sky: very low saturation, high brightness
    bright_sky_mask = (top[:, :, 1] < 30) & (top[:, :, 2] > 220)

    sky_pixels = np.count_nonzero(blue_sky_mask | bright_sky_mask)
    sky_ratio = sky_pixels / top.size * 3  # divide by channels

    # Green grass detection (bottom half, hue 35-80, sat > 40)
    bottom = hsv[h // 2:, :]
    grass_mask = (
        (bottom[:, :, 0] >= 35) & (bottom[:, :, 0] <= 80) &
        (bottom[:, :, 1] > 40)
    )
    grass_ratio = np.count_nonzero(grass_mask) / bottom.size * 3

    return sky_ratio > 0.15 or grass_ratio > 0.15


def chromaticity_neutrality(img_bgr: np.ndarray) -> tuple[float, float]:
    """
    Measure how neutral the image already is using Lab a*, b* mean.
    A well-edited photo should have mean |a*| < 4 and |b*| < 6.
    Returns (a_deviation, b_deviation) - both should be near 0.
    """
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    # OpenCV stores a* and b* offset by 128 (range 0-255)
    a_centered = lab[:, :, 1].astype(np.float64) - 128
    b_centered = lab[:, :, 2].astype(np.float64) - 128
    return float(abs(a_centered.mean())), float(abs(b_centered.mean()))


def detect_neutral_anchors(img_bgr: np.ndarray) -> dict:
    """
    Find pixels that SHOULD be neutral (ceiling, white trim, white walls).
    Returns the average color of these "should be neutral" pixels.
    If they deviate significantly from neutral, that's our true cast.
    """
    h, w = img_bgr.shape[:2]
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)

    # Ceiling region: top 20% of image
    ceiling_region = img_bgr[: h // 5, :]
    ceiling_hsv = hsv[: h // 5, :]

    # Look for low-saturation, high-brightness pixels (white-ish surfaces)
    neutral_mask = (ceiling_hsv[:, :, 1] < 25) & (ceiling_hsv[:, :, 2] > 180)

    if np.count_nonzero(neutral_mask) < 100:
        return {"found": False}

    neutral_pixels = ceiling_region[neutral_mask]
    avg_b = neutral_pixels[:, 0].mean()
    avg_g = neutral_pixels[:, 1].mean()
    avg_r = neutral_pixels[:, 2].mean()
    avg = (avg_b + avg_g + avg_r) / 3

    return {
        "found": True,
        "pixel_count": int(np.count_nonzero(neutral_mask)),
        "b_dev": float((avg_b - avg) / avg),
        "g_dev": float((avg_g - avg) / avg),
        "r_dev": float((avg_r - avg) / avg),
    }


def estimate_color_temperature(img_bgr: np.ndarray) -> float:
    """Approximate CCT from B/R channel ratio."""
    b, g, r = cv2.split(img_bgr.astype(np.float64))
    r_mean = max(np.mean(r), 1)
    b_mean = max(np.mean(b), 1)
    br_ratio = b_mean / r_mean
    cct = 2000 + (br_ratio * 4000)
    return max(2000, min(12000, cct))


def check_color(
    image_path: str,
    temp_min: float = 2800,
    temp_max: float = 7500,
) -> dict:
    """
    Conservative WB check. Only flags clear, severe issues.
    Outdoor exteriors are skipped entirely (never auto-WB).
    """
    img = cv2.imread(image_path)
    if img is None:
        return {
            "color_temp": 5500,
            "saturation": 50,
            "failed": False,
            "severity": 0,
            "color_cast": None,
            "is_exterior": False,
            "should_autofix": False,
        }

    # Scene classification - exterior shots are skipped
    is_exterior = is_exterior_scene(img)

    color_temp = estimate_color_temperature(img)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    saturation = float(np.mean(hsv[:, :, 1]) / 255 * 100)

    # Pre-gate: if already neutral, no fix needed
    a_dev, b_dev = chromaticity_neutrality(img)
    already_neutral = a_dev < 5 and b_dev < 7

    # If exterior or already neutral, only flag for severe issues, never auto-fix
    if is_exterior or already_neutral:
        # Only flag truly extreme cases
        failed = color_temp < 2200 or color_temp > 9000
        return {
            "color_temp": round(color_temp, 0),
            "saturation": round(saturation, 1),
            "color_cast": None,
            "cast_strength": 0,
            "failed": failed,
            "severity": 0.3 if failed else 0,
            "is_exterior": is_exterior,
            "already_neutral": already_neutral,
            "should_autofix": False,  # Never auto-fix exteriors or already-neutral
            "a_dev": a_dev,
            "b_dev": b_dev,
        }

    # Interior, possibly off WB - check via neutral anchor detection
    anchors = detect_neutral_anchors(img)

    cast = None
    cast_strength = 0
    if anchors["found"]:
        # Use ceiling/trim as ground truth for what should be neutral
        if anchors["g_dev"] > 0.05:
            cast = "green"  # Fluorescent lighting - PRIORITY FIX
            cast_strength = anchors["g_dev"]
        elif anchors["r_dev"] > 0.08:
            cast = "orange"  # Tungsten / golden hour
            cast_strength = anchors["r_dev"]
        elif anchors["b_dev"] > 0.08:
            cast = "blue"  # Shade or overcorrected daylight
            cast_strength = anchors["b_dev"]

    # Determine severity - only severe casts get auto-fixed
    failed = False
    severity = 0
    should_autofix = False

    if cast == "green" and cast_strength > 0.05:
        # Green fluorescent cast is the only thing we reliably auto-fix
        # because it's almost always a defect, never intentional
        failed = True
        severity = min(cast_strength * 4, 1.0)
        should_autofix = severity > 0.4

    elif cast and cast_strength > 0.15:
        # Other strong casts: flag but don't auto-fix
        # User may have intentional warm/cool styling
        failed = True
        severity = min(cast_strength * 2, 1.0)
        should_autofix = False  # Don't touch - could be intentional

    # Color temp out of acceptable range (very wide tolerance)
    if color_temp < temp_min or color_temp > temp_max:
        # Only flag if severely out of range (not for stylistic warmth/coolness)
        deviation = max(temp_min - color_temp, color_temp - temp_max)
        if deviation > 1500:
            failed = True
            severity = max(severity, min(deviation / 3000, 1.0))

    return {
        "color_temp": round(color_temp, 0),
        "saturation": round(saturation, 1),
        "color_cast": cast,
        "cast_strength": round(cast_strength, 3),
        "failed": failed,
        "severity": round(severity, 2),
        "is_exterior": is_exterior,
        "already_neutral": already_neutral,
        "should_autofix": should_autofix,
        "anchors_found": anchors.get("found", False),
        "a_dev": a_dev,
        "b_dev": b_dev,
    }
