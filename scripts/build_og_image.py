"""
Build the social share image (1200x630) for autoqc.io.

Left 55%: dark gradient + AutoQC wordmark + headline + feature chips.
Right 45%: a crop of the privacy-after demo image for product context,
           faded into the dark left side.

Output: public/og.jpg
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..")
IN_IMG = os.path.join(ROOT, "public", "demos", "privacy-after.jpg")
OUT = os.path.join(ROOT, "public", "og.jpg")

W, H = 1200, 630
ACCENT = (64, 225, 129)      # hsl(152 76% 52%) approx RGB
BG_DARK = (10, 12, 13)
TEXT = (240, 244, 245)
MUTED = (150, 160, 165)
BORDER = (38, 44, 48)

# macOS system fonts. Arial is on every mac, Menlo too.
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_MONO = "/System/Library/Fonts/Menlo.ttc"
# Fallbacks if a font is missing on the machine running the script.
if not os.path.exists(FONT_BOLD):
    FONT_BOLD = "/System/Library/Fonts/Helvetica.ttc"
if not os.path.exists(FONT_REG):
    FONT_REG = FONT_BOLD


def load(font_path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(font_path, size)
    except OSError:
        return ImageFont.load_default()


def build_background() -> Image.Image:
    """Dark base with a subtle radial highlight on the accent side."""
    canvas = Image.new("RGB", (W, H), BG_DARK)
    # Overlay a very faint green radial glow on the left, below the headline
    glow = Image.new("RGB", (W, H), BG_DARK)
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse([-200, 300, 600, 1100], fill=(18, 60, 35))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=120))
    canvas = Image.blend(canvas, glow, 0.6)
    return canvas


def paste_product(canvas: Image.Image) -> None:
    """Put the cropped privacy-after image on the right 45 percent,
    faded into the dark left via a linear mask."""
    if not os.path.exists(IN_IMG):
        return
    src = Image.open(IN_IMG).convert("RGB")
    # Crop a 3:2 slice centered horizontally
    src_w, src_h = src.size
    target_ratio = 900 / 630
    crop_w = min(src_w, int(src_h * target_ratio))
    crop_h = min(src_h, int(src_w / target_ratio))
    left = (src_w - crop_w) // 2
    top = (src_h - crop_h) // 2
    src = src.crop((left, top, left + crop_w, top + crop_h)).resize(
        (900, 630), Image.LANCZOS
    )
    # Darken slightly so text beside stays dominant
    dark_overlay = Image.new("RGB", src.size, (10, 12, 13))
    src = Image.blend(src, dark_overlay, 0.25)

    # Horizontal mask: opaque at right, transparent on the left
    mask = Image.new("L", (900, 630), 0)
    mdraw = ImageDraw.Draw(mask)
    for x in range(900):
        # ramp from 0 at x=0 to 255 at x=400 and hold
        alpha = int(min(255, (x / 400) * 255))
        mdraw.line([(x, 0), (x, 630)], fill=alpha)

    # Place so the right edge sits at the canvas right edge
    canvas.paste(src, (W - 900, 0), mask)


def draw_accent_logo(draw: ImageDraw.ImageDraw, x: int, y: int, size: int = 36) -> None:
    """Small rounded green square acting as the logo mark."""
    radius = size // 4
    draw.rounded_rectangle(
        [x, y, x + size, y + size], radius=radius, fill=ACCENT
    )
    # A small camera-like accent inside
    cx = x + size // 2
    cy = y + size // 2
    r = size // 5
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BG_DARK)


def draw_chip(draw: ImageDraw.ImageDraw, x: int, y: int, label: str, font: ImageFont.FreeTypeFont) -> int:
    """Mono-style pill. Returns new x cursor after the chip."""
    bbox = draw.textbbox((0, 0), label, font=font)
    text_w = bbox[2] - bbox[0]
    pad_x = 12
    pad_y = 6
    height = 28
    draw.rounded_rectangle(
        [x, y, x + text_w + pad_x * 2, y + height],
        radius=6,
        outline=BORDER,
        width=1,
    )
    draw.text((x + pad_x, y + pad_y - 1), label, font=font, fill=MUTED)
    return x + text_w + pad_x * 2 + 8


def main() -> None:
    canvas = build_background()
    paste_product(canvas)
    draw = ImageDraw.Draw(canvas)

    # Wordmark
    draw_accent_logo(draw, 64, 68, size=36)
    wordmark_font = load(FONT_BOLD, 26)
    draw.text((112, 72), "AutoQC", font=wordmark_font, fill=TEXT)

    # Kicker
    kicker_font = load(FONT_MONO, 14)
    draw.text(
        (64, 180),
        "REAL ESTATE PHOTO QC, AUTOMATED",
        font=kicker_font,
        fill=ACCENT,
    )

    # Headline (three lines, last one accent)
    headline_font = load(FONT_BOLD, 54)
    draw.text((64, 212), "A full shoot,", font=headline_font, fill=TEXT)
    draw.text((64, 272), "edited in minutes.", font=headline_font, fill=TEXT)
    draw.text((64, 332), "Not overnight.", font=headline_font, fill=ACCENT)

    # Feature chips
    chip_font = load(FONT_MONO, 13)
    x = 64
    y = 418
    for label in ["Verticals", "Color", "Privacy blur", "Distractions", "Reflections"]:
        x = draw_chip(draw, x, y, label, chip_font)

    # Footer line
    foot_font = load(FONT_REG, 16)
    draw.text(
        (64, 540),
        "From $8 per property. No subscription.",
        font=foot_font,
        fill=MUTED,
    )

    # Domain in bottom right
    domain_font = load(FONT_MONO, 13)
    bbox = draw.textbbox((0, 0), "autoqc.io", font=domain_font)
    dw = bbox[2] - bbox[0]
    draw.text((W - dw - 64, 556), "autoqc.io", font=domain_font, fill=MUTED)

    canvas.save(OUT, "JPEG", quality=92, optimize=True)
    print(f"Wrote {OUT}  ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
