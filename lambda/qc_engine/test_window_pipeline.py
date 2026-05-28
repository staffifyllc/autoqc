"""
test_window_pipeline.py

Stage-by-stage test of the window-protection wiring against the three
invariants in CLAUDE.md (the Photo-Edit Pipeline contract).

Runs the REAL modules:
    merge   -> cv2.createAlignMTB + cv2.createMergeMertens  (same primitives merge.py uses)
    style   -> hdr.style_transfer.match_to_profile          (stage 5)
    protect -> checks.window_protect.protect_windows        (stage 4)

Fixture: a synthesized bracket set (dark interior + bright window at 3
exposures). The merge holds the window; the style target is built to
LIFT shadows/brighten, which would blow the window if unprotected.
protect_windows must composite the merged window back.

Dumps every stage to ./debug per the contract. Prints PASS/FAIL for
each invariant. Exits non-zero if any invariant fails.

This is the fixed fixture for now; swap synthesize_brackets() for real
RAW decode + a human Lightroom finish once those files are available.
"""

import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from hdr.style_transfer import (  # noqa: E402
    match_to_profile,
    compute_lab_percentiles,
    aggregate_profile,
)
from checks.window_protect import protect_windows, detect_window_mask  # noqa: E402

DEBUG_DIR = "./debug"
EPS = 2.0          # luminance tolerance (0-255 scale) for invariant 1
INTERIOR_TOL = 30.0  # L-channel mean abs diff tolerance for invariant 3


def _luma_bgr(img_bgr):
    """Rec.709 luminance on a BGR uint8 image, returns float 0-255."""
    b = img_bgr[..., 0].astype(np.float32)
    g = img_bgr[..., 1].astype(np.float32)
    r = img_bgr[..., 2].astype(np.float32)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def synthesize_brackets():
    """
    3 exposures of a dark interior with one bright window.
    EV -2 / 0 / +2. Window holds detail at the dark exposure and
    clips at the bright one — exactly the real-estate failure case.
    Returns list of BGR uint8 arrays.
    """
    h, w = 600, 800
    win = (slice(150, 400), slice(500, 740))
    brackets = []
    for ev in (-2, 0, 2):
        gain = 2.0 ** ev
        img = np.full((h, w, 3), 55.0, np.float32)   # interior ~55
        # add a little texture so percentile math isn't degenerate
        img += np.random.RandomState(ev + 5).normal(0, 4, img.shape)
        img *= gain
        # window: bright exterior. At EV0 it's ~210; at +2 it clips.
        img[win] = 210.0 * gain
        brackets.append(np.clip(img, 0, 255).astype(np.uint8))
    return brackets


def build_style_target():
    """
    Build a style histogram from a synthetic 'finished' reference that
    has LIFTED shadows + brightened midtones. This is the kind of
    target that, applied globally, pushes the whole frame brighter and
    blows the window — so it's a faithful stress test for stage 4.
    """
    h, w = 600, 800
    refs = []
    for seed in range(6):
        img = np.full((h, w, 3), 130.0, np.float32)  # bright, lifted
        img += np.random.RandomState(seed).normal(0, 25, img.shape)
        img = np.clip(img, 18, 245).astype(np.uint8)  # shadows lifted to ~18
        refs.append(compute_lab_percentiles(img))
    return aggregate_profile(refs)


def main():
    os.makedirs(DEBUG_DIR, exist_ok=True)

    # --- MERGE (stage 3, unchanged) ---
    brackets = synthesize_brackets()
    aligner = cv2.createAlignMTB()
    aligned = []
    aligner.process(brackets, aligned)
    if not aligned or len(aligned) != len(brackets):
        aligned = brackets
    merger = cv2.createMergeMertens()
    merged_f = merger.process(aligned)
    merged = np.clip(merged_f * 255.0, 0, 255).astype(np.uint8)  # BGR

    # --- STYLE TRANSFER (stage 5) ---
    profile = build_style_target()
    styled = match_to_profile(merged, profile, strength=0.6)  # BGR

    # --- WINDOW PROTECTION (stage 4) ---
    merged_rgb = cv2.cvtColor(merged, cv2.COLOR_BGR2RGB)
    styled_rgb = cv2.cvtColor(styled, cv2.COLOR_BGR2RGB)
    final_rgb = protect_windows(merged_rgb, styled_rgb, debug_dir=DEBUG_DIR)
    final = cv2.cvtColor(final_rgb, cv2.COLOR_RGB2BGR)

    # mask used for evaluation (same detector window_protect uses)
    mask = detect_window_mask(merged_rgb)
    mask_bool = mask > 0.5
    interior_bool = ~mask_bool

    if mask_bool.sum() == 0:
        print("FAIL setup: window mask is empty; detector tuning needed.")
        sys.exit(2)

    lum_merge = _luma_bgr(merged)
    lum_styled = _luma_bgr(styled)
    lum_final = _luma_bgr(final)

    # ----- INVARIANT 1 -----
    # Max luminance inside window mask in FINAL <= MERGE + eps.
    merge_win_max = float(lum_merge[mask_bool].max())
    styled_win_max = float(lum_styled[mask_bool].max())
    final_win_max = float(lum_final[mask_bool].max())
    inv1 = final_win_max <= merge_win_max + EPS

    # ----- INVARIANT 2 -----
    # Clipped-channel pixel count in FINAL <= MERGE.
    clipped_merge = int((merged >= 255).any(axis=2).sum())
    clipped_styled = int((styled >= 255).any(axis=2).sum())
    clipped_final = int((final >= 255).any(axis=2).sum())
    inv2 = clipped_final <= clipped_merge

    # ----- INVARIANT 3 -----
    # FINAL interior histogram within tolerance of the (room) target.
    # Per-room targets not trained yet -> validated against the global
    # target as a stand-in. At strength 0.6 the interior only moves
    # part-way, so the tolerance is generous and we report the number.
    final_L = cv2.cvtColor(final, cv2.COLOR_BGR2LAB)[..., 0]
    final_interior_pcts = np.percentile(
        final_L[interior_bool], list(range(1, 100))
    )
    target_L = np.array(profile["L"], dtype=np.float64)
    interior_diff = float(np.mean(np.abs(final_interior_pcts - target_L)))
    inv3 = interior_diff <= INTERIOR_TOL

    def line(ok, label, detail):
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}: {detail}")

    print("\n=== Window-protection invariants ===")
    print(
        f"(context) window max luminance — "
        f"merge={merge_win_max:.1f}  styled={styled_win_max:.1f}  "
        f"final={final_win_max:.1f}"
    )
    line(
        inv1,
        "INV1 window max(FINAL) <= max(MERGE)+eps",
        f"{final_win_max:.1f} <= {merge_win_max:.1f}+{EPS} "
        f"(styled was {styled_win_max:.1f})",
    )
    line(
        inv2,
        "INV2 clipped(FINAL) <= clipped(MERGE)",
        f"{clipped_final} <= {clipped_merge} (styled introduced {clipped_styled})",
    )
    line(
        inv3,
        "INV3 interior hist within tol of target",
        f"mean|Δ|={interior_diff:.1f} <= {INTERIOR_TOL}",
    )
    print(f"\nDebug intermediates written to {DEBUG_DIR}/")
    print(
        "  01_merged.png 02_styled.png 03_window_mask.png 04_final.png"
    )

    all_pass = inv1 and inv2 and inv3
    print(f"\nRESULT: {'ALL PASS' if all_pass else 'FAILURES PRESENT'}\n")
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
