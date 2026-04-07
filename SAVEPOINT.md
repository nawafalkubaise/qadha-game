# نقطة رجوع — مشروع قضها (Qadha)

آخر تحديث موثّق: **۸ نيسان ۲۰۲٦**

## أين وصل المشروع؟

| | |
|---|---|
| **الفرع** | `master` |
| **آخر كومِت** | `22cb85e` — أعلاه + ملف `SAVEPOINT.md` |
| **حالة الشجرة** | نظيفة (`git status` بدون تغييرات معلّقة) |

## طرق الرجوع لاحقاً

### ١) من مجلد المشروع نفسه (إذا بقي عندك كما هو)

```bash
cd qadha-game
git checkout master
git pull   # إن وُجد remote
```

للرجوع لكومِت معيّن حتى لو تغيّر الفرع:

```bash
git checkout 22cb85e
```

### ٢) من ملف الحزمة (نسخة كاملة بملف واحد)

في مجلد **التنزيلات** (`Downloads`) بجانب المشروع يوجد ملف:

**`qadha-game-SAVEPOINT.bundle`**

يحتوي كلّ فروع الريبو والكومِتات المعلومة وقت الإنشاء. لاسترجاع نسخة جديدة منه:

```bash
cd C:\Users\User\Downloads
git clone qadha-game-SAVEPOINT.bundle qadha-game-restored
cd qadha-game-restored
npm install
npm run build
```

للتحقق من سلامة الحزمة:

```bash
git bundle verify qadha-game-SAVEPOINT.bundle
```

### ٣) نسخ يدوي

نسخ المجلد `qadha-game` كاملًا (ومعه إن أردت تجاهل الحجم: بدون `node_modules` ثم `npm install` لاحقاً).

---

## أوامر مفيدة بعد الاسترجاع

| الأمر | الغرض |
|--------|--------|
| `npm install` | تثبيت الاعتماديات |
| `npm run dev` | تشغيل وضع التطوير |
| `npm run build` | بناء الإنتاج |
| `npm run fetch:malls` | إعادة جلب صور المولات من كومنز (للمطورين؛ اللعب يستخدم الملفات في `public/malls/`) |

---

## أهم مسارات كان العمل عليها

| المسار | الوصف |
|--------|--------|
| `public/malls/` | صور المولات المحلية + `SOURCES.tsv` |
| `src/data/kwMallPics.json` | أسئلة «أين هذا المول؟» مع مسارات الصور |
| `src/data/kwBank.js` | دمج بنك الكويت يشمل `kwMallPics` |
| `src/data/kwImportedBank.json` | أسئلة نصية مستوردة |
| `scripts/fetch-mall-assets.mjs` | جلب الأصول من ويكيميديا كومنز |
| `src/game/questionCache.js` | `qHash` بالـ `id` للأسئلة المصوّرة |
| `src/Qadha.jsx` | عرض اللعبة ومزج طلبات الخيارات |

---

## ملاحظة عن `git remote`

وقت إنشاء هذا الملف قد لا يكون للريبو عنوان `remote` (مثل GitHub). إن أضفت `origin` لاحقاً، استخدم `git push -u origin master` لرفع نفس التاريخ.
