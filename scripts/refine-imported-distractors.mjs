import fs from "node:fs/promises";
import path from "node:path";
import core from "../src/data/kwBankCore.json" with { type: "json" };
import imported from "../src/data/kwImportedBank.json" with { type: "json" };

const root = path.resolve(process.cwd(), "src", "data");
const outFile = path.join(root, "kwImportedBank.json");

const norm = (s = "") =>
  String(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const isArabic = (s = "") => /[\u0600-\u06FF]/.test(String(s));
const isYear = (s = "") => /^\d{4}$/.test(String(s).replace(/[^\d]/g, ""));
const isNumberLike = (s = "") => /^[\d\s.,٬٫]+$/.test(String(s).trim());
const tokens = (s = "") => norm(s).split(" ").filter(Boolean);
const kind = (s = "") => {
  const t = String(s).trim();
  if (isYear(t)) return "year";
  if (isNumberLike(t)) return "number";
  if (/\?$/.test(t) || /[؟]/.test(t)) return "phrase";
  if (t.split(/\s+/).length >= 5) return "sentence";
  return "word";
};
const scoreFit = (answer, cand) => {
  const a = norm(answer);
  const c = norm(cand);
  if (!a || !c || a === c) return -99;
  let s = 0;
  if (isArabic(answer) === isArabic(cand)) s += 3;
  if (kind(answer) === kind(cand)) s += 3;
  const la = a.length || 1;
  const lc = c.length || 1;
  const ratio = Math.min(la, lc) / Math.max(la, lc);
  if (ratio >= 0.8) s += 3;
  else if (ratio >= 0.6) s += 2;
  else if (ratio >= 0.45) s += 1;
  const ta = new Set(tokens(answer));
  const tc = tokens(cand);
  const overlap = tc.filter((x) => ta.has(x)).length;
  if (overlap >= 2) s += 2;
  else if (overlap === 1) s += 1;
  return s;
};

const categories = Object.keys(imported);
const stats = { touched: 0, replaced: 0 };

for (const cat of categories) {
  const list = Array.isArray(imported[cat]) ? imported[cat] : [];
  const coreList = Array.isArray(core[cat]) ? core[cat] : [];
  const pool = [
    ...list.map((q) => q?.o?.[q?.a]).filter(Boolean),
    ...coreList.map((q) => q?.o?.[q?.a]).filter(Boolean),
  ];
  const uniqPool = [...new Set(pool)];
  for (const q of list) {
    if (!q || !Array.isArray(q.o) || q.o.length < 4 || typeof q.a !== "number") continue;
    if (q.src !== "user-text") continue;
    const correct = q.o[q.a];
    if (!correct) continue;
    stats.touched += 1;
    const ranked = uniqPool
      .filter((x) => norm(x) !== norm(correct))
      .map((x) => ({ x, s: scoreFit(correct, x) }))
      .filter((r) => r.s >= 5)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.x);
    if (ranked.length < 3) continue;
    const used = new Set([norm(correct)]);
    const distractors = [];
    for (const c of ranked) {
      const n = norm(c);
      if (used.has(n)) continue;
      used.add(n);
      distractors.push(c);
      if (distractors.length === 3) break;
    }
    if (distractors.length < 3) continue;
    const newOptions = [correct, ...distractors];
    // Shuffle but keep deterministic by question text length.
    const seed = norm(q.q).length % 4;
    const rotated = [...newOptions.slice(seed), ...newOptions.slice(0, seed)];
    const newA = rotated.findIndex((x) => norm(x) === norm(correct));
    q.o = rotated;
    q.a = newA;
    stats.replaced += 1;
  }
}

await fs.writeFile(outFile, `${JSON.stringify(imported, null, 2)}\n`, "utf8");
console.log(`Refined imported distractors: touched=${stats.touched}, replaced=${stats.replaced}`);
