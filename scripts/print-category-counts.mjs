/**
 * يطبع عدد الأسئلة لكل فئة حسب CATS في Qadha.jsx.
 * تشغيل: node scripts/print-category-counts.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import imported from "../src/data/kwImportedBank.json" with { type: "json" };
import { mergeKwBank } from "../src/data/kwMergeImported.js";
import {
  readCountryBankFromFs,
  readAllGccBanksFromFs,
  readGeneralBankDisk,
} from "./lib/readBanksFs.mjs";
import { FALLBACK_AR } from "../src/triviaFallbacks.js";
import { FALLBACK_EN } from "../src/triviaFallbacksEn.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qadhaPath = path.join(__dirname, "..", "src", "Qadha.jsx");
const s = fs.readFileSync(qadhaPath, "utf8");

const catsBlock = s.split("const CATS=")[1].split("];")[0];
const cats = [...catsBlock.matchAll(/\{id:"([^"]+)",n:"([^"]+)",ar:"([^"]+)"/g)].map((m) => ({
  id: m[1],
  en: m[2],
  ar: m[3],
}));

const catIds = cats.map((c) => c.id);
const KW = mergeKwBank(readCountryBankFromFs("kw"), imported);
const GCC_BANKS = readAllGccBanksFromFs();
const GEN_AR = readGeneralBankDisk(true, catIds);
const GEN = readGeneralBankDisk(false, catIds);

function filledBank(base, isAr) {
  const fb = isAr ? FALLBACK_AR : FALLBACK_EN;
  const bank = structuredClone(base);
  for (const { id } of cats) {
    if (bank[id] && bank[id].length > 0) continue;
    if (fb[id]) bank[id] = structuredClone(fb[id]);
    else if (isAr && GEN_AR[id]) bank[id] = structuredClone(GEN_AR[id]);
    else if (!isAr && GEN[id]) bank[id] = structuredClone(GEN[id]);
    else bank[id] = [{ q: "placeholder", o: ["a", "b", "c", "d"], a: 0 }];
  }
  return bank;
}

function printTable(title, bank) {
  console.log(`\n${title}`);
  console.log("─".repeat(72));
  for (const c of cats) {
    const n = Array.isArray(bank[c.id]) ? bank[c.id].length : 0;
    console.log(`${String(n).padStart(4)}  ${c.ar.padEnd(22)}  ${c.id}`);
  }
  const sum = cats.reduce((a, c) => a + (bank[c.id]?.length || 0), 0);
  console.log("─".repeat(72));
  console.log(`المجموع: ${sum} سؤال عبر ${cats.length} فئة`);
}

const kwFilled = filledBank(KW, true);
printTable("وضع الكويت (KW_MERGED + نفس منطق fillMissing في اللعبة)", kwFilled);

const genArFilled = filledBank(GEN_AR, true);
printTable("عالمي عربي (GEN_AR + fallback)", genArFilled);

const genEnFilled = filledBank(GEN, false);
printTable("عالمي إنجليزي (GEN + fallback EN)", genEnFilled);

const gccFilled = filledBank(GCC_BANKS.sa, true);
printTable("مثال خليجي: السعودية (GCC_BANKS.sa + fillMissing عربي إن لزم)", gccFilled);
