/** تكامل اختياري مع [سين جيم](https://seenjeemkw.com/start-game): بيانات فقط (فئات/أسئلة/غلاف). تصميم وألوان وبنية اللعبة تبقى كما في «قدها؟». */

export const SEENJEEM_KW_COUNTRY_ID = "653c8fff18da2c44f651f323";

const devBase = () => (import.meta.env.DEV ? "/api/seenjeem" : "");

function colorFromId(id) {
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 62% 52%)`;
}

export function mapSeenJeemCategoryToGame(item) {
  const id = item.id;
  const cover = item.coverImage || item.image || "";
  return {
    id: `sj_${id}`,
    n: item.name || "Pack",
    ar: item.name || "حزمة",
    icon: "🎯",
    c: colorFromId(id),
    sjRemoteId: id,
    sjCountries: Array.isArray(item.countries) ? item.countries : [],
    /** صورة الغلاف من الـ API — تُعرض داخل بطاقات «قدها؟» فقط */
    sjCover: typeof cover === "string" && cover.startsWith("http") ? cover : "",
  };
}

export async function fetchSeenJeemCategoryList() {
  const base = devBase();
  if (!base) return [];
  try {
    const r = await fetch(`${base}/user/game-category/list?countryId=&name=`);
    if (!r.ok) return [];
    const j = await r.json();
    const arr = j?.data?.categoryData;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && x.status === "ACTIVE" && x.name)
      .map(mapSeenJeemCategoryToGame);
  } catch {
    return [];
  }
}

function extractQuestionsPayload(json) {
  if (!json || typeof json !== "object") return [];
  const d = json.data;
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.questions)) return d.questions;
  if (d && Array.isArray(d.list)) return d.list;
  if (d && Array.isArray(d.items)) return d.items;
  if (Array.isArray(json.questions)) return json.questions;
  return [];
}

export function normalizeSeenJeemQuestion(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.q && Array.isArray(raw.o) && raw.o.length >= 4 && typeof raw.a === "number") {
    return {
      q: String(raw.q),
      o: raw.o.slice(0, 4).map(String),
      a: Math.min(3, Math.max(0, raw.a)),
    };
  }
  const g = raw.GamesQuestion || raw.gamesQuestion || raw.gameQuestion || raw;
  const text =
    g.questionText ||
    g.questionAr ||
    g.questionEn ||
    g.question ||
    g.title ||
    g.name ||
    raw.questionText ||
    raw.question;
  if (!text || String(text).trim().length < 2) return null;

  const opts = [];
  const pushOpt = (v) => {
    if (v != null && String(v).trim()) opts.push(String(v).trim());
  };

  if (Array.isArray(g.options) && g.options.length) {
    for (const o of g.options) {
      if (typeof o === "string") pushOpt(o);
      else if (o && typeof o === "object") pushOpt(o.text ?? o.label ?? o.value ?? o.answer);
    }
  }

  const tryGroups = [
    ["option1", "option2", "option3", "option4"],
    ["answer1", "answer2", "answer3", "answer4"],
    ["choice1", "choice2", "choice3", "choice4"],
  ];
  if (opts.length < 4) {
    for (const group of tryGroups) {
      const acc = [];
      for (const key of group) {
        const v = g[key] ?? raw[key];
        if (v != null && String(v).trim()) acc.push(String(v).trim());
      }
      if (acc.length >= 4) {
        opts.length = 0;
        acc.slice(0, 4).forEach((x) => opts.push(x));
        break;
      }
    }
  }

  const w1 = g.wrongAnswer1 ?? raw.wrongAnswer1;
  const w2 = g.wrongAnswer2 ?? raw.wrongAnswer2;
  const w3 = g.wrongAnswer3 ?? raw.wrongAnswer3;
  const rgt = g.rightAnswer ?? g.correctAnswer ?? raw.rightAnswer ?? raw.correctAnswer;
  if (opts.length < 4 && w1 && w2 && w3 && rgt) {
    opts.length = 0;
    [w1, w2, w3, rgt].forEach((x) => pushOpt(x));
  }

  if (opts.length < 4) {
    for (let i = 1; i <= 6 && opts.length < 4; i++) {
      pushOpt(g[`option${i}`] ?? raw[`option${i}`]);
    }
  }

  if (opts.length < 4) return null;
  const four = opts.slice(0, 4);

  let a = 0;
  if (typeof g.correctIndex === "number") a = g.correctIndex;
  else if (typeof raw.correctIndex === "number") a = raw.correctIndex;
  else if (typeof g.correctOption === "number") a = g.correctOption - 1;
  else if (typeof g.answerIndex === "number") a = g.answerIndex;

  const rightStr = (rgt ?? g.answer ?? "").toString().trim();
  if (rightStr) {
    const idx = four.findIndex((x) => x === rightStr);
    if (idx >= 0) a = idx;
  }

  a = Math.min(3, Math.max(0, a));
  return { q: String(text).trim(), o: four, a };
}

export async function fetchSeenJeemQuestionsForCategory(remoteId) {
  const base = devBase();
  if (!base || !remoteId) return [];
  try {
    const url = `${base}/user/game/questions-list/${encodeURIComponent(remoteId)}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const json = await r.json();
    const items = extractQuestionsPayload(json);
    const out = [];
    for (const item of items) {
      const nq = normalizeSeenJeemQuestion(item);
      if (nq) out.push(nq);
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchSeenJeemPackQuestions(selCats) {
  const result = {};
  await Promise.all(
    selCats.map(async (cat) => {
      const rid = cat.sjRemoteId || (String(cat.id).startsWith("sj_") ? cat.id.slice(3) : null);
      if (!rid) return;
      const qs = await fetchSeenJeemQuestionsForCategory(rid);
      result[cat.id] = qs;
    }),
  );
  return result;
}

export function isSeenJeemDevProxyAvailable() {
  return import.meta.env.DEV === true;
}
