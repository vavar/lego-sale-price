#!/usr/bin/env python3
"""Merge per-page CSVs into one dataset and validate extracted rows.

Checks:
1. Math: price * (1 - discount/100) ~= sale_price (tolerance 0.51 THB).
2. Duplicate item codes across pages.
3. Duplicate item codes with different data (conflicts).
"""
import csv
import glob
import os
from decimal import Decimal, ROUND_HALF_UP

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES = sorted(glob.glob(os.path.join(HERE, "pages", "*.csv")))
OUT = os.path.join(HERE, "lego-sale_2026-09-24-27.csv")

EXPECTED_SALE = {
    # Sheet shows 5,892.50 but 7,890 x 25% = 5,917.50 -> flagged needs_review
    "10358": "5892.50",
}

rows = []
for path in PAGES:
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            r["source_file"] = os.path.basename(path)
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
            warnings.append(f"DUPLICATE-SAME {item} in {r['source_file']}")
        else:
            errors.append(
                f"CONFLICT {item}: {seen[item]} vs {rec} ({r['source_file']})"
            )
    else:
        seen[item] = rec

    if disc and sale:
        expected = (price * (Decimal(100) - Decimal(disc)) / 100).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        actual = Decimal(sale)
        if abs(expected - actual) > Decimal("0.51"):
            if EXPECTED_SALE.get(item) == sale:
                warnings.append(
                    f"MATH-MISMATCH-REVIEWED {item}: expected {expected}, sheet says {sale}"
                )
            else:
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
    )
    w.writeheader()
    w.writerows(rows)

print(f"pages       : {len(PAGES)}")
print(f"total rows  : {len(rows)}")
print(f"unique items: {len(seen)}")
print(f"promos      : {sum(1 for r in rows if r['promo'])}")
print(f"needs_review: {sum(1 for r in rows if r['needs_review'] == '1')}")
print(f"duplicate-same: {sum(1 for w_ in warnings if w_.startswith('DUPLICATE'))}")
print(f"ERRORS: {len(errors)}")
for e in errors[:40]:
    print("  " + e)
print(f"WARNINGS: {len(warnings)}")
for w_ in warnings[:40]:
    print("  " + w_)
