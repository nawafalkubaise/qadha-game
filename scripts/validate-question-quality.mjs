import fs from "node:fs";
import path from "node:path";
import { evaluateQuestionQuality } from "./lib/questionQuality.mjs";

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

const issues = [];

for (const filePath of walkJsonFiles(BANKS_DIR)) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    issues.push({ filePath, question: "JSON parse error", details: [String(error.message || error)] });
    continue;
  }
  if (!Array.isArray(data)) continue;
  data.forEach((q, i) => {
    const qIssues = evaluateQuestionQuality(q);
    if (!qIssues.length) return;
    issues.push({
      filePath,
      question: `#${i + 1}: ${q?.q || "بدون نص"}`,
      details: qIssues,
    });
  });
}

if (issues.length) {
  console.error(`Question quality validation failed: ${issues.length} issue rows`);
  issues.slice(0, 120).forEach((item, idx) => {
    console.error(`${idx + 1}) ${item.filePath}`);
    console.error(`   ${item.question}`);
    console.error(`   ${item.details.join(", ")}`);
  });
  process.exit(1);
}

console.log("Question quality validation passed for all bank files.");
