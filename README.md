# قدها؟ (Qadha)

لعبة أسئلة وواجهة عربية — **Vite + React** مع **خادم Node** (غرف أونلاين، WebSocket، محتوى ديناميكي).

## التشغيل للتطوير

```bash
npm install
cd server && npm install && cd ..
npm run dev
```

- الواجهة: غالباً [http://localhost:5173](http://localhost:5173)
- الـ API: [http://localhost:3001/api/health](http://localhost:3001/api/health)

## إنتاج محلي (منفذ واحد)

```bash
npm run start:prod
```

ثم افتح **http://localhost:3001**

## رفع الكود إلى GitHub (خطوة واحدة بعد التسجيل)

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth login
.\scripts\publish-github.ps1
```

أو بمفتاح شخصي (PAT · صلاحية `repo`): عيّن `$env:GITHUB_TOKEN` ثم شغّل نفس السكربت. التفاصيل داخل الملف.

## مشاركة اللعبة مع الناس

كل الخطوات، Docker، HTTPS، Fly / Render / Railway، والنفق السريع موثّقة في:

**[DEPLOY.md](./DEPLOY.md)**

فحص سريع بعد التشغيل:

```bash
npm run share:check
```

## ترخيص

خاص بالمشروع — راجع المستودع أو المالك.
