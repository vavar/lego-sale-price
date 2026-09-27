#!/usr/bin/env python3
"""Generate a branded placeholder for sets with no available image.
Writes img/{item}.jpg (480px) with the set number in LEGO-style colors."""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "img")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

SETS = {
    "10310": "Orchid",
    "10318": "Concorde",
    "31395": "?",
}


def placeholder(item, label):
    im = Image.new("RGB", (480, 480), (250, 250, 252))
    d = ImageDraw.Draw(im)
    # red plate
    d.rounded_rectangle((70, 150, 410, 330), radius=28, fill=(212, 32, 38))
    # studs
    for i, x in enumerate(range(100, 381, 70)):
        d.ellipse((x, 120, x + 40, 160), fill=(232, 62, 68), outline=(180, 20, 26), width=3)
    f_big = ImageFont.truetype(FONT, 64)
    f_small = ImageFont.truetype(FONT, 22)
    # set number
    bb = d.textbbox((0, 0), item, font=f_big)
    d.text(((480 - bb[2] + bb[0]) / 2, 205), item, font=f_big, fill="white")
    # label
    bb2 = d.textbbox((0, 0), label, font=f_small)
    d.text(((480 - bb2[2] + bb2[0]) / 2, 290), label, font=f_small, fill=(255, 230, 230))
    # footer note
    f_note = ImageFont.truetype(FONT, 16)
    note = "no image available"
    bb3 = d.textbbox((0, 0), note, font=f_note)
    d.text(((480 - bb3[2] + bb3[0]) / 2, 430), note, font=f_note, fill=(150, 152, 160))
    path = os.path.join(OUT, item + ".jpg")
    im.save(path, "JPEG", quality=85, optimize=True)
    print("wrote", path)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for item, label in SETS.items():
        placeholder(item, label)
