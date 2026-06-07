/**
 * تصنيف "نوع/مجال" الإجابة بدقّة أعلى من فاحص الجودة الأصلي،
 * لاكتشاف المشتتات التي "لا علاقة لها بالسؤال" (نوعها مختلف عن الإجابة الصحيحة).
 * المطابقة على مستوى الكلمات (لا substring) لتجنّب الإيجابيات الكاذبة
 * (مثل "ين" داخل "ديناصورات" أو "عام" داخل "طعام").
 */
const toW = (s) => String(s).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "ابريل", "مايو", "يونيو", "يوليو", "أغسطس", "اغسطس", "سبتمبر", "أكتوبر", "اكتوبر", "نوفمبر", "ديسمبر", "محرم", "صفر", "رجب", "شعبان", "رمضان", "شوال"];
const UNITS = ["كم", "كيلومتر", "كيلومتراً", "متر", "متراً", "أمتار", "سم", "ملم", "درجة", "درجات", "كجم", "كغم", "كيلو", "جرام", "طن", "لتر", "نقطة", "نقاط", "سنة", "سنوات", "عام", "أعوام", "يوم", "أيام", "ساعة", "دقيقة", "هكتار", "ميل"];
const CURR = ["دينار", "دنانير", "ريال", "ريالات", "دولار", "دولارات", "درهم", "دراهم", "يورو", "روبية", "جنيه", "ليرة", "فرنك", "روبل"];
const SCALE = ["مليون", "مليارات", "مليار", "ألف", "الف", "آلاف", "تريليون"];

function words(s) {
  return String(s).split(/[\s،,.()«»"'\-/]+/).filter(Boolean).map((w) => w.replace(/^(ال|بال|لل|وال)/, ""));
}
// كلمة موجودة كاملة (بعد تجريد أل التعريف) أو جذر يبدأ به التوكن (للجمع/التنوين)
function hasWord(toks, list) {
  return toks.some((t) => list.some((w) => t === w || (w.length >= 4 && t.startsWith(w))));
}

export function answerKind(raw) {
  const s = toW(String(raw || "").trim());
  if (!s) return "empty";
  const hasLatin = /[A-Za-z]/.test(s);
  const hasDigit = /[0-9]/.test(s);
  const toks = words(s);
  const wc = toks.length;

  // صيغة كيميائية: لاتيني + أرقام بدون مسافات (CO2, H2O, KClO3, C6H6)
  if (hasLatin && /^[A-Za-z0-9()⁺⁻+\-]+$/.test(s) && /([A-Za-z][0-9]|[0-9][A-Za-z])/.test(s)) return "formula";
  // رمز قصير: لاتيني كلمة واحدة قصيرة (DXB) أو رمز اتصال (+971)
  if ((hasLatin && wc === 1 && s.replace(/[^A-Za-z]/g, "").length <= 5) || /^[+]\d{2,4}$/.test(s)) return "code";

  if (/%/.test(s)) return "percent";
  if (hasWord(toks, CURR)) return "money";
  if (hasDigit && hasWord(toks, MONTHS)) return "date";
  // سنة: 3-4 أرقام تمثّل سنة، ربما بلاحقة م/هـ، دون وحدات/عملات
  if (/^\D{0,4}(1[0-9]{3}|20[0-9]{2}|[0-9]{3,4})\s*(م|هـ|ميلادي|هجري|ق\.?م)?\D{0,4}$/.test(s) && !hasWord(toks, UNITS)) return "year";
  if (hasDigit && (hasWord(toks, UNITS) || hasWord(toks, SCALE) || /°/.test(s))) return "measure";
  if (hasDigit && /^[0-9.,٬٫\s]+$/.test(s)) return "count";
  if (hasDigit) return "numlike"; // رقم مدموج بنص

  if (hasLatin) return wc <= 2 ? "latin-short" : "latin-phrase";
  return wc <= 2 ? "ar-short" : "ar-phrase";
}

// أنواع تُعدّ متوافقة (لا تُعتبر "خارج الموضوع" مع بعضها)
const COMPAT = [
  ["ar-short", "ar-phrase"],
  ["count", "numlike"],
];
export function kindsCompatible(a, b) {
  if (a === b) return true;
  return COMPAT.some((g) => g.includes(a) && g.includes(b));
}
