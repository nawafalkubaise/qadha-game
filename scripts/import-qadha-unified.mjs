/**
 * استيراد بنك "قدها.json" الموحّد إلى بنوك اللعبة.
 *   src/data/banks/<country>/<categorySlug>.json   (schema: {q, o:[4], a, d, id, src})
 *
 * المصدر: ملف قدها.json (8952 سؤال) — كل سؤال له الإجابة الصحيحة + 3 إجابات خاطئة ذكية
 * من نفس الموضوع (مبنية مسبقاً عبر build_qadha.py).
 *
 * الاستخدام:
 *   node scripts/import-qadha-unified.mjs --src "C:\\path\\قدها.json"          # dry-run (تقرير فقط)
 *   node scripts/import-qadha-unified.mjs --src "C:\\path\\قدها.json" --write   # تطبيق فعلي
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BANKS = path.join(ROOT, "src", "data", "banks");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const srcIdx = args.indexOf("--src");
const SRC = srcIdx >= 0 ? args[srcIdx + 1] : null;
if (!SRC) {
  console.error("missing --src <path to قدها.json>");
  process.exit(1);
}

/* ── خريطة الدول: اسم عربي في قدها → مجلد البنك ───────────────── */
const COUNTRY_MAP = {
  "الكويت": "kw",
  "السعودية": "sa",
  "الإمارات": "ae",
  "قطر": "qa",
  "البحرين": "bh",
  "عُمان": "om",
  "عمان": "om",
  "عربي": "general_ar",
  "الخليج": "general_ar",
  "خليج": "general_ar",
};

/* ── خريطة الفئات: اسم قدها (بعد التطبيع) → slug في اللعبة ─────── */
const CATEGORY_MAP = {
  // تاريخ
  "تاريخ": "history", "التواريخ المهمة": "history", "تأسيس الاتحاد": "history",
  "اليوم الوطني والتأسيس": "history", "الإمارة وآل سعود": "history",
  "الشهداء والأبطال العسكريون": "history",
  // حضارات/آثار
  "دلمون والحضارات القديمة": "ancient", "المناطق الأثرية": "ancient",
  // جغرافيا/طبيعة
  "جغرافيا": "geography", "الجبال والمرتفعات": "geography",
  "الأودية والوديان": "geography", "الأودية المقدسة": "geography",
  "الأفلاج والمياه": "geography", "البحر الأحمر والساحل": "geography",
  "ظفار وصلالة": "geography", "الشارقة وعجمان": "geography",
  "رأس الخيمة والفجيرة وأم القيوين": "geography",
  "البيئة والطقس": "weather",
  // معالم/سياحة
  "معالم وسياحة": "landmarks", "المعالم والمباني": "landmarks",
  "القلاع والحصون": "landmarks", "المتاحف والمعارض الدائمة": "landmarks",
  "المتاحف والثقافة": "landmarks", "القرى والمواقع التراثية": "landmarks",
  "أبوظبي ومعالمها": "landmarks", "دبي ومعالمها": "landmarks",
  "السياحة والترفيه": "travel", "الفنادق والسياحة": "travel",
  // اقتصاد
  "اقتصاد ونفط": "economics", "العملة والاقتصاد": "economics",
  "البنوك والمال": "economics", "الأرقام والإحصائيات": "economics",
  "رؤية 2030 والمستقبل": "economics", "إنجازات معاصرة": "economics",
  // تراث وعادات
  "تراث وعادات": "customs", "التراث والعادات": "customs",
  "العادات والتقاليد": "customs", "التراث الشعبي والصناعات": "customs",
  "الصناعات اليدوية": "customs", "الحرف والصناعات التقليدية": "customs",
  "الأسواق التراثية": "customs", "القهوة والضيافة": "customs",
  "الزواج والأعراس": "customs", "الأعياد والمناسبات": "customs",
  "البخور واللبان": "customs", "الفروسية والإبل": "customs",
  "الطفولة والمدارس قديماً": "culture",
  "الفلكلور والرقص الشعبي": "dance",
  "الألعاب الشعبية القديمة": "boardgames",
  "البوادي والقبائل": "tribes",
  // معلومات عامة → ثقافة
  "معلومات عامة": "culture", "أسئلة متقدمة": "culture",
  "الفعاليات والمهرجانات": "culture", "مهرجانات وفعاليات": "culture",
  "المهرجانات الكبرى": "culture", "مهرجانات": "culture",
  "المنظمات الخيرية": "culture", "مشاهير": "culture",
  // فنون وأدب وإعلام
  "فنون وأدب": "art", "الفنون والأدب": "art",
  "الفنون التشكيلية والمعارض": "art", "الفنون والأدب والإعلام": "art",
  "الفنون التراثية والموسيقى": "music", "الفنون والموسيقى": "music",
  "موسيقى وفن": "music",
  "الفنانون والمسرح": "theater",
  "الكتب والمؤلفون": "literature", "الشعراء النبطيون": "literature",
  "الأمثال والحكم": "proverbs", "لهجة وأمثال": "proverbs",
  "الإعلام والصحافة": "media", "إعلام وصحافة": "media",
  "الإعلام الرقمي والمحتوى": "media", "القنوات والإذاعات": "media",
  "الإنترنت والمواقع": "tech",
  // رياضة
  "رياضة": "sports", "البطولات الدولية المستضافة": "sports",
  "المسابقات والجوائز": "sports",
  "الألعاب الإلكترونية والإي-سبورتس": "gaming",
  // تعليم/علوم/تقنية/فضاء
  "تعليم": "science", "الأكاديميات والمعاهد": "science",
  "الجامعات الإقليمية": "science", "علوم": "science",
  "تكنولوجيا": "tech", "فضاء": "space",
  // دين
  "الدين والقيم": "religion", "الإسلام والمساجد": "religion",
  "الحياة الدينية والمساجد": "religion", "الحرمان الشريفان والحج": "religion",
  "الشخصيات الدينية والعلماء": "religion", "شخصيات دينية": "religion",
  // رموز وطنية/أعلام
  "الرموز الوطنية": "flags", "رموز وطنية": "flags", "أعلام العرب": "flags",
  // شخصيات/قادة
  "شخصيات وقيادة": "leaders", "الشخصيات والأوائل": "leaders",
  // سياسة/جيش/علاقات
  "سياسة وحكم": "politics", "العلاقات الدولية": "politics",
  "مجلس التعاون": "politics", "دبلوماسية": "politics",
  "الجيش والأمن": "politics", "جيش وأمن": "politics",
  // صحة
  "صحة وطب": "health", "الصحة والمستشفيات": "health",
  // نقل/طيران
  "نقل وطيران": "aviation", "الموانئ والمطارات": "aviation",
  "النقل والمواصلات": "travel", "السكك الحديدية والقطارات": "travel",
  // بحر
  "البحرية والصيد": "ocean", "بحر وغوص ولؤلؤ": "ocean",
  "البحر والإبحار": "ocean", "البحر والصيد": "ocean",
  "اللؤلؤ والبحر": "ocean", "بحر وغوص": "ocean",
  // حيوانات/زراعة
  "حيوانات": "animals", "حياة برية": "animals",
  "الزراعة والثروة الحيوانية": "nature", "الزراعة والاستدامة": "nature",
  // طعام
  "طعام وعادات": "food", "الأكلات الإقليمية": "food",
  "مطبخ عربي": "food", "تسوق ومطاعم": "food",
  // موضة
  "الموضة والأزياء": "fashion",
  // عواصم
  "عواصم العالم": "maps", "عواصم العربية": "maps",
  // فئات باسم دولة → ثقافة
  "السعودية": "culture", "الكويت": "culture", "البحرين": "culture",
  "عُمان": "culture", "عمان": "culture", "الإمارات": "culture",
  "قطر": "culture", "عربي": "culture", "الخليج": "culture",
};

const DIFF_MAP = { "سهل": 1, "متوسط": 2, "صعب": 3, "خبير": 3 };
const FALLBACK_SLUG = "culture"; // أي فئة غير معروفة

/* تطبيع اسم الفئة: إزالة الإيموجي/المحارف غير العربية في البداية */
function normCat(s) {
  return String(s || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}️‍⬀-⯿]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
/* تطبيع نص السؤال للمقارنة/إزالة التكرار */
function normQ(s) {
  return String(s || "")
    .replace(/ـ/g, "")
    .replace(/[^؀-ۿ0-9A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));
const questions = raw.questions || [];

const stats = {
  total: questions.length, written: 0, skippedDup: 0,
  skippedBadCountry: 0, skippedBadShape: 0, fallbackCat: 0,
  byCountry: {}, perFile: {},
};
const unmappedCats = {};
// تجميع المستهدف: country -> slug -> [items]
const target = {};

for (const x of questions) {
  const cid = COUNTRY_MAP[x.country];
  if (!cid) { stats.skippedBadCountry++; continue; }
  const opts = x.options;
  const ai = x.correct_index;
  if (!Array.isArray(opts) || opts.length !== 4 || !Number.isInteger(ai) || ai < 0 || ai > 3) {
    stats.skippedBadShape++; continue;
  }
  const q = String(x.question).trim();
  const o = opts.map((s) => String(s).trim());
  // ارفض الأسئلة بنص فارغ أو خيار فارغ أو خيارات مكررة (لا يلتقطها فاحص الجودة)
  if (!q || o.some((s) => !s) || new Set(o).size !== 4) {
    stats.skippedBadShape++; continue;
  }
  const cat = normCat(x.category);
  let slug = CATEGORY_MAP[cat];
  if (!slug) { slug = FALLBACK_SLUG; stats.fallbackCat++; unmappedCats[cat] = (unmappedCats[cat] || 0) + 1; }

  const item = {
    q,
    o,
    a: ai,
    d: DIFF_MAP[x.difficulty] || 2,
    id: x.id ? "qadha-" + x.id : undefined,
    src: "qadha",
  };
  if (!item.id) delete item.id;
  (target[cid] ||= {});
  (target[cid][slug] ||= []).push(item);
}

let grandWritten = 0;
for (const [cid, slugs] of Object.entries(target)) {
  for (const [slug, items] of Object.entries(slugs)) {
    const dir = path.join(BANKS, cid);
    const file = path.join(dir, slug + ".json");
    let existing = [];
    if (fs.existsSync(file)) {
      try { existing = JSON.parse(fs.readFileSync(file, "utf8")); } catch { existing = []; }
      if (!Array.isArray(existing)) existing = [];
    }
    const seen = new Set();
    for (const e of existing) {
      seen.add(e.id ? "id:" + e.id : "q:" + normQ(e.q));
    }
    const added = [];
    for (const it of items) {
      const key = it.id ? "id:" + it.id : "q:" + normQ(it.q);
      if (seen.has(key)) { stats.skippedDup++; continue; }
      seen.add(key);
      added.push(it);
    }
    if (added.length === 0) continue;
    const merged = existing.concat(added);
    stats.perFile[`${cid}/${slug}.json`] = { before: existing.length, added: added.length, after: merged.length };
    stats.byCountry[cid] = (stats.byCountry[cid] || 0) + added.length;
    grandWritten += added.length;
    if (WRITE) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(merged, null, 2) + "\n", "utf8");
    }
  }
}
stats.written = grandWritten;

console.log("\n=== قدها import " + (WRITE ? "(WRITE)" : "(DRY-RUN)") + " ===");
console.log("source questions:        ", stats.total);
console.log("written/added (unique):  ", stats.written);
console.log("skipped duplicate:       ", stats.skippedDup);
console.log("skipped bad country:     ", stats.skippedBadCountry);
console.log("skipped bad shape:       ", stats.skippedBadShape);
console.log("routed to fallback cat:  ", stats.fallbackCat, "(culture)");
console.log("\nadded per country:", JSON.stringify(stats.byCountry, null, 2));

const unmappedList = Object.entries(unmappedCats).sort((a, b) => b[1] - a[1]);
if (unmappedList.length) {
  console.log("\nUNMAPPED categories routed to '" + FALLBACK_SLUG + "':");
  for (const [c, n] of unmappedList) console.log("  " + n.toString().padStart(5) + "  " + c);
}
console.log("\nfiles touched:", Object.keys(stats.perFile).length);
if (!WRITE) console.log("\n(dry-run — no files written. add --write to apply)");
