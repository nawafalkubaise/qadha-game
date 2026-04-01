# تسليم المشروع «قدها؟» — للمحادثة القادمة

## المسار

`C:\Users\User\Downloads\qadha-game`

الملف الأصلي (نسخة احتياطية): `C:\Users\User\Downloads\قدها ؟\qadha-game (1).jsx`

## تشغيل سريع

```bash
cd C:\Users\User\Downloads\qadha-game
npm install
npm run dev
```

- البناء: `npm run build`
- اللينت: `npm run lint`

## Claude / تحميل الحزمة

- انسخ `.env.example` إلى `.env.local` وضع `ANTHROPIC_API_KEY=...`
- يعمل البروكسي فقط مع `npm run dev` (انظر `vite.config.js`)
- إن كان المنفذ 5173 مشغولاً، Vite يستخدم 5174 أو غيره

## ما تم تغييره (ملخص)

- Vite + React، المكوّن الرئيسي: `src/Qadha.jsx`
- دولتان فقط في اللعبة: **عالمي** + **الكويت**
- أسئلة أوفر/كاش أكبر وتوليد أثقل عبر الـ API (عند وجود مفتاح)
- `eslint`: تعطيل `react-hooks/purity` لـ `Qadha.jsx` فقط في `eslint.config.js`
- سكربت فحص الفئات (تجريبي): `scripts/verify-categories.mjs`

## ملاحظة عن «الذاكرة»

لا يمكن مسح «ذاكرة» المحادثة من هنا. للمتابعة: افتح هذا الملف أو المجلد في Cursor واكتب ما تريد تنفيذه.
