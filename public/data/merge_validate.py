#!/usr/bin/env python3
"""Merge per-page CSVs of one sale into data/sales/<id>.csv and validate.

Usage: python3 data/merge_validate.py [sale_id]
       (sale_id = filename stem in data/pages/, default: 2026-09-24-27)

Pages live in data/pages/<sale_id>/*.csv; images referenced by source_image.
"""
import csv
import glob
import os
import sys

from decimal import Decimal, ROUND_HALF_UP

HERE = os.path.dirname(os.path.abspath(__file__))
SALE_ID = sys.argv[1] if len(sys.argv) > 1 else "2026-09-24-27"
PAGES = sorted(glob.glob(os.path.join(HERE, "pages", SALE_ID, "*.csv")))
OUT = os.path.join(HERE, "sales", SALE_ID + ".csv")

rows = []
for path in PAGES:
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            r["source_file"] = SALE_ID + "/" + os.path.basename(path)
            rows.append(r)

errors, warnings = [], []
seen = {}
for r in rows:
    item = r["item"]
    price = Decimal(r["price_thb"])
    disc = r["discount_pct"]
    sale = r["sale_price_thb"]
    rec = (r["description"], price, disc, sale)

    if item in seen:
        if seen[item] == rec:
            warnings.append(f"DUPLICATE-SAME {item}")
        else:
            errors.append(f"CONFLICT {item}: {seen[item]} vs {rec}")
    else:
        seen[item] = rec

    if disc and sale:
        expected = (price * (Decimal(100) - Decimal(disc)) / 100).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if abs(expected - Decimal(sale)) > Decimal("0.51"):
            errors.append(
                f"MATH {item} {r['description'][:40]}: {price} x {disc}% "
                f"= {expected} but sheet says {sale}"
            )

with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(
        f,
        fieldnames=[
            "item", "description", "price_thb", "discount_pct",
            "sale_price_thb", "promo", "source_image", "needs_review",
            "source_file",
        ],
        lineterminator="\n",
    )
    w.writeheader()
    w.writerows(rows)

print(f"sale        : {SALE_ID}")
print(f"pages       : {len(PAGES)}")
print(f"total rows  : {len(rows)}")
print(f"unique items: {len(seen)}")
print(f"needs_review: {sum(1 for r in rows if r['needs_review'] == '1')}")
print(f"ERRORS: {len(errors)}")
for e in errors[:40]:
    print("  " + e)
sys.exit(1 if errors else 0)
