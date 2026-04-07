/**
 * فحص عميق: فئة فئة، سؤال سؤال — بنية JSON، فهرس الإجابة، تكرار النصوص.
 * تشغيل: node scripts/verify-questions-deep.mjs
 *         node scripts/verify-questions-deep.mjs --verbose   (كل الأسئلة، كل البنوك)
 *         node scripts/verify-questions-deep.mjs --json      (ملخص JSON)
 *         node scripts/verify-questions-deep.mjs --cat=history (تفاصيل فئة واحدة في كل بنك)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GCC_BANKS, GCC_COUNTRY_IDS } from "../src/data/gccBanks.js";
import { KW_MERGED as KW } from "../src/data/kwBank.js";
import { FALLBACK_AR } from "../src/triviaFallbacks.js";
import { FALLBACK_EN } from "../src/triviaFallbacksEn.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qadhaPath = path.join(__dirname, "..", "src", "Qadha.jsx");
const s = fs.readFileSync(qadhaPath, "utf8");

const catsBlock = s.split("const CATS=")[1].split("];")[0];
const catEntries = [...catsBlock.matchAll(/\{id:"([^"]+)",n:"[^"]*",ar:"([^"]*)"/g)].map((m) => ({
  id: m[1],
  ar: m[2],
}));
const catIds = catEntries.map((c) => c.id);
const catLabel = (id) => {
  const e = catEntries.find((c) => c.id === id);
  return e ? `${id} (${e.ar})` : id;
};

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

function normQ(text, isAr) {
  const t = String(text || "").trim().replace(/\s+/g, " ");
  return isAr ? t : t.toLowerCase();
}

/**
 * @returns {{ errors: string[], dupQs: string[], warnings: string[] }}
 */
function validateCategory(catId, questions, { bankName, isAr }) {
  const errors = [];
  const warnings = [];
  const dupQs = [];
  if (!Array.isArray(questions)) {
    errors.push(`الفئة ليست مصفوفة`);
    return { errors, dupQs, warnings };
  }
  const seenQ = new Map();
  questions.forEach((item, i) => {
    const idx = i + 1;
    if (!item || typeof item !== "object") {
      errors.push(`#${idx}: ليس كائنًا`);
      return;
    }
    const { q, o, a } = item;
    if (typeof q !== "string" || !q.trim()) {
      errors.push(`#${idx}: حقل q ناقص أو فارغ`);
    }
    if (!Array.isArray(o)) {
      errors.push(`#${idx}: حقل o ليس مصفوفة`);
    } else if (o.length !== 4) {
      errors.push(`#${idx}: يجب أن يكون ٤ خيارات (العدد الحالي ${o.length})`);
    } else {
      o.forEach((opt, j) => {
        if (typeof opt !== "string" || !opt.trim()) {
          errors.push(`#${idx}: الخيار ${j + 1} فارغ أو غير نص`);
        }
      });
    }
    if (!Number.isInteger(a) || a < 0 || a > 3) {
      errors.push(`#${idx}: فهرس الإجابة a يجب ٠–٣ (القيمة: ${JSON.stringify(a)})`);
    }
    if (item.d !== undefined && item.d !== null && ![1, 2, 3].includes(item.d)) {
      errors.push(`#${idx}: حقل d (مستوى الصعوبة) يجب 1 أو 2 أو 3 إن وُجد`);
    }
    if (typeof q === "string" && q.trim() && Array.isArray(o) && o.length === 4 && Number.isInteger(a) && a >= 0 && a <= 3) {
      const correct = o[a];
      if (typeof correct !== "string" || !correct.trim()) {
        errors.push(`#${idx}: الإجابة الصحيحة (الفهرس ${a}) فارغة`);
      }
    }
    if (typeof q === "string" && q.trim()) {
      const key = normQ(q, isAr);
      if (seenQ.has(key)) {
        dupQs.push(`#${idx} يطابق سؤال #${seenQ.get(key)} (نفس النص)`);
      } else {
        seenQ.set(key, idx);
      }
    }
  });
  return { errors, dupQs, warnings };
}

function validateBank(bank, bankName, isAr, minCount = 8) {
  const out = {
    bankName,
    categoriesOk: 0,
    categoriesWithErrors: 0,
    totalQuestions: 0,
    issueRows: [],
  };
  for (const id of catIds) {
    const qs = bank[id];
    const n = Array.isArray(qs) ? qs.length : 0;
    out.totalQuestions += n;
    const { errors, dupQs } = validateCategory(id, qs, { bankName, isAr });
    const short = n < minCount;
    if (!errors.length && !dupQs.length && !short) {
      out.categoriesOk++;
      continue;
    }
    out.categoriesWithErrors++;
    const lines = [];
    if (short) lines.push(`  ⚠ العدد ${n} (أقل من ${minCount})`);
    errors.forEach((e) => lines.push(`  ✗ ${e}`));
    dupQs.forEach((d) => lines.push(`  ⧉ ${d}`));
    out.issueRows.push({ id, label: catLabel(id), lines });
  }
  return out;
}

function printReport(result) {
  console.log(`\n── ${result.bankName} ──`);
  console.log(`  فئات سليمة بالكامل: ${result.categoriesOk} / ${catIds.length}`);
  console.log(`  إجمالي أسئلة مفحوصة: ${result.totalQuestions}`);
  if (!result.issueRows.length) {
    console.log(`  ✓ لا أخطاء بنية ولا تكرار نصوص أسئلة ضمن الفئة`);
    return;
  }
  console.log(`  فئات فيها ملاحظات: ${result.issueRows.length}`);
  for (const row of result.issueRows) {
    console.log(`\n  [${row.label}]`);
    row.lines.forEach((l) => console.log(l));
  }
}

const verbose = process.argv.includes("--verbose");
const asJson = process.argv.includes("--json");
const catArg = process.argv.find((a) => a.startsWith("--cat="));
const onlyCatId = catArg ? catArg.slice("--cat=".length).trim() : "";

const banks = [
  { name: "KW + fillMissing", bank: filledBank(KW, true), isAr: true },
  { name: "GEN_AR + fillMissing", bank: filledBank(GEN_AR, true), isAr: true },
  { name: "GEN + fillMissing (EN)", bank: filledBank(GEN, false), isAr: false },
  ...GCC_COUNTRY_IDS.map((cid) => ({
    name: `GCC_BANKS.${cid} + fillMissing`,
    bank: filledBank(GCC_BANKS[cid], true),
    isAr: true,
  })),
];

if (onlyCatId) {
  if (!catIds.includes(onlyCatId)) {
    console.error(`فئة غير معروفة: ${onlyCatId}`);
    console.error(`الفئات: ${catIds.join(", ")}`);
    process.exit(1);
  }
  console.log(`═══ تفصيل فئة: ${catLabel(onlyCatId)} ═══\n`);
  for (const b of banks) {
    const qs = b.bank[onlyCatId];
    console.log(`\n── ${b.name} ──`);
    if (!Array.isArray(qs)) {
      console.log("  (لا توجد بيانات)");
      continue;
    }
    qs.forEach((item, i) => {
      console.log(`\n  سؤال ${i + 1}/${qs.length}`);
      console.log(`  Q: ${item.q}`);
      item.o.forEach((opt, j) => {
        const mark = j === item.a ? " ✓" : "";
        console.log(`    ${String.fromCharCode(65 + j)}) ${opt}${mark}`);
      });
    });
  }
  process.exit(0);
}

const allResults = banks.map((b) => validateBank(b.bank, b.name, b.isAr, 8));

if (asJson) {
  console.log(
    JSON.stringify(
      allResults.map((r) => ({
        bank: r.bankName,
        okCats: r.categoriesOk,
        issues: r.issueRows.map((x) => ({ id: x.id, lines: x.lines })),
      })),
      null,
      2
    )
  );
  process.exit(allResults.some((r) => r.issueRows.length) ? 1 : 0);
}

console.log("═══ فحص عميق — فئة فئة، سؤال سؤال ═══");
console.log(`عدد الفئات: ${catIds.length}`);

for (const r of allResults) {
  printReport(r);
}

if (verbose) {
  console.log("\n\n════════ قائمة كل الأسئلة (مختصرة) ════════\n");
  for (const b of banks) {
    console.log(`\n### ${b.name}\n`);
    for (const id of catIds) {
      const qs = b.bank[id];
      if (!Array.isArray(qs)) continue;
      console.log(`\n— ${catLabel(id)} — (${qs.length} سؤال)`);
      qs.forEach((item, i) => {
        const qq = item?.q ?? "";
        const preview = qq.length > 90 ? `${qq.slice(0, 90)}…` : qq;
        console.log(`  ${i + 1}. ${preview}`);
      });
    }
  }
}

const hasIssues = allResults.some((r) => r.issueRows.length);
if (hasIssues) {
  console.log("\n⚠ وُجدت فئات تحتاج مراجعة (انظر أعلاه).");
  process.exit(1);
}
console.log("\n✓ كل البنوك: بنية صحيحة ولا تكرار لنص السؤال داخل نفس الفئة.");
process.exit(0);
