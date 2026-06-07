/**
 * تطبيق مخرجات Phase 2: يقرأ كل scripts/_phase2_out/bin_*.json (نتائج الوكلاء)
 * ويحدّث المشتتات في البنوك، مع فرض بقاء الإجابة الصحيحة الأصلية (من نسخة
 * banks_backup_phase2 الأساسية) — أي تغيير للإجابة الصحيحة يُستعاد ويُسجَّل.
 * لا يلمس q/d/id/src. يتحقق من 4 خيارات متمايزة.
 *
 *   node scripts/apply-phase2.mjs            # فحص (dry-run)
 *   node scripts/apply-phase2.mjs --write    # تطبيق
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normComparable } from "./lib/questionQuality.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "src", "data");
const BANKS = path.join(ROOT, "banks");
const BASE = path.join(ROOT, "banks_backup_phase2");
const OUT = path.join(__dirname, "_phase2_out");
const WRITE = process.argv.includes("--write");

// اجمع كل النتائج
const results = [];
for (const f of fs.readdirSync(OUT).filter((x) => /^bin_\d+\.json$/.test(x))) {
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")); } catch (e) { console.log("BAD OUTPUT FILE:", f, e.message); continue; }
  if (Array.isArray(arr)) for (const r of arr) results.push(r);
}

// جمّع حسب الملف
const byFile = new Map();
for (const r of results) {
  if (!r || typeof r.region !== "string" || typeof r.cat !== "string" || !Number.isInteger(r.index)) continue;
  const key = r.region + "/" + r.cat;
  if (!byFile.has(key)) byFile.set(key, []);
  byFile.get(key).push(r);
}

let applied = 0, restored = 0, skipped = 0, badOpts = 0;
const restoredList = [];
const cache = new Map();
const load = (p) => { if (!cache.has(p)) cache.set(p, JSON.parse(fs.readFileSync(p, "utf8"))); return cache.get(p); };

for (const [key, items] of byFile) {
  const curPath = path.join(BANKS, key + ".json");
  const basePath = path.join(BASE, key + ".json");
  if (!fs.existsSync(curPath) || !fs.existsSync(basePath)) { skipped += items.length; continue; }
  const cur = load(curPath);
  const base = JSON.parse(fs.readFileSync(basePath, "utf8"));
  for (const r of items) {
    const i = r.index;
    if (!cur[i] || !base[i] || !Array.isArray(r.o) || r.o.length !== 4) { skipped++; continue; }
    const baseCorrect = base[i].o[base[i].a];
    const nBase = normComparable(baseCorrect);
    let o = r.o.map((x) => String(x));
    let a = Number.isInteger(r.a) ? r.a : 0;
    // فرض الإجابة الصحيحة الأصلية
    const idx = o.findIndex((x) => normComparable(x) === nBase);
    if (idx >= 0) { a = idx; }
    else { o[Math.min(Math.max(a, 0), 3)] = baseCorrect; a = Math.min(Math.max(a, 0), 3); restored++; restoredList.push(key + "#" + i + " ← " + baseCorrect); }
    // تحقق: 4 خيارات متمايزة
    if (new Set(o.map(normComparable)).size !== 4) { badOpts++; continue; }
    // طبّق المشتتات فقط (احتفظ q/d/id/src)
    cur[i].o = o; cur[i].a = a;
    applied++;
  }
  if (WRITE) fs.writeFileSync(curPath, JSON.stringify(cur, null, 2) + "\n", "utf8");
}

console.log("=== apply phase2 " + (WRITE ? "(WRITE)" : "(DRY-RUN)") + " ===");
console.log("result rows total      :", results.length);
console.log("applied (distractors)  :", applied);
console.log("correct-answer restored:", restored);
console.log("skipped (missing/bad)  :", skipped);
console.log("rejected (dup options) :", badOpts);
if (restoredList.length) { console.log("\n-- restored correct answers (first 15) --"); restoredList.slice(0, 15).forEach((x) => console.log("  " + x)); }
if (!WRITE) console.log("\n(dry-run — add --write to apply)");
