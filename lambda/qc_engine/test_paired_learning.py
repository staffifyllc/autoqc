"""
test_paired_learning.py

Proof: does learning the actual merged->finished transform from PAIRS
beat the global histogram match?

Method:
  1. Group + Mertens-merge every raw scene (same as test_full_set).
  2. Load the 55 finished JPEGs.
  3. MATCH each finished JPEG to its merged scene by downscaled
     grayscale normalized cross-correlation (same composition,
     different grade -> structural match is reliable).
  4. LEARN: for each matched pair, build a per-channel LAB mapping
     (merged channel CDF -> finished channel CDF) and AVERAGE those
     mappings across all pairs. That averaged LUT is the editor's
     learned recipe: "given a merge that looks like THIS, the editor
     produces THAT." Unlike the global histogram (match to the
     average finished distribution), this is conditioned on real
     input->output examples, so it can safely move color (a/b) too.
  5. APPLY the learned LUT to each merged scene -> predicted finish.
  6. MEASURE L-channel percentile distance to the true finish for:
       - baseline (raw merge, no edit)
       - paired-learned LUT
     and compare to the histogram baseline (median 21.6 from
     test_full_set).

Leave-one-out is overkill for a proof; we report train-set fit, which
is the right first signal (does the transform even capture the look?).
"""

import os, sys, glob, datetime as dt
import cv2
import numpy as np
import rawpy
import exifread

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

RAW = "/Users/paulchareth/Desktop/699 Spear Cemetery Rd Reading VT RAW"
FIN = "/Users/paulchareth/Desktop/699 Spear Cemetery Rd Reading VT FIN"
GAP = 10.0
PCTS = list(range(1, 100))


def exif_time_bias(p):
    try:
        with open(p, "rb") as fh:
            t = exifread.process_file(fh, details=False,
                                      stop_tag="EXIF ExposureBiasValue")
        d = t.get("EXIF DateTimeOriginal")
        ep = None
        if d:
            try:
                ep = dt.datetime.strptime(str(d), "%Y:%m:%d %H:%M:%S").timestamp()
            except Exception:
                ep = None
        b = t.get("EXIF ExposureBiasValue"); bv = 0.0
        if b is not None:
            try:
                r = b.values[0]
                bv = float(r.num)/float(r.den) if r.den else float(r.num)
            except Exception:
                bv = 0.0
        return ep, bv
    except Exception:
        return None, 0.0


def dji_key(name):
    import re
    m = re.search(r"(\d{14})", name)
    return m.group(1) if m else None


def group_scenes(files):
    metas = []
    for p in files:
        ep, bv = exif_time_bias(p)
        metas.append({"p": p, "name": os.path.basename(p), "ep": ep, "bv": bv,
                      "k": dji_key(os.path.basename(p))})
    scenes = []
    from collections import defaultdict
    bykey = defaultdict(list)
    for m in metas:
        if m["k"]:
            bykey[m["k"]].append(m)
    for k in sorted(bykey):
        scenes.append(bykey[k])
    rest = [m for m in metas if not m["k"] and m["ep"] is not None]
    rest.sort(key=lambda x: x["ep"])
    cur = []
    for m in rest:
        if cur and m["ep"] - cur[-1]["ep"] > GAP:
            scenes.append(cur); cur = []
        cur.append(m)
    if cur:
        scenes.append(cur)
    return scenes


def dec(p, longside=900):
    with rawpy.imread(p) as raw:
        rgb = raw.postprocess(use_camera_wb=True, output_bps=8,
                              half_size=True, no_auto_bright=True)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    h, w = bgr.shape[:2]
    if max(h, w) > longside:
        s = longside / max(h, w)
        bgr = cv2.resize(bgr, (int(w*s), int(h*s)), interpolation=cv2.INTER_AREA)
    return bgr


def merge_scene(scene):
    frames = []
    for m in sorted(scene, key=lambda x: x["bv"]):
        try:
            frames.append(dec(m["p"]))
        except Exception:
            pass
    if not frames:
        return None
    mh = min(f.shape[0] for f in frames); mw = min(f.shape[1] for f in frames)
    frames = [cv2.resize(f, (mw, mh)) for f in frames]
    if len(frames) == 1:
        return frames[0]
    al = []
    cv2.createAlignMTB().process(frames, al)
    if not al or len(al) != len(frames):
        al = frames
    return np.clip(cv2.createMergeMertens().process(al)*255, 0, 255).astype(np.uint8)


def gray_sig(img):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    g = cv2.resize(g, (64, 64)).astype(np.float32)
    g -= g.mean()
    n = np.linalg.norm(g)
    return g / n if n else g


def channel_map(src_ch, dst_ch):
    """256-entry LUT mapping src channel values to dst via CDF spec."""
    sh, _ = np.histogram(src_ch, 256, (0, 256))
    dh, _ = np.histogram(dst_ch, 256, (0, 256))
    scdf = np.cumsum(sh).astype(np.float64); scdf /= max(scdf[-1], 1)
    dcdf = np.cumsum(dh).astype(np.float64); dcdf /= max(dcdf[-1], 1)
    lut = np.interp(scdf, dcdf, np.arange(256)).astype(np.float64)
    return lut  # float so we can average across pairs


def lab_diff_L(img, target_L_pcts):
    L = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)[..., 0]
    p = np.percentile(L, PCTS)
    return float(np.mean(np.abs(p - target_L_pcts)))


def main():
    raws = [p for p in glob.glob(f"{RAW}/*")
            if p.lower().endswith((".arw", ".dng"))]
    scenes = group_scenes(raws)
    scenes = [s for s in scenes if len(s) >= 2]
    print(f"Merging {len(scenes)} bracket scenes...")
    merged = []
    for i, s in enumerate(scenes):
        m = merge_scene(s)
        if m is not None:
            merged.append(m)
        if (i + 1) % 15 == 0:
            print(f"  merged {i+1}/{len(scenes)}")

    fins = [cv2.imread(f) for f in sorted(glob.glob(f"{FIN}/*.jpg"))]
    fins = [f for f in fins if f is not None]
    print(f"Finished JPEGs: {len(fins)};  merged scenes: {len(merged)}")

    # signatures for matching
    msig = [gray_sig(m) for m in merged]
    fsig = [gray_sig(f) for f in fins]

    # match each finished to best merged (NCC)
    pairs = []  # (merged_idx, fin_idx, score)
    used = set()
    for fi, fs in enumerate(fsig):
        best, bj = -2, -1
        for mj, ms in enumerate(msig):
            sc = float((fs * ms).sum())
            if sc > best:
                best, bj = sc, mj
        pairs.append((bj, fi, best))
    good = [p for p in pairs if p[2] > 0.5]
    print(f"Matched pairs (NCC>0.5): {len(good)} / {len(fins)}")

    # learn averaged LAB channel LUTs from matched pairs
    acc = [np.zeros(256) for _ in range(3)]
    cnt = 0
    for mj, fi, sc in good:
        ml = cv2.cvtColor(merged[mj], cv2.COLOR_BGR2LAB)
        fl = cv2.cvtColor(fins[fi], cv2.COLOR_BGR2LAB)
        for c in range(3):
            acc[c] += channel_map(ml[..., c].ravel(), fl[..., c].ravel())
        cnt += 1
    if cnt == 0:
        print("No matched pairs; cannot learn."); return
    learned = [np.clip(a / cnt, 0, 255).astype(np.uint8) for a in acc]

    # apply learned LUT to each matched merged, measure vs its finished
    base_d, paired_d = [], []
    for mj, fi, sc in good:
        finL = np.percentile(cv2.cvtColor(fins[fi], cv2.COLOR_BGR2LAB)[..., 0], PCTS)
        base_d.append(lab_diff_L(merged[mj], finL))
        lab = cv2.cvtColor(merged[mj], cv2.COLOR_BGR2LAB)
        for c in range(3):
            lab[..., c] = cv2.LUT(lab[..., c], learned[c])
        pred = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        paired_d.append(lab_diff_L(pred, finL))

    base_d, paired_d = np.array(base_d), np.array(paired_d)
    print("\n=== L-channel distance to the human finish (lower = closer) ===")
    print(f"  raw merge, no edit:      median {np.median(base_d):.1f}  mean {base_d.mean():.1f}")
    print(f"  paired-learned transform: median {np.median(paired_d):.1f}  mean {paired_d.mean():.1f}")
    print(f"  (histogram baseline from test_full_set: median 21.6)")
    impr = (np.median(base_d) - np.median(paired_d))
    print(f"\n  paired learning closed {impr:.1f} L-units vs raw merge, "
          f"and {'BEATS' if np.median(paired_d) < 21.6 else 'does NOT beat'} "
          f"the histogram (21.6).")

    # dump a few visual triples: merged | predicted | finished
    os.makedirs("debug_paired", exist_ok=True)
    for n, (mj, fi, sc) in enumerate(good[:6]):
        lab = cv2.cvtColor(merged[mj], cv2.COLOR_BGR2LAB)
        for c in range(3):
            lab[..., c] = cv2.LUT(lab[..., c], learned[c])
        pred = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        h = min(merged[mj].shape[0], pred.shape[0], fins[fi].shape[0])
        def rs(x):
            return cv2.resize(x, (int(x.shape[1]*h/x.shape[0]), h))
        strip = np.hstack([rs(merged[mj]), rs(pred), rs(fins[fi])])
        cv2.imwrite(f"debug_paired/pair_{n:02d}_merge_pred_finish.png", strip)
    print("\nVisual triples (merge | predicted | finish) -> debug_paired/")


if __name__ == "__main__":
    main()
