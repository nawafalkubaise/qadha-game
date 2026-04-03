/**
 * قاعدة طلبات الـ API.
 * - إن وُجد VITE_QADHA_API يُستخدم (إنتاج أو إعداد يدوي).
 * - في التطوير وعند فتح الصفحة من localhost/127.0.0.1: اتصال مباشر بخادم اللعبة
 *   حتى يعمل `npm run dev:server` مع `npm run dev:client` دون 502 من بروكسي Vite.
 * - من عنوان شبكة محلي (مثلاً 192.168.x.x): نسبي → بروكسي Vite إلى 127.0.0.1:3001.
 * - إنتاج `npm run start:prod`: الواجهة والـ API على نفس الأصل؛ apiBase() يرجع "" فيستخدم مسارات نسبية.
 */
export function apiBase() {
  const v = import.meta.env.VITE_QADHA_API;
  if (typeof v === "string" && v.trim()) return v.replace(/\/$/, "");
  if (import.meta.env.DEV && typeof globalThis !== "undefined" && globalThis.location?.hostname) {
    const h = globalThis.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") {
      const raw = String(import.meta.env.VITE_QADHA_SERVER_PORT || "3001");
      const p = /^\d+$/.test(raw) ? raw : "3001";
      return `http://127.0.0.1:${p}`;
    }
  }
  return "";
}
