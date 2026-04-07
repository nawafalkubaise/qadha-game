/**
 * Audit distractor quality question-by-question.
 * Score is heuristic and checks whether wrong options are same "kind" and reasonably close.
 * Usage:
 *   node scripts/audit-distractors-quality.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { KW_MERGED as KW } from "../src/data/kwBank.js";
import { GCC_BANKS } from "../src/data/gccBanks.js";
import { FALLBACK_AR, FALLBACK_EN } from "../src/triviaFallbacks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qadhaPath = path.join(__dirname, "..", "src", "Qadha.jsx");
const s = fs.readFileSync(qadhaPath, "utf8");

const catsBlock = s.split("const CATS=")[1].split("];")[0];
const catIds = [...catsBlock.matchAll(/\{id:"([^"]+)"/g)].map((m) => m[1]);

function extractBetween(startMarker, endMarker) {
  const a = s.indexOf(startMarker);
  const b = s.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error(`Missing: ${startMarker}`);
  return s.slice(a + startMarker.length, b).trim();
}
const genArLiteral = extractBetween("const GEN_AR=", "const GEN=");
const GEN_AR = new Function(`return ${genArLiteral}`)();
const genLiteral = extractBetween("const GEN=", "const fillMissing");
const GEN = new Function(`return ${genLiteral}`)();

function filledBank(base, isAr) {
  const fb = isAr ? FALLBACK_AR : FALLBACK_EN;
  const bank = structuredClone(base);
  for (const id of catIds) {
    if (bank[id]) continue;
    if (fb[id]) bank[id] = structuredClone(fb[id]);
    else if (isAr && GEN_AR[id]) bank[id] = structuredClone(GEN_AR[id]);
    else if (!isAr && GEN[id]) bank[id] = structuredClone(GEN[id]);
    else bank[id] = [{ q: "placeholder", o: ["a", "b", "c", "d"], a: 0 }];
  }
  return bank;
}

const banks = [
  ["KW", filledBank(KW, true)],
  ["GEN_AR", filledBank(GEN_AR, true)],
  ["GEN_EN", filledBank(GEN, false)],
  ["SA", filledBank(GCC_BANKS.sa, true)],
  ["AE", filledBank(GCC_BANKS.ae, true)],
  ["QA", filledBank(GCC_BANKS.qa, true)],
  ["BH", filledBank(GCC_BANKS.bh, true)],
  ["OM", filledBank(GCC_BANKS.om, true)],
];

function norm(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}
function isArabic(s) {
  return /[\u0600-\u06FF]/.test(String(s || ""));
}
function kind(s) {
  const t = String(s || "");
  if (/[0-9\u0660-\u0669]{3,4}/.test(t)) return "year";
  if (/[0-9\u0660-\u0669]/.test(t)) return "number";
  if (/\b(نعم|لا|yes|no)\b/i.test(t)) return "yn";
  if (t.split(/\s+/).filter(Boolean).length <= 2) return "short";
  return "phrase";
}
function tokenOverlap(a, b) {
  const aa = new Set(norm(a).split(" ").filter((x) => x.length >= 2));
  const bb = norm(b).split(" ").filter((x) => x.length >= 2);
  let c = 0;
  bb.forEach((t) => { if (aa.has(t)) c++; });
  return c;
}
function distractorScore(correct, wrong) {
  let score = 0;
  if (kind(correct) === kind(wrong)) score += 1;
  if (isArabic(correct) === isArabic(wrong)) score += 1;
  if (Math.abs(String(correct).length - String(wrong).length) <= 8) score += 1;
  if (tokenOverlap(correct, wrong) > 0) score += 1;
  return score;
}

const allCorrectAnswers = [];
for (const [, bank] of banks) {
  for (const cid of catIds) {
    const arr = bank[cid] || [];
    for (const q of arr) {
      if (!q || !Array.isArray(q.o) || q.o.length !== 4 || !Number.isInteger(q.a)) continue;
      const c = q.o[q.a];
      if (c) allCorrectAnswers.push(c);
    }
  }
}

function smartVariants(correct) {
  const c = String(correct || "").trim();
  if (!c) return [];
  if (kind(c) === "year") {
    const n = Number(c.replace(/[^\d]/g, ""));
    if (Number.isFinite(n)) return [String(n - 1), String(n + 1), String(n + 2)];
  }
  if (kind(c) === "number") {
    const n = Number(c.replace(/[^\d]/g, ""));
    if (Number.isFinite(n)) {
      const d = Math.max(1, Math.round(Math.abs(n) * 0.1));
      return [String(n - d), String(n + d), String(n + d * 2)];
    }
  }
  if (isArabic(c)) return [`${c} قديم`, `${c} حديث`, `${c} محلي`];
  return [`${c} old`, `${c} modern`, `${c} local`];
}

function refineQuestionDistractors(arr) {
  const safeArr = Array.isArray(arr) ? arr : [];
  const answerPool = [
    ...new Set(
      safeArr
        .map((q) => (q && Array.isArray(q.o) && Number.isInteger(q.a) ? q.o[q.a] : null))
        .filter(Boolean),
    ),
  ];
  return safeArr.map((q) => {
    if (!q || !Array.isArray(q.o) || q.o.length !== 4 || !Number.isInteger(q.a)) return q;
    const correct = q.o[q.a];
    const sameKindGlobal = allCorrectAnswers.filter(
      (x) =>
        norm(x) !== norm(correct) &&
        kind(x) === kind(correct) &&
        isArabic(x) === isArabic(correct),
    );
    const ranked = [...answerPool, ...sameKindGlobal, ...smartVariants(correct)]
      .filter((x) => norm(x) !== norm(correct))
      .map((x) => ({ x, s: distractorScore(correct, x) }))
      .filter((r) => r.s >= 3)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.x);
    const chosen = [];
    for (const c of ranked) {
      if (chosen.length >= 3) break;
      if (chosen.some((x) => norm(x) === norm(c))) continue;
      chosen.push(c);
    }
    if (chosen.length < 3) {
      const ownWrong = q.o.filter((_, i) => i !== q.a);
      for (const old of ownWrong) {
        if (chosen.length >= 3) break;
        if (norm(old) === norm(correct)) continue;
        if (chosen.some((x) => norm(x) === norm(old))) continue;
        chosen.push(old);
      }
    }
    if (chosen.length < 3) return q;
    const o = [correct, ...chosen];
    return { ...q, o, a: 0 };
  });
}

let totalWrong = 0;
let goodWrong = 0;
let veryBad = [];

for (const [bankName, bank] of banks) {
  for (const cid of catIds) {
    const arr = refineQuestionDistractors(bank[cid] || []);
    for (const q of arr) {
      if (!q || !Array.isArray(q.o) || q.o.length !== 4 || !Number.isInteger(q.a)) continue;
      const correct = q.o[q.a];
      q.o.forEach((opt, i) => {
        if (i === q.a) return;
        totalWrong++;
        const sc = distractorScore(correct, opt);
        if (sc >= 3) goodWrong++;
        if (sc <= 1) {
          veryBad.push({
            bank: bankName,
            cat: cid,
            q: q.q,
            correct,
            wrong: opt,
            score: sc,
          });
        }
      });
    }
  }
}

const pct = totalWrong ? (goodWrong * 100) / totalWrong : 0;
console.log(`Total wrong options: ${totalWrong}`);
console.log(`Good wrong options (score>=3): ${goodWrong}`);
console.log(`Quality ratio: ${pct.toFixed(2)}%`);
console.log(`Very bad pairs (score<=1): ${veryBad.length}`);
if (veryBad.length) {
  console.log("Sample very bad:");
  veryBad.slice(0, 20).forEach((x, i) => {
    console.log(`${i + 1}. [${x.bank}/${x.cat}] ${x.q}`);
    console.log(`   ✓ ${x.correct}`);
    console.log(`   ✗ ${x.wrong}`);
  });
}
