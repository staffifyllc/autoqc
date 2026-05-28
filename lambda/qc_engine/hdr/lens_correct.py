"""
lens_correct.py

Geometric lens-distortion correction for Sony interiors shot on the
FE PZ 16-35mm F4 G (the lens flagged DistortionCorrectionSetting=Auto
in-camera). lensfun and exiftool both need native deps that do not
package cleanly on Lambda, so this uses a radial-undistort model
(cv2.undistort) keyed to focal length — no external dependency,
works everywhere.

Pipeline position: stage 1.5 — applied to the MERGED result right
after Mertens, BEFORE vertical (keystone) correction. Order matters:
de-bow first so the Hough vertical detector sees straight lines, then
de-keystone.

Scoped: only fires for the FE PZ 16-35 (matched on EXIF lens model).
Never touches DJI exteriors or other lenses.

The per-focal-length k1 table below is the barrel strength for this
lens (negative = barrel; the lens bows lines outward most at 16mm,
trailing to near-zero by 35mm). Values are first estimates to be
dialed against Paul's finished (Lightroom-corrected) frames.
"""

from __future__ import annotations

import numpy as np
import cv2


SONY_1635_LENS = "FE PZ 16-35mm F4 G"

# focal_mm -> k1 (cv2 radial term with camera matrix focal = max(h,w)).
# Negative pulls corners in to undo barrel. Monotonically weakens as
# focal length climbs; ~0 (slight pincushion) by 35mm.
_K1_BY_FOCAL = {
    16: -0.155,
    18: -0.110,
    20: -0.075,
    24: -0.040,
    28: -0.018,
    35: 0.010,
}


def _k1_for_focal(focal_mm: float) -> float:
    if focal_mm is None:
        return _K1_BY_FOCAL[16]  # assume widest if unknown (most common)
    keys = sorted(_K1_BY_FOCAL)
    if focal_mm <= keys[0]:
        return _K1_BY_FOCAL[keys[0]]
    if focal_mm >= keys[-1]:
        return _K1_BY_FOCAL[keys[-1]]
    # linear interpolation between bracketing focal lengths
    for i in range(len(keys) - 1):
        a, b = keys[i], keys[i + 1]
        if a <= focal_mm <= b:
            t = (focal_mm - a) / (b - a)
            return _K1_BY_FOCAL[a] * (1 - t) + _K1_BY_FOCAL[b] * t
    return _K1_BY_FOCAL[16]


def lens_applies(lens_model: str | None) -> bool:
    """True if this lens should be distortion-corrected."""
    return bool(lens_model) and "16-35" in lens_model and "FE PZ" in lens_model


def correct_distortion(
    img_bgr: np.ndarray,
    focal_mm: float | None,
    k1_override: float | None = None,
) -> np.ndarray:
    """
    Apply radial distortion correction. Returns a same-size BGR image
    with the lens barrel removed. k1_override lets the calibration
    harness sweep values.
    """
    h, w = img_bgr.shape[:2]
    f = float(max(h, w))
    cam = np.array([[f, 0, w / 2.0], [0, f, h / 2.0], [0, 0, 1]], np.float64)
    k1 = k1_override if k1_override is not None else _k1_for_focal(focal_mm)
    # k2 small same-sign term smooths the corner falloff
    dist = np.array([k1, k1 * 0.25, 0.0, 0.0, 0.0], np.float64)
    # newCameraMatrix=cam keeps framing/scale stable (no zoom punch-in)
    corrected = cv2.undistort(img_bgr, cam, dist, None, cam)
    return corrected
