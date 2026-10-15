/**
 * يبني قائمة مراجعة الإجابات المشكوك فيها لصاحب اللعبة (لا يغيّر أي سؤال):
 *   review/answers-review.csv  (يفتح في Excel — UTF-8 مع BOM)
 *   review/answers-review.json
 * المصادر: scripts/_factcheck/out_*.json (مراجعة الحقائق) + scripts/_distract/report.json (ملاحظات «suspect»)
 * تشغيل: node scripts/build-answer-review.mjs
 */
import fs from "fs";
import path from "path";

const BANKS = "src/data/banks";
const COUNTRY = { kw: "الكويت", sa: "السعودية", ae: "الإمارات", qa: "قطر", bh: "البحرين", om: "عُمان" };
const ISSUE = {
  wrong: "إجابة خاطئة",
  outdated: "معلومة قديمة",
  another_option_correct: "خيار آخر صحيح أيضاً",
  ambiguous: "سؤال غامض",
  mismatch: "الإجابة لا تطابق السؤال",
  suspect: "مشكوك فيها",
};

const bankCache = new Map();
const findQ = (file, q) => {
  if (!bankCache.has(file)) {
    try { bankCache.set(file, JSON.parse(fs.readFileSync(path.join(BANKS, file), "utf8"))); }
    catch { bankCache.set(file, []); }
  }
  return bankCache.get(file).find((x) => x.q === q);
};

const rows = new Map();
const add = (e, source) => {
  const bq = findQ(e.file, e.q);
  if (!bq) return; /* السؤال حُذف لاحقاً */
  const key = `${e.file}|${e.q}`;
  const prev = rows.get(key);
  const row = {
    country: COUNTRY[e.file.split("/")[0]] || e.file.split("/")[0],
    category: e.file.split("/")[1].replace(/\.json$/, ""),
    file: e.file,
    id: bq.id || "",
    question: e.q,
    current: bq.o[bq.a],
    issue: ISSUE[e.issue] || ISSUE.suspect,
    suggested: e.suggested || "",
    confidence: e.confidence === "high" ? "عالية" : e.confidence === "medium" ? "متوسطة" : "—",
    reason: e.reason || "",
    sources: source,
  };
  if (!prev) { rows.set(key, row); return; }
  /* دمج: نُبقي الأعلى ثقة ونجمع الأسباب */
  prev.sources = [...new Set([...prev.sources.split("+"), source])].join("+");
  if (row.confidence === "عالية" && prev.confidence !== "عالية") Object.assign(prev, { ...row, sources: prev.sources });
  else if (row.reason && !prev.reason.includes(row.reason)) prev.reason += " | " + row.reason;
  if (!prev.suggested && row.suggested) prev.suggested = row.suggested;
};

for (const f of fs.readdirSync("scripts/_factcheck").filter((f) => /^out_.*\.json$/.test(f)).sort()) {
  for (const e of JSON.parse(fs.readFileSync(path.join("scripts/_factcheck", f), "utf8"))) add(e, "مراجعة الحقائق");
}
const distract = path.join("scripts/_distract", "report.json");
if (fs.existsSync(distract)) for (const s of JSON.parse(fs.readFileSync(distract, "utf8")).suspects || []) add({ ...s, issue: "suspect" }, "مراجعة المشتتات");

const order = Object.values(COUNTRY);
const confRank = { "عالية": 0, "متوسطة": 1, "—": 2 };
const list = [...rows.values()].sort((a, b) =>
  order.indexOf(a.country) - order.indexOf(b.country) || confRank[a.confidence] - confRank[b.confidence] || a.category.localeCompare(b.category));

fs.mkdirSync("review", { recursive: true });
fs.writeFileSync("review/answers-review.json", JSON.stringify(list, null, 1) + "\n");
const cols = [["country", "الدولة"], ["category", "الفئة"], ["question", "السؤال"], ["current", "الإجابة الحالية"], ["suggested", "الإجابة المقترحة"], ["issue", "نوع المشكلة"], ["confidence", "الثقة"], ["reason", "السبب"], ["id", "المعرّف"], ["file", "الملف"], ["sources", "المصدر"]];
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
const csv = [cols.map((c) => esc(c[1])).join(","), ...list.map((r) => cols.map((c) => esc(r[c[0]])).join(","))].join("\r\n");
fs.writeFileSync("review/answers-review.csv", "﻿" + csv + "\r\n");

const by = {};
for (const r of list) { by[r.country] ??= { total: 0, high: 0 }; by[r.country].total++; if (r.confidence === "عالية") by[r.country].high++; }
console.log({ total: list.length, high: list.filter((r) => r.confidence === "عالية").length }, by);
