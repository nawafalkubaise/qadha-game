/**
 * إصلاح المشتتات "التي لا علاقة لها بالسؤال": يستبدل كل إجابة خاطئة نوعها/مجالها
 * مختلف عن الإجابة الصحيحة بإجابة من نفس الفئة ونفس النوع (مأخوذة من بنك الأسئلة نفسه)،
 * مع الإبقاء على المشتتات الجيدة الموجودة. يرتّب المرشحين حسب القرب الموضوعي.
 *
 *   node scripts/fix-offtopic-distractors.mjs            # تقرير (dry-run)
 *   node scripts/fix-offtopic-distractors.mjs --write    # تطبيق
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { answerKind, kindsCompatible } from "./lib/answerKind.mjs";
import { normComparable, evaluateQuestionQuality } from "./lib/questionQuality.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BANKS = path.resolve(__dirname, "..", "src", "data", "banks");
const WRITE = process.argv.includes("--write");

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith(".json")) files.push(f);
  }
})(BANKS);

// تحميل كل الملفات + بناء مجمعات المرشحين
const parsed = new Map();
const poolCatKind = new Map(); // "cat|kind" -> Map(normComparable -> original)
const poolKind = new Map();    // "kind"     -> Map(normComparable -> original)
function addPool(map, key, val) {
  if (!map.has(key)) map.set(key, new Map());
  const m = map.get(key);
  const nk = normComparable(val);
  if (nk && !m.has(nk)) m.set(nk, val);
}
for (const file of files) {
  let arr; try { arr = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
  if (!Array.isArray(arr)) continue;
  parsed.set(file, arr);
  const cat = path.basename(file, ".json");
  for (const q of arr) {
    if (!q || !Array.isArray(q.o) || q.o.length !== 4 || !Number.isInteger(q.a)) continue;
    for (const opt of q.o) {
      const k = answerKind(opt);
      addPool(poolCatKind, cat + "|" + k, opt);
      addPool(poolKind, k, opt);
    }
  }
}

const tokens = (s) => new Set(String(s).toLowerCase().match(/[؀-ۿA-Za-z0-9]{2,}/g) || []);
function rankCandidates(correct, qText, kind, cat, exclude) {
  const qCtx = tokens(qText);          // الترتيب حسب القرب من نص السؤال (لا من الإجابة الصحيحة)
  const nCorrect = normComparable(correct);
  const cTokens = tokens(correct);
  const isGiveaway = (val) => {
    const nv = normComparable(val);
    if (!nv) return true;
    if (nv.includes(nCorrect) || nCorrect.includes(nv)) return true; // أحدهما يحتوي الآخر = كاشف للإجابة
    // يشارك كلمة مميزة (>=4 أحرف) مع الإجابة الصحيحة
    for (const t of tokens(val)) if (t.length >= 4 && cTokens.has(t)) return true;
    return false;
  };
  const out = [];
  const fromCat = poolCatKind.get(cat + "|" + kind);
  const fromKind = poolKind.get(kind);
  const pushFrom = (m, bonus) => {
    if (!m) return;
    for (const [nk, val] of m) {
      if (exclude.has(nk) || isGiveaway(val)) continue;
      const overlap = [...tokens(val)].filter((t) => qCtx.has(t)).length;
      out.push({ nk, val, score: bonus + overlap });
    }
  };
  pushFrom(fromCat, 100);   // نفس الفئة أولاً (الأكثر ترابطاً)
  pushFrom(fromKind, 0);    // ثم نفس النوع عبر كل الفئات
  // إزالة التكرار مع تفضيل الأعلى نقاطاً
  const best = new Map();
  for (const c of out) {
    if (!best.has(c.nk) || best.get(c.nk).score < c.score) best.set(c.nk, c);
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.val.localeCompare(b.val, "ar"));
}

function slotFor(id, q) {
  const s = String(id || q || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 4;
}

let total = 0, flagged = 0, fixed = 0, residual = 0;
const examples = [];
const residualByCat = {};

for (const [file, arr] of parsed) {
  const cat = path.basename(file, ".json");
  let touched = false;
  for (const q of arr) {
    if (!q || !Array.isArray(q.o) || q.o.length !== 4 || !Number.isInteger(q.a)) continue;
    total++;
    const correct = q.o[q.a];
    const ck = answerKind(correct);
    const wrong = q.o.filter((_, i) => i !== q.a);
    const offKindCount = wrong.filter((w) => !kindsCompatible(ck, answerKind(w))).length;
    if (!offKindCount) continue;
    flagged++;

    // أبقِ المشتتات المتوافقة نوعاً (الجيدة)، استبدل الباقي
    const exclude = new Set([normComparable(correct)]);
    const kept = [];
    for (const w of wrong) {
      if (kindsCompatible(ck, answerKind(w)) && !exclude.has(normComparable(w))) {
        kept.push(w); exclude.add(normComparable(w));
      }
    }
    const need = 3 - kept.length;
    const ranked = rankCandidates(correct, q.q, ck, cat, exclude);
    const picked = [];
    for (const c of ranked) {
      if (picked.length >= need) break;
      picked.push(c.val); exclude.add(c.nk);
    }
    if (kept.length + picked.length < 3) {
      residual++; residualByCat[cat] = (residualByCat[cat] || 0) + 1; continue;
    }
    const newWrong = [...kept, ...picked].slice(0, 3);
    const slot = slotFor(q.id, q.q);
    const finalOpts = [...newWrong];
    finalOpts.splice(slot, 0, correct);
    // تحقق نهائي: 4 خيارات متمايزة، الفهرس صحيح
    if (finalOpts.length !== 4 || new Set(finalOpts.map(normComparable)).size !== 4) {
      residual++; residualByCat[cat] = (residualByCat[cat] || 0) + 1; continue;
    }
    q.o = finalOpts; q.a = slot; touched = true; fixed++;
    if (examples.length < 15) examples.push({ cat, q: q.q, correct, ck, before: wrong, after: newWrong });
  }
  if (touched && WRITE) fs.writeFileSync(file, JSON.stringify(arr, null, 2) + "\n", "utf8");
}

console.log("=== fix off-topic distractors " + (WRITE ? "(WRITE)" : "(DRY-RUN)") + " ===");
console.log("total questions :", total);
console.log("flagged off-topic:", flagged);
console.log("fixed           :", fixed);
console.log("residual (pool too small):", residual);
const rc = Object.entries(residualByCat).sort((a, b) => b[1] - a[1]).slice(0, 12);
if (rc.length) { console.log("\nresidual by category:"); rc.forEach(([c, n]) => console.log("  " + String(n).padStart(4) + "  " + c)); }
console.log("\n-- examples --");
examples.forEach((e, i) => {
  console.log(`${i + 1}) [${e.cat}] (${e.ck}) ${e.q}\n      ✓ ${e.correct}`);
  console.log(`      before ✗ ${e.before.join("  |  ")}`);
  console.log(`      after  ✗ ${e.after.join("  |  ")}\n`);
});
if (!WRITE) console.log("(dry-run — add --write to apply)");
