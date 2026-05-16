"""
AI Deblur via Replicate API

Uses open-source deblurring models to recover detail in soft/blurry photos.
Runs on Replicate.com's infrastructure (no GPU setup needed on our end).

Cost: ~$0.001 per image. Only runs when the photo actually needs it
(mild-to-moderate softness or if cheap sharpening wasn't enough).

Model: NAFNet (Nonlinear Activation Free Network)
State-of-the-art for image deblurring, specifically trained for this task.
Works best on real estate architecture (no faces to distort).

Fallback: if Replicate is down or the API token isn't set,
we gracefully fall back to local unsharp mask.
"""

import os
import tempfile
import urllib.request

import replicate


# Model: NAFNet trained for deblurring
# https://replicate.com/megvii-research/nafnet
#
# Note: omit the :hash pin so Replicate resolves to the latest
# published version. We previously pinned a specific hash
# (faf6a49a...) which Replicate deprecated; every call started
# returning 422 Unprocessable Entity and the lambda spammed
# CloudWatch with "Replicate deblur failed: ReplicateError" for
# every soft photo. Unpinning lets the model upgrade gracefully.
NAFNET_MODEL = "megvii-research/nafnet"

# Alternative: Restormer (higher quality but 2x cost)
RESTORMER_MODEL = "jingyunliang/swinir"


def ai_deblur(image_path: str, current_sharpness: float) -> tuple[str | None, str]:
    """
    Deblur a soft/blurry photo using AI.

    Args:
        image_path: Path to the soft image
        current_sharpness: Laplacian variance from check_sharpness()

    Returns:
        (path to deblurred image, description) or (None, reason)
    """
    api_token = os.environ.get("REPLICATE_API_TOKEN")
    if not api_token:
        return None, "Replicate API not configured"

    # Don't waste API calls on photos that are already sharp enough
    if current_sharpness > 120:
        return None, "Already sharp, no deblur needed"

    # Heavy blur is often unrecoverable even with AI
    # but it's worth trying since the cost is tiny
    try:
        client = replicate.Client(api_token=api_token)

        # Open the image file for upload
        with open(image_path, "rb") as f:
            output = client.run(
                NAFNET_MODEL,
                input={
                    "image": f,
                    "task_type": "Image Debluring (GoPro)",  # Most general deblur
                },
            )

        # Output is a URL to the processed image
        output_url = str(output)

        # Download the result
        suffix = "." + image_path.split(".")[-1]
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)

        with urllib.request.urlopen(output_url) as response:
            tmp.write(response.read())
            tmp.close()

        # Verify the result is actually better (safety check)
        import cv2
        import numpy as np

        new_img = cv2.imread(tmp.name)
        if new_img is None:
            return None, "Could not read AI output"

        new_gray = cv2.cvtColor(new_img, cv2.COLOR_BGR2GRAY)
        new_sharpness = float(cv2.Laplacian(new_gray, cv2.CV_64F).var())

        # If AI made it worse or only marginally better, discard
        if new_sharpness < current_sharpness * 1.3:
            os.unlink(tmp.name)
            return None, "AI deblur did not significantly improve quality"

        return (
            tmp.name,
            f"AI deblur applied (variance {current_sharpness:.0f} → {new_sharpness:.0f})",
        )

    except Exception as e:
        # Replicate occasionally deprecates model versions and returns
        # 422 Unprocessable Entity for every call. We see the full
        # error in CloudWatch and the photo proceeds without deblur.
        # Truncated to keep the log readable.
        err_text = str(e)[:200] or repr(e)[:200]
        print(f"Replicate deblur failed: {err_text}")
        return None, f"AI deblur error: {err_text[:80]}"


def estimate_deblur_cost(num_photos: int) -> float:
    """
    Estimate the cost to deblur N photos.
    Used for internal monitoring and agency cost alerts.
    """
    # NAFNet runs about 2 seconds on T4 GPU at Replicate's pricing
    # T4 is $0.000225/sec
    cost_per_photo = 2.0 * 0.000225
    return num_photos * cost_per_photo
