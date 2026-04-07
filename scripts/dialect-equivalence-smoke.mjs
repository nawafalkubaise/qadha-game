import fs from "node:fs";
import path from "node:path";

const file = path.resolve(process.cwd(), "src", "Qadha.jsx");
const s = fs.readFileSync(file, "utf8");

function extract(name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*(\\[[\\s\\S]*?\\n\\]);`);
  const m = s.match(re);
  if (!m) throw new Error(`Missing ${name}`);
  return new Function(`return ${m[1]}`)();
}

const groups = extract("DIALECT_EQUIV_GROUPS");
const phrases = extract("DIALECT_PHRASE_EQUIV");

const norm = (x = "") =>
  String(x)
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\w\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const map = new Map();
for (const g of groups) {
  const c = norm(g[0]);
  for (const w of g) map.set(norm(w), c);
}

const canonicalize = (x) => {
  let t = norm(x);
  const replacePhrase = (text, from, to) => {
    const src = text.split(" ").filter(Boolean);
    const pat = from.split(" ").filter(Boolean);
    if (!src.length || !pat.length) return text;
    const out = [];
    for (let i = 0; i < src.length; ) {
      let ok = true;
      for (let j = 0; j < pat.length; j++) {
        if (src[i + j] !== pat[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        out.push(to);
        i += pat.length;
      } else {
        out.push(src[i]);
        i++;
      }
    }
    return out.join(" ").replace(/\s+/g, " ").trim();
  };
  for (const [from, to] of phrases) {
    const f = norm(from);
    const tt = norm(to);
    t = replacePhrase(t, f, tt);
  }
  return t
    .split(" ")
    .map((w) => map.get(w) || w)
    .join(" ")
    .trim();
};

const pairs = [
  ["حذاء", "جوتي"],
  ["حذاء", "نعال"],
  ["بطاطا", "بطاطس"],
  ["جوال", "موبايل"],
  ["مركز صحي", "مستوصف"],
  ["دورة مياه", "حمام"],
  ["قهوة عربية", "قهوه"],
  ["سيارة أجرة", "تاكسي"],
  ["واي فاي", "wifi"],
];

let ok = 0;
for (const [a, b] of pairs) {
  const ca = canonicalize(a);
  const cb = canonicalize(b);
  const pass = ca === cb;
  if (pass) ok++;
  console.log(`${pass ? "PASS" : "FAIL"} | ${a} <=> ${b} | ${ca} == ${cb}`);
}
console.log(`\nPassed ${ok}/${pairs.length}`);
process.exit(ok === pairs.length ? 0 : 1);
