"""
Sharpness Auto-Fix

Applies sharpening to mildly soft photos. Uses unsharp mask for
predictable, natural-looking results.

IMPORTANT: Sharpening cannot recover detail that was never captured.
We classify softness into three tiers:

1. BARELY_SOFT (Laplacian variance 80-100): Light unsharp mask.
   Usually recovers clean look. Safe to auto-fix.

2. MODERATELY_SOFT (Laplacian variance 50-80): Medium unsharp mask
   with edge preservation. May introduce some grain. Auto-fix but
   flag for user to review.

3. HEAVILY_BLURRED (below 50): NO auto-fix attempted. The information
   is lost. Flag for manual reshoot or replacement.

Real estate photos shot on a tripod with good glass should hit
Laplacian variance > 150 consistently. Anything below 100 is
abnormal and worth investigating.
"""

import cv2
import numpy as np
import tempfile


def fix_sharpness(image_path: str, current_sharpness: float) -> tuple[str | None, str]:
    """
    Apply appropriate sharpening based on current sharpness level.

    Args:
        image_path: Path to the image
        current_sharpness: Laplacian variance from check_sharpness()

    Returns:
        Tuple of (path to fixed image, fix description) or (None, reason)
    """
    img = cv2.imread(image_path)
    if img is None:
        return None, "Could not read image"

    # Heavy blur - can't fix
    if current_sharpness < 50:
        return None, "Too blurry to fix. Recommend reshoot."

    # Determine sharpening strength based on severity
    if current_sharpness < 80:
        # Moderately soft - stronger sharpening
        amount = 1.5
        radius = 1.5
        threshold = 3
        description = "Moderate sharpening applied"
    else:
        # Barely soft - light sharpening
        amount = 0.8
        radius = 1.0
        threshold = 2
        description = "Light sharpening applied"

    # Unsharp mask: blur the image, subtract from original, add back with strength
    # Using a Gaussian blur for the "unsharp" mask
    blurred = cv2.GaussianBlur(img, (0, 0), radius)

    # Create the mask (original minus blurred)
    mask = cv2.subtract(img, blurred)

    # Only sharpen edges above the threshold (avoid amplifying noise)
    if threshold > 0:
        gray_mask = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
        low_contrast = gray_mask < threshold
        mask[low_contrast] = 0

    # Apply the mask with the specified amount
    sharpened = cv2.addWeighted(img, 1.0 + amount, blurred, -amount, 0)

    # Clip to valid range
    sharpened = np.clip(sharpened, 0, 255).astype(np.uint8)

    # Verify we actually improved sharpness (safety check)
    gray_sharp = cv2.cvtColor(sharpened, cv2.COLOR_BGR2GRAY)
    new_sharpness = float(cv2.Laplacian(gray_sharp, cv2.CV_64F).var())

    # If sharpening didn't help or made it worse, don't save
    if new_sharpness < current_sharpness * 1.1:
        return None, "Sharpening did not improve quality"

    # Save
    suffix = "." + image_path.split(".")[-1]
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    cv2.imwrite(tmp.name, sharpened, [cv2.IMWRITE_JPEG_QUALITY, 95])

    return tmp.name, f"{description} (variance {current_sharpness:.0f} → {new_sharpness:.0f})"
