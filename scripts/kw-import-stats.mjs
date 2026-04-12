import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import imported from "../src/data/kwImportedBank.json" with { type: "json" };
import { mergeKwBank } from "../src/data/kwMergeImported.js";
import { readCountryBankFromFs } from "./lib/readBanksFs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KW = readCountryBankFromFs("kw");
const KW_MERGED = mergeKwBank(KW, imported);
const s = fs.readFileSync(path.join(__dirname, "..", "src", "Qadha.jsx"), "utf8");
const catsBlock = s.split("const CATS=")[1].split("];")[0];
const catIds = [...catsBlock.matchAll(/\{id:"([^"]+)"/g)].map((m) => m[1]);

function sum(bank) {
  return catIds.reduce((acc, id) => acc + (Array.isArray(bank[id]) ? bank[id].length : 0), 0);
}

function rawImportedValidShape() {
  let n = 0;
  for (const cat of Object.keys(imported)) {
    const arr = imported[cat];
    if (!Array.isArray(arr)) continue;
    for (const q of arr) {
      if (!q || typeof q !== "object") continue;
      if (typeof q.q !== "string" || !q.q.trim()) continue;
      if (!Array.isArray(q.o) || q.o.length !== 4) continue;
      if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) continue;
      n++;
    }
  }
  return n;
}

const base = sum(KW);
const merged = sum(KW_MERGED);

console.log("عدد فئات CATS:", catIds.length);
console.log("مجموع أسئلة الكويت (قبل ملفك):", base);
console.log("مجموع أسئلة الكويت (بعد دمج kwImportedBank.json):", merged);
console.log("الزيادة بعد الدمج (صافي ما أُضيف من الملف مع إزالة التكرار/الفلترة):", merged - base);
console.log("صفوف في ملفك ذات شكل سؤال صالح (قبل فلترة الجودة/التاريخ):", rawImportedValidShape());
console.log("\nملف الاستيراد: src/data/kwImportedBank.json");
