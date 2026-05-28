"""
train_style_model.py

Train a v1 "editor recipe" from raw->finished PAIRS and SAVE it as a
model artifact the pipeline can load. Free, local, CPU-only numpy —
no GPU, no cloud, no API. Costs $0 to run.

Output: hdr/learned_style.npz
  luts: (3, 256) uint8 LAB channel maps (merge -> finished)
  meta: pair count, source shoot, date

This is the same averaged-LAB-transform that beat the histogram in
test_paired_learning (16.8 vs 21.6), persisted so style_transfer can
apply it instead of the statistical histogram. Trained on one shoot
for now (699 Spear); accuracy improves as more paired shoots are added.
"""

import os, sys, glob, json, datetime as dt
import cv2
import numpy as np
import rawpy
import exifread

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

RAW = "/Users/paulchareth/Desktop/699 Spear Cemetery Rd Reading VT RAW"
FIN = "/Users/paulchareth/Desktop/699 Spear Cemetery Rd Reading VT FIN"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hdr", "learned_style.npz")
GAP = 10.0


def exif(p):
    try:
        with open(p, "rb") as fh:
            t = exifread.process_file(fh, details=False, stop_tag="EXIF ExposureBiasValue")
        d = t.get("EXIF DateTimeOriginal"); ep = None
        if d:
            try: ep = dt.datetime.strptime(str(d), "%Y:%m:%d %H:%M:%S").timestamp()
            except Exception: pass
        b = t.get("EXIF ExposureBiasValue"); bv = 0.0
        if b is not None:
            try:
                r = b.values[0]; bv = float(r.num)/float(r.den) if r.den else float(r.num)
            except Exception: pass
        return ep, bv
    except Exception:
        return None, 0.0


def dji_key(n):
    import re; m = re.search(r"(\d{14})", n); return m.group(1) if m else None


def group(files):
    from collections import defaultdict
    metas = [{"p": p, "n": os.path.basename(p), **dict(zip(("ep", "bv"), exif(p))),
              "k": dji_key(os.path.basename(p))} for p in files]
    scenes = []
    bk = defaultdict(list)
    for m in metas:
        if m["k"]: bk[m["k"]].append(m)
    for k in sorted(bk): scenes.append(bk[k])
    rest = sorted([m for m in metas if not m["k"] and m["ep"]], key=lambda x: x["ep"])
    cur = []
    for m in rest:
        if cur and m["ep"] - cur[-1]["ep"] > GAP:
            scenes.append(cur); cur = []
        cur.append(m)
    if cur: scenes.append(cur)
    return [s for s in scenes if len(s) >= 2]


def dec(p, ls=900):
    with rawpy.imread(p) as raw:
        rgb = raw.postprocess(use_camera_wb=True, output_bps=8, half_size=True, no_auto_bright=True)
    b = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    h, w = b.shape[:2]
    if max(h, w) > ls:
        s = ls/max(h, w); b = cv2.resize(b, (int(w*s), int(h*s)), interpolation=cv2.INTER_AREA)
    return b


def merge(scene):
    fr = []
    for m in sorted(scene, key=lambda x: x["bv"]):
        try: fr.append(dec(m["p"]))
        except Exception: pass
    if not fr: return None
    mh = min(f.shape[0] for f in fr); mw = min(f.shape[1] for f in fr)
    fr = [cv2.resize(f, (mw, mh)) for f in fr]
    if len(fr) == 1: return fr[0]
    al = []; cv2.createAlignMTB().process(fr, al)
    if not al or len(al) != len(fr): al = fr
    return np.clip(cv2.createMergeMertens().process(al)*255, 0, 255).astype(np.uint8)


def sig(img):
    g = cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (64, 64)).astype(np.float32)
    g -= g.mean(); n = np.linalg.norm(g); return g/n if n else g


def cmap(s, d):
    sh, _ = np.histogram(s, 256, (0, 256)); dh, _ = np.histogram(d, 256, (0, 256))
    sc = np.cumsum(sh).astype(float); sc /= max(sc[-1], 1)
    dc = np.cumsum(dh).astype(float); dc /= max(dc[-1], 1)
    return np.interp(sc, dc, np.arange(256))


def main():
    raws = [p for p in glob.glob(f"{RAW}/*") if p.lower().endswith((".arw", ".dng"))]
    scenes = group(raws)
    print(f"Merging {len(scenes)} scenes (free, local)...")
    merged = []
    for i, s in enumerate(scenes):
        m = merge(s)
        if m is not None: merged.append(m)
        if (i+1) % 15 == 0: print(f"  {i+1}/{len(scenes)}")
    fins = [cv2.imread(f) for f in sorted(glob.glob(f"{FIN}/*.jpg"))]
    fins = [f for f in fins if f is not None]
    msig = [sig(m) for m in merged]; fsig = [sig(f) for f in fins]

    pairs = []
    for fi, fs in enumerate(fsig):
        best, bj = -2, -1
        for mj, ms in enumerate(msig):
            sc = float((fs*ms).sum())
            if sc > best: best, bj = sc, mj
        if best > 0.5: pairs.append((bj, fi))
    print(f"Matched {len(pairs)} raw->finished pairs")

    acc = [np.zeros(256) for _ in range(3)]; n = 0
    for mj, fi in pairs:
        ml = cv2.cvtColor(merged[mj], cv2.COLOR_BGR2LAB)
        fl = cv2.cvtColor(fins[fi], cv2.COLOR_BGR2LAB)
        for c in range(3): acc[c] += cmap(ml[..., c].ravel(), fl[..., c].ravel())
        n += 1
    luts = np.stack([np.clip(a/n, 0, 255).astype(np.uint8) for a in acc])
    np.savez(OUT, luts=luts,
             meta=json.dumps({"pairs": n, "source": "699 Spear Cemetery",
                              "trained": dt.datetime.now().isoformat()}))
    print(f"\nSaved v1 model -> {OUT}  ({n} pairs)")
    print("LAB channel deltas the editor applies (lut[v]-v at quartiles):")
    for c, name in enumerate("Lab"):
        d = [int(luts[c][q]) - q for q in (64, 128, 192)]
        print(f"  {name}: shadow{d[0]:+d}  mid{d[1]:+d}  high{d[2]:+d}")


if __name__ == "__main__":
    main()
