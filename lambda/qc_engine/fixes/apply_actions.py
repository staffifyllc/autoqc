"""
Recommended-action executor.

Claude Vision returns a list of structured editing actions alongside
its human-readable fix_actions. This module applies them to the photo.

Scope (MVP): global Lightroom-style adjustments only. No local brushes,
no tone curves, no crop, no rotate. The existing verticals/horizon/color
fixes still run ahead of this step.

Every op has a hard magnitude cap. Claude cannot destroy a photo.

Returns (fixed_path, applied_list) or (None, []) if nothing ran.
"""

from __future__ import annotations

import os
import tempfile

import cv2
import numpy as np


# Hue ranges (OpenCV HSV: H 0-179, S 0-255, V 0-255). These mirror
# Lightroom's color range picker. Overlapping ranges are intentional.
_CHANNEL_HUE_RANGES = {
    "reds":     [(0, 10), (170, 179)],  # wraps around
    "oranges":  [(11, 22)],
    "yellows":  [(23, 33)],
    "greens":   [(34, 78)],
    "aquas":    [(79, 95)],
    "blues":    [(96, 128)],
    "purples":  [(129, 148)],
    "magentas": [(149, 169)],
}


# Hard caps per op. Absolute backstop, will never be exceeded.
_HARD_CAPS = {
    "exposure":            (-0.5, 0.5),
    "highlights":          (-25, 25),
    "shadows":             (-25, 25),
    "contrast":            (-20, 20),
    "saturation_global":   (-20, 20),
    "saturation_channel":  (-20, 20),
    "temperature":         (-10, 10),
    "tint":                (-10, 10),
}

# Soft caps. Applied UNCONDITIONALLY before _HARD_CAPS so even a
# Claude-recommended adjustment that's "within spec" gets pulled to a
# conservative magnitude. Set tighter than the prompt's stated range so
# Claude over-recommendation doesn't translate into washed-out output.
#
# Background: Realtour Pilot reported washed-out output 2026-05-03.
# Diagnostic showed the engine was applying highlights=-15 + shadows=+8
# + exposure=-0.2 on ~90% of photos regardless of need. That trio
# compresses the dynamic range and produces the classic flat HDR look.
# Halving the magnitudes keeps real fixes effective while preventing
# pile-on flattening when Claude over-recommends.
_SOFT_CAPS = {
    "exposure":            (-0.15, 0.15),
    "highlights":          (-8, 8),
    "shadows":             (-5, 5),
    "contrast":            (-10, 10),
    "saturation_global":   (-10, 10),
    "saturation_channel":  (-10, 10),
    "temperature":         (-5, 5),
    "tint":                (-5, 5),
}


def _clamp(value, op: str):
    """Clamp to soft cap first (conservative), then hard cap as a backstop."""
    try:
        v = float(value)
    except (TypeError, ValueError):
        return 0.0
    soft_lo, soft_hi = _SOFT_CAPS.get(op, (-100, 100))
    v = max(soft_lo, min(soft_hi, v))
    hard_lo, hard_hi = _HARD_CAPS.get(op, (-100, 100))
    return max(hard_lo, min(hard_hi, v))


# Backwards-compat alias. Some downstream code paths import _CAPS.
_CAPS = _HARD_CAPS


def _apply_exposure(img_f32: np.ndarray, stops: float) -> np.ndarray:
    """Linear brightness scale in stops of EV. +1 stop = 2x brightness."""
    return img_f32 * (2.0 ** stops)


def _apply_highlights(img_f32: np.ndarray, amount: float) -> np.ndarray:
    """Pull/push the upper tones. Amount in -25..+25 (Lightroom-ish scale)."""
    # Build a weighting mask: 0 in shadows, rises in highlights.
    v = np.mean(img_f32, axis=2, keepdims=True) / 255.0
    mask = np.clip((v - 0.5) * 2.0, 0.0, 1.0)  # 0 below mid, 1 at white
    mask = mask ** 2.0  # concentrate the effect in the real highlights
    factor = amount / 100.0  # -0.25 to +0.25
    return img_f32 + (255.0 * factor * mask)


def _apply_shadows(img_f32: np.ndarray, amount: float) -> np.ndarray:
    """Lift/crush the lower tones."""
    v = np.mean(img_f32, axis=2, keepdims=True) / 255.0
    mask = np.clip((0.5 - v) * 2.0, 0.0, 1.0)  # 0 above mid, 1 at black
    mask = mask ** 2.0
    factor = amount / 100.0
    return img_f32 + (255.0 * factor * mask)


def _apply_contrast(img_f32: np.ndarray, amount: float) -> np.ndarray:
    """Global contrast around mid-grey. Amount -20..+20 ~= Lightroom slider."""
    factor = 1.0 + (amount / 100.0)
    return (img_f32 - 128.0) * factor + 128.0


def _apply_saturation_global(img_f32: np.ndarray, amount: float) -> np.ndarray:
    # Guard: positive global saturation boosts produce fake-looking skies on
    # overcast exteriors (a subtle blue tint at the pixel level gets pumped
    # into aggressive cyan) and violate MLS ethics guidance against
    # sky replacement / oversaturation. Negative values (pulling overprocessed
    # photos back toward neutral) are the legitimate use case and still run.
    if amount > 0:
        print(
            f"INFO skipping saturation_global +{amount}: "
            "positive boosts are blocked to prevent fake-sky artifacts."
        )
        return img_f32
    hsv = cv2.cvtColor(img_f32.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = hsv[..., 1] * (1.0 + amount / 100.0)
    hsv[..., 1] = np.clip(hsv[..., 1], 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)


def _apply_saturation_channel(img_f32: np.ndarray, channel: str, amount: float) -> np.ndarray:
    """Per-channel saturation shift. Channel must match _CHANNEL_HUE_RANGES."""
    ranges = _CHANNEL_HUE_RANGES.get(channel)
    if not ranges:
        return img_f32
    hsv = cv2.cvtColor(img_f32.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    h = hsv[..., 0]
    mask = np.zeros_like(h, dtype=bool)
    for lo, hi in ranges:
        mask |= (h >= lo) & (h <= hi)
    scale = 1.0 + amount / 100.0
    hsv[..., 1] = np.where(mask, np.clip(hsv[..., 1] * scale, 0, 255), hsv[..., 1])
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)


def _apply_temperature(img_f32: np.ndarray, amount: float) -> np.ndarray:
    """Positive = warmer (more red/yellow), negative = cooler (more blue)."""
    factor = amount / 10.0  # -1.0 .. +1.0
    shift = factor * 12.0  # up to 12/255 shift per channel
    img_f32[..., 2] = img_f32[..., 2] + shift          # R (BGR)
    img_f32[..., 0] = img_f32[..., 0] - shift          # B
    return img_f32


def _apply_tint(img_f32: np.ndarray, amount: float) -> np.ndarray:
    """Positive = magenta, negative = green."""
    factor = amount / 10.0
    shift = factor * 8.0
    img_f32[..., 2] = img_f32[..., 2] + shift / 2.0    # R
    img_f32[..., 0] = img_f32[..., 0] + shift / 2.0    # B
    img_f32[..., 1] = img_f32[..., 1] - shift          # G
    return img_f32


_DISPATCH = {
    "exposure":           lambda img, a, _: _apply_exposure(img, a),
    "highlights":         lambda img, a, _: _apply_highlights(img, a),
    "shadows":            lambda img, a, _: _apply_shadows(img, a),
    "contrast":           lambda img, a, _: _apply_contrast(img, a),
    "saturation_global":  lambda img, a, _: _apply_saturation_global(img, a),
    "saturation_channel": lambda img, a, action: _apply_saturation_channel(img, action.get("channel", ""), a),
    "temperature":        lambda img, a, _: _apply_temperature(img, a),
    "tint":               lambda img, a, _: _apply_tint(img, a),
}


def apply_recommended_actions(image_path: str, actions: list) -> tuple:
    """
    Apply a list of structured editing actions to the image.

    Returns:
        (fixed_path, applied) where:
            fixed_path: str | None -- path to the new image, None on no-op
            applied: list[dict]    -- per-action record including clamped
                                       amount and reason, for the UI
    """
    if not actions or not isinstance(actions, list):
        return None, []

    img = cv2.imread(image_path)
    if img is None:
        return None, []

    img_f32 = img.astype(np.float32)
    applied = []

    for raw in actions:
        if not isinstance(raw, dict):
            continue
        op = raw.get("op")
        handler = _DISPATCH.get(op)
        if handler is None:
            continue

        amount = _clamp(raw.get("amount", 0), op)
        if amount == 0:
            continue

        try:
            img_f32 = handler(img_f32, amount, raw)
        except Exception as e:
            print(f"WARN action {op} failed: {e}")
            continue

        applied.append({
            "op": op,
            "channel": raw.get("channel"),
            "amount": amount,
            "reason": (raw.get("reason") or "")[:120],
        })

    if not applied:
        return None, []

    img_out = np.clip(img_f32, 0, 255).astype(np.uint8)

    suffix = "." + image_path.split(".")[-1].lower()
    if suffix not in (".jpg", ".jpeg", ".png"):
        suffix = ".jpg"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    quality = 95 if suffix in (".jpg", ".jpeg") else 9
    if suffix in (".jpg", ".jpeg"):
        cv2.imwrite(tmp.name, img_out, [cv2.IMWRITE_JPEG_QUALITY, quality])
    else:
        cv2.imwrite(tmp.name, img_out)
    tmp.close()

    return tmp.name, applied
