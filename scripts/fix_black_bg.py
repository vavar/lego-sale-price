#!/usr/bin/env python3
"""Fix thumbnails whose background turned black: Rebrickable serves many set
images as transparent PNGs; JPEG has no alpha, so transparent pixels became
black. Detect dark borders and composite onto white, then re-save."""
import glob
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IMG = os.path.join(ROOT, "img")

BRIGHTNESS_THRESHOLD = 40   # mean channel value below this = "black"
DARK_RATIO = 0.90           # fraction of border pixels that must be dark


def border_is_black(im):
    w, h = im.size
    px = im.load()
    samples = []
    step = max(1, w // 40)
    for x in range(0, w, step):
        samples.append(px[x, 0]); samples.append(px[x, h - 1])
    step = max(1, h // 40)
    for y in range(0, h, step):
        samples.append(px[0, y]); samples.append(px[w - 1, y])
    dark = sum(1 for p in samples if max(p) < BRIGHTNESS_THRESHOLD)
    return len(samples) > 0 and dark / len(samples) >= DARK_RATIO


def main():
    fixed = 0
    checked = 0
    for path in sorted(glob.glob(os.path.join(IMG, "*.jpg"))):
        checked += 1
        im = Image.open(path).convert("RGB")
        if not border_is_black(im):
            continue
        # black background -> flatten onto white by treating near-black as transparent
        gray = im.convert("L")
        mask = gray.point(lambda v: 255 if v < 28 else 0)  # black areas become mask
        # invert: keep subject, white background
        from PIL import ImageOps
        mask = ImageOps.invert(mask)
        white = Image.new("RGB", im.size, (255, 255, 255))
        white.paste(im, mask=mask)
        white.save(path, "JPEG", quality=82, optimize=True, progressive=True)
        fixed += 1
    print(f"checked {checked} images, fixed {fixed} black backgrounds")


if __name__ == "__main__":
    main()
