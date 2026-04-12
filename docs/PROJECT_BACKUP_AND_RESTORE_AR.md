# نسخ المشروع كاملاً والرجوع إليه لاحقاً

## نسخة ZIP جاهزة (تم إنشاؤها على جهازك)

**المسار:** `C:\Users\User\Downloads\qadha-game-BACKUP.zip`  
(حوالي 13 ميجابايت — يستثني `node_modules` و `dist`؛ بعد الفك تشغّل `npm install`.)

**إعادة إنشاء الأمر لاحقاً** (من مجلد المشروع):

```powershell
cd C:\Users\User\Downloads\qadha-game
tar -a -c -f "C:\Users\User\Downloads\qadha-game-BACKUP.zip" --exclude=node_modules --exclude=dist .
```

---

## مهم: ماذا يعني «حفظ كل شيء»؟

- **ملف نصي واحد** لا يستوعب المشروع كاملاً (آلاف الملفات + `node_modules` ضخم). الحفظ الحقيقي = **نسخ المجلد** أو **أرشيف ZIP** أو **Git**.
- هذا الملف يشرح **الطرق العملية** لحفظ كل شيء والرجوع.

---

## الطريقة 1: نسخ المجلد كاملاً (الأسهل)

1. أغلق Cursor أو أي برنامج يقفل ملفات المشروع (اختياري لكن أنظف).
2. انسخ المجلد بالكامل:
   - من: `C:\Users\User\Downloads\qadha-game`
   - إلى: سطح المكتب، أو قرص USB، أو مجلد `D:\Backups\qadha-game-copy`
3. **الرجوع لاحقاً:** افتح المجلد المنسوخ في Cursor: **File → Open Folder** واختر نفس المسار.
4. في الطرفية داخل المجلد:
   ```bash
   npm install
   npm run build
   ```
   (إذا كان النسخ يحتوي `node_modules` قد لا تحتاج `npm install`، لكن الأفضل تشغيله للتأكد.)

---

## الطريقة 2: ملف ZIP (أرشيف واحد قابل للنقل)

### بدون `node_modules` (أصغر وأسرع — مُفضّل)

في **PowerShell** من مجلد **الأب** (مثلاً `Downloads`):

```powershell
cd C:\Users\User\Downloads
Compress-Archive -Path "qadha-game\*" -DestinationPath "C:\Users\User\Desktop\qadha-game-backup.zip" -Force
```

**ملاحظة:** الأمر أعلاه قد يضمّن `node_modules` إذا وضعت `qadha-game\*` — للاستثناء الأدق انسخ المجلد يدوياً مع حذف `node_modules` قبل الضغط، أو استخدم 7-Zip واستثنِ المجلد.

بعد فك الضغط:

```bash
cd المسار\إلى\qadha-game
npm install
npm run dev
```

### مع `node_modules` (أكبر جداً — عادة غير ضروري)

نفس الفكرة لكن المجلد كاملاً؛ الحجم قد يتجاوز gigabytes.

---

## الطريقة 3: Git (أفضل للمطورين + نسخ على GitHub)

إن كان المشروع مستودع Git:

```bash
cd C:\Users\User\Downloads\qadha-game
git status
git add -A
git commit -m "نسخة احتياطية قبل …"
```

لرفع نسخة على السحابة: أنشئ مستودعاً على GitHub ثم:

```bash
git remote add origin https://github.com/USERNAME/qadha-game.git
git push -u origin master
```

**الرجوع لاحقاً على جهاز جديد:**

```bash
git clone https://github.com/USERNAME/qadha-game.git
cd qadha-game
npm install
npm run dev
```

---

## كيف «ترجع» للمشروع بعد فترة (خطوات سريعة)

1. ضع المجلد أو فك الـ ZIP في مكان ثابت (مثلاً `Downloads\qadha-game`).
2. **Cursor:** File → Open Folder → اختر `qadha-game`.
3. في الطرفية:
   ```bash
   npm install
   npm run build
   npm run dev
   ```
4. راجع التوثيق داخل المشروع:
   - `docs/QUESTION_BANKS_AND_SESSION_WORK.md` — بنوك الأسئلة والأوامر.
   - هذا الملف — النسخ الاحتياطي والاستعادة.

---

## ما يجب ألا تعتمد عليه وحده

- **محادثات Cursor / الوكلاء القدامى:** قد تُحذف؛ **الكود الحقيقي في المجلد على القرص** وليس في الدردشة.
- **ملف واحد .txt** لا يحفظ المشروع كاملاً — استخدم مجلداً أو ZIP أو Git.

---

## ملخص سطر واحد

**احفظ:** انسخ مجلد `qadha-game` أو اضغطه ZIP (يفضّل بدون `node_modules` ثم `npm install` عند الفتح).  
**ارجع:** افتح المجلد في Cursor وشغّل `npm install` ثم `npm run dev`.
