/**
 * يطبّق التصحيحات المؤكدة بعد التحقق الثاني (scripts/_hifix/out_*.json) ويسجّلها:
 *   review/applied-fixes.csv / .json  — كل سؤال قبل/بعد (للمراجعة أو التراجع)
 * شبكة أمان: ٤ خيارات متمايزة غير فارغة، a صحيح، بلا عبارات تحوّط.
 * تشغيل: node scripts/apply-reviewed-fixes.mjs [--write]
 */
import fs from "fs";
import path from "path";

const write = process.argv.includes("--write");
const BANKS = "src/data/banks";
/* --dir scripts/_rev2 لتطبيق جولة أخرى؛ الافتراضي الجولة الأولى */
const dirArg = process.argv.indexOf("--dir");
const DIR = dirArg > 0 ? process.argv[dirArg + 1] : "scripts/_hifix";
const norm = (s) => String(s ?? "").trim().toLowerCase()
  .replace(/[ً-ٰٟـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
const hedge = /(^|\s)(أو|او)\s.*(بارز|مشابه)|لكن |\(مرشح/;

const cache = new Map();
const load = (f) => { if (!cache.has(f)) cache.set(f, JSON.parse(fs.readFileSync(path.join(BANKS, f), "utf8"))); return cache.get(f); };
const applied = [], rejected = [], skipped = [], deleted = [], kept = [];
for (const of of fs.readdirSync(DIR).filter((f) => /^out_.*\.json$/.test(f)).sort()) {
  for (const p of JSON.parse(fs.readFileSync(path.join(DIR, of), "utf8"))) {
    if (p.action === "keep") { kept.push({ file: p.file, q: p.q, note: p.note || "" }); continue; }
    if (p.action !== "fix" && p.action !== "delete") { skipped.push(p); continue; }
    const arr = load(p.file);
    const idx = arr.findIndex((x) => x.q === p.q);
    if (idx < 0) { rejected.push({ ...p, why: "not found" }); continue; }
    if (p.action === "delete") {
      const [gone] = arr.splice(idx, 1);
      deleted.push({ file: p.file, id: gone.id || "", q: gone.q, answer: gone.o[gone.a], question: gone, note: p.note || "" });
      continue;
    }
    const n = p.new || {};
    const why =
      !String(n.q ?? "").trim() ? "empty q" :
      !Array.isArray(n.o) || n.o.length !== 4 ? "need 4 options" :
      n.o.some((x) => !String(x ?? "").trim()) ? "empty option" :
      new Set(n.o.map(norm)).size !== 4 ? "duplicate options" :
      !Number.isInteger(n.a) || n.a < 0 || n.a > 3 ? "bad a" :
      n.o.some((x) => hedge.test(x)) ? "hedging" : null;
    if (why) { rejected.push({ ...p, why }); continue; }
    const before = arr[idx];
    arr[idx] = { ...before, q: String(n.q).trim(), o: n.o.map((x) => String(x).trim()), a: n.a };
    applied.push({ file: p.file, id: before.id || "", beforeQ: before.q, beforeAnswer: before.o[before.a], afterQ: arr[idx].q, afterAnswer: arr[idx].o[n.a], note: p.note || "" });
  }
}
if (write) {
  for (const [f, arr] of cache) fs.writeFileSync(path.join(BANKS, f), JSON.stringify(arr, null, 2) + "\n");
  fs.mkdirSync("review", { recursive: true });
  /* السجلات تتراكم عبر الجولات */
  const prev = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : []);
  const allApplied = [...prev("review/applied-fixes.json"), ...applied];
  const allDeleted = [...prev("review/deleted-questions.json"), ...deleted];
  const allKept = [...prev("review/reviewed-ok.json"), ...kept];
  fs.writeFileSync("review/applied-fixes.json", JSON.stringify(allApplied, null, 1) + "\n");
  fs.writeFileSync("review/deleted-questions.json", JSON.stringify(allDeleted, null, 1) + "\n");
  fs.writeFileSync("review/reviewed-ok.json", JSON.stringify(allKept, null, 1) + "\n");
  const cols = [["file", "الملف"], ["beforeQ", "السؤال قبل"], ["beforeAnswer", "الإجابة قبل"], ["afterQ", "السؤال بعد"], ["afterAnswer", "الإجابة بعد"], ["note", "ملاحظة"], ["id", "المعرّف"]];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  fs.writeFileSync("review/applied-fixes.csv", "﻿" + [cols.map((c) => esc(c[1])).join(","), ...allApplied.map((r) => cols.map((c) => esc(r[c[0]])).join(","))].join("\r\n") + "\r\n");
  const dcols = [["file", "الملف"], ["q", "السؤال المحذوف"], ["answer", "إجابته"], ["note", "سبب الحذف"], ["id", "المعرّف"]];
  fs.writeFileSync("review/deleted-questions.csv", "﻿" + [dcols.map((c) => esc(c[1])).join(","), ...allDeleted.map((r) => dcols.map((c) => esc(r[c[0]])).join(","))].join("\r\n") + "\r\n");
}
console.log({ dir: DIR, applied: applied.length, deleted: deleted.length, kept: kept.length, skipped: skipped.length, rejected: rejected.length, write });
if (rejected.length) console.log(rejected.map((r) => `${r.why} | ${r.file} | ${r.q}`).join("\n"));
