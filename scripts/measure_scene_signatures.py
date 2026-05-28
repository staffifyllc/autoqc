"""
Measure interior vs exterior tonal signatures on the 699 Spear finished
set, split by the VALIDATED hdr/scene.classify_scene classifier.

Emits, per bucket: the LAB L percentile curve at the knots
style_transfer uses ([1,5,10,25,50,75,90,95,99]), mean HSV saturation,
and L std (contrast). These become the interior/exterior targets in
style_transfer.py.
"""

import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lambda", "qc_engine"))
from hdr.scene import classify_scene  # noqa: E402

FIN = os.path.expanduser("~/Desktop/699 Spear Cemetery Rd Reading VT FIN")
PCTS = [1, 5, 10, 25, 50, 75, 90, 95, 99]


def main():
    buckets = {"interior": [], "exterior": []}
    for fn in sorted(os.listdir(FIN)):
        if not fn.lower().endswith((".jpg", ".jpeg")):
            continue
        img = cv2.imread(os.path.join(FIN, fn))
        if img is None:
            continue
        scene, _ = classify_scene(img)
        # downsample for stable, fast stats
        h, w = img.shape[:2]
        if max(h, w) > 720:
            s = 720 / max(h, w)
            img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        L = lab[:, :, 0].ravel()
        buckets[scene].append({
            "L_pcts": np.percentile(L, PCTS),
            "sat": float(np.mean(hsv[:, :, 1])),
            "Lstd": float(np.std(L)),
            "a": float(np.mean(lab[:, :, 1])),
            "b": float(np.mean(lab[:, :, 2])),
        })

    for name, rows in buckets.items():
        if not rows:
            continue
        Lcurve = np.mean([r["L_pcts"] for r in rows], axis=0)
        sat = np.mean([r["sat"] for r in rows])
        lstd = np.mean([r["Lstd"] for r in rows])
        a = np.mean([r["a"] for r in rows])
        b = np.mean([r["b"] for r in rows])
        print(f"\n=== {name.upper()} (n={len(rows)}) ===")
        print("  L pcts:", {p: round(float(v), 1) for p, v in zip(PCTS, Lcurve)})
        print(f"  _TARGET = [{', '.join(f'{v:.1f}' for v in Lcurve)}]")
        print(f"  saturation(mean S)={sat:.1f}  L_std(contrast)={lstd:.1f}  a={a:.1f}  b={b:.1f}")


if __name__ == "__main__":
    main()
