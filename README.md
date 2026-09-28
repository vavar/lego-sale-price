# lego-sale-price

Lego sale price data extracted from in-store price sheets (photos), Thailand.
Promotion period: **24–27 Sep 2026 (24-27/9/26)**.

## Dataset

- [`data/lego-sale_2026-09-24-27.csv`](data/lego-sale_2026-09-24-27.csv) — merged dataset, **875 items**
- `data/pages/*.csv` — one CSV per source photo (19 pages)

### Columns

| column | meaning |
|---|---|
| `item` | LEGO set number |
| `description` | product name as printed on the price sheet |
| `price_thb` | original price (THB) |
| `discount_pct` | discount percent during 24-27/9/26 (empty if promo instead) |
| `sale_price_thb` | sale price (THB) |
| `promo` | non-percent promos, e.g. `Buy 1 Get 1`, `Buy 2 Free 1` |
| `source_image` | source photo (Hermes image cache) |
| `needs_review` | `1` = row needs manual verification (5 rows) |
| `source_file` | page CSV this row came from |

## Quality checks

`data/merge_validate.py` validates every row:

- math check: `price_thb x (1 - discount_pct/100) = sale_price_thb` (tolerance ±0.51 THB)
- duplicate item codes across pages
- conflicting rows for the same item

Status as of extraction: **0 errors**; 1 row (`10358`) where the printed sheet
itself does not match the math (7,890 × 25% = 5,917.50, sheet shows 5,892.50) —
kept as printed and flagged `needs_review`.

Known caveats (flagged `needs_review=1`):

- `31395` — sheet shows two adjacent rows both labelled 31395; price/percent split unclear in photo
- `40460`/`40468` — ROSES 790/25% vs YELLOW TAXI 300/25%: prices appear swapped vs official set numbers
- `43023` — two adjacent rows both printed as "43023 Editions V 43023 V29" at 3,890 (0% and 20%); one is likely 43023, the other a neighbouring set

Descriptions are OCR-style transcriptions from photos — some contain the
sheet's own truncations (`..`) and placeholders (`tbd`, `V29`). Set numbers and
prices are the reliable fields.

## Extracted by

Hermes Agent on vavario (vision extraction from photos), 27 Sep 2026.

## LEGO.com images

Set images are stored in `img/` (480px WebP with transparency). 873 come from
the Rebrickable CDN; `10318` (Concorde) and `31394` (Red Panda) are official
LEGO.com CDN images fetched via a real-browser session (see
`~/projects/lego-fetch/fetch_lego.py` on vavario — lego.com blocks
datacenter IPs, so fetching must run with a real browser fingerprint).

`10310` never existed as printed: the sheet's "10310 Orchid" row is set
**10311** (fixed in the data). `31395` does not exist on lego.com — the
duplicated row is almost certainly `31394`; the row stays flagged
`needs_review` and shows the 31394 image.

Re-run `scripts/fetch_images.py` to refresh images from Rebrickable; it only
downloads what's missing (set `MAXSIDE`/quality as needed).
