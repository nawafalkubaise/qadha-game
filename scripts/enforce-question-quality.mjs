import fs from "node:fs";
import path from "node:path";
import {
  normalizeArabicFusha,
  pickBestDistractors,
  normComparable,
} from "./lib/questionQuality.mjs";

const ROOT = path.resolve(process.cwd());
const BANKS_DIR = path.join(ROOT, "src", "data", "banks");

function walkJsonFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function rotateOptions(options, seed) {
  const rot = seed % options.length;
  return options.map((_, idx) => options[(idx + rot) % options.length]);
}

function hashSeed(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619;
  return Math.abs(h >>> 0);
}

let changedFiles = 0;
let touchedQuestions = 0;

for (const filePath of walkJsonFiles(BANKS_DIR)) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    continue;
  }
  if (!Array.isArray(data) || !data.length) continue;

  const answerPool = data
    .filter((q) => q && Array.isArray(q.o) && q.o.length === 4 && Number.isInteger(q.a) && q.a >= 0 && q.a <= 3)
    .map((q) => normalizeArabicFusha(q.o[q.a]))
    .filter(Boolean);

  let fileChanged = false;
  const updated = data.map((q) => {
    if (!q || !Array.isArray(q.o) || q.o.length !== 4 || !Number.isInteger(q.a) || q.a < 0 || q.a > 3) return q;
    const nq = normalizeArabicFusha(q.q);
    const no = q.o.map((opt) => normalizeArabicFusha(opt));
    const correct = no[q.a];
    const currentWrong = no.filter((_, i) => i !== q.a);
    const bestWrong = pickBestDistractors({ correct, currentWrong, answerPool, count: 3 });
    if (bestWrong.length < 3) return { ...q, q: nq, o: no };

    const merged = [correct, ...bestWrong];
    const rotated = rotateOptions(merged, hashSeed(`${path.basename(filePath)}|${nq}`) % 4);
    const newA = rotated.findIndex((x) => normComparable(x) === normComparable(correct));
    const candidate = { ...q, q: nq, o: rotated, a: newA };
    if (JSON.stringify(candidate) !== JSON.stringify(q)) {
      fileChanged = true;
      touchedQuestions++;
    }
    return candidate;
  });

  if (!fileChanged) continue;
  fs.writeFileSync(filePath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  changedFiles++;
}

console.log(`Question quality enforcement complete. changedFiles=${changedFiles}, touchedQuestions=${touchedQuestions}`);
