/**
 * يتحقق من عدد الأسئلة لكل فئة (٦٠ فئة) في البنوك الرئيسية.
 * تشغيل: node scripts/verify-question-counts.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import imported from "../src/data/kwImportedBank.json" with { type: "json" };
import { mergeKwBank } from "../src/data/kwMergeImported.js";
import {
  readCountryBankFromFs,
  readAllGccBanksFromFs,
  GCC_COUNTRY_IDS_FS,
} from "./lib/readBanksFs.mjs";

const KW = mergeKwBank(readCountryBankFromFs("kw"), imported);
const GCC_BANKS = readAllGccBanksFromFs();
const GCC_COUNTRY_IDS = GCC_COUNTRY_IDS_FS;
import { FALLBACK_AR } from "../src/triviaFallbacks.js";
import { FALLBACK_EN } from "../src/triviaFallbacksEn.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qadhaPath = path.join(__dirname, "..", "src", "Qadha.jsx");
const s = fs.readFileSync(qadhaPath, "utf8");

const catsBlock = s.split("const CATS=")[1].split("];")[0];
const catIds = [...catsBlock.matchAll(/\{id:"([^"]+)"/g)].map((m) => m[1]);

const banksRoot = path.join(__dirname, "..", "src", "data", "banks");

function readBankFromDisk(countryId, ids) {
  const dir = path.join(banksRoot, countryId);
  const bank = {};
  for (const id of ids) {
    const fp = path.join(dir, `${id}.json`);
    if (fs.existsSync(fp)) {
      try {
        bank[id] = JSON.parse(fs.readFileSync(fp, "utf8"));
      } catch {
        bank[id] = [];
      }
    }
  }
  return bank;
}

const GEN_AR = readBankFromDisk("general_ar", catIds);
const GEN = readBankFromDisk("general_en", catIds);

/** مطابقة لـ fillMissing في Qadha.jsx (بلا فرع placeholder إن اكتملت المصادر) */
function filledBank(base, isAr) {
  const fb = isAr ? FALLBACK_AR : FALLBACK_EN;
  const bank = structuredClone(base);
  for (const id of catIds) {
    if (bank[id] && bank[id].length > 0) continue;
    if (fb[id]) bank[id] = structuredClone(fb[id]);
    else if (isAr && GEN_AR[id]) bank[id] = structuredClone(GEN_AR[id]);
    else if (!isAr && GEN[id]) bank[id] = structuredClone(GEN[id]);
    else bank[id] = [{ q: "placeholder", o: ["a", "b", "c", "d"], a: 0 }];
  }
  return bank;
}

function reportBank(name, bank, minExpected = 8) {
  const rows = [];
  let bad = 0;
  for (const id of catIds) {
    const arr = bank[id];
    const n = Array.isArray(arr) ? arr.length : 0;
    if (!Array.isArray(arr) || n < minExpected) {
      bad++;
      rows.push(`  ✗ ${id}: ${Array.isArray(arr) ? n : "ناقص"}`);
    }
  }
  console.log(`\n── ${name} ──`);
  console.log(`  فئات بكامل العدد (≥${minExpected}): ${catIds.length - bad} / ${catIds.length}`);
  if (bad) {
    console.log(`  نقص أو مفقود (${bad}):`);
    rows.forEach((r) => console.log(r));
  }
}

function meanQuestionCount(bank) {
  const lens = catIds.map((id) => (Array.isArray(bank[id]) ? bank[id].length : 0));
  const sum = lens.reduce((a, b) => a + b, 0);
  return (sum / catIds.length).toFixed(1);
}

console.log("═══ قدها؟ — عدد الأسئلة لكل فئة (٦٠ فئة) ═══");
console.log(`معرّفات CATS: ${catIds.length}`);
console.log("\nملاحظة: الكويت والعالمي يُكمَلان بـ fillMissing وقت التشغيل — الأرقام التالية بعد المحاكاة.\n");

reportBank("KW + fillMissing (وضع الكويت الفعلي)", filledBank(KW, true), 8);
console.log(`  متوسط أسئلة/فئة: ${meanQuestionCount(filledBank(KW, true))}`);

reportBank("GEN_AR + FALLBACK (عالمي عربي بعد fillMissing)", filledBank(GEN_AR, true), 8);
console.log(`  متوسط أسئلة/فئة: ${meanQuestionCount(filledBank(GEN_AR, true))}`);

reportBank("GEN + FALLBACK_EN (عالمي إنجليزي بعد fillMissing)", filledBank(GEN, false), 8);
console.log(`  متوسط أسئلة/فئة: ${meanQuestionCount(filledBank(GEN, false))}`);

reportBank("GCC_BANKS.sa (جاهز كما هو)", GCC_BANKS.sa, 8);
reportBank("GCC_BANKS.ae", GCC_BANKS.ae, 8);
reportBank("GCC_BANKS.qa", GCC_BANKS.qa, 8);
reportBank("GCC_BANKS.bh", GCC_BANKS.bh, 8);
reportBank("GCC_BANKS.om", GCC_BANKS.om, 8);

for (const cid of GCC_COUNTRY_IDS) {
  const b = filledBank(GCC_BANKS[cid], true);
  const m = meanQuestionCount(b);
  console.log(`  ${cid} بعد fillMissing إن لزم: متوسط ${m} سؤال/فئة (كل الفئات ≥8: ${catIds.every((id) => (b[id]?.length || 0) >= 8)})`);
}

console.log("\nانتهى الفحص.");
