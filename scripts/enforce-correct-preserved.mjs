/**
 * شبكة أمان لمرحلة 2: تضمن أن الإجابة الصحيحة الأصلية (من نسخة احتياطية) تبقى هي
 * الإجابة الصحيحة بعد تعديل الوكلاء للمشتتات. لو غيّر وكيلٌ الإجابة الصحيحة، نعيدها،
 * ونُبقي مشتتاته الجيدة. الحالات التي تتطلب مراجعة بشرية (إجابة أصلية تبدو خاطئة) تُسجَّل.
 *
 *   node scripts/enforce-correct-preserved.mjs <relPathUnderBanks...>   # افحص فقط
 *   node scripts/enforce-correct-preserved.mjs --write <relPaths...>
 *   مثال: node scripts/enforce-correct-preserved.mjs --write kw/food.json sa/food.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normComparable } from "./lib/questionQuality.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "src", "data");
const BANKS = path.join(ROOT, "banks");
const BACKUP = path.join(ROOT, "banks_backup_prequality");
const WRITE = process.argv.includes("--write");
const rels = process.argv.slice(2).filter((a) => a !== "--write");

let restored = 0, fine = 0, flags = [];
for (const rel of rels) {
  const curPath = path.join(BANKS, rel);
  const prePath = path.join(BACKUP, rel);
  const cur = JSON.parse(fs.readFileSync(curPath, "utf8"));
  const pre = JSON.parse(fs.readFileSync(prePath, "utf8"));
  let touched = false;
  for (let i = 0; i < cur.length; i++) {
    const c = cur[i], p = pre[i];
    if (!c || !p || !Array.isArray(c.o) || !Array.isArray(p.o)) continue;
    const origCorrect = p.o[p.a];
    const nOrig = normComparable(origCorrect);
    if (normComparable(c.o[c.a]) === nOrig) { fine++; continue; }
    // الإجابة الصحيحة تغيّرت — أعِدها
    const idx = c.o.findIndex((o) => normComparable(o) === nOrig);
    if (idx >= 0) {
      c.a = idx; // الإجابة الأصلية موجودة كخيار → فقط صحّح المؤشّر
    } else {
      c.o[c.a] = origCorrect; // استبدل ما وضعه الوكيل بالإجابة الأصلية
    }
    // تأكد من 4 خيارات متمايزة بعد الاستعادة
    const seen = new Set(); let dup = false;
    for (const o of c.o) { const k = normComparable(o); if (seen.has(k)) dup = true; seen.add(k); }
    flags.push({ rel, index: i, q: c.q, origCorrect, warning: dup ? "duplicate option after restore — needs manual distractor" : null });
    restored++;
    touched = true;
  }
  if (touched && WRITE) fs.writeFileSync(curPath, JSON.stringify(cur, null, 2) + "\n", "utf8");
}

console.log("=== enforce correct-answer preserved " + (WRITE ? "(WRITE)" : "(CHECK)") + " ===");
console.log("ok (unchanged correct):", fine);
console.log("restored               :", restored);
if (flags.length) {
  console.log("\n-- restored / flagged for review (original answer may itself be weak) --");
  flags.forEach((f, i) => console.log(`${i + 1}) [${f.rel}#${f.index}] ${f.q}\n      restored correct → ${f.origCorrect}${f.warning ? "  ⚠ " + f.warning : ""}`));
}
