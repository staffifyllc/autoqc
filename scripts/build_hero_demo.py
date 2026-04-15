"""
Build the hero before/after demo pair.

Source: a gorgeous modern living room (MLS-quality).
After: the original, resized to 1600 wide.
Before: the same image with two realistic photographer mistakes
  applied: a 2 degree tilt and a warm yellow cast. Cropped so the
  rotation does not leave black corners.

Output: public/demos/hero-before.jpg, public/demos/hero-after.jpg
"""
from __future__ import annotations

import os
from PIL import Image, ImageOps
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), "..")

# Demo 1: living room. Shows tilt + warm cast being fixed.
HERO_SRC = os.path.expanduser("~/Desktop/photoqc-test-images/hero-listing.jpg")
HERO_BEFORE = os.path.join(ROOT, "public", "demos", "hero-before.jpg")
HERO_AFTER = os.path.join(ROOT, "public", "demos", "hero-after.jpg")

# Demo 2: kitchen. Shows strong tungsten cast being neutralized.
KITCHEN_SRC = os.path.expanduser("~/Desktop/photoqc-test-images/kitchen.jpg")
KITCHEN_BEFORE = os.path.join(ROOT, "public", "demos", "kitchen-before.jpg")
KITCHEN_AFTER = os.path.join(ROOT, "public", "demos", "kitchen-after.jpg")


TILT_DEGREES = 2.0
# Warm cast: push red up, blue down, a touch of green for yellow tint.
R_SHIFT = 18
G_SHIFT = 6
B_SHIFT = -20

# Stronger tungsten-style cast for the kitchen demo (mixed lighting
# often yields a heavier cast than a daylight interior).
TUNGSTEN_R = 28
TUNGSTEN_G = 10
TUNGSTEN_B = -28


def resize_max_width(img: Image.Image, max_w: int) -> Image.Image:
    if img.width <= max_w:
        return img
    ratio = max_w / img.width
    return img.resize((max_w, int(img.height * ratio)), Image.LANCZOS)


def apply_cast(img: Image.Image, r: int, g: int, b: int) -> Image.Image:
    arr = np.asarray(img, dtype=np.int16)
    arr[..., 0] = np.clip(arr[..., 0] + r, 0, 255)
    arr[..., 1] = np.clip(arr[..., 1] + g, 0, 255)
    arr[..., 2] = np.clip(arr[..., 2] + b, 0, 255)
    return Image.fromarray(arr.astype(np.uint8))


def tilt_and_crop(img: Image.Image, degrees: float) -> Image.Image:
    """Rotate, then crop the inner rect that has no black corners."""
    w, h = img.size
    rad = np.deg2rad(abs(degrees))
    # Largest axis-aligned rect that fits inside a rotated rectangle
    # of the same size. Classic formula.
    cos = np.cos(rad)
    sin = np.sin(rad)
    new_w = int((w * cos - h * sin) / (cos * cos - sin * sin))
    new_h = int((h * cos - w * sin) / (cos * cos - sin * sin))
    if new_w <= 0 or new_h <= 0:
        return img

    rotated = img.rotate(degrees, resample=Image.BICUBIC, expand=False)
    left = (w - new_w) // 2
    top = (h - new_h) // 2
    cropped = rotated.crop((left, top, left + new_w, top + new_h))
    # Upscale back to original dimensions so both halves of the slider match.
    return cropped.resize((w, h), Image.LANCZOS)


def build_pair(src_path: str, before_path: str, after_path: str, *,
               tilt: float = 0.0, r: int = 0, g: int = 0, b: int = 0) -> None:
    if not os.path.exists(src_path):
        raise SystemExit(f"Missing source: {src_path}")
    src = Image.open(src_path).convert("RGB")
    src = resize_max_width(src, 1600)
    src.save(after_path, "JPEG", quality=90, optimize=True)
    print(f"Wrote {after_path}  ({os.path.getsize(after_path) // 1024} KB, {src.size})")

    before = src
    if tilt:
        before = tilt_and_crop(before, tilt)
    if r or g or b:
        before = apply_cast(before, r, g, b)
    before.save(before_path, "JPEG", quality=90, optimize=True)
    print(f"Wrote {before_path}  ({os.path.getsize(before_path) // 1024} KB, {before.size})")


def main() -> None:
    # Hero: living room, tilt + warm cast together.
    build_pair(
        HERO_SRC, HERO_BEFORE, HERO_AFTER,
        tilt=TILT_DEGREES, r=R_SHIFT, g=G_SHIFT, b=B_SHIFT,
    )

    # Kitchen: stronger tungsten cast, no tilt.
    build_pair(
        KITCHEN_SRC, KITCHEN_BEFORE, KITCHEN_AFTER,
        tilt=0.0, r=TUNGSTEN_R, g=TUNGSTEN_G, b=TUNGSTEN_B,
    )


if __name__ == "__main__":
    main()
