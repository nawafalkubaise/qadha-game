/**
 * إصلاح الإجابات الخاطئة "الضعيفة" في بنوك اللعبة.
 * يعيد توليد 3 مشتتات ذكية من نفس النوع/الموضوع باستخدام أداة اللعبة نفسها
 * (pickBestDistractors) — فقط للأسئلة التي يرفضها فاحص الجودة.
 *
 *   node scripts/fix-weak-distractors.mjs          # تقرير فقط
 *   node scripts/fix-weak-distractors.mjs --write  # تطبيق
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateQuestionQuality,
  pickBestDistractors,
  normComparable,
} from "./lib/questionQuality.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BANKS = path.join(ROOT, "src", "data", "banks");
const WRITE = process.argv.includes("--write");

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.name.endsWith(".json")) out.push(full);
  }
  return out;
}

const files = walk(BANKS);
const parsed = new Map(); // file -> array
for (const f of files) {
  try {
    const a = JSON.parse(fs.readFileSync(f, "utf8"));
    if (Array.isArray(a)) parsed.set(f, a);
  } catch { /* ignore */ }
}

// تجميع كل الإجابات الصحيحة حسب الفئة (اسم الملف) + تجمّع عام
const byCategory = new Map(); // slug -> Set(correct answers)
const global = new Set();
for (const [f, arr] of parsed) {
  const slug = path.basename(f, ".json");
  if (!byCategory.has(slug)) byCategory.set(slug, new Set());
  const set = byCategory.get(slug);
  for (const q of arr) {
    if (q && Array.isArray(q.o) && Number.isInteger(q.a) && q.o[q.a] != null) {
      set.add(String(q.o[q.a]));
      global.add(String(q.o[q.a]));
    }
  }
}
const globalArr = [...global];

// توضع الإجابة الصحيحة في موقع ثابت (بدون عشوائية) لتجنّب التحيّز لموقع 0
function slotFor(id, q) {
  const s = String(id || q || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 4;
}

let fixed = 0, stillWeak = 0, scanned = 0;
const examples = [];

for (const [f, arr] of parsed) {
  const slug = path.basename(f, ".json");
  let touched = false;
  arr.forEach((q) => {
    const issues = evaluateQuestionQuality(q);
    if (!issues.some((i) => i.startsWith("weak_distractor"))) return;
    scanned++;
    const correct = q.o[q.a];
    const currentWrong = q.o.filter((_, i) => i !== q.a);
    // مجمع المرشحين: المشتتات الحالية الجيدة (تُحتفظ) ثم نفس الفئة عبر كل الدول ثم عام
    const pool = [...currentWrong, ...(byCategory.get(slug) || []), ...globalArr];
    const newWrong = pickBestDistractors({ correct, currentWrong, answerPool: pool, count: 3 });
    // تأكد أنها فعلاً 3 ومن نفس النوع/السكربت ومختلفة عن الصحيحة
    const ok = newWrong.length === 3 &&
      newWrong.every((w) => normComparable(w) !== normComparable(correct)) &&
      new Set(newWrong.map(normComparable)).size === 3;
    if (!ok) { stillWeak++; return; }
    // الإجابة الصحيحة تُدرج في موقع معروف؛ الفهرس = الموقع نفسه (لا حاجة لبحث نصّي)
    const slot = slotFor(q.id, q.q);
    const finalOpts = [...newWrong];
    finalOpts.splice(slot, 0, correct); // الطول الآن = 4 لأن newWrong=3
    const trial = { ...q, o: finalOpts, a: slot };
    // لا نطبّق التعديل إلا إذا اجتاز فاحص الجودة (وإلا نترك السؤال كما هو)
    if (evaluateQuestionQuality(trial).some((i) => i.startsWith("weak_distractor"))) { stillWeak++; return; }
    q.o = trial.o; q.a = trial.a;
    fixed++; touched = true;
    if (examples.length < 6) examples.push({ slug, q: q.q, o: q.o, a: q.a });
  });
  if (touched && WRITE) {
    fs.writeFileSync(f, JSON.stringify(arr, null, 2) + "\n", "utf8");
  }
}

console.log("\n=== fix weak distractors " + (WRITE ? "(WRITE)" : "(DRY-RUN)") + " ===");
console.log("flagged scanned: ", scanned);
console.log("fixed:           ", fixed);
console.log("still weak:      ", stillWeak);
if (examples.length) {
  console.log("\nexamples:");
  for (const e of examples) {
    console.log(`  [${e.slug}] ${e.q}`);
    e.o.forEach((o, i) => console.log(`     ${i === e.a ? "✓" : " "} ${o}`));
  }
}
if (!WRITE) console.log("\n(dry-run — add --write to apply)");
