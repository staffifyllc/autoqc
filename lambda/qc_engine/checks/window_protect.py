"""
window_protect.py

Drop-in window / blown-highlight protection stage.
Slots between the Mertens merge and the LAB histogram-match style transfer.

Pipeline position:
    merged = mertens.process(aligned_brackets)   # window detail intact
    styled = histogram_match(merged, target)     # global remap blows the window
    final  = protect_windows(merged, styled)     # merged window composited back

Why this is the right layer:
Mertens fusion already holds the window (well-exposedness weighting pulls those pixels
from the darkest bracket). The global histogram match then warps the whole-image CDF
toward a baked target and destroys the small bright window region. The merge is not the
bug. This stage masks the window, lets style transfer own only the interior, and composites
the merged window back with a soft edge.

Tighter integration (optional, more correct): also exclude the window mask when computing
the SOURCE CDF inside histogram_match, so blown window pixels don't skew the interior
mapping. This module handles the composite; passing the mask into your matcher handles the
skew. Do the composite first — it fixes the visible failure immediately.
"""

import cv2
import numpy as np


def _to_float(img):
    """Return float32 RGB in [0,1] plus a flag for whether input was uint8."""
    if img.dtype == np.uint8:
        return img.astype(np.float32) / 255.0, True
    return img.astype(np.float32), False


def _restore(img, was_uint8):
    img = np.clip(img, 0.0, 1.0)
    return (img * 255.0).astype(np.uint8) if was_uint8 else img


def _bgr(f):
    return cv2.cvtColor((np.clip(f, 0, 1) * 255).astype(np.uint8), cv2.COLOR_RGB2BGR)


def detect_window_mask(
    merged,
    luma_thresh=0.82,
    sat_max=0.25,
    min_area_frac=0.0008,
    feather_px=25,
):
    """
    Luminance + low-saturation detector for windows / blown exteriors.

    merged        : Mertens output, float[0,1] or uint8, RGB
    luma_thresh   : pixels brighter than this are window candidates (0-1)
    sat_max       : reject bright BUT saturated regions (colored walls, warm lamps)
    min_area_frac : drop blobs smaller than this fraction of the frame (kills specular dots)
    feather_px    : Gaussian feather radius for a soft composite edge

    Returns float32 mask in [0,1], same H,W as input. 1 = window, 0 = interior.
    Tune luma_thresh down if windows are partly missed; up if it grabs bright walls.
    """
    f, _ = _to_float(merged)
    luma = 0.2126 * f[..., 0] + 0.7152 * f[..., 1] + 0.0722 * f[..., 2]
    hsv = cv2.cvtColor(np.clip(f, 0, 1).astype(np.float32), cv2.COLOR_RGB2HSV)
    sat = hsv[..., 1]

    raw = ((luma >= luma_thresh) & (sat <= sat_max)).astype(np.uint8)

    # close gaps inside a window, then open to drop speckle
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    raw = cv2.morphologyEx(raw, cv2.MORPH_CLOSE, k, iterations=2)
    raw = cv2.morphologyEx(raw, cv2.MORPH_OPEN, k, iterations=1)

    # keep only window-sized blobs
    n, labels, stats, _ = cv2.connectedComponentsWithStats(raw, connectivity=8)
    min_area = int(min_area_frac * raw.shape[0] * raw.shape[1])
    keep = np.zeros_like(raw)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            keep[labels == i] = 1

    mask = keep.astype(np.float32)
    if feather_px > 0:
        ksize = feather_px * 2 + 1
        mask = cv2.GaussianBlur(mask, (ksize, ksize), 0)
    return np.clip(mask, 0.0, 1.0)


def _highlight_rolloff(img, knee=0.85, strength=0.6):
    """
    Soft compression above `knee` so the composited window reads natural, not hard-clipped.
    strength 0 = none, 1 = full reinhard-style roll-off above the knee. The merged window
    usually isn't clipped (that's the point), so keep this mild.
    """
    x = (img - knee) / (1.0 - knee + 1e-6)
    compressed = knee + (1.0 - knee) * (x / (1.0 + x))
    return np.where(img > knee, img * (1 - strength) + compressed * strength, img)


def protect_windows(
    merged,
    styled,
    mask=None,
    rolloff=True,
    rolloff_knee=0.85,
    rolloff_strength=0.6,
    debug_dir=None,
    **detect_kwargs,
):
    """
    Composite the merged (window-intact) frame back over the styled (interior) frame.

    merged : pre-style Mertens output
    styled : output of your histogram-match style transfer
    mask   : optional precomputed mask (grounded-SAM / composition.py window flag).
             single channel, float[0,1] or uint8. If None, detect_window_mask() is used.
    debug_dir : if set, dumps merged / styled / mask / final for stage localization.

    Returns final image in the same dtype as `styled`.
    """
    m_f, _ = _to_float(merged)
    s_f, was_uint8 = _to_float(styled)

    if mask is None:
        mask = detect_window_mask(merged, **detect_kwargs)
    else:
        mask, _ = _to_float(mask)
        if mask.ndim == 3:
            mask = mask[..., 0]
    mask3 = mask[..., None]

    window_src = _highlight_rolloff(m_f, rolloff_knee, rolloff_strength) if rolloff else m_f
    final = s_f * (1.0 - mask3) + window_src * mask3

    if debug_dir is not None:
        import os
        os.makedirs(debug_dir, exist_ok=True)
        cv2.imwrite(f"{debug_dir}/01_merged.png", _bgr(m_f))
        cv2.imwrite(f"{debug_dir}/02_styled.png", _bgr(s_f))
        cv2.imwrite(f"{debug_dir}/03_window_mask.png", (mask * 255).astype(np.uint8))
        cv2.imwrite(f"{debug_dir}/04_final.png", _bgr(np.clip(final, 0, 1)))

    return _restore(final, was_uint8)


if __name__ == "__main__":
    # quick self-check on a synthetic frame: dark interior, one bright window
    h, w = 600, 800
    merged = np.full((h, w, 3), 0.35, np.float32)
    merged[150:400, 500:740] = 0.7          # window holds detail in merge
    styled = merged.copy()
    styled[150:400, 500:740] = 0.99         # style transfer blows it out
    out = protect_windows(merged, styled, debug_dir="./debug")
    win = out[150:400, 500:740]
    print("window mean after protect:", round(float(win.mean()), 3), "(should be ~0.7, not ~0.99)")
