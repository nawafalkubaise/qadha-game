/**
 * حزمة كسولة لدولة واحدة: Vite يجمع كل ملفات JSON في هذا المجلد
 * داخل chunk واحد يُحمَّل عند الطلب (انظر ../../banksLoader.js).
 */
const mods = import.meta.glob("./*.json", { eager: true });

const bank = {};
for (const [p, mod] of Object.entries(mods)) {
  bank[p.slice(2, -5)] = Array.isArray(mod.default) ? mod.default : [];
}

export default bank;
