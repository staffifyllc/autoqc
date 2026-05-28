"""
Validate hdr/scene.classify_scene against the 699 Spear finished set.

Runs the classifier on every finished JPEG, prints the INT/EXT call +
the deciding fractions, and writes a labeled contact sheet to the
Desktop so Paul can eyeball every call in one image.

Usage:
    python3 scripts/validate_scene_classifier.py
"""

import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lambda", "qc_engine"))
from hdr.scene import classify_scene  # noqa: E402

FIN = os.path.expanduser("~/Desktop/699 Spear Cemetery Rd Reading VT FIN")
OUT = os.path.expanduser("~/Desktop/scene_classification_contact_sheet.jpg")


def main():
    files = sorted(
        [f for f in os.listdir(FIN) if f.lower().endswith((".jpg", ".jpeg"))],
        key=lambda x: (len(x), x),
    )
    thumbs = []
    n_ext = n_int = 0
    print(f"{'file':<10} {'scene':<9} foliage  blue_sky bright   reasons")
    print("-" * 80)
    for fn in files:
        path = os.path.join(FIN, fn)
        img = cv2.imread(path)
        if img is None:
            continue
        scene, d = classify_scene(img)
        if scene == "exterior":
            n_ext += 1
        else:
            n_int += 1
        short = fn.replace("699 Spear Cemetery Rd Reading VT ", "").replace(".jpg", "")
        print(
            f"{short:<10} {scene:<9} {d['foliage_frac']:.3f}   "
            f"{d['blue_sky_frac']:.3f}    {d['bright_sky_frac']:.3f}    "
            f"{','.join(d['reasons'])}"
        )

        # thumb with a colored banner: green=exterior, blue=interior
        th = cv2.resize(img, (320, 213), interpolation=cv2.INTER_AREA)
        banner = np.zeros((34, 320, 3), np.uint8)
        color = (60, 200, 60) if scene == "exterior" else (200, 120, 40)
        banner[:] = color
        cv2.putText(
            banner, f"{short}: {scene.upper()}", (6, 24),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA,
        )
        thumbs.append(np.vstack([banner, th]))

    print("-" * 80)
    print(f"EXTERIOR: {n_ext}   INTERIOR: {n_int}   TOTAL: {n_ext + n_int}")

    # contact sheet: 5 columns
    cols = 5
    cell_h, cell_w = thumbs[0].shape[:2]
    rows = (len(thumbs) + cols - 1) // cols
    sheet = np.full((rows * cell_h, cols * cell_w, 3), 30, np.uint8)
    for i, t in enumerate(thumbs):
        r, c = divmod(i, cols)
        sheet[r * cell_h:(r + 1) * cell_h, c * cell_w:(c + 1) * cell_w] = t
    cv2.imwrite(OUT, sheet, [cv2.IMWRITE_JPEG_QUALITY, 90])
    print(f"\nContact sheet: {OUT}")


if __name__ == "__main__":
    main()
