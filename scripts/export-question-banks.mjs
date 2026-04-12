/**
 * يصدّر كل أسئلة اللعبة إلى ملفات JSON:
 *   src/data/banks/<countryId>/<categoryId>.json
 *
 * الدول: general_ar, general_en, kw, sa, ae, qa, bh, om
 * المحتوى العام: دمج ما على القرص + FALLBACK (بدون تكرار).
 *
 * تشغيل: node scripts/export-question-banks.mjs
 */
import imported from "../src/data/kwImportedBank.json" with { type: "json" };
import { mergeKwBank } from "../src/data/kwMergeImported.js";
import {
  readCountryBankFromFs,
  readAllGccBanksFromFs,
  readGeneralBankDisk,
  GCC_COUNTRY_IDS_FS,
} from "./lib/readBanksFs.mjs";
import { FALLBACK_AR } from "../src/triviaFallbacks.js";
import { FALLBACK_EN } from "../src/triviaFallbacksEn.js";
import {
  BANKS_DIR,
  bankJsonPath,
  ensureDirForFile,
  readCatIdsFromQadha,
} from "./lib/bankPaths.mjs";
import { mergeQuestionLists } from "./lib/questionValidate.mjs";

const KW_MERGED = mergeKwBank(readCountryBankFromFs("kw"), imported);
const GCC_BANKS = readAllGccBanksFromFs();
const GCC_COUNTRY_IDS = GCC_COUNTRY_IDS_FS;

function writeJson(p, data) {
  ensureDirForFile(p);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const catIds = readCatIdsFromQadha();
const genArRaw = readGeneralBankDisk(true, catIds);
const genEnRaw = readGeneralBankDisk(false, catIds);

let written = 0;
for (const cid of catIds) {
  const mergedAr = mergeQuestionLists(genArRaw[cid], FALLBACK_AR[cid]);
  writeJson(bankJsonPath("general_ar", cid), mergedAr);
  written++;
  const mergedEn = mergeQuestionLists(genEnRaw[cid], FALLBACK_EN[cid]);
  writeJson(bankJsonPath("general_en", cid), mergedEn);
  written++;
}

for (const cid of catIds) {
  const arr = Array.isArray(KW_MERGED[cid]) ? KW_MERGED[cid] : [];
  writeJson(bankJsonPath("kw", cid), arr);
  written++;
}

for (const country of GCC_COUNTRY_IDS) {
  const bank = GCC_BANKS[country] || {};
  for (const cid of catIds) {
    const arr = Array.isArray(bank[cid]) ? bank[cid] : [];
    writeJson(bankJsonPath(country, cid), arr);
    written++;
  }
}

console.log(`تم تصدير ${written} ملفاً JSON إلى:\n  ${BANKS_DIR}`);
console.log(`الفئات: ${catIds.length} · الدول: general_ar, general_en, kw, ${GCC_COUNTRY_IDS.join(", ")}`);
