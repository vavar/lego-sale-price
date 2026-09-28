# lego-sale-price

เก็บสถิติราคาขาย LEGO งวดโปรโมชันหน้าร้าน (ประเทศไทย) — เว็บค้นหาได้ ทำจาก
**Vite + React + HeroUI v3** deploy บน GitHub Pages (static build ไม่มี server).

**เปิดเว็บ:** https://vavar.github.io/lego-sale-price/

## โครงสร้าง

```
public/
  data/
    sales.json            # รายการงวด sale ทั้งหมด (เว็บอ่านไฟล์นี้)
    sales/<id>.csv        # ข้อมูลราคาแต่ละงวด
  img/                    # รูปเซ็ต 875 ไฟล์ (.webp 480px โปร่งใส)
src/
  App.jsx                 # state กลาง: โหลดงวด, กรอง, เรียง
  components/
    Controls.jsx          # ช่องค้นหา + ฟิลเตอร์ + เรียง (HeroUI Input/Select/Chip)
    Table.jsx             # ตาราง + lazy image + ปุ่ม copy รหัส
    Lightbox.jsx          # ดูรูปใหญ่ (HeroUI Modal) + pinch zoom + swipe
  lib/csv.js              # CSV parser
data/                     # แหล่งข้อมูลดิบต่องวด (pages/, merge_validate.py)
scripts/                  # ดาวน์โหลด/จัดการรูปจาก Rebrickable CDN
tests/                    # parser test + browser smoke test (playwright-core)
```

## เพิ่มงวด sale ใหม่

1. แกะข้อมูลจากภาพใบราคาเป็น CSV → `data/pages/<sale_id>/*.csv`
   (คอลัมน์: `item,description,price_thb,discount_pct,sale_price_thb,promo,source_image,needs_review`)
2. `python3 data/merge_validate.py <sale_id>` → ได้ `data/sales/<sale_id>.csv` + ตรวจสมการราคา
3. เพิ่ม entry ใน `public/data/sales.json`:
   ```json
   { "id": "<sale_id>", "label": "วันที่โชว์บนเว็บ", "file": "data/sales/<sale_id>.csv" }
   ```
4. `npm run build` (หรือ push — workflow deploy ให้เอง)

## คำสั่ง

```bash
npm install        # ติดตั้งครั้งแรก
npm run dev        # dev server
npm run build      # build → dist/
npm run preview    # ทดลองเปิด build ล่าสุด (port 4173)
node tests/parser.test.mjs        # unit test parser + ข้อมูล
node tests/browser.smoke.mjs      # e2e (ต้องรัน npm run preview ก่อน)
python3 scripts/fetch_images.py   # โหลด/อัปเดตรูปจาก Rebrickable (idempotent)
```

## Deploy

Push ไปที่ `main` → GitHub Actions (`.github/workflows/deploy.yml`) build แล้ว
deploy ขึ้น Pages อัตโนมัติ

## หมายเหตุข้อมูล

- รูป: 873 จาก Rebrickable CDN, 10318 + 31394 จาก LEGO.com CDN (ดึงผ่าน
  real-browser session เพราะ lego.com บล็อก datacenter IP)
- แถว "10310 Orchid" ในใบราคาแรกแท้จริงคือเซ็ต **10311** (ยืนยันกับ search
  ทางการของ LEGO แล้ว) — แก้ในข้อมูลแล้ว
- "31395" ไม่มีบน lego.com; ใบราคาพิมพ์ 31394 ซ้ำ (แถวถูกลบออกจากงวดแรก)
