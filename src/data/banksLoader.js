/**
 * تحميل بنوك JSON في Vite: src/data/banks/<دولة>/<فئة>.json
 * كل دولة في chunk مستقل يُجلب عند الطلب عبر banks/<دولة>/index.js
 * (سكربتات Node تستخدم scripts/lib/readBanksFs.mjs)
 */
const countryChunks = import.meta.glob("./banks/*/index.js");

/** cid → Promise<bank> (نخزّن الوعد نفسه حتى لا يتكرر الجلب) */
const pending = new Map();

export function loadBankForCountry(countryId) {
  if (pending.has(countryId)) return pending.get(countryId);
  const chunk = countryChunks[`./banks/${countryId}/index.js`];
  const p = chunk
    ? chunk().then((mod) => ({ ...mod.default }))
    : Promise.resolve({});
  /* فشل الشبكة لا يُخزَّن — المحاولة التالية تعيد الجلب */
  p.catch(() => pending.delete(countryId));
  pending.set(countryId, p);
  return p;
}

export function loadKwBankFlat() {
  return loadBankForCountry("kw");
}

export function loadGeneralArBank() {
  return loadBankForCountry("general_ar");
}

export function loadGeneralEnBank() {
  return loadBankForCountry("general_en");
}
