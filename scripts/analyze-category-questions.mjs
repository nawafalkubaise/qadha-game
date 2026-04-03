/**
 * تحليل تغطية الأسئلة لكل فئة (مطابقة لمنطق fillMissing في Qadha.jsx)
 * تشغيل: node scripts/analyze-category-questions.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { FALLBACK_AR } from "../src/triviaFallbacks.js";
import { FALLBACK_EN } from "../src/triviaFallbacksEn.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qadhaPath = path.join(__dirname, "..", "src", "Qadha.jsx");
const s = fs.readFileSync(qadhaPath, "utf8");

const catsBlock = s.split("const CATS=")[1].split("];")[0];
const catIds = [...catsBlock.matchAll(/\{id:"([^"]+)"/g)].map((m) => m[1]);

function extractBetween(startMarker, endMarker) {
  const a = s.indexOf(startMarker);
  const b = s.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error(`Missing: ${startMarker}`);
  return s.slice(a + startMarker.length, b);
}

function keysInBank(body) {
  const set = new Set();
  const re = /"([a-z0-9_]+)"\s*:\s*\[/g;
  let m;
  while ((m = re.exec(body)) !== null) set.add(m[1]);
  return set;
}

const kwKeys = keysInBank(extractBetween("const KW=", "/* ═══════ 🌍 GENERAL KNOWLEDGE"));
const genArKeys = keysInBank(extractBetween("const GEN_AR=", "const GEN="));
const genEnKeys = keysInBank(
  extractBetween("const GEN=", "const fillMissing"),
);

const fbAr = new Set(Object.keys(FALLBACK_AR));
const fbEn = new Set(Object.keys(FALLBACK_EN));

function sourceForKw(id) {
  if (kwKeys.has(id)) return "KW (كويت مخصص)";
  if (fbAr.has(id)) return "FALLBACK_AR";
  if (genArKeys.has(id)) return "GEN_AR";
  return "PLACEHOLDER (أسئلة تلقائية عامة)";
}

function sourceForGeneralAr(id) {
  if (genArKeys.has(id)) return "GEN_AR";
  if (fbAr.has(id)) return "FALLBACK_AR";
  return "PLACEHOLDER";
}

function sourceForGeneralEn(id) {
  if (genEnKeys.has(id)) return "GEN";
  if (fbEn.has(id)) return "FALLBACK_EN";
  return "PLACEHOLDER";
}

const onlyPlaceholderKw = catIds.filter((id) => sourceForKw(id).startsWith("PLACEHOLDER"));
const onlyPlaceholderGA = catIds.filter((id) => sourceForGeneralAr(id).startsWith("PLACEHOLDER"));
const onlyPlaceholderGE = catIds.filter((id) => sourceForGeneralEn(id).startsWith("PLACEHOLDER"));

console.log("═══ قدها؟ — تحليل مصدر الأسئلة لكل فئة (٦٠ فئة) ═══\n");
console.log("ملاحظة: PLACEHOLDER = ٢٠ سؤالاً مولّداً آلياً (نص عام حسب اسم الفئة) — ليست أسئلة حقيقية.\n");

console.log("── وضع الكويت (KW بعد fillMissing) ──");
console.log(`  مباشرة من بنك KW:     ${catIds.filter((id) => kwKeys.has(id)).length} فئات`);
console.log(`  من FALLBACK_AR:       ${catIds.filter((id) => !kwKeys.has(id) && fbAr.has(id)).length} فئات`);
console.log(`  من GEN_AR فقط:        ${catIds.filter((id) => !kwKeys.has(id) && !fbAr.has(id) && genArKeys.has(id)).length} فئات`);
console.log(`  PLACEHOLDER فقط:      ${onlyPlaceholderKw.length} فئات`);
if (onlyPlaceholderKw.length) console.log(`  → [${onlyPlaceholderKw.join(", ")}]\n`);
else console.log();

console.log("── عالمي عربي (GEN_AR + FALLBACK_AR) ──");
console.log(`  من GEN_AR مباشرة:     ${catIds.filter((id) => genArKeys.has(id)).length} فئات`);
console.log(`  من FALLBACK_AR فقط:   ${catIds.filter((id) => !genArKeys.has(id) && fbAr.has(id)).length} فئات`);
console.log(`  PLACEHOLDER فقط:      ${onlyPlaceholderGA.length} فئات`);
if (onlyPlaceholderGA.length) console.log(`  → [${onlyPlaceholderGA.join(", ")}]\n`);
else console.log();

console.log("── عالمي English (GEN + FALLBACK_EN) ──");
console.log(`  من GEN مباشرة:        ${catIds.filter((id) => genEnKeys.has(id)).length} فئات`);
console.log(`  من FALLBACK_EN فقط:   ${catIds.filter((id) => !genEnKeys.has(id) && fbEn.has(id)).length} فئات`);
console.log(`  PLACEHOLDER فقط:      ${onlyPlaceholderGE.length} فئات`);
if (onlyPlaceholderGE.length) console.log(`  → [${onlyPlaceholderGE.join(", ")}]\n`);
else console.log();

console.log("── فئات بلا مفتاح في FALLBACK_AR (لكن قد تُغطى بـ KW أو GEN_AR) ──");
const missingFbAr = catIds.filter((id) => !fbAr.has(id));
console.log(`  العدد: ${missingFbAr.length} — [${missingFbAr.join(", ")}]\n`);

console.log("── فئات بلا مفتاح في FALLBACK_EN (قد تُغطى بـ GEN) ──");
const missingFbEn = catIds.filter((id) => !fbEn.has(id));
console.log(`  العدد: ${missingFbEn.length} — [${missingFbEn.join(", ")}]\n`);

const kwUsesGenArOnly = catIds.filter(
  (id) => !kwKeys.has(id) && !fbAr.has(id) && genArKeys.has(id),
);
console.log("── الكويت: فئات بلا KW ولا FALLBACK_AR وتُملأ من GEN_AR (عالمي عربي) ──");
console.log(`  [${kwUsesGenArOnly.join(", ")}]\n`);

const kwUsesFallbackOnly = catIds.filter(
  (id) => !kwKeys.has(id) && fbAr.has(id),
);
console.log("── الكويت: فئات بلا KW وتعتمد على FALLBACK_AR ──");
console.log(`  العدد ${kwUsesFallbackOnly.length} — [${kwUsesFallbackOnly.join(", ")}]\n`);
