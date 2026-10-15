/**
 * إصلاحات آلية آمنة على البنوك:
 *  - general_en: علامة الاستفهام العربية «؟» → "?"
 *  - حذف الأسئلة المكررة داخل نفس الفئة (نُبقي النسخة ذات الخيارات الأسلم)
 * تشغيل: node scripts/fix-mechanical-defects.mjs [--write]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const write = process.argv.includes("--write");
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "banks");
const normAr = (s) =>
  String(s ?? "").trim().toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
const distinctOpts = (q) => new Set((q.o || []).map(normAr)).size;

let qmarks = 0, dups = 0, files = 0;
for (const region of fs.readdirSync(root)) {
  const dir = path.join(root, region);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const fp = path.join(dir, f);
    const arr = JSON.parse(fs.readFileSync(fp, "utf8"));
    let changed = false;
    if (region === "general_en") {
      for (const q of arr) {
        const fix = (s) => String(s).replace(/؟/g, "?");
        if (/؟/.test(q.q) || q.o.some((o) => /؟/.test(o))) {
          q.q = fix(q.q); q.o = q.o.map(fix); qmarks++; changed = true;
        }
      }
    }
    const keep = new Map();
    for (const q of arr) {
      const k = normAr(q.q) + "|" + String(q.img || "");
      const prev = keep.get(k);
      if (!prev) { keep.set(k, q); continue; }
      dups++; changed = true;
      console.log(`dup ${region}/${f}: ${q.q}`);
      if (distinctOpts(q) > distinctOpts(prev)) keep.set(k, q);
    }
    const out = [...keep.values()];
    if (changed) {
      files++;
      if (write) fs.writeFileSync(fp, JSON.stringify(out, null, 2) + "\n");
    }
  }
}
console.log({ qmarks, dups, files, write });
