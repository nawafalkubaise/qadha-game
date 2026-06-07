/**
 * كشف الأسئلة التي قد تكون في الفئة الخطأ (تصنيف نصّي حتمي، تقريبي).
 * يبني بصمة مفردات لكل فئة (مجمّعة عبر كل المناطق)، ثم يصنّف كل سؤال
 * بأقرب فئة عبر TF-IDF؛ لو الأفضل ≠ فئة الملف بفارق واضح → يُعلَّم.
 *
 *   node scripts/audit-category-placement.mjs            # تقرير
 *   node scripts/audit-category-placement.mjs --json out # حفظ القائمة
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BANKS = path.resolve(__dirname, "..", "src", "data", "banks");

// كلمات وقف عربية/إنجليزية شائعة لا تميّز فئة
const STOP = new Set("من في إلى على عن ما ماذا متى أين كيف كم لماذا أي هل هو هي التي الذي مع بين عند كان كانت يكون اسم عدد أكبر أطول أشهر أول أهم أكثر أقل نسبة the of in to a an is are what when where how which who many much most first largest".split(/\s+/));

const tok = (s) => (String(s || "").toLowerCase().match(/[؀-ۿA-Za-z]{3,}/g) || [])
  .map((w) => w.replace(/^(ال|بال|لل|وال|فال)/, ""))
  .filter((w) => w.length >= 3 && !STOP.has(w));

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith(".json")) files.push(f);
  }
})(BANKS);

// اجمع نصوص كل فئة (عبر المناطق)، واحتفظ بكل سؤال
const catDocs = new Map();   // cat -> Map(term -> count)
const catTotals = new Map(); // cat -> token count
const rows = [];             // {file, cat, region, index, q, text}
for (const file of files) {
  let arr; try { arr = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
  if (!Array.isArray(arr)) continue;
  const cat = path.basename(file, ".json");
  const region = path.relative(BANKS, file).split(/[\\/]/)[0];
  if (!catDocs.has(cat)) { catDocs.set(cat, new Map()); catTotals.set(cat, 0); }
  const cd = catDocs.get(cat);
  for (let i = 0; i < arr.length; i++) {
    const q = arr[i];
    if (!q || !q.q) continue;
    const correct = Array.isArray(q.o) && Number.isInteger(q.a) ? q.o[q.a] : "";
    const text = q.q + " " + correct;
    const ts = tok(text);
    for (const t of ts) { cd.set(t, (cd.get(t) || 0) + 1); catTotals.set(cat, catTotals.get(cat) + 1); }
    rows.push({ file: path.relative(BANKS, file).replace(/\\/g, "/"), cat, region, index: i, q: q.q, ts });
  }
}

const cats = [...catDocs.keys()];
// IDF: في كم فئة يظهر المصطلح
const df = new Map();
for (const [, cd] of catDocs) for (const t of cd.keys()) df.set(t, (df.get(t) || 0) + 1);
const N = cats.length;
const idf = (t) => Math.log((N + 1) / ((df.get(t) || 0) + 1)) + 1;

// متجه TF-IDF مطبَّع لكل فئة
const catVec = new Map();
for (const cat of cats) {
  const cd = catDocs.get(cat), tot = catTotals.get(cat) || 1;
  const v = new Map(); let norm = 0;
  for (const [t, c] of cd) { const w = (c / tot) * idf(t); v.set(t, w); norm += w * w; }
  norm = Math.sqrt(norm) || 1;
  for (const [t] of v) v.set(t, v.get(t) / norm);
  catVec.set(cat, v);
}

function scoreCat(ts, cat) {
  const v = catVec.get(cat); if (!v) return 0;
  // متجه السؤال: tf-idf على مصطلحاته الفريدة
  const seen = new Map();
  for (const t of ts) seen.set(t, (seen.get(t) || 0) + 1);
  let dot = 0, qnorm = 0;
  for (const [t, c] of seen) { const w = c * idf(t); qnorm += w * w; dot += w * (v.get(t) || 0); }
  qnorm = Math.sqrt(qnorm) || 1;
  return dot / qnorm;
}

let flagged = 0;
const confusion = new Map(); // "from->to" -> count
const examples = [];
const flaggedList = [];
const MARGIN = 0.06; // فرق الثقة المطلوب لإعلان "في الفئة الخطأ"

for (const r of rows) {
  if (r.ts.length < 3) continue; // قصير جداً للحكم
  let best = null, ownScore = scoreCat(r.ts, r.cat);
  for (const cat of cats) {
    const s = scoreCat(r.ts, cat);
    if (!best || s > best.s) best = { cat, s };
  }
  if (best.cat !== r.cat && best.s - ownScore > MARGIN && best.s > 0.12) {
    flagged++;
    const key = r.cat + " → " + best.cat;
    confusion.set(key, (confusion.get(key) || 0) + 1);
    flaggedList.push({ file: r.file, index: r.index, q: r.q, from: r.cat, to: best.cat, own: +ownScore.toFixed(3), best: +best.s.toFixed(3) });
    if (examples.length < 20) examples.push(`[${r.file}] ${r.q}\n      now: ${r.cat} (${ownScore.toFixed(2)})  →  suggest: ${best.cat} (${best.s.toFixed(2)})`);
  }
}

console.log("=== category placement audit ===");
console.log("rows scored :", rows.filter((r) => r.ts.length >= 3).length);
console.log("flagged (likely wrong category):", flagged, `(${(flagged / rows.length * 100).toFixed(1)}%)`);
console.log("\n-- top confusion pairs (current → suggested) --");
[...confusion.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, n]) => console.log("  " + String(n).padStart(4) + "  " + k));
console.log("\n-- examples --");
examples.forEach((e, i) => console.log(`${i + 1}) ${e}\n`));

const ji = process.argv.indexOf("--json");
if (ji >= 0 && process.argv[ji + 1]) {
  fs.writeFileSync(process.argv[ji + 1], JSON.stringify(flaggedList, null, 2), "utf8");
  console.log("wrote", flaggedList.length, "flagged ->", process.argv[ji + 1]);
}
