/**
 * نقل الأسئلة المُعلَّمة بفئة خاطئة إلى فئتها الصحيحة (داخل نفس المنطقة).
 * يقرأ flags من scripts/_phase2_out/bin_*.json (suggestedCategory)، ويُشغَّل
 * بعد apply-phase2 --write (حتى تكون المشتتات محدّثة والترتيب ثابت).
 *
 *   node scripts/move-phase2.mjs            # تقرير (dry-run)
 *   node scripts/move-phase2.mjs --write    # تنفيذ النقل
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normComparable } from "./lib/questionQuality.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "src", "data");
const BANKS = path.join(ROOT, "banks");
const OUT = path.join(__dirname, "_phase2_out");
const WRITE = process.argv.includes("--write");

// الفئات الصالحة من Qadha.jsx
const jsx = fs.readFileSync(path.resolve(__dirname, "..", "src", "Qadha.jsx"), "utf8");
const slugs = new Set([...jsx.split("const CATS=")[1].split("];")[0].matchAll(/\{id:"([^"]+)"/g)].map((m) => m[1]));

// اجمع flags
const flags = [];
for (const f of fs.readdirSync(OUT).filter((x) => /^bin_\d+\.json$/.test(x))) {
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")); } catch { continue; }
  if (!Array.isArray(arr)) continue;
  for (const r of arr) {
    if (!r || !r.suggestedCategory || typeof r.region !== "string" || !Number.isInteger(r.index)) continue;
    const to = r.suggestedCategory;
    if (to === r.cat) continue;
    if (!slugs.has(to)) continue; // فئة غير صالحة → تجاهل
    flags.push({ region: r.region, fromCat: r.cat, index: r.index, to });
  }
}

// جمّع حسب الملف المصدر
const bySource = new Map(); // region/cat -> [{index,to}]
for (const f of flags) {
  const key = f.region + "/" + f.fromCat;
  if (!bySource.has(key)) bySource.set(key, []);
  bySource.get(key).push(f);
}

let moved = 0, skipped = 0;
const moveSummary = {}; // "from -> to" -> count
const targetAppends = new Map(); // region/toCat -> [question objects]

for (const [key, list] of bySource) {
  const [region, fromCat] = key.split("/");
  const srcPath = path.join(BANKS, region, fromCat + ".json");
  if (!fs.existsSync(srcPath)) { skipped += list.length; continue; }
  const arr = JSON.parse(fs.readFileSync(srcPath, "utf8"));
  // أزل من الأعلى للأسفل حتى لا تتغير الفهارس
  const sorted = [...list].sort((a, b) => b.index - a.index);
  for (const m of sorted) {
    const q = arr[m.index];
    if (!q) { skipped++; continue; }
    const toKey = region + "/" + m.to;
    if (!targetAppends.has(toKey)) targetAppends.set(toKey, []);
    targetAppends.get(toKey).push(q);
    arr.splice(m.index, 1);
    moved++;
    const sk = fromCat + " → " + m.to;
    moveSummary[sk] = (moveSummary[sk] || 0) + 1;
  }
  if (WRITE) fs.writeFileSync(srcPath, JSON.stringify(arr, null, 2) + "\n", "utf8");
}

// ألحق بالملفات الهدف (مع تفادي التكرار النصّي للسؤال)
for (const [toKey, items] of targetAppends) {
  const tgtPath = path.join(BANKS, toKey + ".json");
  if (!fs.existsSync(tgtPath)) { skipped += items.length; continue; }
  const arr = JSON.parse(fs.readFileSync(tgtPath, "utf8"));
  const have = new Set(arr.map((x) => normComparable(x.q)));
  for (const q of items) {
    const nq = normComparable(q.q);
    if (have.has(nq)) continue; // موجود مسبقاً
    arr.push(q); have.add(nq);
  }
  if (WRITE) fs.writeFileSync(tgtPath, JSON.stringify(arr, null, 2) + "\n", "utf8");
}

console.log("=== move misplaced questions " + (WRITE ? "(WRITE)" : "(DRY-RUN)") + " ===");
console.log("move flags (valid):", flags.length);
console.log("moved             :", moved);
console.log("skipped           :", skipped);
console.log("\n-- top moves (from → to) --");
Object.entries(moveSummary).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, n]) => console.log("  " + String(n).padStart(4) + "  " + k));
if (!WRITE) console.log("\n(dry-run — add --write to perform moves)");
