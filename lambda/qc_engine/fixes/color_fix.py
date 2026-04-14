"""
Conservative White Balance Fix

Only fixes clear pathologies (green fluorescent cast primarily).
Outdoor exteriors and already-neutral photos are NEVER touched.
Corrections are clamped to small magnitude - we'd rather under-correct
than destroy a good photo.
"""

import cv2
import numpy as np
import tempfile


# Maximum allowed channel scale - prevents destructive shifts
MAX_SCALE = 1.10  # Never push a channel by more than 10%
MIN_SCALE = 0.92  # Or pull it down more than 8%


def fix_color(image_path: str, color_result: dict) -> str | None:
    """
    Conservative WB correction. Only runs when:
    1. should_autofix flag is True (severity > 0.4 AND cast is reliably detected)
    2. Photo is interior (exteriors are skipped)
    3. We have neutral anchor reference points
    """
    # GATE 1: Only proceed if the check explicitly flagged for auto-fix
    if not color_result.get("should_autofix", False):
        return None

    # GATE 2: Never fix exteriors
    if color_result.get("is_exterior", False):
        return None

    # GATE 3: Don't touch already-neutral photos
    if color_result.get("already_neutral", False):
        return None

    img = cv2.imread(image_path)
    if img is None:
        return None

    cast = color_result.get("color_cast")
    cast_strength = color_result.get("cast_strength", 0)

    # Only apply targeted corrections for known cast types
    # The MAGNITUDE of correction is capped by cast_strength
    # Even severe casts get only modest adjustments
    img_float = img.astype(np.float64)
    b, g, r = cv2.split(img_float)

    scale_b, scale_g, scale_r = 1.0, 1.0, 1.0

    if cast == "green":
        # Reduce green slightly, boost magenta minimally
        # Scale down green by up to 8% based on severity
        reduction = min(cast_strength * 0.5, 0.08)
        scale_g = 1.0 - reduction
        scale_r = 1.0 + reduction * 0.3
        scale_b = 1.0 + reduction * 0.3
    elif cast == "orange":
        # Reduce red, boost blue minimally
        reduction = min(cast_strength * 0.4, 0.06)
        scale_r = 1.0 - reduction
        scale_b = 1.0 + reduction * 0.5
    elif cast == "blue":
        # Reduce blue, boost red minimally
        reduction = min(cast_strength * 0.4, 0.06)
        scale_b = 1.0 - reduction
        scale_r = 1.0 + reduction * 0.4
    else:
        # No clear cast - don't fix
        return None

    # CLAMP scales to safe range - prevent destructive shifts
    scale_b = max(MIN_SCALE, min(MAX_SCALE, scale_b))
    scale_g = max(MIN_SCALE, min(MAX_SCALE, scale_g))
    scale_r = max(MIN_SCALE, min(MAX_SCALE, scale_r))

    # If clamping reduced our shift to nothing meaningful, skip
    if (
        abs(scale_b - 1) < 0.015
        and abs(scale_g - 1) < 0.015
        and abs(scale_r - 1) < 0.015
    ):
        return None

    b_corrected = np.clip(b * scale_b, 0, 255)
    g_corrected = np.clip(g * scale_g, 0, 255)
    r_corrected = np.clip(r * scale_r, 0, 255)

    corrected = cv2.merge([
        b_corrected.astype(np.uint8),
        g_corrected.astype(np.uint8),
        r_corrected.astype(np.uint8),
    ])

    # Verify the correction actually moved chromaticity toward neutral
    # If it made things worse, abandon the fix
    lab_orig = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    lab_new = cv2.cvtColor(corrected, cv2.COLOR_BGR2LAB)

    a_orig = abs(lab_orig[:, :, 1].astype(np.float64).mean() - 128)
    b_orig = abs(lab_orig[:, :, 2].astype(np.float64).mean() - 128)
    a_new = abs(lab_new[:, :, 1].astype(np.float64).mean() - 128)
    b_new = abs(lab_new[:, :, 2].astype(np.float64).mean() - 128)

    # Sum of chromaticity should decrease
    if (a_new + b_new) >= (a_orig + b_orig):
        # Fix didn't actually help - throw it out
        return None

    suffix = "." + image_path.split(".")[-1]
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    cv2.imwrite(tmp.name, corrected, [cv2.IMWRITE_JPEG_QUALITY, 95])

    return tmp.name
