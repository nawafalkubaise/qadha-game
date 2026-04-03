#!/usr/bin/env node
/**
 * فحص سريع قبل مشاركة الرابط: يتصل بـ /api/health
 * الاستخدام: node scripts/share-preflight.mjs [baseUrl]
 */
const base = (process.argv[2] || "http://127.0.0.1:3001").replace(/\/$/, "");
const url = `${base}/api/health`;

let ok = false;
let detail = "";
try {
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  ok = r.ok;
  detail = `${r.status} ${r.statusText}`;
  if (ok) {
    const j = await r.json().catch(() => null);
    if (j) detail = JSON.stringify(j);
  }
} catch (e) {
  detail = String(e?.message || e);
}

if (ok) {
  console.log(`[قدها] جاهز: ${url}\n${detail}`);
  process.exit(0);
}
console.error(`[قدها] غير جاهز: ${url}\n${detail}`);
process.exit(1);
