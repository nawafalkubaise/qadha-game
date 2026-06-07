/**
 * إعادة بناء المشتتات بجودة أعلى (المرحلة 1، حتمية بدون نموذج لغوي):
 *  - نفس لغة الإجابة الصحيحة (سؤال عربي ← مشتتات عربية، سؤال إنجليزي ← إنجليزية)
 *  - نفس المنطقة (لا نسحب "أكبر محمية في السعودية" لسؤال كويتي)
 *  - توليد ذكي للأنواع المنظَّمة: عملة←عملات حقيقية، سنة←سنوات قريبة،
 *    نسبة←نِسَب قريبة، مقياس/عدد←أرقام قريبة بنفس الوحدة
 *  - مشتتات النصوص: من نفس الفئة/المنطقة فقط، مرتّبة حسب قرب السياق
 *  - حارس الكشف: لا مشتت يحتوي الإجابة (أو العكس) ولا يشارك كلمة مميزة معها
 *
 *   node scripts/requality-distractors.mjs            # تقرير (dry-run)
 *   node scripts/requality-distractors.mjs --write    # تطبيق
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { answerKind, kindsCompatible } from "./lib/answerKind.mjs";
import { normComparable } from "./lib/questionQuality.mjs";
import { generateStructured } from "./lib/distractorGen.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BANKS = path.resolve(__dirname, "..", "src", "data", "banks");
const WRITE = process.argv.includes("--write");

const isArabic = (s) => /[؀-ۿ]/.test(String(s || ""));
const isLatin = (s) => /[A-Za-z]/.test(String(s || ""));
function sameLanguage(a, b) {
  // عربي مقابل عربي، أو لاتيني-فقط مقابل لاتيني-فقط. الأرقام/الرموز محايدة.
  const aAr = isArabic(a), bAr = isArabic(b);
  if (aAr || bAr) return aAr === bAr; // لو أحدهما عربي، لازم كلاهما عربي
  const aL = isLatin(a), bL = isLatin(b);
  if (aL || bL) return aL === bL;
  return true; // كلاهما أرقام/رموز فقط
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith(".json")) files.push(f);
  }
})(BANKS);

const regionOf = (file) => path.relative(BANKS, file).split(/[\\/]/)[0];
const catOf = (file) => path.basename(file, ".json");

// مجمّعات المرشحين مقيّدة بالمنطقة: "region|cat|kind" و "region|kind"
const parsed = new Map();
const poolRCK = new Map(); // region|cat|kind -> Map(norm -> original)
const poolRK = new Map();  // region|kind      -> Map(norm -> original)
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
  const region = regionOf(file), cat = catOf(file);
  for (const q of arr) {
    if (!q || !Array.isArray(q.o) || q.o.length !== 4 || !Number.isInteger(q.a)) continue;
    for (const opt of q.o) {
      const k = answerKind(opt);
      addPool(poolRCK, `${region}|${cat}|${k}`, opt);
      addPool(poolRK, `${region}|${k}`, opt);
    }
  }
}

const tokens = (s) => new Set(String(s).toLowerCase().match(/[؀-ۿA-Za-z0-9]{2,}/g) || []);

function makeGiveawayGuard(correct) {
  const nCorrect = normComparable(correct);
  const cTokens = tokens(correct);
  // الحارس الكامل: للمشتتات المسحوبة من المجمّع (نصوص قد تكشف الإجابة)
  const full = (val) => {
    const nv = normComparable(val);
    if (!nv || nv === nCorrect) return true;
    if (nv.includes(nCorrect) || nCorrect.includes(nv)) return true;
    for (const t of tokens(val)) if (t.length >= 4 && cTokens.has(t)) return true;
    return false;
  };
  // الحارس الخفيف: للقيم المولّدة عددياً (تشترك عمداً في البادئة/الوحدة، والاختلاف في الرقم)
  const light = (val) => {
    const nv = normComparable(val);
    if (!nv || nv === nCorrect) return true;
    return nv.includes(nCorrect) || nCorrect.includes(nv);
  };
  return { full, light };
}

function rankPool(correct, qText, ck, region, cat, exclude, isGiveaway) {
  const qCtx = tokens(qText);
  const out = [];
  const consider = (m, bonus) => {
    if (!m) return;
    for (const [nk, val] of m) {
      if (exclude.has(nk) || isGiveaway(val)) continue;
      if (!sameLanguage(correct, val)) continue;
      if (!kindsCompatible(ck, answerKind(val))) continue;
      const overlap = [...tokens(val)].filter((t) => qCtx.has(t)).length;
      out.push({ nk, val, score: bonus + overlap });
    }
  };
  consider(poolRCK.get(`${region}|${cat}|${ck}`), 100); // نفس المنطقة+الفئة
  consider(poolRK.get(`${region}|${ck}`), 0);           // نفس المنطقة، أي فئة
  const best = new Map();
  for (const c of out) if (!best.has(c.nk) || best.get(c.nk).score < c.score) best.set(c.nk, c);
  return [...best.values()].sort((a, b) => b.score - a.score || a.val.localeCompare(b.val, "ar"));
}

function slotFor(id, q) {
  const s = String(id || q || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 4;
}

let total = 0, needFix = 0, fixed = 0, residual = 0;
const residualByCat = {};
const examples = [];

for (const [file, arr] of parsed) {
  const region = regionOf(file), cat = catOf(file);
  let touched = false;
  for (const q of arr) {
    if (!q || !Array.isArray(q.o) || q.o.length !== 4 || !Number.isInteger(q.a)) continue;
    total++;
    const correct = q.o[q.a];
    const ck = answerKind(correct);
    const wrong = q.o.filter((_, i) => i !== q.a);
    // للأنواع العددية المنظَّمة نقدر نولّد بدائل نظيفة، فنرفض المشتتات الطويلة جداً
    // مقارنة بالإجابة (جملة كاملة كمشتت لإجابة قصيرة = رديء)
    // أنواع نقدر نولّد لها بدائل نظيفة (numlike مستثنى: غامض، النص قد يكون الإجابة)
    const STRUCT = new Set(["year", "percent", "measure", "count", "money"]);
    const cWords = String(correct).split(/\s+/).filter(Boolean).length;
    const lengthMismatch = (w) => {
      if (!STRUCT.has(ck)) return false;
      const wWords = String(w).split(/\s+/).filter(Boolean).length;
      return wWords > cWords + 3 && wWords > 2 * Math.max(1, cWords);
    };
    // مشتت "سيئ" = نوع غير متوافق OR لغة مختلفة OR طول مفرط للأنواع العددية
    const isBad = (w) => !kindsCompatible(ck, answerKind(w)) || !sameLanguage(correct, w) || lengthMismatch(w);
    const badCount = wrong.filter(isBad).length;
    if (!badCount) continue;
    needFix++;

    const guard = makeGiveawayGuard(correct);
    const exclude = new Set([normComparable(correct)]);
    const genCands = STRUCT.has(ck) ? generateStructured(correct, ck) : [];
    // للأنواع المنظَّمة القابلة للتوليد: نعيد البناء من الصفر (نتجنّب فخ الوحدة الخاطئة
    // داخل نفس النوع، مثل "170 كم" كمشتت لإجابة "2 مليون زائر"). غير ذلك: نُبقي الجيد.
    const regenerate = genCands.length >= 1;
    const kept = [];
    if (!regenerate) {
      for (const w of wrong) {
        const nk = normComparable(w);
        if (!isBad(w) && !guard.full(w) && !exclude.has(nk)) { kept.push(w); exclude.add(nk); }
      }
    }
    let need = 3 - kept.length;
    const picked = [];

    // 1) توليد ذكي للأنواع المنظَّمة (حارس خفيف: الاختلاف في الرقم)
    if (need > 0) {
      for (const cand of genCands) {
        if (need <= 0) break;
        const nk = normComparable(cand);
        if (exclude.has(nk) || guard.light(cand)) continue;
        picked.push(cand); exclude.add(nk); need--;
      }
    }
    // 2) سحب من مجمّع نفس المنطقة/الفئة ثم المنطقة (حارس كامل)
    if (need > 0) {
      for (const c of rankPool(correct, q.q, ck, region, cat, exclude, guard.full)) {
        if (need <= 0) break;
        picked.push(c.val); exclude.add(c.nk); need--;
      }
    }

    if (kept.length + picked.length < 3) {
      residual++; residualByCat[cat] = (residualByCat[cat] || 0) + 1; continue;
    }
    const newWrong = [...kept, ...picked].slice(0, 3);
    const slot = slotFor(q.id, q.q);
    const finalOpts = [...newWrong];
    finalOpts.splice(slot, 0, correct);
    if (finalOpts.length !== 4 || new Set(finalOpts.map(normComparable)).size !== 4) {
      residual++; residualByCat[cat] = (residualByCat[cat] || 0) + 1; continue;
    }
    if (examples.length < 12) examples.push({ cat: `${region}/${cat}`, q: q.q, correct, ck, before: wrong, after: newWrong });
    q.o = finalOpts; q.a = slot; touched = true; fixed++;
  }
  if (touched && WRITE) fs.writeFileSync(file, JSON.stringify(arr, null, 2) + "\n", "utf8");
}

console.log("=== requality distractors " + (WRITE ? "(WRITE)" : "(DRY-RUN)") + " ===");
console.log("total questions      :", total);
console.log("needed fixing        :", needFix, `(${(needFix / total * 100).toFixed(1)}%)`);
console.log("fixed                :", fixed);
console.log("residual (pool small):", residual);
const rc = Object.entries(residualByCat).sort((a, b) => b[1] - a[1]).slice(0, 15);
if (rc.length) { console.log("\nresidual by category:"); rc.forEach(([c, n]) => console.log("  " + String(n).padStart(4) + "  " + c)); }
console.log("\n-- examples --");
examples.forEach((e, i) => {
  console.log(`${i + 1}) [${e.cat}] (${e.ck}) ${e.q}\n      ✓ ${e.correct}`);
  console.log(`      before ✗ ${e.before.join("  |  ")}`);
  console.log(`      after  ✗ ${e.after.join("  |  ")}\n`);
});
if (!WRITE) console.log("(dry-run — add --write to apply)");
