"""
Render interior + exterior samples through the FULL HDR pipeline so Paul
can judge the new scene routing on his Desktop.

For one interior bracket set and one exterior bracket set:
    merge (Mertens) -> lens correct (Sony) -> classify scene
    -> [A] OLD look: interior curve + sat 1.15 applied to everything
    -> [B] NEW look: scene-routed curve + scene saturation
Then stacks merged | OLD | NEW into a labeled comparison JPEG on Desktop.

Bracket sets are grouped by EXIF capture time (<=10s gap), same as the
production grouping. Picks the first set that classifies interior and
the first that classifies exterior.
"""

import os
import sys
import glob

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lambda", "qc_engine"))
from hdr.merge import merge_brackets, read_lens_meta  # noqa: E402
from hdr.lens_correct import lens_applies, correct_distortion  # noqa: E402
from hdr.scene import classify_scene  # noqa: E402
from hdr.style_transfer import apply_learned_style  # noqa: E402

try:
    import exifread
except Exception:
    exifread = None

RAW = os.path.expanduser("~/Desktop/699 Spear Cemetery Rd Reading VT RAW")
OUT_DIR = os.path.expanduser("~/Desktop")


def capture_ts(path):
    """EXIF DateTimeOriginal as a sortable int (YYYYMMDDHHMMSS), or None."""
    if exifread is None:
        return None
    try:
        with open(path, "rb") as fh:
            tags = exifread.process_file(fh, details=False, stop_tag="DateTimeOriginal")
        v = tags.get("EXIF DateTimeOriginal") or tags.get("Image DateTime")
        if not v:
            return None
        s = str(v).replace(":", "").replace(" ", "")
        return int(s)
    except Exception:
        return None


def group_by_time(paths, max_gap=10):
    """Group sorted RAWs into bracket sets by capture-time gap (seconds)."""
    stamped = []
    for p in paths:
        ts = capture_ts(p)
        if ts is not None:
            stamped.append((ts, p))
    stamped.sort()
    groups, cur = [], []
    prev = None
    for ts, p in stamped:
        # crude seconds delta from YYYYMMDDHHMMSS int
        if prev is not None and _secs(ts) - _secs(prev) > max_gap:
            if len(cur) >= 2:
                groups.append(cur)
            cur = []
        cur.append(p)
        prev = ts
    if len(cur) >= 2:
        groups.append(cur)
    return groups


def _secs(ts):
    s = str(ts)
    hh, mm, ss = int(s[8:10]), int(s[10:12]), int(s[12:14])
    return hh * 3600 + mm * 60 + ss


def merge_set(paths):
    out, meta = merge_brackets(paths)
    if out is None:
        return None, None
    merged = cv2.imread(out)
    lm = read_lens_meta(paths[0])
    if lens_applies(lm.get("lens_model")):
        merged = correct_distortion(merged, lm.get("focal_mm"))
    return merged, lm


def label(img, text):
    bar = np.zeros((40, img.shape[1], 3), np.uint8)
    cv2.putText(bar, text, (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8,
                (255, 255, 255), 2, cv2.LINE_AA)
    return np.vstack([bar, img])


def thumb(img, w=560):
    h = int(img.shape[0] * w / img.shape[1])
    return cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)


def render(merged, scene, tag):
    old = apply_learned_style(merged, scene="interior")          # old: everything interior
    new = apply_learned_style(merged, scene=scene)                # new: scene-routed
    panels = [
        label(thumb(merged), "1. MERGED (neutral)"),
        label(thumb(old), "2. OLD (interior curve, sat 1.15)"),
        label(thumb(new), f"3. NEW ({scene} routed)"),
    ]
    sheet = np.hstack(panels)
    path = os.path.join(OUT_DIR, f"sample_{tag}_{scene}.jpg")
    cv2.imwrite(path, sheet, [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(f"  wrote {path}")
    return path


def main():
    arw = glob.glob(os.path.join(RAW, "*.ARW"))
    dng = glob.glob(os.path.join(RAW, "*.DNG"))
    print(f"ARW={len(arw)} DNG={len(dng)}")

    arw_groups = group_by_time(arw)
    dng_groups = group_by_time(dng)
    print(f"ARW sets={len(arw_groups)} DNG sets={len(dng_groups)}")

    done_int = done_ext = False
    # exterior: try DJI drone sets first (definitely exterior)
    for g in dng_groups + arw_groups:
        if done_int and done_ext:
            break
        merged, _ = merge_set(g[:7])
        if merged is None:
            continue
        scene, d = classify_scene(merged)
        print(f"set n={len(g)} -> {scene}  foliage={d['foliage_frac']:.3f} blue={d['blue_sky_frac']:.3f}")
        if scene == "exterior" and not done_ext:
            render(merged, "exterior", "EXT")
            done_ext = True
        elif scene == "interior" and not done_int:
            render(merged, "interior", "INT")
            done_int = True

    print("done")


if __name__ == "__main__":
    main()
