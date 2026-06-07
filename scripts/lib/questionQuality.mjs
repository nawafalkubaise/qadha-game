export const MIN_DISTRACTOR_SCORE = 3;

const DIALECT_REPLACEMENTS = [
  [/(^|\s)شنو(?=\s|$)/g, "$1ما"],
  [/(^|\s)ليش(?=\s|$)/g, "$1لماذا"],
  [/(^|\s)شلون(?=\s|$)/g, "$1كيف"],
  [/(^|\s)الحين(?=\s|$)/g, "$1الآن"],
  [/(^|\s)مو(?=\s|$)/g, "$1ليس"],
  [/(^|\s)ابي(?=\s|$)/g, "$1أريد"],
  [/(^|\s)ابغى(?=\s|$)/g, "$1أريد"],
  [/(^|\s)تبي(?=\s|$)/g, "$1تريد"],
  [/(^|\s)ودي(?=\s|$)/g, "$1أرغب"],
  [/(^|\s)وايد(?=\s|$)/g, "$1كثير"],
  [/(^|\s)جذي(?=\s|$)/g, "$1هكذا"],
  [/(^|\s)هالشي(?=\s|$)/g, "$1هذا الأمر"],
  [/(^|\s)ماكو(?=\s|$)/g, "$1لا يوجد"],
];

const DIALECT_PATTERNS = DIALECT_REPLACEMENTS.map(([rx]) => rx);

export function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeArabicFusha(value) {
  let out = normalizeText(value);
  for (const [rx, replacement] of DIALECT_REPLACEMENTS) out = out.replace(rx, replacement);
  out = out.replace(/\?+/g, "؟").replace(/[!]+/g, "!").replace(/\s+([؟!.,،])/g, "$1").trim();
  return out;
}

export function containsDialect(value) {
  const s = String(value || "");
  return DIALECT_PATTERNS.some((rx) => rx.test(s));
}

export function normComparable(value) {
  return normalizeText(value).toLowerCase();
}

export function isArabic(value) {
  return /[\u0600-\u06FF]/.test(String(value || ""));
}

export function answerType(value) {
  const t = String(value || "").trim();
  if (/^[12][0-9]{3}$/.test(t.replace(/[^\d]/g, ""))) return "year";
  if (/^[\d٠-٩\s.,٬٫]+$/.test(t) && /[\d٠-٩]/.test(t)) return "number";
  if (/^(نعم|لا|yes|no)$/i.test(t)) return "yes-no";
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words <= 2) return "short";
  if (words <= 5) return "phrase";
  return "sentence";
}

function tokenOverlap(a, b) {
  const aa = new Set(normComparable(a).split(" ").filter((x) => x.length >= 2));
  const bb = normComparable(b).split(" ").filter((x) => x.length >= 2);
  let c = 0;
  for (const token of bb) if (aa.has(token)) c++;
  return c;
}

export function distractorScore(correct, candidate) {
  const c = normalizeText(correct);
  const d = normalizeText(candidate);
  if (!c || !d || normComparable(c) === normComparable(d)) return -99;
  let s = 0;
  if (answerType(c) === answerType(d)) s += 3;
  if (isArabic(c) === isArabic(d)) s += 2;
  const lenRatio = Math.min(c.length, d.length) / Math.max(c.length || 1, d.length || 1);
  if (lenRatio >= 0.8) s += 2;
  else if (lenRatio >= 0.6) s += 1;
  const overlap = tokenOverlap(c, d);
  if (overlap >= 2) s += 2;
  else if (overlap === 1) s += 1;
  return s;
}

export function pickBestDistractors({ correct, currentWrong = [], answerPool = [], count = 3 }) {
  const targetType = answerType(correct);
  const targetArabic = isArabic(correct);
  const unique = new Map();

  for (const value of [...currentWrong, ...answerPool]) {
    const clean = normalizeArabicFusha(value);
    const key = normComparable(clean);
    if (!key || key === normComparable(correct)) continue;
    if (!unique.has(key)) unique.set(key, clean);
  }

  const ranked = [...unique.values()]
    .filter((v) => answerType(v) === targetType && isArabic(v) === targetArabic)
    .map((v) => ({ v, score: distractorScore(correct, v) }))
    .sort((a, b) => b.score - a.score || a.v.localeCompare(b.v, "ar"));

  const chosen = ranked.filter((x) => x.score >= MIN_DISTRACTOR_SCORE).slice(0, count).map((x) => x.v);
  if (chosen.length >= count) return chosen;

  for (const r of ranked) {
    if (chosen.length >= count) break;
    if (!chosen.some((x) => normComparable(x) === normComparable(r.v))) chosen.push(r.v);
  }
  return chosen.slice(0, count);
}

export function evaluateQuestionQuality(question) {
  const issues = [];
  if (!question || !Array.isArray(question.o) || question.o.length !== 4 || !Number.isInteger(question.a)) return issues;
  const correct = question.o[question.a];
  const wrong = question.o.filter((_, idx) => idx !== question.a);
  const type = answerType(correct);
  if (containsDialect(question.q)) issues.push("dialect_question");
  wrong.forEach((opt, i) => {
    if (containsDialect(opt)) issues.push(`dialect_option_${i + 1}`);
    if (type !== "yes-no" && distractorScore(correct, opt) <= 0) issues.push(`weak_distractor_${i + 1}`);
  });
  return issues;
}
