"""
scene.py — interior vs exterior routing for the HDR style stage.

Why this exists
---------------
The editor's finished look is NOT one curve. Interiors are finished
dark-anchored and contrasty (deep blacks, lifted shadows, restrained
saturation) to read like a magazine room. Exteriors are finished like
a landscape: brighter overall, a higher (not crushed) black point,
punchier saturation, natural sky/foliage color. Applying the interior
black-anchor curve to an exterior is exactly the "atomic / horrible"
exterior look Paul flagged.

So the style stage needs to know, per frame, which bucket it is in.

Why a local classifier (not Claude Vision room_type)
----------------------------------------------------
The style stage runs BEFORE process_photo, where the Claude Vision
composition check (which returns room_type) lives. Routing on Vision
here would mean a second Vision call per photo — extra cost and latency
on every HDR frame. The interior/exterior split is a coarse, whole-image
question (is there sky / foliage, or is this a walled room?), which a
cheap HSV heuristic answers reliably. We keep Vision for the nuanced QC
job it already does downstream.

Discriminators
--------------
Two whole-image tells, both validated 55/55 on the 699 Spear set:
  - foliage: green grass/trees. Ceilings and walls are never green, so
    a meaningful green fraction is a near-certain exterior tell.
  - blue sky: hue in the blue band with real saturation, concentrated
    in the top of the frame.

A "bright sky band" (large bright low-saturation region up top) was
tried as a third tell for overcast/blown skies, but a white ceiling
reads identically, and on real frames it only ever produced false
exteriors: a white bathroom with a leafy window (#33), a barn with
green buckets + a white ceiling (#37, #38). Every TRUE exterior in the
set already clears the foliage or blue-sky bar, so the bright-band rule
added risk and zero recall. Dropped. bright_sky_frac is still computed
for diagnostics only.

A lit window inside an interior is local and surrounded by wall, so it
does not move the whole-image foliage/blue-sky fractions. A white
ceiling has no green, so it stays interior. The one known miss is a
foliage-free, blue-sky-free exterior (winter snow under flat overcast):
it degrades to the interior curve rather than crashing. Acceptably rare
for the daytime/green real-estate sets this beta targets.
"""

from __future__ import annotations

import numpy as np
import cv2


# --- tunables (validated against the 699 Spear finished set) ---------
# green foliage fraction (whole image) above which we call exterior
_FOLIAGE_FRAC = 0.06
# blue-sky fraction (within the top band) above which we call exterior
_BLUE_SKY_FRAC = 0.12
# top band = first N% of rows, where sky lives
_TOP_BAND = 0.45


def _fractions(img_bgr: np.ndarray) -> dict:
    """Compute the HSV fractions the decision rests on. Downsampled for
    speed; fractions are scale-invariant so this is lossless for our
    purposes."""
    h, w = img_bgr.shape[:2]
    max_side = 512
    if max(h, w) > max_side:
        s = max_side / max(h, w)
        img_bgr = cv2.resize(
            img_bgr, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA
        )
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    H, S, V = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    hh = hsv.shape[0]
    top = slice(0, max(1, int(hh * _TOP_BAND)))

    # foliage: OpenCV hue 30..90 is yellow-green..green; need real
    # saturation and some brightness so we don't catch dark noise.
    foliage = (H >= 30) & (H <= 90) & (S > 50) & (V > 40)
    foliage_frac = float(np.count_nonzero(foliage)) / foliage.size

    # blue sky in the top band: hue ~95..135 with saturation + brightness
    Ht, St, Vt = H[top], S[top], V[top]
    blue = (Ht >= 95) & (Ht <= 135) & (St > 35) & (Vt > 90)
    blue_sky_frac = float(np.count_nonzero(blue)) / blue.size

    # bright low-sat band (white/overcast/blown sky OR white ceiling)
    bright = (Vt > 175) & (St < 55)
    bright_sky_frac = float(np.count_nonzero(bright)) / bright.size

    return {
        "foliage_frac": foliage_frac,
        "blue_sky_frac": blue_sky_frac,
        "bright_sky_frac": bright_sky_frac,
        "mean_v": float(np.mean(V)),
    }


def classify_scene(img_bgr: np.ndarray) -> tuple[str, dict]:
    """
    Return ("exterior"|"interior", details). Conservative toward
    interior: a frame only flips exterior on a strong outdoor tell
    (foliage, blue sky, or a bright sky band backed by some foliage),
    so a white-ceiling interior or a lone lit window stays interior.
    """
    f = _fractions(img_bgr)
    reasons = []
    if f["foliage_frac"] >= _FOLIAGE_FRAC:
        reasons.append(f"foliage {f['foliage_frac']:.3f}")
    if f["blue_sky_frac"] >= _BLUE_SKY_FRAC:
        reasons.append(f"blue_sky {f['blue_sky_frac']:.3f}")
    scene = "exterior" if reasons else "interior"
    f["scene"] = scene
    f["reasons"] = reasons
    return scene, f
