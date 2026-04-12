/** تحقق صارم من شكل السؤال (متوافق مع اللعبة) */
export function validateQuestion(q, index = 0) {
  const prefix = index !== null ? `[#${index}] ` : "";
  if (!q || typeof q !== "object") return `${prefix}ليس كائناً`;
  if (typeof q.q !== "string" || !q.q.trim()) return `${prefix}نص السؤال (q) فارغ`;
  if (!Array.isArray(q.o) || q.o.length !== 4) return `${prefix}يجب أن يكون o مصفوفة بطول 4`;
  for (let i = 0; i < 4; i++) {
    if (typeof q.o[i] !== "string") return `${prefix}الخيار ${i} ليس نصاً`;
  }
  if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) return `${prefix}المؤشر a يجب أن يكون صحيحاً بين 0 و 3`;
  if (q.d !== undefined && q.d !== null && (!Number.isInteger(q.d) || q.d < 1 || q.d > 3)) {
    return `${prefix}الحقل d إن وُجد يجب أن يكون 1 أو 2 أو 3`;
  }
  return null;
}

export function validateQuestionArray(arr, pathLabel = "") {
  if (!Array.isArray(arr)) return [`${pathLabel}: الجذر ليس مصفوفة`];
  const errs = [];
  arr.forEach((q, i) => {
    const e = validateQuestion(q, i);
    if (e) errs.push(pathLabel ? `${pathLabel}: ${e}` : e);
  });
  return errs;
}

export function qHashNode(q) {
  if (q && q.id) return "id:" + String(q.id);
  const head = (q.q || "").substring(0, 40);
  const img = q.img ? String(q.img).slice(-56) : "";
  return head + "|" + img;
}

/** دمج مع إزالة التكرار (الأول يبقى) */
export function dedupeQuestions(questions) {
  const seen = new Set();
  const out = [];
  for (const q of questions) {
    const err = validateQuestion(q, null);
    if (err) continue;
    const h = qHashNode(q);
    if (seen.has(h)) continue;
    seen.add(h);
    out.push(q);
  }
  return out;
}

export function mergeQuestionLists(primary, secondary) {
  return dedupeQuestions([...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])]);
}
