/**
 * إزالة الأسئلة المكررة عبر فئات متعددة داخل نفس المنطقة (أسئلة قوالب حُشيت في كل فئة).
 * لكل نص سؤال مكرر داخل منطقة: نُبقي نسخة واحدة (نُفضّل فئتها الصحيحة "home" إن وُجدت،
 * وإلا أول فئة)، ونحذف الباقي. الحذف فقط — نقل الناجين لفئتهم يتم لاحقاً عبر move-phase2.
 *
 *   node scripts/dedup-cross-category.mjs            # تقرير (dry-run)
 *   node scripts/dedup-cross-category.mjs --write    # تنفيذ الحذف
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BANKS = path.resolve(__dirname, "..", "src", "data", "banks");
const WRITE = process.argv.includes("--write");

// خريطة الفئة الصحيحة (home) حسب نمط نص السؤال
const HOME = [
  [/عاصمة|capital of/i, "geography"],
  [/العملة الرسمية/, "currencies"],
  [/ضمن دول مجلس التعاون/, "politics"],
  [/طبق شعبي/, "food"],
  [/معلم أو مدينة يرتبط/, "landmarks"],
  [/معروف عن .* معاصرة/, "culture"],
  [/أكبر محيط|largest ocean/i, "ocean"],
  [/سرعة الضوء|speed of light|وحدة القوة|unit of force|الجاذبية اكتشف/i, "physics"],
  [/الجدول الدوري/, "chemistry"],
  [/الحرب الباردة|chinese new year/i, "history"],
  [/أكبر عضو بالجسم/, "biology"],
  [/كأس آسيا|كأس الخليج/, "soccer"],
  [/رائد فضاء/, "space"],
  [/ملك البحرين الحالي/, "leaders"],
  [/دار الآثار الإسلامية|متحف طارق رجب/, "kuwait_landmarks"],
];
const homeOf = (q) => { for (const [re, c] of HOME) if (re.test(q)) return c; return null; };

const regions = fs.readdirSync(BANKS).filter((r) => fs.statSync(path.join(BANKS, r)).isDirectory());

let groups = 0, deleted = 0, keptHome = 0, keptFirst = 0, relocated = 0;
const delByCat = new Map();
const sampleKeeps = [];
const emptied = [];

for (const region of regions) {
  const dir = path.join(BANKS, region);
  const files = fs.readdirSync(dir).filter((x) => x.endsWith(".json"));
  // load all
  const data = new Map(); // cat -> array
  for (const f of files) data.set(f.replace(/\.json$/, ""), JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));

  // index: qtext -> [{cat, idx}]
  const idx = new Map();
  for (const [cat, arr] of data) {
    for (let i = 0; i < arr.length; i++) {
      const q = arr[i]; if (!q || !q.q) continue;
      const k = q.q.trim();
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push({ cat, i });
    }
  }

  // mark deletions per cat (+ relocations to home)
  const toDelete = new Map(); // cat -> Set(indices)
  const relocate = new Map(); // homeCat -> [question objects]
  for (const [qtext, locs] of idx) {
    const cats = new Set(locs.map((l) => l.cat));
    if (cats.size <= 1) continue; // not cross-category
    groups++;
    const home = homeOf(qtext);
    let keep, moveTo = null;
    if (home && cats.has(home)) { keep = locs.find((l) => l.cat === home); keptHome++; }
    else if (home && data.has(home)) { keep = locs[0]; moveTo = home; relocated++; } // home known+absent -> move survivor
    else { keep = locs[0]; keptFirst++; }
    if (sampleKeeps.length < 14) sampleKeeps.push(`[${region}] ${moveTo ? "MOVE -> "+moveTo : 'keep "'+keep.cat+'"'}${home ? " (home="+home+(cats.has(home)?"":" absent")+")" : " (no-home)"}: ${qtext.slice(0,50)}`);
    for (const l of locs) {
      // when relocating, ALL source copies (incl. keep) are removed; survivor is re-added to home
      const removeThis = moveTo ? true : (l !== keep);
      if (!removeThis) continue;
      if (!toDelete.has(l.cat)) toDelete.set(l.cat, new Set());
      toDelete.get(l.cat).add(l.i);
      delByCat.set(l.cat, (delByCat.get(l.cat) || 0) + 1);
      if (l !== keep) deleted++;
    }
    if (moveTo) {
      if (!relocate.has(moveTo)) relocate.set(moveTo, []);
      relocate.get(moveTo).push(data.get(keep.cat)[keep.i]);
    }
  }

  // apply: delete from sources, then append relocations to home cats
  const dirty = new Set();
  for (const [cat, del] of toDelete) {
    data.set(cat, data.get(cat).filter((_, i) => !del.has(i)));
    dirty.add(cat);
  }
  for (const [home, qs] of relocate) {
    data.get(home).push(...qs);
    dirty.add(home);
  }
  for (const cat of dirty) {
    const arr = data.get(cat);
    if (arr.length === 0) emptied.push(`${region}/${cat}`);
    if (WRITE) fs.writeFileSync(path.join(dir, cat + ".json"), JSON.stringify(arr, null, 2) + "\n");
  }
}

console.log(`=== dedup cross-category (${WRITE ? "WRITE" : "DRY-RUN"}) ===`);
console.log("duplicate groups        :", groups);
console.log("kept in home category   :", keptHome);
console.log("relocated to home        :", relocated);
console.log("kept first (no home hit):", keptFirst);
console.log("questions deleted        :", deleted);
console.log("files emptied (DANGER)  :", emptied.length, emptied.slice(0, 10).join(", "));
console.log("\n-- top categories by deletions --");
[...delByCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([c, n]) => console.log(`  ${n}  ${c}`));
console.log("\n-- sample keep decisions --");
sampleKeeps.forEach((s) => console.log("  " + s));
if (!WRITE) console.log("\n(dry-run — add --write to delete)");
