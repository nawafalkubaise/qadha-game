/**
 * توليد مشتتات ذكية "من نفس النوع" للأنواع المنظَّمة (أرقام، عملات، سنوات، نِسَب، مقاييس).
 * يُستخدم قبل اللجوء إلى مجمّع البنك، لأن التوليد العددي يعطي مشتتات معقولة دائماً
 * (سنوات قريبة، نِسَب قريبة، نفس الوحدة) بدل سحب قيمة عشوائية من فئة أخرى.
 */
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toEnDigits = (s) => String(s).replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d));
const isArabicDigits = (s) => /[٠-٩]/.test(s);
const toArDigits = (s) => String(s).replace(/[0-9]/g, (d) => AR_DIGITS[+d]);

// عملات حقيقية للتوليد عند سؤال نوعه "money" (نحافظ على صيغة "الـ X الـ Y")
const CURRENCIES = [
  "الدينار الكويتي", "الريال السعودي", "الدرهم الإماراتي", "الدينار البحريني",
  "الريال القطري", "الريال العماني", "الدولار الأمريكي", "اليورو",
  "الجنيه الإسترليني", "الجنيه المصري", "الين الياباني", "الروبية الهندية",
  "الليرة التركية", "الفرنك السويسري", "الدينار العراقي", "الدينار الأردني",
];

function parseLeadingNumber(s) {
  const en = toEnDigits(s);
  const m = en.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  return { num: parseFloat(m[0].replace(",", ".")), raw: m[0], index: m.index };
}

// يستبدل أول رقم في النص مع الحفاظ على نوع الأرقام (عربية/لاتينية) واللاحقة
function replaceFirstNumber(original, newNum, { integer } = {}) {
  const arabic = isArabicDigits(original);
  const en = toEnDigits(original);
  const m = en.match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  let numStr;
  if (integer || Number.isInteger(newNum)) numStr = String(Math.max(0, Math.round(newNum)));
  else numStr = String(+newNum.toFixed(2));
  if (arabic) numStr = toArDigits(numStr);
  return original.slice(0, m.index) + numStr + original.slice(m.index + m[0].length);
}

function nearbyNumbers(n, count = 6) {
  const out = new Set();
  const mag = Math.abs(n);
  // عوامل تغيير نسبية + إزاحات صغيرة، مع تفضيل قيم "مرتبة"
  const deltas = mag >= 1000 ? [-0.3, -0.15, 0.15, 0.3, 0.5, -0.5]
    : mag >= 100 ? [-0.25, -0.1, 0.1, 0.25, 0.4, -0.4]
    : mag >= 20 ? [-0.4, -0.2, 0.2, 0.4, 0.6, -0.6]
    : [-3, -2, -1, 1, 2, 3, 4];
  for (const d of deltas) {
    let v = mag >= 20 ? Math.round(n * (1 + d)) : n + d;
    if (v !== n && v > 0) out.add(v);
    if (out.size >= count) break;
  }
  // ضمان وجود ما يكفي
  let k = 1;
  while (out.size < count) { if (n + k > 0 && n + k !== n) out.add(n + k); out.add(Math.max(1, n - k)); k++; if (k > 50) break; }
  return [...out].filter((v) => v !== n).slice(0, count);
}

/**
 * يولّد مشتتات لنوع منظَّم. يرجّع مصفوفة قيم نصية (قد تكون فارغة لو النوع غير مدعوم).
 * @param correct القيمة الصحيحة (نص)
 * @param kind نوع answerKind
 */
export function generateStructured(correct, kind) {
  const s = String(correct).trim();
  switch (kind) {
    case "money": {
      // مشتتات = عملات أخرى مختلفة عن الصحيحة
      const cn = s.replace(/\s+/g, "");
      return CURRENCIES.filter((c) => c.replace(/\s+/g, "") !== cn);
    }
    case "year": {
      const p = parseLeadingNumber(s);
      if (!p) return [];
      const y = Math.round(p.num);
      const offs = [-2, -1, 1, 2, 3, -3, 5, -5, 10, -10];
      const seen = new Set();
      const out = [];
      for (const o of offs) {
        const ny = y + o;
        if (ny <= 0 || ny === y || seen.has(ny)) continue;
        seen.add(ny);
        const v = replaceFirstNumber(s, ny, { integer: true });
        if (v) out.push(v);
      }
      return out;
    }
    case "percent": {
      const p = parseLeadingNumber(s);
      if (!p) return [];
      return nearbyNumbers(p.num, 8).map((v) => replaceFirstNumber(s, Math.min(100, v))).filter(Boolean);
    }
    case "measure":
    case "count": {
      // ملاحظة: "numlike" (رقم مدموج بنص) غير مدعوم عمداً — قد يكون النص هو الإجابة لا الرقم
      const p = parseLeadingNumber(s);
      if (!p) return [];
      const integer = Number.isInteger(p.num) && !/[.,]/.test(p.raw);
      return nearbyNumbers(p.num, 8).map((v) => replaceFirstNumber(s, v, { integer })).filter(Boolean);
    }
    default:
      return [];
  }
}

export const CURRENCY_LIST = CURRENCIES;
