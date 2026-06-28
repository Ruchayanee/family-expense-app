# Go Live Checklist

เอกสารนี้เป็นรายการตรวจสุดท้ายก่อนเปิดให้ครอบครัวใช้งานจริง

## ก่อน Push ขึ้น GitHub

```bash
npm run check
npm run readiness
```

## หลัง Deploy Worker

```bash
WORKER_URL="https://YOUR_WORKER_URL" \
SETUP_SECRET="SETUP_SECRET_FROM_WRANGLER" \
npm run setup:worker

WORKER_URL="https://YOUR_WORKER_URL" npm run verify:worker
```

## หลัง Deploy GitHub Pages

1. เปิด GitHub Pages URL
2. Login เป็น `โอม`
3. เพิ่มรายจ่ายทดสอบ 1 รายการ
4. เปิด Google Sheet แล้วดูว่าแถวเข้า Sheet `Expenses`
5. Login เป็น `ป๊า` หรือ `ม๊า`
6. ตรวจว่าเห็นรายการ แต่ไม่มีปุ่มเพิ่ม แก้ไข หรือลบ

## ก่อนให้ใช้งานจริง

- เปลี่ยน PIN ตั้งต้นทุกคน
- เก็บ Google service account JSON key ไว้ในที่ปลอดภัย
- ห้าม commit `worker/wrangler.toml` ถ้ามีข้อมูลจริงที่ไม่อยากเผยแพร่
- Backup Google Sheet เดือนละครั้งเป็น `.xlsx`
