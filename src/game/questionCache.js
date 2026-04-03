/** كاش الأسئلة المحلي — يُفصل عن Qadha.jsx لتسهيل الأونلاين والـ API لاحقاً */

export function loadCache() {
  try {
    const d = localStorage.getItem("qadha_qcache");
    return d ? JSON.parse(d) : {};
  } catch {
    return {};
  }
}

export function saveCache(c) {
  try {
    localStorage.setItem("qadha_qcache", JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

export function loadSeen() {
  try {
    const d = localStorage.getItem("qadha_seen");
    return d ? new Set(JSON.parse(d)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveSeen(s) {
  try {
    localStorage.setItem("qadha_seen", JSON.stringify([...s].slice(-2000)));
  } catch {
    /* ignore */
  }
}

/** مطابقة خفيفة مع الخادم — للعرض السريع؛ السيرفر يستخدم بصمة أقوى */
export function qHash(q) {
  return (q.q || "").substring(0, 40);
}

export function getCacheCount() {
  const c = loadCache();
  let t = 0;
  Object.values(c).forEach((v) => (t += v.length));
  return t;
}

export function clearQuestionCachesFromStorage() {
  try {
    localStorage.removeItem("qadha_qcache");
    localStorage.removeItem("qadha_seen");
  } catch {
    /* ignore */
  }
}
