# NoNeang v1

แอปบันทึกการกินแบบง่าย + ติดตามรอบเอว (ตัวแทนเหนียง) · PWA ไฟล์นิ่ง ไม่มี backend · ข้อมูลเก็บใน localStorage ของเครื่อง

## ติดตั้งบน GitHub Pages
1. สร้าง repo ใหม่ เช่น `noneang` แล้วอัปโหลดทุกไฟล์ในโฟลเดอร์นี้ไว้ที่ root
2. Settings → Pages → Source: `Deploy from a branch` → Branch `main` / `(root)` → Save
3. รอ 1–2 นาที เปิด `https://<username>.github.io/noneang/`
4. บน iPhone: เปิดใน Safari → ปุ่มแชร์ → Add to Home Screen

## ไฟล์
- `index.html` — โครงหน้า + CSS
- `app.js` — logic ทั้งหมด (storage adapter `Store`, การคำนวณ, หน้าจอ)
- `data.js` — ไอคอน, มาสคอต, พจนานุกรมอาหารตั้งต้น, ฐาน/ไส้สำหรับเมนูผสม
- `sw.js`, `manifest.webmanifest`, `icon-*.png` — ให้ติดตั้งเป็นแอปและเปิด offline ได้

## โครงข้อมูล (localStorage key `noneang.v1`)
`profile` · `foods[]` · `entries[]` (เก็บ kcal/P/Fb ณ วันที่กิน) · `body[]` (weight/waist) · `activity{date: activeKcal}` · `periods[]` (วันแรกของรอบ) · `dayStatus{date: done|skip}` · `chin{level}`
ทุก record มี `id`, `userId`, `createdAt`, `schemaVersion` — ย้ายไป Supabase ได้โดยเปลี่ยนแค่ `Store`

## แก้ไขตอนอัปเดตเวอร์ชัน
เปลี่ยนชื่อ cache ใน `sw.js` (`noneang-v1` → `noneang-v2`) ทุกครั้งที่แก้ไฟล์ ไม่งั้นมือถือจะยังใช้ไฟล์เก่า
