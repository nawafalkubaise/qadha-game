#!/usr/bin/env node
/**
 * أدوات دقيقة لملفات بنك الأسئلة (JSON مصفوفة).
 *
 *   node scripts/question-bank-tool.mjs validate <ملف.json>
 *   node scripts/question-bank-tool.mjs dedupe <ملف.json> [--write]
 *   node scripts/question-bank-tool.mjs hashes <ملف.json>
 *   node scripts/question-bank-tool.mjs validate-all
 *
 * المسار النسبي من جذر المشروع أو مسار مطلق.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  validateQuestionArray,
  dedupeQuestions,
  qHashNode,
} from "./lib/questionValidate.mjs";
import { BANKS_DIR, readCatIdsFromQadha } from "./lib/bankPaths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function resolvePath(p) {
  if (path.isAbsolute(p)) return p;
  return path.join(ROOT, p);
}

function readJsonArray(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  return data;
}

const [, , cmd, arg1, arg2] = process.argv;

if (!cmd || cmd === "help" || cmd === "-h") {
  console.log(`استخدام:
  node scripts/question-bank-tool.mjs validate <file.json>
  node scripts/question-bank-tool.mjs dedupe <file.json> [--write]
  node scripts/question-bank-tool.mjs hashes <file.json>
  node scripts/question-bank-tool.mjs validate-all`);
  process.exit(0);
}

if (cmd === "validate") {
  const p = resolvePath(arg1);
  const data = readJsonArray(p);
  const errs = validateQuestionArray(data, p);
  if (errs.length) {
    console.error(errs.join("\n"));
    process.exit(1);
  }
  console.log(`OK — ${data.length} سؤالاً صالحاً`);
  process.exit(0);
}

if (cmd === "dedupe") {
  const p = resolvePath(arg1);
  const write = arg2 === "--write" || arg2 === "-w";
  const data = readJsonArray(p);
  const before = data.length;
  const out = dedupeQuestions(data);
  const errs = validateQuestionArray(out, p);
  if (errs.length) {
    console.error(errs.join("\n"));
    process.exit(1);
  }
  console.log(`قبل: ${before} · بعد: ${out.length} (مزالة ${before - out.length})`);
  if (write) {
    fs.writeFileSync(p, JSON.stringify(out, null, 2) + "\n", "utf8");
    console.log("تم الحفظ.");
  }
  process.exit(0);
}

if (cmd === "hashes") {
  const p = resolvePath(arg1);
  const data = readJsonArray(p);
  data.forEach((q, i) => {
    console.log(`${i}\t${qHashNode(q)}`);
  });
  process.exit(0);
}

if (cmd === "validate-all") {
  const catIds = readCatIdsFromQadha();
  const countries = fs.readdirSync(BANKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  let bad = 0;
  for (const country of countries) {
    for (const cid of catIds) {
      const fp = path.join(BANKS_DIR, country, `${cid}.json`);
      if (!fs.existsSync(fp)) {
        console.error(`مفقود: ${fp}`);
        bad++;
        continue;
      }
      let data;
      try {
        data = readJsonArray(fp);
      } catch (e) {
        console.error(`${fp}: JSON ${e.message}`);
        bad++;
        continue;
      }
      const errs = validateQuestionArray(data, fp);
      if (errs.length) {
        errs.forEach((e) => console.error(e));
        bad++;
      }
    }
  }
  if (bad) {
    console.error(`\nفشل: ${bad} ملفاً به أخطاء أو مفقود`);
    process.exit(1);
  }
  console.log(`OK — كل ملفات البنوك (${countries.length} دولة × ${catIds.length} فئة) صالحة`);
  process.exit(0);
}

console.error("أمر غير معروف:", cmd);
process.exit(1);
