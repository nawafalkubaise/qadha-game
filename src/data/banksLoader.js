/**
 * تحميل بنوك JSON في Vite: src/data/banks/<دولة>/<فئة>.json
 * (سكربتات Node تستخدم scripts/lib/readBanksFs.mjs)
 */
const allBankModules = import.meta.glob("./banks/*/*.json", { eager: true });

export function loadBankForCountry(countryId) {
  const bank = {};
  const prefix = `./banks/${countryId}/`;
  for (const [p, mod] of Object.entries(allBankModules)) {
    if (!p.startsWith(prefix) || !p.endsWith(".json")) continue;
    const catId = p.slice(prefix.length, -5);
    bank[catId] = Array.isArray(mod.default) ? mod.default : [];
  }
  return bank;
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
