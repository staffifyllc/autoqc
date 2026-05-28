"""
test_full_set.py

Run the real pipeline (merge -> style -> window-protect) against the
WHOLE 699 Spear Cemetery shoot and validate the three CLAUDE.md
invariants on every scene, plus measure distance to the human
Lightroom finish.

Fixture (real):
  RAW: ~/Desktop/699 Spear Cemetery Rd Reading VT RAW   (225 ARW + 68 DNG)
  FIN: ~/Desktop/699 Spear Cemetery Rd Reading VT FIN   (55 finished JPEGs)

Grouping:
  DJI DNG  -> filename 14-digit timestamp (DJI_YYYYMMDDHHMMSS_xxxx_D.DNG)
  Sony ARW -> EXIF DateTimeOriginal (no timestamp in FGBxxxxx.ARW names),
              new scene on >10s gap or EV ladder reset (>=1.5 stop drop).

Decode is half-res for speed; tonal behavior is resolution-independent.

Outputs:
  ./debug_full/<scene>/{01_merged,02_styled,03_mask,04_final}.png  (first N)
  Aggregate PASS/FAIL for INV1, INV2 across all scenes.
  INV3 distance distribution vs the property's human-finish target.
"""

import os
import sys
import glob
from collections import defaultdict

import cv2
import numpy as np
import rawpy
import exifread

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hdr.style_transfer import (  # noqa: E402
    match_to_profile,
    compute_lab_percentiles,
    aggregate_profile,
)
from checks.window_protect import protect_windows, detect_window_mask  # noqa: E402

DESKTOP = "/Users/paulchareth/Desktop"
RAW_DIR = f"{DESKTOP}/699 Spear Cemetery Rd Reading VT RAW"
FIN_DIR = f"{DESKTOP}/699 Spear Cemetery Rd Reading VT FIN"
DEBUG_DIR = "./debug_full"
DUMP_FIRST_N = 6
GAP_SECONDS = 10.0
EPS = 2.0
INTERIOR_TOL = 30.0
RAW_EXTS = (".arw", ".dng", ".cr2", ".cr3", ".nef", ".raf", ".orf", ".rw2")


def read_exif(path):
    """Return (capture_epoch_seconds_or_None, exposure_bias_or_None)."""
    try:
        with open(path, "rb") as fh:
            tags = exifread.process_file(
                fh, details=False, stop_tag="EXIF ExposureBiasValue"
            )
        dt = tags.get("EXIF DateTimeOriginal") or tags.get("Image DateTime")
        epoch = None
        if dt:
            # format "YYYY:MM:DD HH:MM:SS"
            s = str(dt).strip()
            try:
                import datetime as _dt
                epoch = _dt.datetime.strptime(
                    s, "%Y:%m:%d %H:%M:%S"
                ).timestamp()
            except ValueError:
                epoch = None
        bias = tags.get("EXIF ExposureBiasValue")
        bias_val = None
        if bias is not None:
            try:
                r = bias.values[0]
                bias_val = float(r.num) / float(r.den) if r.den else float(r.num)
            except Exception:
                bias_val = None
        return epoch, bias_val
    except Exception:
        return None, None


def dji_key(name):
    import re
    m = re.search(r"(\d{14})", name)
    return m.group(1) if m else None


def group_scenes(raw_files):
    """Return list of scenes, each a list of file paths (sorted darkest-first
    by EV when known)."""
    metas = []
    for p in raw_files:
        name = os.path.basename(p)
        epoch, bias = read_exif(p)
        metas.append({"path": p, "name": name, "epoch": epoch, "bias": bias,
                      "djikey": dji_key(name)})

    scenes = []

    # DJI: group by filename timestamp key
    dji = [m for m in metas if m["djikey"]]
    by_key = defaultdict(list)
    for m in dji:
        by_key[m["djikey"]].append(m)
    for k in sorted(by_key):
        scenes.append(by_key[k])

    # Sony / no-key: group by EXIF time gap + EV reset
    rest = [m for m in metas if not m["djikey"]]
    dated = [m for m in rest if m["epoch"] is not None]
    undated = [m for m in rest if m["epoch"] is None]
    dated.sort(key=lambda m: m["epoch"])
    # Time-gap only. No EV-reset break — Sony AEB is center-out
    # (0,-2,+2,-4,+4) so a bias drop is NOT a scene boundary.
    cur = []
    for m in dated:
        if not cur:
            cur = [m]
            continue
        prev = cur[-1]
        gap = m["epoch"] - prev["epoch"]
        if gap > GAP_SECONDS:
            scenes.append(cur)
            cur = []
        cur.append(m)
    if cur:
        scenes.append(cur)
    for m in undated:  # truly ungroupable -> singletons
        scenes.append([m])

    # sort each scene's frames darkest->brightest by bias when available
    for s in scenes:
        s.sort(key=lambda m: (m["bias"] if m["bias"] is not None else 0))
    return scenes


def decode_raw_half(path):
    # Mirror production stage-1 decode: no_auto_bright=True for brackets
    # preserves the AEB exposure ladder so the darkest frame keeps its
    # window detail for Mertens to pull.
    with rawpy.imread(path) as raw:
        rgb = raw.postprocess(
            use_camera_wb=True, output_bps=8, half_size=True,
            no_auto_bright=True,
        )
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)  # BGR


def merge_scene(paths):
    """Decode + align + Mertens. Returns merged BGR uint8 or None."""
    frames = []
    for p in paths:
        try:
            frames.append(decode_raw_half(p))
        except Exception as e:
            print(f"  decode fail {os.path.basename(p)}: {e}")
    if len(frames) == 0:
        return None
    # normalize sizes
    minh = min(f.shape[0] for f in frames)
    minw = min(f.shape[1] for f in frames)
    frames = [cv2.resize(f, (minw, minh)) if f.shape[:2] != (minh, minw) else f
              for f in frames]
    if len(frames) == 1:
        return frames[0]
    aligner = cv2.createAlignMTB()
    aligned = []
    aligner.process(frames, aligned)
    if not aligned or len(aligned) != len(frames):
        aligned = frames
    merged_f = cv2.createMergeMertens().process(aligned)
    return np.clip(merged_f * 255.0, 0, 255).astype(np.uint8)


def build_target_from_finish():
    fins = sorted(glob.glob(f"{FIN_DIR}/*.jpg"))
    pcts = []
    for f in fins:
        img = cv2.imread(f)
        if img is not None:
            pcts.append(compute_lab_percentiles(img))
    return aggregate_profile(pcts), len(pcts)


def luma_bgr(img):
    b = img[..., 0].astype(np.float32)
    g = img[..., 1].astype(np.float32)
    r = img[..., 2].astype(np.float32)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def main():
    os.makedirs(DEBUG_DIR, exist_ok=True)
    raw_files = [
        p for p in glob.glob(f"{RAW_DIR}/*")
        if p.lower().endswith(RAW_EXTS)
    ]
    print(f"RAW files: {len(raw_files)}")
    target, n_fin = build_target_from_finish()
    print(f"Style target trained from {n_fin} finished JPEGs "
          f"(keys: {list(target.keys()) if target else 'EMPTY'})")

    scenes = group_scenes(raw_files)
    multi = [s for s in scenes if len(s) >= 2]
    singles = [s for s in scenes if len(s) == 1]
    counts = [len(s) for s in multi]
    print(f"\nGrouped into {len(scenes)} scenes: "
          f"{len(multi)} bracket sets (sizes {sorted(set(counts))}, "
          f"avg {np.mean(counts):.1f}), {len(singles)} singletons")

    inv1_pass = inv2_pass = 0
    inv3_diffs = []
    processed = 0
    target_L = np.array(target["L"], dtype=np.float64) if target else None

    for idx, scene in enumerate(scenes):
        paths = [m["path"] for m in scene]
        merged = merge_scene(paths)
        if merged is None:
            continue
        styled = match_to_profile(merged, target, strength=0.6) if target else merged

        merged_rgb = cv2.cvtColor(merged, cv2.COLOR_BGR2RGB)
        styled_rgb = cv2.cvtColor(styled, cv2.COLOR_BGR2RGB)
        final_rgb = protect_windows(merged_rgb, styled_rgb)
        final = cv2.cvtColor(final_rgb, cv2.COLOR_RGB2BGR)

        mask = detect_window_mask(merged_rgb)
        mask_bool = mask > 0.5
        has_window = mask_bool.sum() > 0

        # INV1 + INV2
        if has_window:
            lm = luma_bgr(merged)[mask_bool].max()
            lf = luma_bgr(final)[mask_bool].max()
            inv1 = lf <= lm + EPS
        else:
            inv1 = True  # no window region -> trivially satisfied
        cm = int((merged >= 255).any(axis=2).sum())
        cf = int((final >= 255).any(axis=2).sum())
        inv2 = cf <= cm
        inv1_pass += int(inv1)
        inv2_pass += int(inv2)

        # INV3
        if target_L is not None:
            interior = ~mask_bool if has_window else np.ones(final.shape[:2], bool)
            fL = cv2.cvtColor(final, cv2.COLOR_BGR2LAB)[..., 0]
            fpct = np.percentile(fL[interior], list(range(1, 100)))
            inv3_diffs.append(float(np.mean(np.abs(fpct - target_L))))

        if processed < DUMP_FIRST_N:
            d = f"{DEBUG_DIR}/scene_{idx:03d}_n{len(scene)}"
            os.makedirs(d, exist_ok=True)
            cv2.imwrite(f"{d}/01_merged.png", merged)
            cv2.imwrite(f"{d}/02_styled.png", styled)
            cv2.imwrite(f"{d}/03_mask.png", (mask * 255).astype(np.uint8))
            cv2.imwrite(f"{d}/04_final.png", final)
        processed += 1
        if processed % 10 == 0:
            print(f"  ...processed {processed} scenes")

    print(f"\n=== Invariants across {processed} processed scenes ===")
    print(f"[{'PASS' if inv1_pass==processed else 'PARTIAL'}] "
          f"INV1 window not blown vs merge: {inv1_pass}/{processed}")
    print(f"[{'PASS' if inv2_pass==processed else 'PARTIAL'}] "
          f"INV2 no new clipping vs merge: {inv2_pass}/{processed}")
    if inv3_diffs:
        arr = np.array(inv3_diffs)
        within = int((arr <= INTERIOR_TOL).sum())
        print(f"[INV3] interior vs human-finish target: "
              f"median|Δ|={np.median(arr):.1f}  mean={arr.mean():.1f}  "
              f"within tol({INTERIOR_TOL})={within}/{len(arr)}")
    print(f"\nDebug dumps for first {DUMP_FIRST_N} scenes in {DEBUG_DIR}/")


if __name__ == "__main__":
    main()
