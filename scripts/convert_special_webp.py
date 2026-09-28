#!/usr/bin/env python3
"""Convert the special-case JPGs (LEGO.com CDN originals) to WebP."""
from PIL import Image

PAIRS = [
    ("img/10318.jpg", "img/10318.webp"),   # official LEGO CDN, white bg
    ("img/31394.jpg", "img/31394.webp"),   # official LEGO CDN, flattened white
    ("img/31395.jpg", "img/31395.webp"),   # copy of 31394 (sheet duplicate row)
]

for src, dst in PAIRS:
    im = Image.open(src).convert("RGB")
    im.thumbnail((480, 480), Image.LANCZOS)
    im.save(dst, "WEBP", quality=80, method=6)
    print("wrote", dst, im.size)
