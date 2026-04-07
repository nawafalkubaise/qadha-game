/**
 * يستخرج أسئلة/أجوبة من ملف نصي عربي ويحوّلها لبنك أسئلة كويتي جاهز.
 * - يزيل التكرار بحسب نص السؤال (تطبيع بسيط)
 * - يصنّف السؤال على فئة تقريبية من فئات اللعبة
 * - يبني 4 خيارات (إجابة صحيحة + 3 مشتتات من إجابات أخرى)
 * - يضع d: 1/2/3 حسب طول النص داخل كل فئة
 *
 * تشغيل:
 * node scripts/import-kuwait-text-questions.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = "C:/Users/User/Desktop/اسئله عن الكويت.txt";
const outPath = path.join(__dirname, "..", "src", "data", "kwImportedBank.json");

function norm(s) {
  return String(s || "")
    .replace(/\u0640/g, "")
    .replace(/[^\u0600-\u06FF0-9A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanQuestion(s) {
  return String(s || "")
    .replace(/^السؤال\s*[:：]\s*/i, "")
    .replace(/^سؤال\s*[:：]\s*/i, "")
    .replace(/^الجواب\s*[:：]\s*/i, "")
    .replace(/^الإجابة\s*[:：]\s*/i, "")
    .replace(/\s+ص\s*\d+.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.؟!]+$/g, "")
    .trim();
}

function cleanAnswer(s) {
  return String(s || "")
    .replace(/^الجواب\s*[:：]\s*/i, "")
    .replace(/^الإجابة\s*[:：]\s*/i, "")
    .replace(/\s+ص\s*\d+.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.]+$/g, "")
    .trim();
}

function categoryFor(question) {
  const q = norm(question);
  if (/منتخب|كأس|أولمبي|رياض/.test(q)) return "sports";
  if (/مجلس الامة|نظام الحكم|دستور|امير|الحاكم|حكم/.test(q)) return "politics";
  if (/عملة|دينار|نفط|حقل|بورصة|اقتصاد/.test(q)) return "economics";
  if (/معلم|متحف|سوق|تراث|ابراج|قصر|فيلكا|الجهراء|سياح/.test(q)) return "landmarks";
  if (/مساحة|جزر|محافظ|العاصمة|الموقع|تقع|قارة|حد|الخليج|مناخ/.test(q)) return "geography";
  if (/عام|متى|تاسست|استقلال|تحرير|انضمت|معركة|غزو/.test(q)) return "history";
  return "history";
}
function detectTopic(question) {
  const q = norm(question);
  if (/عاصم/.test(q)) return "capital";
  if (/عملة|عمله|دينار|ريال|درهم/.test(q)) return "currency";
  if (/نظام الحكم|حكم/.test(q)) return "government";
  if (/جزر/.test(q)) return "islands";
  if (/محافظ|تقسيم إداري|التقسيم الإداري/.test(q)) return "governorates";
  if (/مساحة|مساحه/.test(q)) return "area";
  if (/سكان|التركيبة السكانية|عدد السكان|الشريحة السكانية/.test(q)) return "population";
  if (/متى|عام|سنة|تاريخ|استقلال|تحرير|تأسست|انضمت/.test(q)) return "year";
  if (/لغة|اللغه/.test(q)) return "language";
  if (/تحد|الحدود|يحد/.test(q)) return "border";
  if (/جزيرة|فيلكا|بوبيان|وربة|كبر|قاروه|أم المرادم|مسكان/.test(q)) return "island_name";
  return "general";
}

function scoreLen(q) {
  return String(q.q || "").length + (Array.isArray(q.o) ? q.o.join("").length : 0);
}

function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619;
  return Math.abs(h >>> 0);
}

function pickDeterministic(arr, count, seed, avoid = new Set()) {
  const pool = arr.filter((x) => !avoid.has(x));
  const out = [];
  if (!pool.length) return out;
  let i = hashSeed(seed) % pool.length;
  let guard = 0;
  const maxLoops = Math.max(16, pool.length * 4);
  while (out.length < count && pool.length && guard < maxLoops) {
    const v = pool[i % pool.length];
    if (!out.includes(v)) out.push(v);
    i += 7;
    if (out.length >= pool.length) break;
    guard++;
  }
  return out.slice(0, count);
}

function parsePairs(rawText) {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const pairs = [];
  let pendingQ = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // صيغة: سؤال<TAB>جواب
    if (line.includes("\t")) {
      const [q, a] = line.split("\t");
      const qq = cleanQuestion(q);
      const aa = cleanAnswer(a);
      if (qq && aa && qq.length >= 8) pairs.push({ q: qq, a: aa });
      continue;
    }

    if (/^السؤال\s*[:：]/.test(line)) {
      pendingQ = cleanQuestion(line);
      // أحياناً نفس السطر يحوي الإجابة أيضاً
      if (pendingQ.includes("الإجابة:") || pendingQ.includes("الجواب:")) {
        const m = pendingQ.match(/^(.*?)\s*(?:الإجابة|الجواب)\s*[:：]\s*(.*)$/);
        if (m) {
          const qq = cleanQuestion(m[1]);
          const aa = cleanAnswer(m[2]);
          if (qq && aa && qq.length >= 8) pairs.push({ q: qq, a: aa });
          pendingQ = null;
        }
      }
      continue;
    }

    if (/^(?:الإجابة|الجواب)\s*[:：]/.test(line) && pendingQ) {
      const aa = cleanAnswer(line);
      const qq = cleanQuestion(pendingQ);
      if (qq && aa && qq.length >= 8) pairs.push({ q: qq, a: aa });
      pendingQ = null;
      continue;
    }
  }
  return pairs;
}

const raw = fs.readFileSync(sourcePath, "utf8");
const pairs = parsePairs(raw);

// إزالة التكرار بحسب السؤال
const uniqMap = new Map();
for (const p of pairs) {
  const key = norm(p.q);
  if (!key || uniqMap.has(key)) continue;
  if (!p.a || p.a.length < 2) continue;
  uniqMap.set(key, p);
}
const uniq = [...uniqMap.values()];

// تجميع حسب الفئة
const grouped = {};
for (const p of uniq) {
  const cat = categoryFor(p.q);
  if (!grouped[cat]) grouped[cat] = [];
  grouped[cat].push(p);
}

// إعداد مشتتات الإجابات
const globalAnswers = [...new Set(uniq.map((x) => x.a).filter(Boolean))];
const out = {};

const pools = {
  capital: ["مدينة الكويت", "الرياض", "الدوحة", "المنامة", "أبوظبي", "مسقط", "بغداد"],
  currency: ["الدينار الكويتي", "الريال السعودي", "الدرهم الإماراتي", "الريال القطري", "الدينار البحريني", "الريال العماني"],
  government: ["إمارة دستورية وراثية", "ملكية دستورية", "جمهورية برلمانية", "ملكية مطلقة"],
  islands: ["سبع جزر", "ثماني جزر", "تسع جزر", "عشر جزر", "إحدى عشرة جزيرة"],
  governorates: ["أربع محافظات", "خمس محافظات", "ست محافظات", "سبع محافظات"],
  language: ["العربية", "الإنجليزية", "الفرنسية", "الأوردية"],
  border: ["العراق", "السعودية", "إيران", "قطر", "البحرين", "الإمارات"],
  island_name: ["فيلكا", "بوبيان", "وربة", "كبر", "قاروه", "مسكان", "أم المرادم", "أم النمل"],
};

function toArabicDigits(nStr) {
  return String(nStr).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
}
function nearYearFromText(txt) {
  const m = String(txt).match(/(1[0-9]{3}|20[0-9]{2})/);
  if (!m) return [];
  const y = Number(m[1]);
  return [y - 2, y - 1, y + 1, y + 2].map((v) => `${toArabicDigits(v)}`);
}
function nearNumberFromText(txt) {
  const m = String(txt).replace(/[,،]/g, "").match(/([0-9\u0660-\u0669]{1,8})/);
  if (!m) return [];
  const west = m[1].replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const n = Number(west);
  if (!Number.isFinite(n)) return [];
  const d = Math.max(1, Math.round(n * 0.1));
  return [n - d, n + d, n + 2 * d].map((v) => toArabicDigits(Math.max(1, Math.round(v))));
}

for (const [cat, arr] of Object.entries(grouped)) {
  const catAnswers = [...new Set(arr.map((x) => x.a).filter(Boolean))];
  const items = arr.map((p) => {
    const topic = detectTopic(p.q);
    const topicPool = pools[topic] || [];
    const smart = [];
    if (topic === "year") smart.push(...nearYearFromText(p.a));
    if (topic === "area" || topic === "population" || /كم/.test(norm(p.q))) smart.push(...nearNumberFromText(p.a));
    smart.push(...topicPool);

    const avoid = new Set([p.a]);
    let distract = pickDeterministic(smart, 3, `${cat}:smart:${p.q}`, avoid);
    if (distract.length < 3) {
      const fromCat = pickDeterministic(catAnswers, 3 - distract.length, `${cat}:${p.q}`, new Set([p.a, ...distract]));
      distract = [...distract, ...fromCat];
    }
    if (distract.length < 3) {
      const extra = pickDeterministic(globalAnswers, 3 - distract.length, `g:${cat}:${p.q}`, new Set([p.a, ...distract]));
      distract = [...distract, ...extra];
    }
    while (distract.length < 3) distract.push("غير ذلك");
    const options = [p.a, ...distract].slice(0, 4);
    const rot = hashSeed(`${cat}|${p.q}`) % 4;
    const o = options.map((_, i) => options[(i + rot) % 4]);
    const a = o.indexOf(p.a);
    return { q: p.q, o, a };
  });

  // d حسب طول النص داخل الفئة
  const withScore = items.map((it, i) => ({ it, i, s: scoreLen(it) })).sort((a, b) => a.s - b.s);
  const n = withScore.length;
  const i1 = Math.max(1, Math.ceil(n / 3));
  const i2 = Math.max(i1 + 1, Math.ceil((2 * n) / 3));
  const rankD = {};
  withScore.forEach((row, rank) => {
    rankD[row.i] = rank < i1 ? 1 : rank < i2 ? 2 : 3;
  });
  out[cat] = items.map((it, i) => ({ ...it, d: rankD[i] || 2, src: "user-text" }));
}

fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`Imported pairs: ${pairs.length}`);
console.log(`Unique questions: ${uniq.length}`);
console.log(`Categories written: ${Object.keys(out).length}`);
console.log(`Output: ${outPath}`);
