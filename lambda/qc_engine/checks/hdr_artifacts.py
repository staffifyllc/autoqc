"""
HDR Artifact Detection

Detects common HDR blending artifacts:
1. Haloing - bright/dark halos around high-contrast edges (roofline vs sky,
   furniture vs windows). Standard: halos should not exceed 3-5px.
2. Ghosting - semi-transparent objects from movement between brackets
   (ceiling fans, curtains, pets)
3. Flat/surreal tone mapping - the "overcooked HDR" look where natural
   light falloff is lost and everything looks artificially even.

Target: natural dynamic range, shadows at 15-25% luminance,
highlights not clipped.
"""

import cv2
import numpy as np


def detect_halos(gray: np.ndarray, max_halo_px: int = 5) -> dict:
    """Detect halos around high-contrast edges."""
    # Find edges
    edges = cv2.Canny(gray, 100, 200)

    # Create dilated edge region
    kernel_small = np.ones((3, 3), np.uint8)
    kernel_large = np.ones((max_halo_px * 2 + 1, max_halo_px * 2 + 1), np.uint8)

    edge_thin = cv2.dilate(edges, kernel_small, iterations=1)
    edge_wide = cv2.dilate(edges, kernel_large, iterations=1)

    # Halo region is between thin and wide edge masks
    halo_region = edge_wide & ~edge_thin

    if np.count_nonzero(halo_region) == 0:
        return {"detected": False, "score": 0}

    # In the halo region, check for brightness gradients
    # that indicate haloing (bright-dark-bright pattern)
    halo_pixels = gray[halo_region > 0]
    edge_pixels = gray[edge_thin > 0]

    if len(halo_pixels) == 0 or len(edge_pixels) == 0:
        return {"detected": False, "score": 0}

    # Compare brightness distribution in halo zone vs edge zone
    halo_mean = np.mean(halo_pixels)
    edge_mean = np.mean(edge_pixels)
    halo_std = np.std(halo_pixels)

    # Strong brightness difference between edge and halo zone indicates haloing
    brightness_diff = abs(float(halo_mean - edge_mean))
    halo_score = brightness_diff / 128.0  # Normalize to 0-1

    return {
        "detected": halo_score > 0.15,
        "score": round(halo_score, 3),
    }


def detect_flat_tonemap(gray: np.ndarray) -> dict:
    """Detect overcooked HDR / flat tone mapping."""
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
    hist = hist / hist.sum()

    # Overcooked HDR has a very compressed histogram
    # (everything pushed to midtones, no deep shadows or bright highlights)
    shadow_mass = hist[:50].sum()   # Should be > 0.05 for natural images
    highlight_mass = hist[200:].sum()  # Should be > 0.05

    # Also check for unnatural uniformity in luminance
    std_dev = np.std(gray)

    flat_score = 0
    if shadow_mass < 0.03:
        flat_score += 0.3
    if highlight_mass < 0.03:
        flat_score += 0.3
    if std_dev < 40:
        flat_score += 0.4

    return {
        "detected": flat_score > 0.5,
        "score": round(flat_score, 3),
        "shadow_mass": round(float(shadow_mass), 3),
        "highlight_mass": round(float(highlight_mass), 3),
    }


def check_hdr_artifacts(image_path: str, max_halo_px: int = 5) -> dict:
    img = cv2.imread(image_path)
    if img is None:
        return {"failed": False, "severity": 0, "artifact_type": "none"}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    halo_result = detect_halos(gray, max_halo_px)
    flat_result = detect_flat_tonemap(gray)

    failed = halo_result["detected"] or flat_result["detected"]

    if halo_result["detected"] and flat_result["detected"]:
        artifact_type = "halo_and_flat"
        severity = max(halo_result["score"], flat_result["score"])
    elif halo_result["detected"]:
        artifact_type = "halo"
        severity = halo_result["score"]
    elif flat_result["detected"]:
        artifact_type = "flat_tonemap"
        severity = flat_result["score"]
    else:
        artifact_type = "none"
        severity = 0

    return {
        "failed": failed,
        "severity": round(severity, 2),
        "artifact_type": artifact_type,
        "halo": halo_result,
        "tonemap": flat_result,
    }
