"""
Style transfer via LAB histogram matching.

After Mertens fusion (or single-frame RAW decode) the image has a
generic neutral look. To push it toward an agency's finished aesthetic
we match its per-channel LAB distribution to a target distribution
learned from their reference photos.

Why LAB:
  - L (luminance) captures tonal curve / contrast feel
  - a (green-magenta) captures WB tint
  - b (blue-yellow) captures WB warm/cool
  - Independent channels => independent transforms => no surprising
    color blowouts compared to RGB-space matching.

Why percentile-based (instead of full histograms):
  - Compact (99 floats per channel, 297 floats per profile) — fits
    cleanly in a Postgres Json column
  - Robust to noise in references
  - Cheap to apply at inference time (interpolation, not full LUT)

This module is intentionally narrow: it does ONE thing (LAB hist match)
and returns a new image. The handler decides when to call it.
"""

import json
from typing import Optional

import cv2
import numpy as np


# Percentile resolution. 99 points (1..99) is a good tradeoff: dense
# enough to capture the curve shape, sparse enough that the JSON
# payload stays under a few KB.
_PERCENTILES = list(range(1, 100))  # 1, 2, ..., 99


def compute_lab_percentiles(img: np.ndarray) -> dict:
    """
    Compute per-channel LAB percentile arrays for one image.
    Returns {"L": [..], "a": [..], "b": [..]} with float values.

    Performance: a 24-megapixel reference photo demands one numpy sort
    per LAB channel for np.percentile — ~2-4 seconds per photo. With
    1000+ references that blows past Lambda timeouts. Downsampling to
    ~720x480 (345k pixels) gives the same statistical distribution
    within rounding error and runs ~50x faster. We never need pixel-
    perfect histograms for style transfer; we need a stable target.
    """
    h, w = img.shape[:2]
    max_side = 720
    if max(h, w) > max_side:
        scale = max_side / max(h, w)
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    out = {}
    for i, name in enumerate(("L", "a", "b")):
        channel = lab[:, :, i].ravel()
        out[name] = [float(v) for v in np.percentile(channel, _PERCENTILES)]
    return out


def aggregate_profile(per_image_percentiles: list[dict]) -> dict:
    """
    Average percentile curves across many reference images. The result
    is the agency's "target" distribution that we match new photos to.

    Aggregating percentiles (not raw pixels) is statistically wrong in
    the strict sense, but works well in practice for style transfer
    and keeps memory bounded — we never have to hold all reference
    pixels at once.
    """
    if not per_image_percentiles:
        return {}
    keys = ("L", "a", "b")
    n = len(per_image_percentiles)
    out: dict = {}
    for k in keys:
        # Pull per-channel arrays from each image
        arrs = [np.array(p[k], dtype=np.float64) for p in per_image_percentiles if k in p]
        if not arrs:
            continue
        stacked = np.stack(arrs, axis=0)  # (n_images, 99)
        out[k] = [float(v) for v in np.mean(stacked, axis=0)]
        out[f"{k}_count"] = len(arrs)
    out["sample_size"] = n
    return out


def _build_match_lut(
    source_channel: np.ndarray, target_percentiles: list[float]
) -> np.ndarray:
    """
    For one 8-bit channel, build a 256-entry LUT that maps source
    pixel values to target values, matching the cumulative
    distribution. Pure histogram matching via inverse CDF.
    """
    # Source CDF
    hist, _ = np.histogram(source_channel.ravel(), bins=256, range=(0, 256))
    src_cdf = np.cumsum(hist).astype(np.float64)
    src_cdf /= max(src_cdf[-1], 1)  # normalize to [0,1]

    # Build target CDF from the percentile array. Percentiles 1..99
    # span (almost) the full distribution; we anchor 0% and 100% to
    # 0 and 255 so the LUT covers the whole range.
    p_axis = np.linspace(0, 1, num=len(target_percentiles) + 2)
    p_vals = np.concatenate(([0.0], np.array(target_percentiles), [255.0]))

    # For each source intensity 0..255, find where it falls on the
    # source CDF, then look up the value at that same CDF point on
    # the target curve.
    lut = np.zeros(256, dtype=np.uint8)
    for i in range(256):
        target_value = np.interp(src_cdf[i], p_axis, p_vals)
        lut[i] = int(np.clip(round(target_value), 0, 255))
    return lut


def _midtone_weight_lut(sigma: float = 50.0) -> np.ndarray:
    """
    Build a 256-entry weight LUT shaped like a Gaussian centered at
    L=128. Values near the midtone (~128) get weight close to 1.0;
    values at extremes (0 or 255) get weight close to 0.

    Used to scale style-transfer strength per-pixel: extreme shadows
    and highlights are preserved (protecting dynamic range) while
    the midtone "feel" still shifts toward the reference distribution.

    sigma controls the falloff. 50 gives weight ~0.6 at L=80/L=176,
    ~0.14 at L=0/L=255 — a noticeable protect-the-extremes shape.
    """
    idx = np.arange(256, dtype=np.float32)
    return np.exp(-((idx - 128.0) ** 2) / (2.0 * sigma * sigma))


def match_to_profile(
    img: np.ndarray,
    profile: dict,
    strength: float = 0.6,
    match_color: bool = False,
    protect_extremes: bool = True,
) -> np.ndarray:
    """
    Apply LAB histogram matching to push img toward the agency's
    target distribution.

    By default:
      - ONLY the L (luminance) channel is matched. a/b chroma transfer
        destroys spatial color structure (pink walls / yellow skies).
        Off by default; opt in via match_color when references are
        room-type-matched to the source.
      - Shadow and highlight extremes are PROTECTED from the match.
        A Gaussian weight centered at L=128 means the full match
        strength applies to midtones while shadows (L<40) and
        highlights (L>220) move much less. Without this protection
        the algorithm aggressively lifts interior shadows to the
        target shape (target was learned from Lightroom-finished
        interiors where shadows already sit at L=24) and produces
        the "nuclear" washed-out look Paul reported.

    strength: 0..1 base blend factor. Effective per-pixel strength is
              strength * gaussian_weight(L) when protect_extremes is
              True, which is the safer default.
    match_color: histogram-match a/b channels too. Default off.
    protect_extremes: midtone-weighted blending. Default on.
    """
    if not profile or "L" not in profile:
        return img

    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    out = lab.copy()

    channels_to_match = ["L"]
    if match_color:
        channels_to_match.extend(["a", "b"])

    weight_lut = _midtone_weight_lut() if protect_extremes else None

    for name in channels_to_match:
        i = {"L": 0, "a": 1, "b": 2}[name]
        channel = lab[:, :, i]
        target = profile.get(name)
        if not target:
            continue
        lut = _build_match_lut(channel, target)
        matched = cv2.LUT(channel, lut)

        if weight_lut is not None:
            # Per-pixel strength = base * gaussian_weight(luminance).
            # We always weight by the L channel's luminance so that
            # color channels (when match_color is True) protect
            # extremes based on local brightness, not on a/b values
            # which can be anywhere.
            l_channel = lab[:, :, 0]
            local_w = (weight_lut[l_channel] * strength).astype(np.float32)
            blended = (
                channel.astype(np.float32) * (1.0 - local_w)
                + matched.astype(np.float32) * local_w
            )
            out[:, :, i] = np.clip(blended, 0, 255).astype(np.uint8)
        elif strength >= 0.999:
            out[:, :, i] = matched
        else:
            blended = (
                channel.astype(np.float32) * (1.0 - strength)
                + matched.astype(np.float32) * strength
            )
            out[:, :, i] = np.clip(blended, 0, 255).astype(np.uint8)

    return cv2.cvtColor(out, cv2.COLOR_LAB2BGR)


def match_image_path(
    image_path: str,
    profile: dict,
    out_path: str,
    strength: float = 0.6,
    match_color: bool = False,
    protect_extremes: bool = True,
) -> Optional[str]:
    """
    File-path wrapper: read, match, write. Returns the output path
    on success, None on failure (caller falls back to the input).
    """
    img = cv2.imread(image_path)
    if img is None:
        return None
    matched = match_to_profile(
        img,
        profile,
        strength=strength,
        match_color=match_color,
        protect_extremes=protect_extremes,
    )
    if not cv2.imwrite(out_path, matched, [cv2.IMWRITE_JPEG_QUALITY, 95]):
        return None
    return out_path


def serialize_profile(profile: dict) -> str:
    """JSON-encode a profile for storage in StyleProfile.styleHistogram."""
    return json.dumps(profile)


def deserialize_profile(blob: str | dict | None) -> dict:
    """Decode StyleProfile.styleHistogram back into the python dict."""
    if not blob:
        return {}
    if isinstance(blob, dict):
        return blob
    try:
        return json.loads(blob)
    except (TypeError, ValueError):
        return {}
