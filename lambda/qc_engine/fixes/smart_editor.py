"""
Smart Auto-Editor

Translates Claude Vision's fix_actions and category issues into actual
image edits using OpenCV / NumPy. The goal is to push photos ACROSS the
QC threshold, not just flag them.

Operations supported:
- Highlight recovery (flatten ceiling/counter highlights)
- Shadow lift (brighten crushed shadows)
- Tone curve (S-curve for microcontrast)
- Selective HSL (reduce oversaturated greens / sky / warm bias)
- Global warm/cool nudge (small WB shifts)
- Clarity / local contrast boost
- Gentle sharpening

All operations are clamped so no single adjustment can destroy the photo.
"""

import cv2
import numpy as np
import tempfile


def _apply_tone_curve(img: np.ndarray, highlights: int = 0, shadows: int = 0, contrast: int = 0) -> np.ndarray:
    """
    Apply tone curve adjustments.
    highlights: -20 to +20 (negative = recover/flatten, positive = boost)
    shadows:    -20 to +20 (positive = lift, negative = deepen)
    contrast:   -20 to +20 (S-curve strength)
    """
    lut = np.arange(256, dtype=np.float32)

    if highlights != 0:
        # Highlights: affect pixels 180-255, curve them down/up
        amount = highlights * 0.3
        mask = np.clip((lut - 180) / 75, 0, 1)
        lut = lut + (amount * mask)

    if shadows != 0:
        # Shadows: affect pixels 0-75, lift/deepen
        amount = shadows * 0.4
        mask = np.clip((75 - lut) / 75, 0, 1)
        lut = lut + (amount * mask)

    if contrast != 0:
        # S-curve: midpoint around 128
        amount = contrast * 0.01
        normalized = (lut - 128) / 128
        sign = np.sign(normalized)
        # Apply sigmoid-like curve
        lut = 128 + sign * np.abs(normalized) ** (1 - amount) * 128

    lut = np.clip(lut, 0, 255).astype(np.uint8)
    return cv2.LUT(img, lut)


def _selective_hsl(
    img: np.ndarray,
    green_sat: int = 0,
    blue_sat: int = 0,
    orange_sat: int = 0,
) -> np.ndarray:
    """
    Reduce/boost saturation of specific hue ranges.
    green_sat, blue_sat, orange_sat: -30 to +30 (negative = desaturate)
    """
    if green_sat == 0 and blue_sat == 0 and orange_sat == 0:
        return img

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)

    # H in 0-179 in OpenCV
    # Green: 35-85
    # Blue (sky): 90-130
    # Orange/warm: 5-25 OR 165-179
    if green_sat != 0:
        mask = ((hsv[:, :, 0] >= 35) & (hsv[:, :, 0] <= 85)).astype(np.float32)
        mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=5)
        hsv[:, :, 1] += green_sat * mask * 2.55

    if blue_sat != 0:
        mask = ((hsv[:, :, 0] >= 90) & (hsv[:, :, 0] <= 130)).astype(np.float32)
        mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=5)
        hsv[:, :, 1] += blue_sat * mask * 2.55

    if orange_sat != 0:
        mask1 = (hsv[:, :, 0] <= 25).astype(np.float32)
        mask2 = (hsv[:, :, 0] >= 165).astype(np.float32)
        mask = cv2.GaussianBlur(mask1 + mask2, (0, 0), sigmaX=5)
        hsv[:, :, 1] += orange_sat * mask * 2.55

    hsv[:, :, 1] = np.clip(hsv[:, :, 1], 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def _wb_nudge(img: np.ndarray, warm_cool: int = 0, tint: int = 0) -> np.ndarray:
    """
    Small global WB adjustments.
    warm_cool: -15 to +15 (negative = cooler/more blue, positive = warmer/more yellow)
    tint:      -15 to +15 (negative = more green, positive = more magenta)
    """
    if warm_cool == 0 and tint == 0:
        return img

    b, g, r = cv2.split(img.astype(np.float32))

    # Warm/cool: shift red-blue balance
    if warm_cool != 0:
        amt = warm_cool * 0.004
        r = r * (1 + amt)
        b = b * (1 - amt)

    # Tint: shift green-magenta
    if tint != 0:
        amt = tint * 0.004
        g = g * (1 - amt)
        r = r * (1 + amt * 0.5)
        b = b * (1 + amt * 0.5)

    b = np.clip(b, 0, 255)
    g = np.clip(g, 0, 255)
    r = np.clip(r, 0, 255)
    return cv2.merge([b.astype(np.uint8), g.astype(np.uint8), r.astype(np.uint8)])


def _local_contrast(img: np.ndarray, amount: int = 0) -> np.ndarray:
    """
    Add micro-contrast / clarity using unsharp mask on the L channel.
    amount: 0-20 (0 = no change)
    """
    if amount == 0:
        return img

    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    blurred = cv2.GaussianBlur(l, (0, 0), sigmaX=12)
    strength = amount / 40.0  # 0-0.5
    l_enhanced = cv2.addWeighted(l, 1 + strength, blurred, -strength, 0)

    lab = cv2.merge([l_enhanced, a, b])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


# Keyword -> adjustment mapping
# These are small, safe adjustments based on what Claude Vision detected.
# If Claude flags an issue in a category, we apply the corresponding nudge.
ADJUSTMENT_MAP = {
    # Exposure
    "ceiling_highlights_flat": {"highlights": -8},
    "counter_highlight_flat": {"highlights": -6},
    "minor_overexposure_upper_range": {"highlights": -10},
    "highlight_clipping": {"highlights": -12},
    "window_blowout": {"highlights": -14},
    "shadow_crush": {"shadows": 12},
    "shadow_density_high": {"shadows": 8},
    "muddy_midtones": {"contrast": 8},
    "flat_hdr": {"contrast": 10, "local_contrast": 8},
    "low_microcontrast": {"local_contrast": 10},
    "window_underexposed_relative": {"shadows": 10},
    "too_dark": {"shadows": 15, "highlights": 5},
    "too_bright": {"highlights": -12, "shadows": -5},

    # White balance (small nudges only)
    "wb_slightly_warm": {"warm_cool": -4},
    "wb_slightly_cool": {"warm_cool": 4},
    "wb_too_warm": {"warm_cool": -8},
    "wb_too_cool": {"warm_cool": 8},
    "green_cast": {"tint": 6, "green_sat": -10},
    "green_shadow_cast": {"tint": 4},
    "magenta_cast": {"tint": -6},
    "neutral_surfaces_not_neutral": {"warm_cool": -2, "tint": 2},

    # Saturation / polish
    "sky_oversaturated_minor": {"blue_sat": -6},
    "sky_oversaturated": {"blue_sat": -10},
    "greens_slightly_boosted": {"green_sat": -5},
    "oversaturated": {"green_sat": -8, "blue_sat": -8, "orange_sat": -5},

    # Sharpness (handled by separate sharpness_fix module, but boost here for low values)
    "soft_focus": {"local_contrast": 6},
}


def smart_fix(
    image_path: str,
    full_analysis: dict | None = None,
    issues: dict | None = None,
) -> tuple[str | None, list[str]]:
    """
    Apply smart, targeted fixes based on Claude's category issues.
    Returns (path_to_fixed_image, list_of_operations_applied).
    Returns (None, []) if no fixes were needed or applied.
    """
    if not full_analysis and not issues:
        return None, []

    img = cv2.imread(image_path)
    if img is None:
        return None, []

    # Accumulate adjustments from all detected issues
    adjustments = {
        "highlights": 0,
        "shadows": 0,
        "contrast": 0,
        "local_contrast": 0,
        "warm_cool": 0,
        "tint": 0,
        "green_sat": 0,
        "blue_sat": 0,
        "orange_sat": 0,
    }

    applied_labels = []

    # Collect all issue keys from the analysis
    issue_keys = set()
    if full_analysis:
        categories = full_analysis.get("categories", {})
        for cat_data in categories.values():
            for issue in cat_data.get("issues", []):
                issue_keys.add(issue)
    if issues:
        for k in issues.keys():
            if not k.startswith("_"):
                issue_keys.add(k)

    # Map each detected issue to its adjustments
    for issue in issue_keys:
        adj = ADJUSTMENT_MAP.get(issue)
        if not adj:
            continue
        applied_labels.append(issue)
        for key, val in adj.items():
            # Average if multiple issues map to same adjustment
            if adjustments[key] == 0:
                adjustments[key] = val
            else:
                adjustments[key] = (adjustments[key] + val) / 2

    # Clamp all adjustments to safe ranges
    for key in ["highlights", "shadows", "contrast"]:
        adjustments[key] = max(-20, min(20, int(adjustments[key])))
    for key in ["warm_cool", "tint"]:
        adjustments[key] = max(-12, min(12, int(adjustments[key])))
    for key in ["green_sat", "blue_sat", "orange_sat"]:
        adjustments[key] = max(-20, min(10, int(adjustments[key])))
    adjustments["local_contrast"] = max(0, min(15, int(adjustments["local_contrast"])))

    # If no meaningful adjustments, skip
    total_adjustment = sum(abs(v) for v in adjustments.values())
    if total_adjustment == 0:
        return None, []

    # Apply in order: tone curve, then WB, then selective HSL, then local contrast
    out = img.copy()

    if adjustments["highlights"] != 0 or adjustments["shadows"] != 0 or adjustments["contrast"] != 0:
        out = _apply_tone_curve(
            out,
            highlights=adjustments["highlights"],
            shadows=adjustments["shadows"],
            contrast=adjustments["contrast"],
        )

    if adjustments["warm_cool"] != 0 or adjustments["tint"] != 0:
        out = _wb_nudge(
            out, warm_cool=adjustments["warm_cool"], tint=adjustments["tint"]
        )

    if (
        adjustments["green_sat"] != 0
        or adjustments["blue_sat"] != 0
        or adjustments["orange_sat"] != 0
    ):
        out = _selective_hsl(
            out,
            green_sat=adjustments["green_sat"],
            blue_sat=adjustments["blue_sat"],
            orange_sat=adjustments["orange_sat"],
        )

    if adjustments["local_contrast"] > 0:
        out = _local_contrast(out, amount=adjustments["local_contrast"])

    # Save
    suffix = "." + image_path.split(".")[-1]
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    cv2.imwrite(tmp.name, out, [cv2.IMWRITE_JPEG_QUALITY, 95])

    # Build human-readable description of what was applied
    ops = []
    if adjustments["highlights"] < 0:
        ops.append(f"Highlights recovered ({adjustments['highlights']})")
    elif adjustments["highlights"] > 0:
        ops.append(f"Highlights boosted (+{adjustments['highlights']})")
    if adjustments["shadows"] > 0:
        ops.append(f"Shadows lifted (+{adjustments['shadows']})")
    elif adjustments["shadows"] < 0:
        ops.append(f"Shadows deepened ({adjustments['shadows']})")
    if adjustments["contrast"] != 0:
        ops.append(f"Contrast {'+' if adjustments['contrast'] > 0 else ''}{adjustments['contrast']}")
    if adjustments["local_contrast"] > 0:
        ops.append(f"Microcontrast +{adjustments['local_contrast']}")
    if adjustments["warm_cool"] != 0:
        dir_ = "warmer" if adjustments["warm_cool"] > 0 else "cooler"
        ops.append(f"WB {abs(adjustments['warm_cool'])} {dir_}")
    if adjustments["tint"] != 0:
        dir_ = "magenta" if adjustments["tint"] > 0 else "green removed"
        ops.append(f"Tint toward {dir_}")
    if adjustments["green_sat"] < 0:
        ops.append(f"Greens desaturated ({adjustments['green_sat']})")
    if adjustments["blue_sat"] < 0:
        ops.append(f"Sky desaturated ({adjustments['blue_sat']})")
    if adjustments["orange_sat"] != 0:
        ops.append(f"Warms {'+' if adjustments['orange_sat'] > 0 else ''}{adjustments['orange_sat']}")

    return tmp.name, ops
