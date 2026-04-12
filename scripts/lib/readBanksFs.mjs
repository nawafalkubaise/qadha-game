/**
 * قراءة بنوك الأسئلة من القرص (Node فقط) — نفس هيكل src/data/banks/<دولة>/<فئة>.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BANKS_ROOT = path.join(__dirname, "..", "..", "src", "data", "banks");

export function readCountryBankFromFs(countryId) {
  const dir = path.join(BANKS_ROOT, countryId);
  const bank = {};
  if (!fs.existsSync(dir)) return bank;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const cat = f.slice(0, -5);
    try {
      bank[cat] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    } catch {
      bank[cat] = [];
    }
  }
  return bank;
}

export const GCC_COUNTRY_IDS_FS = ["sa", "ae", "qa", "bh", "om"];

export function readAllGccBanksFromFs() {
  const out = {};
  for (const id of GCC_COUNTRY_IDS_FS) {
    out[id] = readCountryBankFromFs(id);
  }
  return out;
}

/** general_ar أو general_en — مصفوفة لكل معرّف فئة (ملف ناقص = []) */
export function readGeneralBankDisk(isAr, catIds) {
  const folder = isAr ? "general_ar" : "general_en";
  const bank = {};
  for (const id of catIds) {
    const fp = path.join(BANKS_ROOT, folder, `${id}.json`);
    bank[id] = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf8")) : [];
  }
  return bank;
}
