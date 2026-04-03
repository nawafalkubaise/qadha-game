# مشاركة «قدها؟» مع الجمهور — دليل كامل

الخادم يقدّم **الصفحة + REST + WebSocket** على **منفذ واحد**. للنشر العام تحتاج عادة **HTTPS** (شهادة TLS) ونطاقاً أو رابط استضافة.

## قبل المشاركة (تحقق سريع)

بعد تشغيل الخادم (محلياً أو Docker):

```bash
npm run share:check
# أو مع رابط النشر:
node scripts/share-preflight.mjs https://لعبتك.example
```

يجب أن يعيد `GET /api/health` ناجحة (`{ "ok": true, ... }`).

---

## 1) Docker على VPS أو جهازك (موصى به)

### المتطلبات
- Docker + Docker Compose
- فتح المنفذ **3001** في الجدار الناري (أو منفذ الواجهة الأمامية 443 فقط إن استخدمت Caddy/nginx)

### التشغيل

```bash
docker compose up -d --build
```

- رابط مباشر: `http://IP-السيرفر:3001`
- البيانات (`store.json` والـ overlay): تُحفظ في حجم Docker **`qadha_data`**

### أسرار اختيارية (`.env`)

```bash
cp .env.share.example .env
# عدّل القيم، ثم أضف في docker-compose.yaml تحت qadha:
#   env_file: .env
```

أو عيّن المتغيرات يدوياً في `docker-compose.yaml` (مثل `QADHA_ADMIN_KEY`).

### أوامر npm مكافئة

```bash
npm run docker:up    # بناء + تشغيل بالخلفية
npm run docker:down  # إيقاف
```

---

## 2) HTTPS أمام Docker (Caddy — الأسهل)

1. انسخ `Caddyfile.example` إلى `Caddyfile` واستبدل `example.com` بنطاقك.
2. أشِر DNS (سجل A) إلى IP السيرفر.
3. شغّل Caddy؛ يحصل على شهادة Let’s Encrypt تلقائياً.
4. `reverse_proxy` يوجّه إلى `localhost:3001` حيث Docker يستمع.

لـ **nginx** راجع `nginx.conf.example` (تأكد من تمرير **Upgrade** لمسار WebSocket `/api/realtime/`).

ضع **`QADHA_TRUST_PROXY=1`** في بيئة الحاوية عند استخدام بروكسي (موجود افتراضياً في `docker-compose.yaml`).

---

## 3) استضافة سحابية جاهزة (رابط عام بلا إدارة VPS)

كل الخيارات تستخدم **`Dockerfile`** الموجود في الجذر.

### Fly.io
1. ثبّت [flyctl](https://fly.io/docs/hands-on/install-flyctl/).
2. في مجلد المشروع: `fly launch` (يمكن دمج الإعداد مع `fly.toml` المرفق).
3. أسرار: `fly secrets set QADHA_ADMIN_KEY=your-long-secret`
4. `fly deploy` — يعطيك `https://qadha-game.fly.dev` (أو الاسم الذي اخترته).
5. عدّل `app = "..."` في `fly.toml` إن لزم.

### Render
1. حساب على [Render](https://render.com) → **New** → **Blueprint**.
2. اربط المستودع؛ يقرأ **`render.yaml`**.
3. أضف من اللوحة أي أسرار (مثل `QADHA_ADMIN_KEY`) إن رغبت.
4. Render يحقن **`PORT`**؛ الخادم يدعم ذلك تلقائياً.

### Railway
1. [Railway](https://railway.app) → مشروع جديد من Git أو `railway up`.
2. يكتشف **`Dockerfile`** (راجع **`railway.toml`**).
3. `PORT` يُضبط تلقائياً من المنصة.

> على الخطط المجانية قد يكون هناك «نوم» للخدمة أو حدود موارد — راجع سياسة كل منصة.

---

## 4) تجربة سريعة من جهازك (بدون VPS)

**لا تصلح للجمهور الكبير** — الرابط مؤقت والثقة محدودة.

1. شغّل اللعبة: `npm run start:prod` **أو** `npm run dev`.
2. في طرفية ثانية:
   - مع `start:prod`: `npm run tunnel:cf:prod` أو `npm run tunnel:lt:prod`
   - مع `dev`: `npm run tunnel:cf` أو `npm run tunnel:lt`
3. استخدم الـ `https://...` الذي تطبعه الأداة.

إن فشل Cloudflare DNS لديك، جرّب **localtunnel** أو **ngrok** (`tunnel:ngrok:prod` مع الإنتاج).

---

## متغيرات البيئة (مرجع)

| المتغير | متى |
|---------|-----|
| `QADHA_SERVER_PORT` | منفذ الاستماع (يتقدّم على `PORT`) |
| `PORT` | يضبطه Render وRailway وغيرها |
| `QADHA_TRUST_PROXY` | `1` خلف بروكسي HTTPS |
| `QADHA_CORS_ORIGINS` | إن فُصلت الواجهة عن الـ API |
| `QADHA_ADMIN_KEY` | تمكين رفع الأسئلة عبر API |
| `QADHA_DIST_DIR` | مسار `dist` غير الافتراضي (نادر) |

---

## ملاحظات مهمة

- **الغرف واللعب المباشر** في الذاكرة: إعادة تشغيل الخادم تفرغ الغرف النشطة.
- **المحتوى (`store.json`)** مع Docker + الحجم `qadha_data` يبقى بين إعادة التشغيل.
- للعب صوت/WebRTC مع الجمهور: HTTPS حقيقي يساعد المتصفحات على السماح بالميكروفون.

---

## الملفات المرتبطة بالنشر

| الملف | الغرض |
|--------|--------|
| `Dockerfile` | بناء واجهة + خادم |
| `docker-compose.yaml` | تشغيل محلي/سيرفر مع حفظ البيانات |
| `docker-entrypoint.sh` | صلاحيات وتهيئة `store.json` |
| `fly.toml` | Fly.io |
| `render.yaml` | Render Blueprint |
| `railway.toml` | Railway |
| `Caddyfile.example` / `nginx.conf.example` | HTTPS أمام المنفذ 3001 |
| `.env.share.example` | قالب أسرار Docker |
