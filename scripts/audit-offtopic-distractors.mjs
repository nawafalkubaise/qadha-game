/**
 * كشف الأسئلة التي تحتوي على إجابات خاطئة (مشتتات) "لا علاقة لها بالسؤال":
 * أي مشتت نوعه/مجاله مختلف عن الإجابة الصحيحة (سنة مقابل نسبة، اسم مقابل رقم، ...).
 * فاحص الجودة الأصلي يتحقق فقط من النوع الخشن؛ هذا أدق.
 *
 *   node scripts/audit-offtopic-distractors.mjs            # تقرير
 *   node scripts/audit-offtopic-distractors.mjs --json out # حفظ القائمة
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BANKS = path.resolve(__dirname, "..", "src", "data", "banks");

const toW = (s) => String(s).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const MONTHS = /(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر|محرم|صفر|ربيع|جمادى|رجب|شعبان|رمضان|شوال|ذو)/;
const UNIT = /(كم|كيلومتر|متر|سم|ملم|°|درجة|كجم|كغم|كيلو|جرام|طن|لتر|نقطة|سنة|عام|يوم|ساعة|دقيقة|متراً|كيلومتراً)/;
const MONEY = /(دينار|ريال|دولار|درهم|يورو|روبية)/;
const SCALE = /(مليون|مليار|ألف|الف|تريليون)/;

function kind(raw) {
  const s = toW(String(raw || "").trim());
  if (!s) return "empty";
  const hasLatin = /[A-Za-z]/.test(s);
  const hasDigit = /[0-9]/.test(s);
  const words = s.split(/\s+/).filter(Boolean).length;

  // صيغة كيميائية: حروف لاتينية + أرقام صغيرة بدون مسافات (CO2, H2O, KClO3, C6H6)
  if (hasLatin && /^[A-Za-z0-9()⁺⁻+\-]+$/.test(s) && /[A-Za-z].*[0-9]|[0-9].*[A-Za-z]/.test(s)) return "formula";
  // رمز قصير لاتيني (DXB, AUH) أو رمز اتصال (+971) أو رمز كيميائي بسيط
  if ((hasLatin && words === 1 && s.length <= 5) || /^[+]\d{2,4}$/.test(s) || /^[A-Za-z]{1,3}[⁺⁻+\-]?$/.test(s)) return "code";

  if (/%/.test(s)) return "percent";
  if (MONEY.test(s)) return "money";
  if (MONTHS.test(s) && hasDigit) return "date";
  // سنة: 3-4 أرقام تمثّل سنة (١٩٦١، 1990م، 2030)
  if (/^\D{0,3}(1[0-9]{3}|20[0-9]{2}|[0-9]{3,4})\s*(م|هـ|ميلادي|هجري)?\D{0,3}$/.test(s) && !UNIT.test(s) && !MONEY.test(s)) return "year";
  if (hasDigit && (UNIT.test(s) || SCALE.test(s))) return "measure";
  if (hasDigit && /^[0-9.,٬٫\s]+$/.test(toW(s))) return "count";
  if (hasDigit) return "numlike"; // رقم مع نص (نصف رقمي)

  if (hasLatin) return words <= 2 ? "latin-short" : "latin-phrase";
  // نص عربي
  return words <= 2 ? "ar-short" : "ar-phrase";
}

// أي أنواع تُعدّ "متوافقة" مع بعضها (لا تُعتبر خارج الموضوع)
const COMPAT = [
  ["ar-short", "ar-phrase"],     // نص عربي قصير/طويل مقبول مع بعضه
  ["count", "numlike"],
];
function compatible(a, b) {
  if (a === b) return true;
  return COMPAT.some((g) => g.includes(a) && g.includes(b));
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.name.endsWith(".json")) files.push(f);
  }
})(BANKS);

let total = 0, flagged = 0;
const perCat = {};
const perFile = {};
const examples = [];
const flaggedList = [];

for (const file of files) {
  let arr; try { arr = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
  if (!Array.isArray(arr)) continue;
  const rel = path.relative(BANKS, file).replace(/\\/g, "/");
  const slug = path.basename(file, ".json");
  for (let i = 0; i < arr.length; i++) {
    const q = arr[i];
    if (!q || !Array.isArray(q.o) || q.o.length !== 4 || !Number.isInteger(q.a)) continue;
    total++;
    const ck = kind(q.o[q.a]);
    const wrong = q.o.filter((_, idx) => idx !== q.a);
    const offKinds = wrong.map(kind).filter((wk) => !compatible(ck, wk));
    if (offKinds.length) {
      flagged++;
      perCat[slug] = (perCat[slug] || 0) + 1;
      perFile[rel] = (perFile[rel] || 0) + 1;
      flaggedList.push({ file: rel, index: i, q: q.q, correct: q.o[q.a], ck, wrong, offCount: offKinds.length });
      if (examples.length < 25) examples.push(`[${rel}] (${ck}) ${q.q}\n      ✓ ${q.o[q.a]}\n      ✗ ${wrong.join("  |  ")}`);
    }
  }
}

console.log("=== off-topic distractor audit ===");
console.log("total questions :", total);
console.log("flagged (distractor kind ≠ answer kind):", flagged, `(${(flagged / total * 100).toFixed(1)}%)`);
console.log("\n-- top categories by flagged count --");
Object.entries(perCat).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([c, n]) => console.log("  " + String(n).padStart(4) + "  " + c));
console.log("\n-- examples --");
examples.forEach((e, i) => console.log(`${i + 1}) ${e}\n`));

const ji = process.argv.indexOf("--json");
if (ji >= 0 && process.argv[ji + 1]) {
  fs.writeFileSync(process.argv[ji + 1], JSON.stringify(flaggedList, null, 2), "utf8");
  console.log("wrote", flaggedList.length, "flagged ->", process.argv[ji + 1]);
}
