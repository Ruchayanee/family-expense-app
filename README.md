# Family Expense App

Mobile-first web app สำหรับบันทึกรายจ่ายครอบครัว ใช้ GitHub Pages สำหรับหน้าเว็บ, Cloudflare Worker เป็น API และ Google Sheets เป็นฐานข้อมูล

## ใช้งานอะไรได้บ้าง

- Login แยก Admin/Viewer
- Admin เพิ่ม แก้ไข ลบ และ export รายจ่ายได้
- Viewer ดูข้อมูล ค้นหา filter และดูสรุปได้เท่านั้น
- Dashboard แสดงรายจ่ายวันนี้ เดือนนี้ จำนวนรายการ และหมวดที่ใช้เงินมากที่สุด
- รายการทั้งหมดพร้อมค้นหา filter sort
- สรุปรายเดือนตามวัน หมวดหมู่ และผู้จ่าย
- Export CSV และ print เป็น PDF

## ผู้ใช้เริ่มต้น

| ชื่อ | บทบาท | PIN |
|---|---|---|
| โอม | Admin | 123456 |
| ป๊า | Viewer | 111111 |
| ม๊า | Viewer | 222222 |

ควรเปลี่ยน PIN ก่อนใช้งานจริง

## โครงสร้าง

```text
frontend/                  หน้าเว็บสำหรับ GitHub Pages
worker/                    Cloudflare Worker API เชื่อม Google Sheets
tools/                     ตัวช่วย deploy/setup/verify
.github/workflows/         GitHub Actions สำหรับ check และ Pages deploy
docs/                      เอกสาร deploy และ go-live
```

## ทดลองหน้าเว็บ

เปิด `frontend/index.html` ได้ทันที ระบบจะเข้า demo mode และเก็บข้อมูลทดลองใน browser

หรือเปิด local server:

```bash
cd frontend
python3 -m http.server 4173 --bind 127.0.0.1
```

## ตรวจโค้ด

```bash
npm run check
npm run readiness
```

## Deploy ใช้งานจริง

อ่านขั้นตอนที่ [docs/GITHUB_DEPLOY.md](docs/GITHUB_DEPLOY.md)

สรุปสั้น:

1. ตั้ง GitHub Pages Source เป็น GitHub Actions
2. สร้าง Google Sheet และ service account
3. Deploy `worker/` ไป Cloudflare Worker
4. ตั้ง GitHub Actions variables:
   - `API_BASE_URL` = Worker URL
   - `DEMO_MODE` = `false`
5. Run setup:

```bash
WORKER_URL="https://YOUR_WORKER_URL" \
SETUP_SECRET="YOUR_SETUP_SECRET" \
npm run setup:worker
```

6. ตรวจ Worker:

```bash
WORKER_URL="https://YOUR_WORKER_URL" npm run verify:worker
```
