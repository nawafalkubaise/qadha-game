/**
 * أسئلة دول الخليج (غير الكويت): ملف لكل فئة تحت
 *   src/data/banks/<sa|ae|qa|bh|om>/<categoryId>.json
 * تُجلب حزمة الدولة عند الطلب فقط.
 */
import { loadBankForCountry } from "./banksLoader.js";

export const GCC_COUNTRY_IDS = ["sa", "ae", "qa", "bh", "om"];

export function loadGccBank(countryId) {
  return loadBankForCountry(countryId);
}

export function isGccCountryId(cid) {
  return GCC_COUNTRY_IDS.includes(cid);
}
