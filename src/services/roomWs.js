import { apiBase } from "./apiBase.js";

/** عنوان WebSocket لغرف اللعب (نفس المنفذ/البروكسي الذي يخدم REST). */
export function roomWsUrl() {
  const raw = String(apiBase() || "").replace(/\/$/, "");
  if (typeof globalThis !== "undefined" && globalThis.location?.host) {
    if (!raw || !/^https?:\/\//i.test(raw)) {
      const proto = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${globalThis.location.host}/api/realtime/room`;
    }
  }
  if (/^https:\/\//i.test(raw)) return `wss://${raw.slice(8)}/api/realtime/room`;
  if (/^http:\/\//i.test(raw)) return `ws://${raw.slice(7)}/api/realtime/room`;
  if (typeof globalThis !== "undefined" && globalThis.location?.host) {
    const proto = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${globalThis.location.host}/api/realtime/room`;
  }
  return "ws://127.0.0.1:3001/api/realtime/room";
}
