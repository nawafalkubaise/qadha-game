import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const s = fs.readFileSync(path.join(root, "src", "Qadha.jsx"), "utf8");
const catsBlock = s.split("const CATS=")[1].split("];")[0];
const catIds = [...catsBlock.matchAll(/\{id:"([^"]+)"/g)].map((m) => m[1]);

const banksRoot = path.join(root, "src", "data", "banks");
const countries = fs.readdirSync(banksRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

console.log("CATS count:", catIds.length);
for (const c of countries) {
  const dir = path.join(banksRoot, c);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
  const missing = catIds.filter((id) => !files.includes(id));
  const extra = files.filter((f) => !catIds.includes(f));
  console.log(`\n${c}: files=${files.length}`);
  if (missing.length) console.log("  missing JSON for CATS id:", missing.join(", "));
  if (extra.length) console.log("  extra files not in CATS:", extra.join(", "));
}

// فئات في CATS لكن ليست ضمن أي صف في CAT_GROUP_ROWS (تظهر تحت «أخرى» فقط)
const s2 = fs.readFileSync(path.join(root, "src", "Qadha.jsx"), "utf8");
const grBlock = s2.split("const CAT_GROUP_ROWS=")[1].split("];")[0];
const inGroup = new Set();
for (const m of grBlock.matchAll(/ids:new Set\(\[([\s\S]*?)\]\)/g)) {
  const inner = m[1];
  for (const id of inner.matchAll(/"([a-z][a-z0-9_]*)"/g)) {
    inGroup.add(id[1]);
  }
}
const notInGroup = catIds.filter((id) => !inGroup.has(id));
console.log("\nCATS ids not listed in CAT_GROUP_ROWS (show under «أخرى»):");
console.log(notInGroup.length ? notInGroup.join(", ") : "(none — all grouped)");
