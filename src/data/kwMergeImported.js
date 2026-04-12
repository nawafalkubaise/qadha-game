/**
 * دمج بنك الكويت من الملفات مع kwImportedBank.json (بدون fs / بدون Vite glob).
 */
const normQ = (s) =>
  String(s || "")
    .replace(/\u0640/g, "")
    .replace(/[^\u0600-\u06FF0-9A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const normA = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const isArabic = (s) => /[\u0600-\u06FF]/.test(String(s || ""));
const kind = (s) => {
  const t = String(s || "");
  if (/[0-9\u0660-\u0669]{3,4}/.test(t)) return "year";
  if (/[0-9\u0660-\u0669]/.test(t)) return "number";
  if (/^(نعم|لا|yes|no)$/i.test(t.trim())) return "yn";
  if (t.split(/\s+/).filter(Boolean).length <= 2) return "short";
  return "phrase";
};
function overlapTokens(a, b) {
  const aa = new Set(normA(a).split(" ").filter((x) => x.length >= 2));
  const bb = normA(b).split(" ").filter((x) => x.length >= 2);
  let c = 0;
  bb.forEach((t) => {
    if (aa.has(t)) c++;
  });
  return c;
}
function distractorScore(correct, wrong) {
  let s = 0;
  if (kind(correct) === kind(wrong)) s += 1;
  if (isArabic(correct) === isArabic(wrong)) s += 1;
  if (Math.abs(String(correct).length - String(wrong).length) <= 8) s += 1;
  if (overlapTokens(correct, wrong) > 0) s += 1;
  return s;
}
function hasAcceptableDistractors(qItem) {
  const correct = qItem.o[qItem.a];
  const wrong = qItem.o.filter((_, i) => i !== qItem.a);
  const scores = wrong.map((w) => distractorScore(correct, w));
  const good = scores.filter((x) => x >= 2).length;
  const veryBad = scores.filter((x) => x <= 1).length;
  return good >= 2 && veryBad <= 2;
}

export function mergeKwBank(base, extra) {
  const out = {};
  const allCats = new Set([...Object.keys(base || {}), ...Object.keys(extra || {})]);
  for (const cat of allCats) {
    const srcA = Array.isArray(base?.[cat]) ? base[cat] : [];
    const srcB = Array.isArray(extra?.[cat]) ? extra[cat] : [];
    const seen = new Set();
    const arr = [];
    for (const qItem of [...srcA, ...srcB]) {
      if (!qItem || typeof qItem !== "object") continue;
      if (typeof qItem.q !== "string" || !qItem.q.trim()) continue;
      if (!Array.isArray(qItem.o) || qItem.o.length !== 4) continue;
      if (!Number.isInteger(qItem.a) || qItem.a < 0 || qItem.a > 3) continue;
      if (cat === "history" && qItem.src === "user-text") continue;
      if (qItem.src === "user-text" && !hasAcceptableDistractors(qItem)) continue;
      const key = qItem.id ? "id:" + String(qItem.id) : normQ(qItem.q) + "|" + String(qItem.img || "").slice(-52);
      if (!(qItem.id || normQ(qItem.q)) || seen.has(key)) continue;
      seen.add(key);
      arr.push(qItem);
    }
    out[cat] = arr;
  }
  return out;
}
