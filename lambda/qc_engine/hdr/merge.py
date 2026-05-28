"""
HDR bracket merge for Flylisted (Sony A7III/A7IV ARW workflow).

Given N bracket S3 keys for one scene, this module:
  1. Decodes each RAW via rawpy (LibRaw under the hood). Handles ARW,
     CR2/CR3, NEF, RAF, ORF, DNG, etc. — Sony today, others without
     code change later.
  2. Aligns frames with cv2.createAlignMTB to correct micro-shift even
     on a tripod. Mean Threshold Bitmap is the standard for bracket
     alignment and works without exposure metadata.
  3. Fuses the aligned brackets with cv2.createMergeMertens — the
     exposure-fusion algorithm the high-end real-estate "flambient"
     workflow emulates manually. Outputs an 8-bit BGR display-ready
     image; no separate tonemap step.

The merged frame is then handed back to handler.py which runs it
through the standard composition / smart_editor / fix pipeline.

This module is intentionally self-contained: no DB writes, no SQS, no
S3 — just file paths in, file path out. Easier to test, easier to
unit-run locally on real Flylisted bracket sets.
"""

import os
import tempfile
import traceback
from typing import Optional

import cv2
import numpy as np
import rawpy


# rawpy postprocess parameters tuned for real-estate interiors shot on
# Sony bodies. use_camera_wb honors the in-camera WB (close enough
# Stage 1 (decode) per the architecture contract: owns demosaic + color
# space, makes NO tonal decisions. use_camera_wb honors in-camera WB
# (close enough; smart_editor refines). output_bps=8 feeds straight into
# Mertens. AHD demosaic is the default quality/speed tradeoff.
#
# no_auto_bright is the load-bearing setting:
#   True  (bracket merge) — LibRaw applies NO per-frame auto-brightness,
#         so the AEB exposure ladder is preserved. The darkest bracket
#         stays dark and HOLDS the window / exterior detail that Mertens
#         pulls from. This is required for stage 3's invariant ("window
#         detail intact in merge output").
#   False (single frame)  — no merge to balance brightness, so let LibRaw
#         auto-brighten or a lone dark frame comes back near-black.
#
# Why this matters: with auto-bright ON for brackets, LibRaw lifted the
# darkest frame ~4x (mean luma 24 -> 106 on a real Sony bracket),
# flattening the ladder and clipping the window BEFORE merge ran. That
# is a stage-1 tonal decision the contract forbids, and it was the root
# cause of blown windows in the merge output.
def _rawpy_params(no_auto_bright: bool) -> dict:
    return dict(
        use_camera_wb=True,
        output_bps=8,
        no_auto_bright=no_auto_bright,
        output_color=rawpy.ColorSpace.sRGB,
    )


# Long-edge resolution cap applied at decode. A 33MP A7IV bracket
# decoded full-res, times 5-7 frames, times the float32 Laplacian
# pyramids cv2.MergeMertens builds, blew past the 4GB Lambda ceiling
# and OOM-crashed every interior merge (exteriors from smaller DJI
# files squeaked under — hence "exteriors done, interiors stuck").
# Capping the long edge to 3072px (~6MP) cuts peak merge memory ~5x
# and is still well above MLS / web delivery needs (typically
# 2048-3072px). Raise this only alongside a Lambda memory bump.
MAX_MERGE_EDGE = 3072


def _decode_raw(raw_path: str, no_auto_bright: bool = True) -> Optional[np.ndarray]:
    """
    Decode a single RAW (ARW/CR3/NEF/etc.) to an 8-bit BGR numpy array,
    capped to MAX_MERGE_EDGE on the long side to bound merge memory.

    no_auto_bright defaults to True (the bracket-merge case) so the
    exposure ladder is preserved. Pass False for single-frame decode
    where there is no merge to balance brightness.

    Returns None on decode failure so the caller can skip the bracket
    instead of failing the whole merge.
    """
    try:
        with rawpy.imread(raw_path) as raw:
            rgb = raw.postprocess(**_rawpy_params(no_auto_bright))
        # rawpy returns RGB; OpenCV operates in BGR
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        h, w = bgr.shape[:2]
        if max(h, w) > MAX_MERGE_EDGE:
            scale = MAX_MERGE_EDGE / max(h, w)
            bgr = cv2.resize(
                bgr,
                (int(round(w * scale)), int(round(h * scale))),
                interpolation=cv2.INTER_AREA,
            )
        return bgr
    except Exception as e:
        print(f"RAW decode failed for {raw_path}: {e}")
        return None


def _normalize_sizes(frames: list[np.ndarray]) -> list[np.ndarray]:
    """
    Sony A7III (24MP) and A7IV (33MP) produce different sized arrays.
    Inside a single bracket set they should all match, but defensive
    resizing handles edge cases (cropped frames, mixed bodies).
    Picks the smallest H/W in the set as the target.
    """
    if not frames:
        return frames
    min_h = min(f.shape[0] for f in frames)
    min_w = min(f.shape[1] for f in frames)
    out = []
    for f in frames:
        if f.shape[0] != min_h or f.shape[1] != min_w:
            out.append(cv2.resize(f, (min_w, min_h), interpolation=cv2.INTER_AREA))
        else:
            out.append(f)
    return out


def merge_brackets(
    bracket_paths: list[str],
    output_path: Optional[str] = None,
) -> tuple[Optional[str], dict]:
    """
    Decode → align → Mertens-fuse a list of RAW bracket files.

    Returns (path_to_merged_jpeg, metadata_dict).
    On any failure returns (None, {"error": "..."}).

    metadata_dict carries:
      - frame_count: int (how many brackets actually decoded)
      - merged_resolution: (h, w)
      - operations: list[str] for the UI
    """
    if not bracket_paths:
        return None, {"error": "no bracket paths provided"}
    if len(bracket_paths) < 2:
        return None, {"error": "need at least 2 brackets to merge"}

    try:
        # 1. Decode every bracket. Drop any that fail.
        frames = []
        for p in bracket_paths:
            arr = _decode_raw(p)
            if arr is not None:
                frames.append(arr)

        if len(frames) < 2:
            return None, {
                "error": f"only {len(frames)} of {len(bracket_paths)} brackets decoded — cannot merge"
            }

        frames = _normalize_sizes(frames)
        h, w = frames[0].shape[:2]

        # 2. Align. AlignMTB works on 8-bit images and corrects sub-pixel
        # shifts that even tripod shots accumulate (mirror slap, wind,
        # tripod creep). No-op if frames are already aligned.
        aligner = cv2.createAlignMTB()
        aligned: list[np.ndarray] = []
        aligner.process(frames, aligned)

        # OpenCV's AlignMTB sometimes returns an empty list on extreme
        # frames; fall back to unaligned in that case rather than failing.
        if not aligned or len(aligned) != len(frames):
            print("AlignMTB returned unexpected output, using unaligned frames")
            aligned = frames

        # 3. Mertens exposure fusion. Returns a float32 image in [0,1].
        merger = cv2.createMergeMertens()
        fused_float = merger.process(aligned)

        # Clip and convert to uint8 for the rest of the pipeline.
        fused_uint8 = np.clip(fused_float * 255.0, 0, 255).astype(np.uint8)

        # 4. Write to disk as JPEG (the rest of qc_engine expects a path).
        if output_path is None:
            tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
            output_path = tmp.name
            tmp.close()
        cv2.imwrite(output_path, fused_uint8, [cv2.IMWRITE_JPEG_QUALITY, 95])

        return output_path, {
            "frame_count": len(frames),
            "merged_resolution": (h, w),
            "operations": [
                f"HDR merged from {len(frames)} brackets",
                "Aligned (MTB)",
                "Fused (Mertens exposure fusion)",
            ],
        }

    except Exception as e:
        print(f"HDR merge failed: {e}")
        traceback.print_exc()
        return None, {"error": str(e)[:500]}


def merge_brackets_from_s3(
    s3_client,
    bucket: str,
    bracket_keys: list[str],
) -> tuple[Optional[str], dict]:
    """
    Convenience wrapper: pull bracket files from S3 to local temp, run
    merge_brackets, clean up the bracket downloads. Returns the same
    (path, metadata) shape as merge_brackets.
    """
    local_paths: list[str] = []
    try:
        for key in bracket_keys:
            # Preserve the source extension so rawpy picks the right
            # decoder. ARW for Sony, CR3 for Canon, etc.
            ext = "." + key.split(".")[-1].lower()
            tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
            s3_client.download_file(bucket, key, tmp.name)
            local_paths.append(tmp.name)
            tmp.close()

        return merge_brackets(local_paths)
    finally:
        for p in local_paths:
            try:
                os.unlink(p)
            except OSError:
                pass


def decode_single_raw_from_s3(
    s3_client,
    bucket: str,
    raw_key: str,
) -> tuple[Optional[str], dict]:
    """
    Single-frame RAW path: pull one RAW from S3, demosaic via rawpy,
    write to a JPEG temp file. Used when a Photo has bracketKeys with
    a single entry (drone hero shots, missed brackets, etc.) so the
    standard composition + smart_editor pipeline can still process it.

    Returns (path_to_decoded_jpeg, metadata_dict) or (None, {"error":...}).
    """
    ext = "." + raw_key.split(".")[-1].lower()
    raw_tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    try:
        s3_client.download_file(bucket, raw_key, raw_tmp.name)
        raw_tmp.close()
        # Single frame: no merge to balance brightness, so allow LibRaw
        # auto-brightness (no_auto_bright=False) or a lone dark frame
        # comes back near-black.
        arr = _decode_raw(raw_tmp.name, no_auto_bright=False)
        if arr is None:
            return None, {"error": f"rawpy could not decode {raw_key}"}
        out = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        cv2.imwrite(out.name, arr, [cv2.IMWRITE_JPEG_QUALITY, 95])
        out.close()
        return out.name, {
            "frame_count": 1,
            "operations": ["RAW decoded (single frame, no merge)"],
        }
    finally:
        try:
            os.unlink(raw_tmp.name)
        except OSError:
            pass
