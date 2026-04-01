import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qadhaPath = path.join(__dirname, "..", "src", "Qadha.jsx");
const s = fs.readFileSync(qadhaPath, "utf8");

const cats = s.split("const CATS=")[1].split("];")[0];
const catIds = [...cats.matchAll(/\{id:"([^"]+)"/g)].map((m) => m[1]);

function extractBetween(startMarker, endMarker) {
  const a = s.indexOf(startMarker);
  const b = s.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error(`Missing markers: ${startMarker}`);
  return s.slice(a + startMarker.length, b);
}

const kwBody = extractBetween("const KW=", "/* ═══════ 🌍 GENERAL KNOWLEDGE");
const genArBody = extractBetween("const GEN_AR=", "const GEN=");

function keysInBank(body) {
  const map = new Map();
  const re = /"([a-z0-9_]+)"\s*:\s*\[/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const k = m[1];
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    for (; i < body.length && depth > 0; i++) {
      const ch = body[i];
      if (ch === "[") depth++;
      else if (ch === "]") depth--;
    }
    const arr = body.slice(start, i - 1);
    const n = (arr.match(/\{q:/g) || []).length;
    map.set(k, n);
  }
  return map;
}

const kw = keysInBank(kwBody);
const ga = keysInBank(genArBody);

const minQ = 8;
const issues = [];
const missingKw = [];
const missingGa = [];

for (const id of catIds) {
  if (!kw.has(id)) missingKw.push(id);
  else if ((kw.get(id) || 0) < minQ)
    issues.push({ id, bank: "KW", count: kw.get(id), need: minQ });

  if (!ga.has(id)) missingGa.push(id);
  else if ((ga.get(id) || 0) < minQ)
    issues.push({ id, bank: "GEN_AR", count: ga.get(id), need: minQ });
}

console.log("Categories:", catIds.length);
console.log("KW keys:", kw.size, "GEN_AR keys:", ga.size);
if (missingKw.length) console.log("MISSING in KW:", missingKw.join(", "));
if (missingGa.length) console.log("MISSING in GEN_AR:", missingGa.join(", "));
if (issues.length) {
  console.log("LOW COUNT:", JSON.stringify(issues, null, 2));
  process.exitCode = 1;
} else if (missingKw.length || missingGa.length) {
  process.exitCode = 1;
} else {
  console.log(`OK: each category has >= ${minQ} questions in KW and GEN_AR`);
}
