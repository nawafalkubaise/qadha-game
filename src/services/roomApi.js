import { apiBase } from "./apiBase.js";

function roomUnavailableHint() {
  return "شغّل الخادم: `npm run dev` أو للإنتاج `npm run start:prod` ثم جرّب المنفذ 3001، أو `npm run dev:server` مع Vite.";
}

export async function createRoom() {
  const base = apiBase();
  let r;
  try {
    r = await fetch(`${base}/api/rooms`, { method: "POST", headers: { "Content-Type": "application/json" } });
  } catch {
    throw new Error(`createRoom network — ${roomUnavailableHint()}`);
  }
  if (!r.ok) {
    if (r.status === 502 || r.status === 503) {
      throw new Error(`createRoom ${r.status} — الخادم غير متصل على 127.0.0.1:3001. ${roomUnavailableHint()}`);
    }
    throw new Error(`createRoom ${r.status}`);
  }
  return r.json();
}

export async function joinRoom(code, displayName) {
  const base = apiBase();
  const c = String(code || "").toUpperCase().trim();
  let r;
  try {
    r = await fetch(`${base}/api/rooms/${encodeURIComponent(c)}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
  } catch {
    throw new Error(`joinRoom network — ${roomUnavailableHint()}`);
  }
  if (!r.ok) {
    if (r.status === 502 || r.status === 503) {
      throw new Error(`joinRoom ${r.status} — ${roomUnavailableHint()}`);
    }
    throw new Error(`joinRoom ${r.status}`);
  }
  return r.json();
}

export async function getRoom(code) {
  const base = apiBase();
  const c = String(code || "").toUpperCase().trim();
  let r;
  try {
    r = await fetch(`${base}/api/rooms/${encodeURIComponent(c)}`);
  } catch {
    throw new Error(`getRoom network — ${roomUnavailableHint()}`);
  }
  if (!r.ok) {
    if (r.status === 502 || r.status === 503) {
      throw new Error(`getRoom ${r.status} — ${roomUnavailableHint()}`);
    }
    throw new Error(`getRoom ${r.status}`);
  }
  return r.json();
}

export async function putRoomState(code, hostToken, body) {
  const base = apiBase();
  const c = String(code || "").toUpperCase().trim();
  let r;
  try {
    r = await fetch(`${base}/api/rooms/${encodeURIComponent(c)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`putRoom network — ${roomUnavailableHint()}`);
  }
  if (!r.ok) {
    if (r.status === 502 || r.status === 503) {
      throw new Error(`putRoom ${r.status} — ${roomUnavailableHint()}`);
    }
    const err = await r.json().catch(() => ({}));
    if (r.status === 409 && err.error) {
      throw new Error(String(err.error));
    }
    throw new Error(err.error || `putRoom ${r.status}`);
  }
  return r.json();
}

/** إشارة WebRTC (SDP / ICE) إلى لاعب محدد؛ `to` = معرّف اللاعب في الغرفة */
export async function postWebRtcSignal(code, bearerToken, body) {
  const base = apiBase();
  const c = String(code || "").toUpperCase().trim();
  let r;
  try {
    r = await fetch(`${base}/api/rooms/${encodeURIComponent(c)}/webrtc/signal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`postWebRtcSignal network — ${roomUnavailableHint()}`);
  }
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `postWebRtcSignal ${r.status}`);
  }
  return r.json();
}

export async function getWebRtcInbox(code, bearerToken) {
  const base = apiBase();
  const c = String(code || "").toUpperCase().trim();
  let r;
  try {
    r = await fetch(`${base}/api/rooms/${encodeURIComponent(c)}/webrtc/inbox`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
  } catch {
    throw new Error(`getWebRtcInbox network — ${roomUnavailableHint()}`);
  }
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `getWebRtcInbox ${r.status}`);
  }
  return r.json();
}
