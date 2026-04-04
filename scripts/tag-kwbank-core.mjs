/**
 * يضيف حقل d (1 عادي · 2 وسط · 3 صعب) لكل سؤال في kwBankCore.json
 * حسب ترتيب «طول النص» داخل كل فئة (نفس منطق الاحتياطي السابق).
 * تشغيل: node scripts/tag-kwbank-core.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "..", "src", "data", "kwBankCore.json");
const raw = fs.readFileSync(p, "utf8");
const data = JSON.parse(raw);

for (const [cat, arr] of Object.entries(data)) {
  if (!Array.isArray(arr)) continue;
  const n = arr.length;
  if (n === 0) continue;
  const withIdx = arr.map((q, i) => ({
    q,
    i,
    s: String(q.q || "").length + (Array.isArray(q.o) ? q.o.map(String).join("").length : 0),
  }));
  withIdx.sort((a, b) => a.s - b.s);
  const i1 = Math.max(1, Math.ceil(n / 3));
  const i2 = Math.max(i1 + 1, Math.ceil((2 * n) / 3));
  const dByOrig = {};
  withIdx.forEach((row, rank) => {
    const d = rank < i1 ? 1 : rank < i2 ? 2 : 3;
    dByOrig[row.i] = d;
  });
  data[cat] = arr.map((q, i) => {
    const { d: _drop, ...rest } = q;
    return { ...rest, d: dByOrig[i] };
  });
}

fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("Tagged kwBankCore.json with d=1|2|3 per category.");
