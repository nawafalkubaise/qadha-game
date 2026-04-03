import crypto from "node:crypto";

/** إزالة تشكيل شائع + تطبيع مسافات — ليس بديل NFKC كامل لكل الحالات لكنه كافٍ لمنع التكرار العرضي */
export function normalizeForDedup(s) {
  if (typeof s !== "string") return "";
  let t = s.normalize("NFC").trim().replace(/\s+/g, " ");
  t = t.replace(/[\u064B-\u065F\u0670\u0640]/g, "");
  return t.toLowerCase();
}

function optionsKey(o) {
  if (!Array.isArray(o)) return "";
  return o.map((x) => normalizeForDedup(String(x))).sort().join("|");
}

/** بصمة ثابتة لسؤال MCQ — تُستخدم في السيرفر والعميل */
export function questionFingerprint(q) {
  const stem = normalizeForDedup(q?.q ?? "");
  const opts = optionsKey(q?.o);
  const h = crypto.createHash("sha256");
  h.update(stem, "utf8");
  h.update("\n", "utf8");
  h.update(opts, "utf8");
  return h.digest("hex");
}

export function isValidQuestion(q) {
  return (
    q &&
    typeof q.q === "string" &&
    q.q.trim().length > 2 &&
    Array.isArray(q.o) &&
    q.o.length === 4 &&
    q.o.every((x) => typeof x === "string" && x.trim().length > 0) &&
    Number.isInteger(q.a) &&
    q.a >= 0 &&
    q.a < 4
  );
}
