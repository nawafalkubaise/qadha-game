/**
 * أسئلة دول الخليج (غير الكويت): ملف لكل فئة تحت
 *   src/data/banks/<sa|ae|qa|bh|om>/<categoryId>.json
 */
import { loadBankForCountry } from "./banksLoader.js";

export const GCC_COUNTRY_IDS = ["sa", "ae", "qa", "bh", "om"];

const built = {};
for (const id of GCC_COUNTRY_IDS) {
  built[id] = loadBankForCountry(id);
}

export const GCC_BANKS = built;

export function isGccCountryId(cid) {
  return GCC_COUNTRY_IDS.includes(cid);
}
