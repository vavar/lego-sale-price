#!/usr/bin/env python3
"""Download official set images from Rebrickable CDN and store resized
copies in img/{item}.jpg (max 480px, JPEG q82) for the GitHub Pages site.

Idempotent: skips items already downloaded. Failures are recorded in
scripts/image_failures.txt and the script exits 1 if any remain.
"""
import csv
import io
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "img")
CSV_PATH = os.path.join(ROOT, "data", "lego-sale_2026-09-24-27.csv")
MAXSIDE = 480
HEADERS = {"User-Agent": "Mozilla/5.0 (lego-sale-price asset sync; personal use)"}


def load_items():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        return sorted({r["item"] for r in csv.DictReader(f)})


def fetch(item):
    path = os.path.join(OUT, item + ".jpg")
    last_err = "unreachable"
    for version in (1, 2, 3):
        url = f"https://cdn.rebrickable.com/media/sets/{item}-{version}.jpg"
        for attempt in range(3):
            try:
                with urlopen(Request(url, headers=HEADERS), timeout=30) as resp:
                    data = resp.read()
                im = Image.open(io.BytesIO(data))
                im.load()
                im = im.convert("RGB")
                im.thumbnail((MAXSIDE, MAXSIDE), Image.LANCZOS)
                im.save(path, "JPEG", quality=82, optimize=True, progressive=True)
                return item, os.path.getsize(path), None
            except Exception as e:  # noqa: BLE001
                last_err = f"{type(e).__name__}: {e}"
                if attempt == 2:
                    break
                time.sleep(1.5 * (attempt + 1))
    return item, 0, last_err


def main():
    os.makedirs(OUT, exist_ok=True)
    items = load_items()
    todo = [i for i in items if not os.path.exists(os.path.join(OUT, i + ".jpg"))]
    print(f"{len(items)} sets | {len(items) - len(todo)} already present | downloading {len(todo)}", flush=True)

    ok = fail = 0
    total = 0
    errors = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(fetch, i): i for i in todo}
        for n, fut in enumerate(as_completed(futs), 1):
            item, size, err = fut.result()
            if err:
                fail += 1
                errors.append((item, err))
                print(f"FAIL {item}: {err}", flush=True)
            else:
                ok += 1
                total += size
            if n % 50 == 0:
                print(f"{n}/{len(todo)} ok={ok} fail={fail}", flush=True)

    print(f"DONE ok={ok} fail={fail} bytes={total / 1e6:.1f}MB", flush=True)
    if errors:
        with open(os.path.join(HERE, "image_failures.txt"), "w", encoding="utf-8") as f:
            for item, err in errors:
                f.write(f"{item}\t{err}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
