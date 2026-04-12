# بنوك الأسئلة — هيكل الملفات وكل ما تم تنفيذه

هذا الملف يوثّق التغييرات المتعلقة بفصل أسئلة اللعبة إلى ملفات JSON لكل **دولة** وكل **فئة**، وأدوات التصدير والتحقق، وربط التطبيق بها.

---

## 1. هيكل الملفات على القرص

كل بنك أسئلة هو مصفوفة JSON:

**المسار:** `src/data/banks/<countryId>/<categoryId>.json`

**معرّفات الدول (`countryId`):**


| المعرّف                      | الاستخدام               |
| ---------------------------- | ----------------------- |
| `general_ar`                 | وضع «عالمي عربي»        |
| `general_en`                 | وضع «عالمي إنجليزي»     |
| `kw`                         | الكويت                  |
| `sa`, `ae`, `qa`, `bh`, `om` | دول الخليج (غير الكويت) |


**معرّفات الفئات (`categoryId`):** نفس معرّفات `CATS` في `src/Qadha.jsx` (مثل `history`, `geography`, `kuwait_parliament`, …).

**شكل كل سؤال في المصفوفة:**

- `q` — نص السؤال (سلسلة غير فارغة)
- `o` — أربعة خيارات (مصفوفة نصوص)
- `a` — فهرس الإجابة الصحيحة: `0` … `3`
- `d` — اختياري: مستوى صعوبة للشبكة `1` | `2` | `3`

**العدد:** 72 فئة × 8 دول = **576 ملف JSON** (بعد أول تصدير كامل).

---

## 2. ملفات التطبيق (مصدر التحميل)


| الملف                         | الدور                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/data/banksLoader.js`     | في **Vite** فقط: `import.meta.glob("./banks/*/*.json")` وتحميل بنك دولة أو `general_ar` / `general_en` / `kw`. |
| `src/data/kwMergeImported.js` | دمج بنك الكويت من الملفات مع `kwImportedBank.json` (إزالة تكرار وفلترة مشتتات كما في المنطق السابق).           |
| `src/data/kwBank.js`          | `KW` من الملفات، `KW_MERGED = mergeKwBank(KW, imported)`.                                                      |
| `src/data/gccBanks.js`        | `GCC_BANKS` لكل من `sa` … `om` من المجلدات فقط.                                                                |
| `src/Qadha.jsx`               | `GEN_AR` / `GEN` عبر `loadGeneralArBank()` و `loadGeneralEnBank()` من `banksLoader.js`.                        |


**ملاحظة:** `src/data/kwBankCore.json` لم يعد مستورداً في الكود؛ المصدر المعتمد للكويت هو `src/data/banks/kw/*.json` (يمكن الإبقاء على الملف القديم كأرشيف).

---

## 3. سكربتات Node (قراءة من القرص بدون Vite)


| الملف                              | الدور                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `scripts/lib/readBanksFs.mjs`      | `readCountryBankFromFs`, `readAllGccBanksFromFs`, `readGeneralBankDisk`, `GCC_COUNTRY_IDS_FS`. |
| `scripts/lib/bankPaths.mjs`        | `BANKS_DIR`, `bankJsonPath`, `readCatIdsFromQadha`, `ensureDirForFile`.                        |
| `scripts/lib/questionValidate.mjs` | تحقق صارم من شكل السؤال، `dedupeQuestions`, `mergeQuestionLists`, `qHashNode`.                 |


---

## 4. أوامر npm والأدوات


| الأمر                                                            | الوظيفة                                                                                                        |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run export:banks`                                           | يعيد توليد كل ملفات `src/data/banks/` من البيانات الحالية على القرص + دمج fallbacks للعالمي حيث ينطبق السكربت. |
| `npm run banks:validate`                                         | يتحقق من صحة **كل** ملفات البنوك (`validate-all`).                                                             |
| `node scripts/question-bank-tool.mjs validate <file.json>`       | التحقق من ملف واحد.                                                                                            |
| `node scripts/question-bank-tool.mjs dedupe <file.json> --write` | إزالة التكرار والحفظ.                                                                                          |
| `node scripts/question-bank-tool.mjs hashes <file.json>`         | طباعة فهارس وبصمات للأسئلة.                                                                                    |
| `node scripts/kw-import-stats.mjs`                               | إحصائيات الكويت (يقرأ من القرص + دمج الاستيراد).                                                               |


---

## 5. تعديلات سلوك اللعبة (جلسات سابقة + مدمجة في المشروع)

- **فئات كويتية خاصة (`kuwait_`*):** تظهر فقط عند اختيار دولة الكويت (`kw`); عند تغيير الدولة تُزال من الاختيار.
- **شاشة الإعداد:** لا يبدأ اللعب بدون اسم مباراة وأسماء اللاعبين/الفرق حسب الوضع؛ زر البدء يعتمد على `setupCanGo`.
- **اللوبي الشبكي:** اسم اللاعب عند الانضمام لا يقل عن حرفين (لا دخول باسم افتراضي فارغ).
- `**getQuestions` للعالمي:** لا يضاعف `FALLBACK_AR` / `FALLBACK_EN` في الطبقة الثانية لأن المحتوى مدمج في ملفات `general_ar` / `general_en`.
- `**fillMissing`:** يعوّض الفئات **الفارغة** (`!bank[id] || bank[id].length === 0`) من الـ fallbacks كما في المنطق السابق.

---

## 6. سكربتات التحقق المحدّثة لقراءة JSON من القرص

بدلاً من استخراج `GEN_AR` / `GEN` من نص `Qadha.jsx`، تستخدم الآن:

- `scripts/verify-question-counts.mjs`
- `scripts/verify-questions-deep.mjs`
- `scripts/print-category-counts.mjs`
- `scripts/audit-distractors-quality.mjs`

مصادر البنوك: `readBanksFs.mjs` + `mergeKwBank` حيث يلزم.

---

## 7. سير عمل مقترح للتحرير

1. عدّل `src/data/banks/<دولة>/<فئة>.json` يدوياً أو عبر أدواتك.
2. شغّل `npm run banks:validate` أو `question-bank-tool validate` على الملف.
3. عند الحاجة: `dedupe --write` لإزالة التكرار.
4. `npm run build` و `npm run verify:questions` للتأكد.

---

## 8. ملفات حُذفت أو استُبدلت أثناء العمل

- أُزيل المحتوى الضخم المضمّن لـ `GEN_AR` و `GEN` من `Qadha.jsx` لصالح التحميل من `banks/`.
- حُذف سكربت مؤقت `scripts/patch-qadha-gen.mjs` بعد الدمج (لم يعد مطلوباً).

---

## 9. فحص صحة المشروع (Doctor / CI محلي)

تشغيل سريع للتأكد أن كل شيء يعمل:

```bash
npm run lint
npm run build
npm run verify:questions
npm run banks:validate
node scripts/verify-questions-deep.mjs
node scripts/kw-import-stats.mjs
```

**نتيجة آخر فحص (مرجع):**


| الأمر                       | الحالة                                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `lint`                      | نجاح — تحذيران فقط في `Qadha.jsx` (`react-hooks/exhaustive-deps`: `liveRoom` و `country.id` في مصفوفات `useEffect`) — ليست أخطاء. |
| `build`                     | نجاح — قد يظهر تحذير حجم الـ chunk (>500KB) من Vite فقط.                                                                          |
| `verify:questions`          | نجاح — كل البنوك ≥8 أسئلة/فئة حسب المحاكاة.                                                                                       |
| `banks:validate`            | نجاح — كل ملفات `banks/*.json` صالحة الشكل.                                                                                       |
| `verify-questions-deep.mjs` | نجاح بعد إصلاح منطق التكرار (انظر القسم 10).                                                                                      |


---

## 10. إصلاح `verify-questions-deep.mjs` (تكرار زائف لأسئلة الصور)

**المشكلة:** السكربت كان يعتبر سؤالين «مكررين» إذا كان **نص `q` متطابقاً** فقط. أسئلة المولات/المطاعم (`kuwait_malls`, `kuwait_restaurants`) تستخدم نفس الجملة مع `**img` مختلف** وغالباً `**id`** — وهذا صحيح في اللعمة.

**الحل:** في `scripts/verify-questions-deep.mjs` أُضيفت دالة `qKeyForDupCheck` لتطابق منطق `qHash` في `src/game/questionCache.js`:

- إن وُجد `id` → المفتاح `id:<المعرّف>`
- وإلا → أول 40 حرفاً من `q` + `|` + آخر 56 حرفاً من `img` (إن وُجد)

بهذا لا يُبلّغ السكربت عن تكرار زائف لأسئلة الصور.

---

## 11. إحصائيات الكويت (`kw-import-stats`)

إذا كانت ملفات `src/data/banks/kw/*.json` مُصدَّرة أصلاً من **البنك المدمج** (ملفات + `kwImportedBank.json`)، فسيظهر الفرق «قبل وبعد الدمج» **صفراً** — هذا متوقع وليس خطأ.

---

## 12. أين هذا الملف وكيف نكمل لاحقاً

- **مسار التوثيق:** `docs/QUESTION_BANKS_AND_SESSION_WORK.md`
- **للمتابعة بعد فترة:**
  1. افتح هذا الملف واقرأ الأقسام 1–8 للهيكل والأوامر.
  2. عدّل JSON تحت `src/data/banks/` حسب الحاجة.
  3. شغّل `npm run banks:validate` ثم `npm run build`.
  4. للفحص العميق: `node scripts/verify-questions-deep.mjs`.
  5. إذا أضفت فئات جديدة في `CATS` داخل `Qadha.jsx`، ستحتاج ملفات JSON جديدة لكل دولة أو تشغيل `npm run export:banks` بعد التأكد من المنطق (قد يعيد كتابة الملفات).

---

## 13. ملخص ملفات مهمة (فهرس سريع)


| مسار                                | ملاحظة                                                      |
| ----------------------------------- | ----------------------------------------------------------- |
| `src/data/banks/`                   | كل الأسئلة حسب الدولة والفئة                                |
| `src/data/banksLoader.js`           | تحميل Vite                                                  |
| `src/data/kwMergeImported.js`       | دمج الكويت + الاستيراد                                      |
| `src/data/kwBank.js`                | تصدير `KW`, `KW_MERGED`                                     |
| `src/data/gccBanks.js`              | دول الخليج من المجلدات                                      |
| `src/Qadha.jsx`                     | الواجهة، `fillMissing`, `getQuestions`, قيود الكويت/الإعداد |
| `src/components/OnlineLobby.jsx`    | اسم لاعب ≥ حرفين عند الانضمام                               |
| `scripts/export-question-banks.mjs` | إعادة تصدير البنوك                                          |
| `scripts/question-bank-tool.mjs`    | validate / dedupe / hashes / validate-all                   |
| `scripts/lib/readBanksFs.mjs`       | قراءة البنوك من القرص في Node                               |


---

*آخر تحديث: توثيق فحص Doctor، وإصلاح تكرار أسئلة الصور في الفحص العميق، وفهرس المتابعة.*