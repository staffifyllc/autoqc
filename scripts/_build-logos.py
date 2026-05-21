"""
One-shot: generate clean transparent PNG wordmarks for both brands so
the AutoQC x Staffify partnership email can use real logos on black.
Writes:
  public/autoqc-wordmark.png   (emerald square + 'AutoQC' in white)
  public/staffify-wordmark.png (cyan 'Staffify' wordmark - converted from existing SVG via simple render)
"""
from PIL import Image, ImageDraw, ImageFont
import os

PUBLIC = os.path.join(os.path.dirname(__file__), "..", "public")

# ---- AutoQC wordmark ----
W, H = 720, 200
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Rounded square mark
mark_size = 132
margin = 30
mark_x = margin
mark_y = (H - mark_size) // 2
# Emerald rounded rect
d.rounded_rectangle(
    [(mark_x, mark_y), (mark_x + mark_size, mark_y + mark_size)],
    radius=28,
    fill=(16, 185, 129, 255),  # #10b981
)

# Camera glyph inside the mark (simple body + lens)
cx = mark_x + mark_size // 2
cy = mark_y + mark_size // 2
# Camera body
body_w, body_h = 70, 52
d.rounded_rectangle(
    [(cx - body_w // 2, cy - body_h // 2 + 4),
     (cx + body_w // 2, cy + body_h // 2 + 4)],
    radius=8,
    fill=(255, 255, 255, 255),
)
# Top hump (viewfinder)
d.rounded_rectangle(
    [(cx - 18, cy - body_h // 2 - 6),
     (cx + 18, cy - body_h // 2 + 6)],
    radius=4,
    fill=(255, 255, 255, 255),
)
# Lens
d.ellipse(
    [(cx - 16, cy - 12), (cx + 16, cy + 20)],
    fill=(16, 185, 129, 255),
)
d.ellipse(
    [(cx - 10, cy - 6), (cx + 10, cy + 14)],
    fill=(255, 255, 255, 255),
)

# Wordmark text
text = "AutoQC"
# Try several common fonts in order of preference
candidates = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Black.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]
font = None
for path in candidates:
    if os.path.exists(path):
        try:
            font = ImageFont.truetype(path, 96)
            break
        except Exception:
            pass
if font is None:
    font = ImageFont.load_default()

text_x = mark_x + mark_size + 28
# vertical center
bbox = d.textbbox((0, 0), text, font=font)
text_h = bbox[3] - bbox[1]
text_y = (H - text_h) // 2 - bbox[1] - 6
d.text((text_x, text_y), text, font=font, fill=(255, 255, 255, 255))

out_autoqc = os.path.join(PUBLIC, "autoqc-wordmark.png")
img.save(out_autoqc, "PNG")
print(f"wrote {out_autoqc}  size={os.path.getsize(out_autoqc)}")

# ---- Staffify wordmark ----
# Generate a comparable wordmark for Staffify too so both visually pair.
# Pure text on transparent in their cyan #1ABDE1.
sW, sH = 720, 200
sim = Image.new("RGBA", (sW, sH), (0, 0, 0, 0))
sd = ImageDraw.Draw(sim)

s_text = "Staffify"
s_font = None
for path in candidates:
    if os.path.exists(path):
        try:
            s_font = ImageFont.truetype(path, 128)
            break
        except Exception:
            pass
if s_font is None:
    s_font = ImageFont.load_default()

s_bbox = sd.textbbox((0, 0), s_text, font=s_font)
s_text_w = s_bbox[2] - s_bbox[0]
s_text_h = s_bbox[3] - s_bbox[1]
# Center horizontally and vertically
sx = (sW - s_text_w) // 2 - s_bbox[0]
sy = (sH - s_text_h) // 2 - s_bbox[1] - 8
sd.text((sx, sy), s_text, font=s_font, fill=(26, 189, 225, 255))  # #1ABDE1

out_staffify = os.path.join(PUBLIC, "staffify-wordmark.png")
sim.save(out_staffify, "PNG")
print(f"wrote {out_staffify}  size={os.path.getsize(out_staffify)}")
