import express from "express";
import cors from "cors";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import { questionFingerprint, isValidQuestion, normalizeForDedup } from "./lib/dedup.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, "data", "store.json");
/** QADHA_SERVER_PORT يتقدّم على PORT (Railway / Render / Fly تضيف غالباً PORT) */
const PORT = Number(process.env.QADHA_SERVER_PORT || process.env.PORT || 3001);
const ADMIN_KEY = (process.env.QADHA_ADMIN_KEY || "").trim();
const DIST_DIR = path.resolve(
  process.env.QADHA_DIST_DIR || path.join(__dirname, "..", "dist"),
);
const EXTRA_CORS_ORIGINS = (process.env.QADHA_CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function loadStore() {
  const raw = fs.readFileSync(STORE_PATH, "utf8");
  return JSON.parse(raw);
}

function saveStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function randomCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return s;
}

function randomToken() {
  return crypto.randomBytes(24).toString("hex");
}

/** @type {Map<string, object>} */
const rooms = new Map();

function getRoom(code) {
  const c = String(code || "").toUpperCase().trim();
  return rooms.get(c) || null;
}

const SIGNAL_QUEUE_CAP = 120;

function ensureSignalInbox(room, playerId) {
  if (!room.signalInbox || typeof room.signalInbox !== "object") room.signalInbox = {};
  const id = String(playerId);
  if (!Array.isArray(room.signalInbox[id])) room.signalInbox[id] = [];
}

function pushSignal(room, targetPlayerId, entry) {
  ensureSignalInbox(room, targetPlayerId);
  const q = room.signalInbox[targetPlayerId];
  q.push(entry);
  while (q.length > SIGNAL_QUEUE_CAP) q.shift();
}

/** يحلّ الرمز إلى { id } للمضيف (hostToken) أو الضيف (playerToken) */
function resolveSignalingPlayer(room, authHeader) {
  const token = String(authHeader || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return null;
  if (token === room.hostToken) {
    const hostP = room.players.find((p) => p.isHost);
    return { id: hostP ? hostP.id : "host" };
  }
  const p = room.players.find((x) => x.playerToken === token);
  if (!p) return null;
  return { id: p.id };
}

function roomSnapshot(room) {
  return {
    code: room.code,
    rev: room.rev,
    players: room.players.map((p) => ({ id: p.id, name: p.name, isHost: !!p.isHost })),
    gameState: room.gameState,
  };
}

function broadcastRoom(room) {
  if (!room.wsClients?.size) return;
  const payload = JSON.stringify({ type: "snapshot", room: roomSnapshot(room) });
  for (const client of room.wsClients) {
    if (client.readyState === 1) client.send(payload);
  }
}

function deliverWsSignals(room, targetPlayerId, entry) {
  if (!room.wsClients?.size) return;
  const payload = JSON.stringify({ type: "signal", from: entry.from, msg: entry.msg });
  for (const client of room.wsClients) {
    if (client.playerId === targetPlayerId && client.readyState === 1) client.send(payload);
  }
}

function ensureWsClients(room) {
  if (!room.wsClients) room.wsClients = new Set();
}

const app = express();
if (process.env.QADHA_TRUST_PROXY === "1" || process.env.QADHA_TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

/** يسمح للواجهة على localhost بالاتصال مباشرة بـ :3001 (مثلاً vite وحده + خادم في طرفية أخرى) */
function corsAllowedOrigin(origin) {
  if (!origin) return true;
  if (EXTRA_CORS_ORIGINS.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    /* واجهة التطوير من جهاز آخر على نفس الشبكة (مثلاً جوال ← Vite على 192.168.x.x) */
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    /* نفق عام (جوال من أي مكان) — أسماء شائعة لخدمات التطوير */
    const h = hostname.toLowerCase();
    if (
      h.endsWith(".ngrok-free.app") ||
      h.endsWith(".ngrok.io") ||
      h.endsWith(".trycloudflare.com") ||
      h.endsWith(".loca.lt") ||
      h.endsWith(".localtunnel.me") ||
      h.endsWith(".localhost.run") ||
      h.endsWith(".devtunnels.ms")
    )
      return true;
  } catch {
    return false;
  }
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (corsAllowedOrigin(origin)) return callback(null, true);
      callback(null, false);
    },
  }),
);
app.use(express.json({ limit: "512kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "qadha-game-server" });
});

app.get("/api/content/manifest", (_req, res) => {
  try {
    const store = loadStore();
    res.json({
      contentVersion: store.contentVersion ?? 1,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: "store_read_failed", message: String(e?.message || e) });
  }
});

app.get("/api/content/overlay", (_req, res) => {
  try {
    const store = loadStore();
    res.json({
      contentVersion: store.contentVersion ?? 1,
      overlay: store.overlay || {},
    });
  } catch (e) {
    res.status(500).json({ error: "store_read_failed", message: String(e?.message || e) });
  }
});

/**
 * إضافة أسئلة مع منع التكرار (بصمة نصية + خيارات)
 * Header: x-admin-key أو Authorization: Bearer <key>
 */
app.post("/api/content/questions", (req, res) => {
  const key = (req.headers["x-admin-key"] || "").trim() || (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    res.status(401).json({ error: "unauthorized", hint: "Set QADHA_ADMIN_KEY on server and send x-admin-key" });
    return;
  }
  const { countryId, categoryId, questions } = req.body || {};
  if (!countryId || !categoryId || !Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: "bad_request", need: ["countryId", "categoryId", "questions[]"] });
    return;
  }
  try {
    const store = loadStore();
    if (!store.overlay) store.overlay = {};
    if (!store.overlay[countryId]) store.overlay[countryId] = {};
    if (!Array.isArray(store.overlay[countryId][categoryId])) store.overlay[countryId][categoryId] = [];
    if (!store.fingerprints || typeof store.fingerprints !== "object") store.fingerprints = {};

    const added = [];
    const skipped = [];
    for (const q of questions) {
      if (!isValidQuestion(q)) {
        skipped.push({ reason: "invalid_shape", preview: String(q?.q).slice(0, 40) });
        continue;
      }
      const fp = questionFingerprint(q);
      if (store.fingerprints[fp]) {
        skipped.push({ reason: "duplicate", fingerprint: fp, preview: normalizeForDedup(q.q).slice(0, 60) });
        continue;
      }
      store.fingerprints[fp] = { countryId, categoryId, at: new Date().toISOString() };
      store.overlay[countryId][categoryId].push({ q: q.q.trim(), o: q.o.map((x) => String(x).trim()), a: q.a });
      added.push(fp);
    }
    store.contentVersion = (store.contentVersion ?? 1) + 1;
    saveStore(store);
    res.json({
      contentVersion: store.contentVersion,
      added: added.length,
      skipped,
      fingerprints: added,
    });
  } catch (e) {
    res.status(500).json({ error: "store_write_failed", message: String(e?.message || e) });
  }
});

app.post("/api/rooms", (_req, res) => {
  let code = randomCode(6);
  let tries = 0;
  while (rooms.has(code) && tries++ < 20) code = randomCode(6);
  if (rooms.has(code)) {
    res.status(500).json({ error: "code_generation_failed" });
    return;
  }
  const hostToken = randomToken();
  const room = {
    code,
    hostToken,
    rev: 0,
    createdAt: Date.now(),
    players: [{ id: "host", name: "المضيف", isHost: true }],
    gameState: null,
    signalInbox: { host: [] },
    wsClients: new Set(),
  };
  rooms.set(code, room);
  res.json({ code, hostToken, role: "host" });
});

app.post("/api/rooms/:code/join", (req, res) => {
  const code = String(req.params.code || "").toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ error: "room_not_found" });
    return;
  }
  const name = String(req.body?.displayName || "لاعب").trim().slice(0, 32) || "لاعب";
  const playerId = randomToken().slice(0, 12);
  const playerToken = randomToken();
  room.players.push({ id: playerId, name, isHost: false, playerToken });
  ensureSignalInbox(room, playerId);
  ensureWsClients(room);
  room.rev += 1;
  broadcastRoom(room);
  res.json({ code, playerId, playerToken, role: "guest" });
});

/** WebRTC: إشارات SDP/ICE بين اللاعبين (Bearer = hostToken أو playerToken) */
app.post("/api/rooms/:code/webrtc/signal", (req, res) => {
  const code = String(req.params.code || "").toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ error: "room_not_found" });
    return;
  }
  const sender = resolveSignalingPlayer(room, req.headers.authorization);
  if (!sender) {
    res.status(403).json({ error: "bad_token" });
    return;
  }
  const toRaw = req.body?.to;
  const msg = req.body?.msg;
  if (!msg || typeof msg !== "object") {
    res.status(400).json({ error: "need_msg" });
    return;
  }
  const ids = new Set(room.players.map((p) => p.id));
  const entry = { from: sender.id, msg };
  if (toRaw == null) {
    for (const p of room.players) {
      if (p.id !== sender.id) {
        pushSignal(room, p.id, entry);
        deliverWsSignals(room, p.id, entry);
      }
    }
  } else {
    const to = String(toRaw);
    if (!ids.has(to) || to === sender.id) {
      res.status(400).json({ error: "bad_to" });
      return;
    }
    pushSignal(room, to, entry);
    deliverWsSignals(room, to, entry);
  }
  /* لا نغيّر room.rev هنا حتى لا يتعارض مع clientRev عند المضيف */
  res.json({ ok: true });
});

app.get("/api/rooms/:code/webrtc/inbox", (req, res) => {
  const code = String(req.params.code || "").toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ error: "room_not_found" });
    return;
  }
  const player = resolveSignalingPlayer(room, req.headers.authorization);
  if (!player) {
    res.status(403).json({ error: "bad_token" });
    return;
  }
  ensureSignalInbox(room, player.id);
  const messages = room.signalInbox[player.id].splice(0, room.signalInbox[player.id].length);
  res.json({ ok: true, messages });
});

app.get("/api/rooms/:code", (req, res) => {
  const code = String(req.params.code || "").toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ error: "room_not_found" });
    return;
  }
  res.json({
    code: room.code,
    rev: room.rev,
    players: room.players.map((p) => ({ id: p.id, name: p.name, isHost: !!p.isHost })),
    gameState: room.gameState,
  });
});

app.put("/api/rooms/:code", (req, res) => {
  const code = String(req.params.code || "").toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ error: "room_not_found" });
    return;
  }
  const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!auth || auth !== room.hostToken) {
    res.status(403).json({ error: "host_only" });
    return;
  }
  const clientRev = req.body?.clientRev;
  if (typeof clientRev === "number" && clientRev !== room.rev) {
    res.status(409).json({ error: "rev_conflict", serverRev: room.rev });
    return;
  }
  if ("gameState" in req.body) {
    room.gameState = req.body.gameState;
  }
  room.rev += 1;
  broadcastRoom(room);
  res.json({ ok: true, rev: room.rev });
});

let distReady = false;
try {
  distReady = fs.statSync(path.join(DIST_DIR, "index.html")).isFile();
} catch {
  distReady = false;
}
if (distReady) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(DIST_DIR, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

const server = http.createServer(app);

/* مسار منفصل عن `/api/rooms/:code` حتى لا يُفسَّر `ws` ككود غرفة */
const wss = new WebSocketServer({ server, path: "/api/realtime/room" });

wss.on("connection", (ws) => {
  ws.authed = false;
  const authTimer = setTimeout(() => {
    if (!ws.authed) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  }, 12000);

  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      return;
    }
    if (!ws.authed) {
      if (data.type !== "auth" || !data.code || !data.token) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
      const room = getRoom(data.code);
      const player = room && resolveSignalingPlayer(room, `Bearer ${data.token}`);
      if (!room || !player) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
      clearTimeout(authTimer);
      ws.authed = true;
      ws.roomCode = room.code;
      ws.playerId = player.id;
      ensureWsClients(room);
      room.wsClients.add(ws);
      try {
        ws.send(JSON.stringify({ type: "snapshot", room: roomSnapshot(room) }));
      } catch {
        /* ignore */
      }
      return;
    }
    if (data.type !== "signal" || data.msg == null || typeof data.msg !== "object") return;
    const room = getRoom(ws.roomCode);
    if (!room || !ws.playerId) return;
    const ids = new Set(room.players.map((p) => p.id));
    const toRaw = data.to;
    const msg = data.msg;
    const entry = { from: ws.playerId, msg };
    if (toRaw == null) {
      for (const p of room.players) {
        if (p.id !== ws.playerId) {
          pushSignal(room, p.id, entry);
          deliverWsSignals(room, p.id, entry);
        }
      }
      return;
    }
    const to = String(toRaw);
    if (!ids.has(to) || to === ws.playerId) return;
    pushSignal(room, to, entry);
    deliverWsSignals(room, to, entry);
  });

  ws.on("close", () => {
    clearTimeout(authTimer);
    const room = ws.roomCode ? getRoom(ws.roomCode) : null;
    if (room?.wsClients) room.wsClients.delete(ws);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`qadha-game-server http://127.0.0.1:${PORT} (كل الواجهات على المنفذ ${PORT})`);
  if (distReady) {
    console.log(`[qadha] واجهة الإنتاج من ${DIST_DIR} — نفس المنفذ للّعب أونلاين`);
  } else {
    console.log(
      "[qadha] لا يوجد dist/index.html — شغّل `npm run build` لخدمة الواجهة من هذا المنفذ، أو استخدم Vite منفصلاً",
    );
  }
  if (!ADMIN_KEY) console.warn("[qadha] QADHA_ADMIN_KEY not set — POST /api/content/questions disabled until set");
});
