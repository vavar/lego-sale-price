#!/usr/bin/env python3
"""Convert LEGO CDN images fetched to /tmp into repo thumbnails (img/*.jpg)."""
from PIL import Image

# 10318 from LEGO CDN (JPEG 1500x445)
im = Image.open('/tmp/10318.png').convert('RGB')
im.thumbnail((480, 480), Image.LANCZOS)
im.save('img/10318.jpg', 'JPEG', quality=82, optimize=True, progressive=True)

# 31394 from LEGO CDN (PNG 1207px with alpha -> flatten onto white)
im = Image.open('/tmp/31394.png')
bg = Image.new('RGB', im.size, (255, 255, 255))
bg.paste(im, mask=im.split()[-1])
bg.thumbnail((480, 480), Image.LANCZOS)
bg.save('img/31394.jpg', 'JPEG', quality=82, optimize=True, progressive=True)

for f in ('img/10318.jpg', 'img/31394.jpg'):
    print(f, Image.open(f).size)
