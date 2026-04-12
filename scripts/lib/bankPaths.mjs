import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.join(__dirname, "..", "..");
export const BANKS_DIR = path.join(REPO_ROOT, "src", "data", "banks");

export function bankJsonPath(countryId, categoryId) {
  return path.join(BANKS_DIR, countryId, `${categoryId}.json`);
}

export function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function readCatIdsFromQadha() {
  const qadhaPath = path.join(REPO_ROOT, "src", "Qadha.jsx");
  const s = fs.readFileSync(qadhaPath, "utf8");
  const catsBlock = s.split("const CATS=")[1].split("];")[0];
  return [...catsBlock.matchAll(/\{id:"([^"]+)"/g)].map((m) => m[1]);
}
