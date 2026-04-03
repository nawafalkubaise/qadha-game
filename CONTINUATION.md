# تسليم المشروع «قدها؟» — مرجع الجلسة التالية

**عند العودة:** افتح المجلد في Cursor، اقرأ هذا الملف، ثم اكتب للمساعد ما تريد متابعته.

---

## نقطة الرجوع — احفظ هذا الملف مع المشروع

**هذا الملف (`CONTINUATION.md`) هو المرجع الرئيسي** لما تم تنفيذه ولأين ترجع لاحقاً — لا تحتاج ملفاً ثانياً للملخص.

| ماذا | أين |
|------|-----|
| **مسار المشروع** | `C:\Users\User\Downloads\qadha-game` |
| **الكود والتغييرات** | Git على فرع **`master`** — للقائمة الكاملة: `git log --oneline -12` (أهم commit للميزات الكبيرة: `c908b74`) |
| **حالة العمل حالياً** | `git status` → يفضّل أن يظهر *working tree clean* بعد كل حفظ |
| **تشغيل اللعبة** | `npm install` + `cd server; npm install` (مرة واحدة) ثم من الجذر: **`npm run dev`** يشغّل **الخادم (3001) + Vite** معاً. واجهة فقط بدون خادم: **`npm run dev:client`** |
| **سجل التعديلات التفصيلي** | القسم **«جلسة تطوير»** في أسفل هذا الملف |

**للنسخ على جهاز آخر أو USB:** انسخ مجلد `qadha-game` كاملاً (أو `git clone` / `git push` ثم `pull`)، ولا تنسَ **`CONTINUATION.md`** ومجلد **`src/`**.

---

## المسار

`C:\Users\User\Downloads\qadha-game`

نسخة احتياطية قديمة (ملف واحد): `C:\Users\User\Downloads\قدها ؟\qadha-game (1).jsx`

**المكدس:** Vite + React — المنطق والواجهة الأساسية في **`src/Qadha.jsx`** (ملف كبير). تكامل **سين جيم** في **`src/seenjeem.js`**.

---

## تجربة اللعبة (سريع)

```powershell
cd C:\Users\User\Downloads\qadha-game
npm install
npm run dev
```

- المتصفح: غالباً **http://localhost:5173** (أو **5174** إن كان 5173 مشغولاً).
- **انقر مرة داخل الصفحة** لتفعيل الصوت (سياسة المتصفح).

أوامر أخرى: `npm run build`، `npm run preview`، `npm run lint`.

```powershell
# أول مرة: تبعيات الخادم
cd C:\Users\User\Downloads\qadha-game\server
npm install
cd ..
npm install
npm run dev
```

---

## رؤية المنتج المستقبلية (قرارات تصميم — جلسات مع المساعد، ٣ أبريل ٢٠٢٦)

**ملاحظة:** هذا **مخطط واتجاه**؛ جزء منه نُفّذ في الكود وجزء لم يُنفَّذ بعد.

| الموضوع | القرار |
|---------|--------|
| **المنصات** | ويب أولاً (MVP)، ثم توسيع للموبايل لاحقاً بنفس المشروع قدر الإمكان. |
| **اللغة أولاً** | عربي للواجهة وبنك الأسئلة؛ توسيع لغات لاحقاً. |
| **النوع** | أسئلة وأجوبة + طور فيه **محادثة صوتية مباشرة** بين اللاعبين (WebRTC/SFU مثل LiveKit أو Daily) + **شات فوري**. |
| **طور ثانٍ** | أسئلة فقط: **فردي** و**أونلاين بدون صوت/شات**؛ وفي **الطورين** (الكامل وأسئلة فقط) **فريق ضد فريق** مع **أنماط جاهزة** (٢ض٢، ٤ض٤، …). |
| **دخول الغرف** | لاحقاً: **الثلاثة معاً** — كود/رابط، مطابقة عشوائية، أصدقاء (تفاصيل القواعد تُحدَّد عند التنفيذ). |
| **المحتوى** | حزم جاهزة + إمكانية **إضافة أسئلة من المالك** مع **تحديث فوري** للاعبين دون إيقاف اللعبة. |
| **الحسابات** | ضيف **مجاني** بمزايا محدودة جداً + حساب كامل اختياري للمزايا الأثقل. |
| **الدخل** | **مزيج إعلانات + اشتراك/شراء داخل التطبيق** (على الويب غالباً دفع ويب مثل Stripe؛ على المتاجر لاحقاً أنظمة أبل/قوقل). |
| **الأمان والإشراف (أول إصدار قابل للنشر)** | إبلاغ + فلتر شات + طرد من الغرفة + حظر مؤقت/دائم + **سجل بلاغات**. |
| **الذكاء الاصطناعي للأسئلة** | **RAG / مصادر موثوقة** + تحقق؛ **منع تكرار** (تطبيع نص + بصمة + يمكن تشابه دلالي لاحقاً). مسار الإنتاج المفضّل: **توليد من لوحة تحكم (دفعات)** ثم نشر؛ توليد أثناء اللوبي اختياري لاحقاً مع قبول التأخير. |
| **الاتجاه التقني المختار** | ويب حديث (React/Vite الحالي) + خدمة سحابية للحسابات والغرف + **SFU** للصوت + WebSocket/قنوات فورية للشات. |

---

## ما نُفّذ في الكود (٣ أبريل ٢٠٢٦) — خادم محتوى + غرف + تقسيم جزئي

| المكوّن | الوصف |
|---------|--------|
| **`server/index.mjs`** | Express على **`QADHA_SERVER_PORT`** (افتراضي **3001**): `GET /api/content/manifest`، `GET /api/content/overlay`، `POST /api/content/questions` (يتطلب **`QADHA_ADMIN_KEY`** + ترويسة **`x-admin-key`**) مع **منع تكرار** عبر `server/lib/dedup.mjs`؛ غرف: `POST /api/rooms`، `POST /api/rooms/:code/join`، `GET /api/rooms/:code`، `PUT /api/rooms/:code` (المضيف فقط، مع `clientRev` لتقليل التعارض). |
| **`server/data/store.json`** | إصدار المحتوى `contentVersion` + `overlay` حسب الدولة والفئة + سجل `fingerprints`. |
| **`vite.config.js`** | بروكسي التطوير: `/api/content`، `/api/rooms`، `/api/health` → `127.0.0.1:3001`. |
| **`package.json` (جذر)** | `npm run dev` = `concurrently` (خادم + Vite)؛ `npm run dev:server`؛ `npm run dev:client`. |
| **`src/services/contentApi.js`** | جلب manifest/overlay ومزامنة مع **`localStorage`** (`qadha_remote_content_ver`، `qadha_remote_overlay_cache`). |
| **`src/services/roomApi.js`** + **`src/components/OnlineLobby.jsx`** | واجهة تجريبية «غرفة أونلاين» من القائمة؛ استطلاع كل ~٢ ثانية. |
| **`src/game/questionCache.js`** | فصل كاش `qadha_qcache` / `qadha_seen` و`qHash` عن `Qadha.jsx`. |
| **`src/Qadha.jsx`** | `getQuestions(..., remoteOverlay)` يدمج أسئلة من السيرفر فوق البنوك المحلية؛ شاشة **`online`**؛ إخفاء شريط الثيم في `online`. |

**لم يُنفَّذ بعد (من الرؤية):** صوت مباشر، شات فوري داخل اللعبة، مطابقة/أصدقاء، حسابات وإعلانات ودفع، لوحة إشراف، RAG كامل، WebSocket للغرف، تقسيم كامل لملف `Qadha.jsx` الضخم.

---

## تدفق الشاشات (ترتيب اللعب — محدّث)

1. **شاشة البداية** (`splash`) → القائمة.
2. **القائمة** (`menu`): زر **يلا** → **الدولة والفئات**؛ زر **اللعب الجماعي · Multiplayer** → شاشة **`online`** (`OnlineLobby`). (نص فرعي اختياري: **Powered By : Bojrmakh Q8 Team**.)
3. **الدولة والفئات** (`cats`):  
   - شريط خطوات: **رئيسية → الدولة والفئات → الفريق** (`flowSteps`).  
   - أعلى: اختيار **الدولة** (شبكة مختصرة + **غيّر** لفتح قائمة الدول الكاملة `country`).  
   - ثم **٨ فئات**؛ الأقسام الكبرى تُعرض **بتبويبات** — قسم واحد مفتوح في كل مرة (شريط أفقي `catGroupTabBar`)، ما عدا **سين جيم** عندما يكون قسم «حزم» واحد فقط.  
   - **التالي — إعداد الفريق** → `setup` (معطّل حتى اكتمال ٨ فئات).  
   - من شريط الخطوات: لا يُسمح بالذهاب لـ `setup` بدون ٨ فئات.
4. **الإعداد** (`setup`): اختيار **الوضع** (١ ضد ١ / فريق) — ملخص الدولة، اسم المباراة، لاعبين/فرق، صعوبة؛ **يلا** يبدأ المباراة (`startGame`). زر **يلا** معطّل إن لم تُختر ٨ فئات (مع تنبيه). **لا يوجد رهان** (أُزيل من اللعبة).  
   - لا توجد شاشة `mode` منفصلة؛ الوضع داخل الإعداد.  
   - **رجوع** → `cats`.
5. **الشبكة / السؤال / النتائج** كما سبق.

---

## الدول في اللعبة (`COUNTRIES`)

1. **عالمي · أسئلة عربية** (`general_ar`) — في `getQuestions`: **`GEN_AR` + `FALLBACK_AR`** فقط (+ كاش + اختياري Anthropic). لا يُخلَط مع الإنجليزي.
2. **عالمي · English questions** (`general_en`) — **`GEN` + `FALLBACK_EN`** فقط (+ كاش + اختياري Anthropic).
3. **الكويت** (`kw`) — بنك **`KW`** + اختياري Anthropic.
4. **سين جيم** (`seenjeem`) —  
   - **فئات:** من API عند `npm run dev` + بروكسي؛ إن لم تُحمَّل الحزم تُستخدم **`CATS`** (٦٠ فئة) مع تجميع `groupCatsForUi` مثل العالمي.  
   - **أسئلة:** تُدمَج **API** (إن وُجد) + **`GEN_AR` + `GEN` + `FALLBACK_AR` + `FALLBACK_EN`**؛ مع فلتر **🇰🇼** يُضاف **`KW`**. لا حاجة لـ `SEENJEEM_TOKEN` للعب المحلي.  
   - فلتر **كل الحزم / الكويت** على شاشة الفئات (يؤثر على قائمة الحزم عند وجود API؛ محلياً فلتر الكويت يزيد محتوى KW في البركة).

دالة **`getQuestions(cats, cid, apiResult, opts, remoteOverlay)`:** للسين جيم يُمرَّر `{ sjKw: sjKwOnly }`؛ **`remoteOverlay`** يدمج أسئلة إضافية من خادم **`/api/content/overlay`** (حسب `countryId` و`categoryId`).

---

## ملفات مهمة

| ملف | دوره |
|-----|------|
| `src/Qadha.jsx` | اللعبة كاملة: ثيمات، تدفق الشاشات (`splash`/`menu`/`online`/`cats`/…)، `flowSteps`، تبويبات أقسام الفئات، شبكة، أسئلة، `TX`/`BI`، `getQuestions` + دمج `remoteOverlay`، `CAT_GROUP_ROWS` |
| `src/game/questionCache.js` | كاش الأسئلة المحلي و`qHash` |
| `src/services/apiBase.js` | قاعدة URL للـ API (`VITE_QADHA_API` أو نسبي للبروكسي) |
| `src/services/contentApi.js` | manifest + overlay + تخزين محلي |
| `src/services/roomApi.js` | إنشاء/انضمام/قراءة/تحديث الغرفة |
| `src/components/OnlineLobby.jsx` | غرفة أونلاين تجريبية |
| `server/index.mjs` | خادم المحتوى والغرف |
| `server/lib/dedup.mjs` | تطبيع نص وبصمة أسئلة لمنع التكرار على السيرفر |
| `server/data/store.json` | مخزن overlay وإصدارات المحتوى |
| ~~`src/categoryArt.jsx`~~ | **حُذف من المشروع.** عرض الفئات = **`CATS[].icon` (إيموجي)** فقط — راجع **«جلسة إيموجي الفئات وإزالة SVG»** و**«جلسة إيموجي الدين والسياسة وتكبير خط الفئات»**. |
| `src/seenjeem.js` | جلب فئات/أسئلة سين جيم، `normalizeSeenJeemQuestion`، `SEENJEEM_KW_COUNTRY_ID` |
| `src/main.jsx` | نقطة الدخول |
| `vite.config.js` | بروكسي: Anthropic، Seen Jeem، **`/api/content` + `/api/rooms` + `/api/health`** → خادم محلي 3001 |
| `.env.example` | قالب المتغيرات (انسخه إلى `.env.local`) |
| `eslint.config.js` | استثناء `react-hooks/purity` لـ `Qadha.jsx` |
| `scripts/verify-categories.mjs` | سكربت تجريبي للفئات |
| `src/triviaFallbacks.js` | `FALLBACK_AR` |
| `src/triviaFallbacksEn.js` | `FALLBACK_EN` (يُصدَّر من `triviaFallbacks.js` أيضاً) |
| `src/index.css` | `#root`؛ أحجام خط أساسية |
| `index.html` | `viewport-fit=cover` + `safe-area` |
| **`CONTINUATION.md`** | هذا الملف — **احفظه مع المشروع** |

---

## المتغيرات (`.env.local` — مُستثنى من Git)

| المتغير | الغرض |
|---------|--------|
| `ANTHROPIC_API_KEY` | اختياري — توليد أسئلة عبر Claude في التطوير فقط. |
| `SEENJEEM_TOKEN` | اختياري — حزم/أسئلة حية من API مع `npm run dev`. |
| `QADHA_ADMIN_KEY` | على **بيئة تشغيل الخادم** (ليس شرطاً في `.env.local` للواجهة) — لتفعيل `POST /api/content/questions`. |
| `QADHA_SERVER_PORT` | اختياري — افتراضي **3001**. |
| `VITE_QADHA_API` | اختياري — عنوان الـ API في الإنتاج (بدون `/` أخيرة). |

**بروكسي Vite مع `npm run dev` فقط** (Anthropic / Seen Jeem / خادم قدها المحلي).

---

## واجهة ولغات

- **`TX`:** نصوص مدمجة **عربي · English**.
- **`BI`:** تلميحات ثنائية اللغة (مثل placeholder للإجابة، صعوبة، إلخ). **حُذف** سابقاً **`anthropicHint`** من القائمة.
- **`document.documentElement`:** `lang="ar"`، `dir="rtl"`.
- **شاشة الفئات:** ألوان **ثيم اللعبة** (ليلي/فاتح/هادئ) — ليست صفحة Seen Jeem الرمادية/البرتقالية المنفصلة. كلاسات: `catsSection`, `catsCard`, `catGroupTabBar`, `catsSteps`, … داخل `<style>` في `Qadha.jsx` وتستخدم `th.*`.

---

## تجميع الفئات في الواجهة

- **`CAT_GROUP_ROWS` + `groupCatsForUi`:** ٦ مجموعات + «أخرى» إن لزم. **سين جيم (حزمة واحدة):** صف واحد.
- **تبويبات الأقسام:** عند وجود أكثر من صف واحد، يظهر شريط **`catGroupTabBar`**؛ **`openCatGroupIdx`** يحدد القسم الظاهر؛ يُصفَّر عند تغيير الدولة أو `sjKwOnly`.

---

## ما يحفظه المتصفح

| المفتاح | الغرض |
|---------|--------|
| `qadha_theme` | `calm` \| `night` \| `light` |
| `qadha_qcache` | كاش أسئلة (يُمسح بعد المباراة) |
| `qadha_seen` | تتبع أسئلة (يُمسح مع الكاش) |
| `qadha_remote_content_ver` | آخر إصدار محتوى مُزامَن من السيرفر |
| `qadha_remote_overlay_cache` | نسخة محلية من `overlay` القادم من API |
| `sessionStorage` `qadha_room_host` | توكن المضيف للغرفة التجريبية (إن وُجد) |

---

## Git (حفظ للمرة القادمة)

المشروع يمكن أن يكون على فرع `master`. لحفظ نسخة:

```powershell
cd C:\Users\User\Downloads\qadha-game
git add -A
git status
git commit -m "وصف مختصر للتغييرات"
```

لا ترفع `.env.local` (مُدرج في `.gitignore`).

---

## كيف تكمل في جلسة جديدة

1. افتح `qadha-game` في Cursor.
2. اقرأ **`CONTINUATION.md`**.
3. اكتب طلبك للمساعد.

**انسخ المجلد كاملاً أو ادفع إلى Git / Drive** لفتحه من جهاز آخر.

---

## الملفات والمجلدات الضرورية (نسخ احتياطي كامل)

لإعادة فتح المشروع على أي جهاز، احتفظ بهذه العناصر (أو بمجلد المشروع كاملاً مع استثناء ما يلي من **عدم** الاعتماد عليه وحده):

### يجب أن تُحفَظ (مصدر المشروع)

| مسار | الدور |
|------|--------|
| `package.json` | التبعيات وسكربتات التشغيل |
| `package-lock.json` | إصدارات دقيقة للحزم (مُفضّل مع `package.json`) |
| `vite.config.js` | إعداد Vite + البروكسي (Anthropic / Seen Jeem / خادم قدها) |
| **`server/`** | `package.json`، `index.mjs`، `lib/`، `data/store.json` |
| `index.html` | نقطة HTML |
| `eslint.config.js` | فحص الكود |
| `.gitignore` | ما يُستثنى من Git |
| `.env.example` | قالب المتغيرات (انسخه يدوياً إلى `.env.local` عند الحاجة) |
| **`CONTINUATION.md`** | مرجع الجلسة وهذا الدليل |
| `README.md` | إن وُجد |
| **`src/`** بالكامل | يشمل `components/`، `game/`، `services/`، و`Qadha.jsx`، … |
| **`scripts/`** | مثل `verify-categories.mjs` |

### لا تُرفَع لـ Git لكن تُنشَأ محلياً (اختياري للنسخ اليدوي)

| مسار | ملاحظة |
|------|--------|
| `node_modules/` | يُعاد توليده بـ `npm install` — لا حاجة لنسخه إن كان لديك إنترنت |
| `dist/` | يُعاد بـ `npm run build` |
| `.env.local` | أسرارك المحلية — **انسخه يدوياً** لمكان آمن إن استخدمت مفاتيح API؛ لا يُرفع لـ Git |

### أوامر سريعة بعد نسخ المجلد على جهاز جديد

```powershell
cd مسار\qadha-game
npm install
npm run dev
```

### أرشفة المجلد (بدون `node_modules` و`dist`) — PowerShell

```powershell
cd C:\Users\User\Downloads
Compress-Archive -Path qadha-game\* -DestinationPath qadha-game-source.zip -Force
# ثم احذف من الأرشيف يدوياً مجلدي node_modules و dist إن وُجدا، أو انسخ المجلد بعد حذفهما أولاً
```

الأضمن: **`git clone`** أو **`git pull`** من مستودعك، أو نسخ المجلد كاملاً ثم `npm install`.

---

## جلسة أبريل ٢٠٢٦ — غرف أونلاين، صوت مباشر، WebSocket، تبسيط الواجهة

**احفظ هذا القسم مع المشروع.** عند العودة: افتح `CONTINUATION.md` وابحث عن هذا العنوان، أو استخدم `git log` لمطابقة الـ commit.

### ما تم تنفيذه (ملخّص)

1. **غرف أونلاين:** المضيف ينشئ غرفة والضيف يدخل بالكود؛ مزامنة **الدولة + الثمان فئات + الانتقال لخطوة إعداد الفريق** عبر `gameState` على الخادم (`PUT` بحماية `clientRev` للمضيف فقط).
2. **من يختار:** المضيف فقط يعدّل الدولة والفئات؛ الضيف يرى نفس الاختيار مع واجهة مقفلة لخياراته.
3. **صوت بين الأجهزة:** WebRTC (اتصال بين كل زوج من اللاعبين) مع إشارات **SDP / ICE**؛ النقل **فوري عبر WebSocket** عند الاتصال، مع **REST + صندوق inbox** كاحتياطي على الخادم.
4. **WebSocket للغرفة:** المسار `WS /api/realtime/room` (منفصل عن `GET /api/rooms/:code` لتفادي التعامل مع `ws` ككود غرفة) بعد رسالة `{ type: "auth", code, token }` (نفس `hostToken` أو `playerToken`). الخادم يبث **`snapshot`** (نفس شكل `GET /api/rooms/:code` بدون أسرار) عند تحديث `gameState` أو انضمام لاعب، ويوصّل إشارات الصوت للمستهدف مباشرة عند وجود اتصال WS.
5. **سلاسة العميل:** استبدال استطلاع الضيف كل ثانيتين بتحديث من الـ snapshot؛ تقليل زمن debounce لحفظ المضيف على شاشة الفئات؛ اللوبي يعتمد على القناة الحية بدل `setInterval` للـ REST.
6. **تنظيف واجهة اللاعب:** حذف نصوص تقنية (مثل rev/polling، عرض JSON، زر حالة تجريبية، تسميات مضيف/ضيف الثقيلة)، واختصار النصوص بلغة مناسبة للّعب.
7. **إصلاحات React:** ترتيب `useEffect` الذي يستدعي `go` بعد تعريف `useCallback`؛ استيفاء قواعد `eslint` لـ `setState` داخل التأثيرات حيث لزم.
8. **إصلاح مسار WebSocket:** كان `/api/rooms/ws` يتعارض مع `GET /api/rooms/:code` (يُفسَّر `ws` ككود غرفة → 404). **المسار الحالي:** `WS /api/realtime/room` مع بروكسي Vite على **`/api/realtime`** (`ws: true`).
9. **Anthropic بدون مفتاح:** متغير **`anthropicRemoteDisabled`** في `Qadha.jsx` يفعّل عند **401/403** من `/api/anthropic/v1/messages`؛ يُوقف **`genQs` / `genBatch` / `bulkDownload`** والتحميل المسبق من إغراق الشبكة والكونسول. يُصفّر بإعادة تحميل الصفحة.
10. **نص الدور والسرقة:** **`turnLabel`** و **`stealBanner`** في `Qadha.jsx` حسب **`country.lang`** (عربي: «فلان يلعب»؛ إنجليزي: `Name's Turn`) بدل خلط `tx.turn` ثنائي اللغة مع الاسم.

### الملفات المتأثرة (مرجع سريع)

| ملف | الدور |
|-----|--------|
| `server/index.mjs` | REST للغرف + `broadcastRoom` + WebSocket على **`/api/realtime/room`** + `deliverWsSignals` + POST/GET إشارات WebRTC |
| `server/package.json` | اعتماد **`ws`** |
| `vite.config.js` | **`ws: true`** على `/api/rooms` وعلى **`/api/realtime`** |
| `src/services/roomApi.js` | `postWebRtcSignal`، `getWebRtcInbox`، بقية REST |
| `src/services/roomWs.js` | `roomWsUrl()` للاتصال من المتصفح (مباشر 3001 أو عبر Vite) |
| `src/services/voiceMesh.js` | `VoiceMeshController` + `signalTransport` اختياري |
| `src/hooks/useRoomChannel.js` | اتصال WS + إعادة محاولة + استطلاع احتياطي خفيف |
| `src/hooks/useVoiceMesh.js` | ربط الصوت بالقناة وبـ `fetchPeerIds` اختياري |
| `src/components/OnlineLobby.jsx` | لوبي؛ تمرير `playerId` و`voiceToken` للضيف عند «متابعة» |
| `src/Qadha.jsx` | `onlineSession`، مايك، مزامنة ضيف، صوت، تدفق الفئات، **تعطيل Anthropic بعد 401**، **`turnLabel` / `stealBanner`** |

### شكل جلسة الأونلاين في الواجهة (`onlineSession`)

يُضبط عند «متابعة» من اللوبي تقريباً: `{ code, isHost, hostToken?, playerId, voiceToken }`.

- **المضيف:** `playerId === "host"`، `voiceToken` = `hostToken`.
- **الضيف:** `playerId` و`voiceToken` من استجابة `POST .../join`.

### التشغيل (تذكير)

```powershell
cd C:\Users\User\Downloads\qadha-game
npm install
cd server
npm install
cd ..
npm run dev
```

يجب أن يعمل **الخادم على المنفذ 3001** مع **Vite** حتى الغرف والـ WebSocket يعملان من الواجهة.

### قيود وحلول لاحقة

- **STUN فقط** على العميل؛ بعض شبكات الجوال/NAT تحتاج **خادم TURN** لثبات الصوت.
- **لوحة اللعب (شبكة الأسئلة)** ما زالت **محلية لكل جهاز**؛ المزامنة الحالية تغطي الفئات وانتقال المرحلة إلى الإعداد لا غير.
- **اختبار يدوي:** إن كان **المنفذ 3001 مشغولاً**، `npm run dev` قد يسقط السيرفر بينما Vite يعمل؛ أغلق العملية القديمة أو غيّر `QADHA_SERVER_PORT`.

### مفاتيح كود للمتابعة السريعة (بحث داخل المشروع)

- `anthropicRemoteDisabled` — تعطيل دفعات Anthropic بعد فشل التصريح.
- `markAnthropicAuthFailure` — يُستدعى عند `!r.ok` في `genQs` / `genBatch`.
- `turnLabel` / `stealBanner` — عرض الدور وسرقة السؤال حسب لغة الدولة.
- `useRoomChannel` — `roomWsUrl()` → **`/api/realtime/room`**.

### حفظ التعديلات في Git (عندك)

```powershell
cd C:\Users\User\Downloads\qadha-game
git add -A
git status
git commit -m "أونلاين: realtime WS، WebRTC صوت، Anthropic عند 401، نص دور عربي/إنجليزي"
```

---

## جلسة واجهة وفئات (٣ أبريل ٢٠٢٦) — ما طلبه المستخدم وما نُفِّذ

**ملاحظة (متابعة لاحقة):** أي ذكر لـ **`categoryArt` / SVG** هنا **تاريخي**؛ **الشكل الحالي للفئات = إيموجي كبير فقط** — راجع **«جلسة إيموجي الفئات وإزالة SVG»** و**«جلسة إيموجي الدين والسياسة وتكبير خط الفئات»** أدناه.

**المرجع:** نفّذ في نفس فترة محادثات Cursor؛ احفظ هذا القسم مع المشروع لفتح الجلسة لاحقاً.

### طلبات المستخدم (ملخّص)

| الطلب | التنفيذ |
|--------|---------|
| فتح اللعبة في Chrome | تشغيل `npm run dev` من الجذر ثم فتح المتصفح على منفذ Vite (غالباً `5173`؛ إن كانت المنافذ مشغولة قد يكون `5176` إلخ). إن سقط **خادم 3001** بسبب `EADDRINUSE`، أغلق العملية القديمة أو غيّر **`QADHA_SERVER_PORT`**. |
| استبدال نص تحت عنوان «قدها؟» | أصبح **Powered By : Bojrmakh Q8 Team**؛ زيادة المسافة بين العنوان والنص (**margin** سفلي للعنوان ≈ **28px**). |
| إزالة فقرة تلميح Anthropic/الكاش | حُذف **`BI.anthropicHint`** وحُذفت الفقرة من شاشة **`menu`** التي كانت تظهر عند وجود مسار Anthropic في التطوير. |
| تسمية أوضح من «غرفة أونلاين» | الزر والعنوان في **`OnlineLobby`**: **اللعب الجماعي · Multiplayer**. |
| إزالة إيموجي السيفين من الواجهة | إزالة **⚔️** من **`T.ar` / `T.en`** (`start`, `startM`, `rematch`)； في اختيار الوضع **١ ضد ١** أيقونة الزر **⚡** بدل السيف. |
| صور كرتونية للفئات (وليس رموزاً) | جرّبنا **صور خارجية** (`image.pollinations.ai`) ثم أُلغي الاعتماد (حجب/عدم ظهور). العودة لرسوم **SVG محلية**. |
| ألوان واضحة بكل الأنماط وأشكال جديدة | إعادة تصميم **`categoryArt.jsx`** بالكامل: ألوان **صلبة `rgb`**، تدرج خلفية **`bgTop`/`bgBot`**، حدود **تعتمد على الثيم**: **`isDarkUi`** (`true` عند **`themeMode === "night"`**) ← حد فاتح `#f1f5f9` على بطاقات داكنة، وحد داكن `#0f172a` على بطاقات فاتحة. أشكال جديدة لكل **`id`** فئة (~٦٠ حالة). |
| اختفت الصور / إصلاح عاجل | **السبب:** كائن **`st`** كان يتضمّن **`fill: "none"`** ويُنشر **بعد** `fill={...}` فكان يلغي التعبئة. **الحل:** `st` يحوي **خصائص stroke فقط** (`stroke`, `strokeWidth`, …). |
| حفظ كل التعديلات في ملف | **هذا القسم + باقي `CONTINUATION.md`** — ويُفضَّل **`git commit`**. |

### ملفات تغيّرت في هذه الجلسة (واجهة وفئات)

| ملف | ماذا |
|-----|------|
| `src/Qadha.jsx` | نص القائمة، المسافات، حذف تلميح Anthropic، **⚡** للوضع ١ض١، **`CategoryArt`** يستقبل **`isDarkUi={isNight}`** (بطاقات، شرائح، `CatIcon`). |
| `src/components/OnlineLobby.jsx` | عنوان **اللعب الجماعي · Multiplayer**. |
| `src/categoryArt.jsx` | دالة **`palette(hex, isDarkUi)`**؛ **`CategoryCartoonInner`** بأشكال جديدة؛ **`CategoryArt`** يقبل **`isDarkUi`**؛ إصلاح تعارض **`fill`** مع الـ spread. |
| ~~`src/data/categoryArtPrompts.js`~~ | **حُذف** (كان مخصصاً لبرومبت صور خارجية؛ لم يعد مستخدماً). |

### تشغيل سريع (تذكير)

```powershell
cd C:\Users\User\Downloads\qadha-game
npm run dev
```

- Chrome: `http://localhost:5173` (أو المنفذ الذي يطبعُه Vite في الطرفية).

---

## جلسة إيموجي الفئات وإزالة SVG (٣ أبريل ٢٠٢٦ — متابعة محادثات Cursor)

**الغرض:** توثيق كل ما طُبّق لاحقاً على **عرض الفئات** حتى يمكن الرجوع للملف دون فقدان السياق.

### تسلسل الطلبات والقرارات

| المرحلة | ما طلبه المستخدم | ما نُفِّذ |
|---------|------------------|-----------|
| ١ | مطابقة [سين جيم](https://seenjeemkw.com/start-game) لشكل البطاقات | بانر، شريط تدرج، دائرة اختيار… ثم طالب **بشكل صور الفئات فقط** فرُجعت البطاقة القديمة مع `variant="thumbnail"` في SVG. |
| ٢ | صور حقيقية (مثل طائرة للطيران) | `CategoryVisual` + `src/data/categoryPhotos.js` (روابط Unsplash). |
| ٣ | ليس صوراً بل **SVG أوضح لكل فئة** | إعادة رسم `CategoryCartoonInner`؛ حذف صور الويب و`categoryPhotos.js`. |
| ٤ | **إيموجي أفضل** لكل فئة | تحديث **`CATS[].icon`** (تمييز أدق: مثلاً تاريخ `📜`، سياسة → لاحقاً **`🏛️`**، دين → **`🕌`**، طيران `🛫`، سفر `🧳`، رياضة عامة `🏀` وكرة القدم `⚽`، …) ثم عرض الإيموجي فقط في البطاقات والشرائح و`CatIcon`. |
| ٥ | **إزالة SVG** والإبقاء على إيموجي **أوضح وأكبر** | حذف **`src/categoryArt.jsx`** بالكامل؛ إزالة استيراد **`CategoryArt`** من **`Qadha.jsx`**؛ العرض = **`cat.icon` فقط** مع أحجام كبيرة. |

### الحالة الحالية في الكود (مختصر)

- **`src/Qadha.jsx`**
  - **`CATS` — دين/سياسة (تحديث لاحق):** `religion.icon` = **`🕌`**، `politics.icon` = **`🏛️`** (بدل الشمعة/صندوق الاقتراع السابقين).
  - **`CatIcon`:** يعرض الإيموجي فقط؛ **`sz` الافتراضي 64**؛ في شبكة اللعب **`sz={62}`**؛ حجم الخط: `Math.round(Math.max(54, Math.min(132, sz*1.38)))`.
  - **بطاقة الفئة (`catsCardBody`):** `<span className="catsCardEmoji">` فقط — **لا SVG**؛ **`min-height: clamp(124px, 28vw, 158px)`**؛ حشو أعلى/أسفل 16px/14px.
  - **شرائح الاختيار (`catsChip`):** `<span className="catsChipEmoji">` فقط.
  - **أنماط مدمجة في `<style>`:**  
    - `.catsCardEmoji` — `font-size: clamp(64px, 18vw, 102px)` + `drop-shadow`  
    - `.catsChipEmoji` — `clamp(44px, 11vw, 64px)`  
    - `.catsChip` / `.catsChipSlot` — **`min-width` 76px، `min-height` 82px** للشريحة/الفراغ؛ حشو الشريحة 12px 14px 14px  
    - شبكة الفئات أسفل الشرائح: **`minHeight: 68`** لحاوية `CatIcon`  
    - `.catsCardEmoji, .catsChipEmoji, .catEmojiSolo` — عائلة خطوط: `Segoe UI Emoji`, `Apple Color Emoji`, `Noto Color Emoji`
- **محذوف ولا يُستورد:** `src/categoryArt.jsx`  
- **محذوف سابقاً:** `src/data/categoryPhotos.js`

**التحقق:** `npm run lint` ناجح بعد تعديلات الإيموجي والأحجام.

### مثال `commit` موصى به

```powershell
cd C:\Users\User\Downloads\qadha-game
git add -A
git commit -m "فئات: إيموجي فقط بحجم كبير، إزالة categoryArt (SVG)"
```

---

## جلسة إيموجي الدين والسياسة وتكبير خط الفئات (٣ أبريل ٢٠٢٦)

**طلب المستخدم:** استبدال إيموجي فئة **الدين** و**السياسة** برموز **دينية وسياسية أوضح**، و**تكبير خط عرض الفئات** في الواجهة.

### ما نُفِّذ

| البند | قبل | بعد |
|--------|-----|-----|
| **الدين (`religion`)** | 🕯️ | **🕌** |
| **السياسة (`politics`)** | 🗳️ | **🏛️** |
| **بطاقة الفئة `.catsCardEmoji`** | `clamp(52px, 15vw, 86px)` | **`clamp(64px, 18vw, 102px)`** |
| **شرائح `.catsChipEmoji`** | `clamp(36px, 9vw, 52px)` | **`clamp(44px, 11vw, 64px)`** |
| **`CatIcon`** | `sz` افتراضي 56، شبكة 52، `max(44..108, sz*1.25)` | **`sz` افتراضي 64، شبكة 62، `max(54..132, sz*1.38)`** |
| **جسم البطاقة `.catsCardBody`** | `min-height` أصغر وحشو أقل | **`clamp(124px, 28vw, 158px)`** وحشو **16px / 14px** |
| **الشريحة `.catsChip` / `.catsChipSlot`** | ~68×72 | **76×82** مع حشو أوضح |
| **حاوية الإيموجي في شبكة اللعب** | `minHeight: 56` | **`minHeight: 68`** |

**الملف المتأثر:** `src/Qadha.jsx` فقط (مصفوفة **`CATS`** + **`CatIcon`** + كتلة **`<style>`** + سطر شبكة **`CatIcon`**).

**اختبار:** `npm run lint` — نجاح.

### ملاحظة تصميم

- **🕌** يربط الفئة بالدين بوضوح في السياق العربي؛ إن رُغِبَ رمز أقل ارتباطاً بمكان معيّن يمكن لاحقاً **`🛐`** (مكان عبادة) أو **`🤲`**.
- **🏛️** يعبّر عن مؤسسة/حكم أكثر من **🗳️** (اقتراع) وحده.

---

## سجل تحديثات مختصر

- **٣ أبريل ٢٠٢٦:** خادم `server/` (محتوى + غرف)، بروكسي Vite، `OnlineLobby`، `remoteOverlay`، `questionCache.js`، توثيق الرؤية في هذا الملف.
- **٣ أبريل ٢٠٢٦ (إضافة):** غرف أونلاين مع **WebSocket** (`/api/realtime/room`)، صوت **WebRTC**، المضيف يختار الفئات، مزامنة فورية للضيف، تنظيف نصوص اللوبي/الفئات.
- **٣ أبريل ٢٠٢٦ (لاحق):** إيقاف إسهال طلبات **Anthropic** عند **401/403**؛ **دور / سرقة** بلغة واحدة عبر `turnLabel` و`stealBanner` — كل ذلك في **`Qadha.jsx`** والقسم **«جلسة أبريل ٢٠٢٦ — غرف أونلاين…»**.
- **٣ أبريل ٢٠٢٦ (واجهة):** **Powered By Bojrmakh Q8 Team**، إزالة فقرة تلميح Anthropic، **اللعب الجماعي · Multiplayer**، إزالة **⚔️** من الأزرار الرئيسية و**⚡** ل١ض١، ~~`categoryArt.jsx`~~ (أُلغي لاحقاً — راجع **«جلسة إيموجي الفئات وإزالة SVG»**)؛ حذف **`categoryArtPrompts.js`** سابقاً.
- **٣ أبريل ٢٠٢٦ (فئات — لاحقاً):** تجارب سين جيم / صور Unsplash / SVG أعد تصميمه → **القرار النهائي:** **`CATS[].icon` فقط**، أحجام كبيرة، **حذف `categoryArt.jsx`**؛ تفاصيل كاملة في القسم **«جلسة إيموجي الفئات وإزالة SVG»**.
- **٣ أبريل ٢٠٢٦ (فئات — متابعة):** **الدين 🕌**، **السياسة 🏛️**؛ تكبير **`catsCardEmoji` / `catsChipEmoji` / `CatIcon`** والشرائح والحاوية في الشبكة — القسم **«جلسة إيموجي الدين والسياسة وتكبير خط الفئات»**.
- **تدفق:** قائمة → دولة+فئات → إعداد (وضع+فريق) → لعب؛ إزالة شاشة `mode` المنفصلة.
- **سين جيم:** أسئلة محلية بدون توكن (دمج GEN + FALLBACK + اختياري KW مع فلتر الكويت).
- **فئات:** تبويبات لكل قسم كبير بدل عرض كل الأقسام دفعة واحدة.
- **ألوان الفئات:** موحدة مع ثيم اللعبة.
- دمج اللغات `TX`/`BI`؛ `prefetch` عند `menu` أو `cats`.
- **عالمي منفصل عربي/إنجليزي**؛ **إزالة الرهان**؛ **تصفير الفئات** عند العودة من القائمة/زر فئات جديدة؛ **عرض الفئات = إيموجي كبير فقط** (لا `categoryArt.jsx`).

**آخر تحديث للملف:** ٣ أبريل ٢٠٢٦ — يشمل: غرف أونلاين، WebSocket **`/api/realtime/room`**، WebRTC صوت، تعطيل Anthropic بعد 401، نص دور/سرقة حسب لغة الدولة، واجهة القائمة (Bojrmakh، Multiplayer)، **«جلسة إيموجي الفئات وإزالة SVG»**، و**«جلسة إيموجي الدين والسياسة وتكبير خط الفئات»** (🕌 / 🏛️ + أحجام أوضح + `npm run lint`).

---

## جلسة تطوير ٣ أبريل ٢٠٢٦ — خادم + رؤية مستقبلية

- توثيق **رؤية المنتج** (صوت، شات، طورين، فرق، محتوى، حسابات، دخل، إشراف، AI) في القسم أعلاه.
- إضافة **`server/`** (محتوى بإصدارات، منع تكرار، غرف في الذاكرة).
- ربط الواجهة: **`contentApi`**، **`roomApi`**، **`OnlineLobby`**، دمج **`remoteOverlay`** في **`getQuestions`**.
- سكربتات **`npm run dev`** الموحّدة مع **`concurrently`**؛ تحديث **`.env.example`**.

---

## جلسة تطوير ٢ أبريل ٢٠٢٦ (للمراجعة لاحقاً)

### الدول (`COUNTRIES`)
- استبدال «عالمي» الواحد بـ **عالمي · أسئلة عربية** (`general_ar`) و**عالمي · English questions** (`general_en`).
- `getQuestions`: العربي يستخدم `GEN_AR` + `FALLBACK_AR` فقط؛ الإنجليزي `GEN` + `FALLBACK_EN` فقط (لا خلط في نفس الوضع). الكويت وقدها؟ كما هما.

### الفئات بعد انتهاء اللعب
- من الرئيسية «يلا» ومن النتائج «الرئيسية»: **تصفير** `selCats`.
- زر **فئات جديدة** (`tx.newCats`) من النتائج → `cats` مع تصفير الاختيار. «ثاني» يحافظ على نفس الفئات.

### واجهة الفئات
- تمييز أقوى للمختار: `catsCardSel` + `catsChipOn`.
- **تحديث لاحق (نفس اليوم):** عرض الفئات أصبح **`CATS[].icon` (إيموجي) بحجم كبير** فقط؛ **`categoryArt.jsx` حُذف** — راجع **«جلسة إيموجي الفئات وإزالة SVG»**.

### إزالة الرهان
- حُذف `wager` من الحالة ومن شاشة الإعداد والنصوص `TX`.

### محتوى / لغة
- تصحيح سؤال صحة فاسد في بنك الكويت؛ «فيديو قيم» → «فيديو جيم»؛ إصلاح خيارات مكررة في `triviaFallbacks` (الأهرام).

### ملفات هذه الجلسة
| ملف | ملاحظة |
|-----|--------|
| `src/Qadha.jsx` | الدول، `getQuestions`، واجهة، إزالة رهان، أزرار/تصفير؛ **لاحقاً:** فئات بإيموجي فقط (بدون `CategoryArt`) |
| ~~`src/categoryArt.jsx`~~ | **حُذف** في الجلسة اللاحقة — راجع قسم **إيموجي الفئات وإزالة SVG** |
| `src/triviaFallbacks.js` | إصلاح خيار مكرر في `media` |

### حفظ في Git (على جهازك)
بعد التعديلات نفّذ (أو استخدم الـ commit الجاهز):

```powershell
cd C:\Users\User\Downloads\qadha-game
git add -A
git status
git commit -m "عالمي عربي/إنجليزي منفصل، فئات جديدة، CategoryArt، إزالة الرهان، إصلاحات أسئلة"
```

للنسخ الاحتياطي: انسخ المجلد كاملاً أو ادفع `master` إلى remote، ولا ترفع `.env.local`.

**أهم commit للميزات:** `c908b74`. **لآخر حفظ على Git:** نفّذ `git log -1 --oneline` داخل المجلد.
