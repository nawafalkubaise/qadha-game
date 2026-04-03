import { useCallback, useEffect, useRef, useState } from "react";
import { getRoom, postWebRtcSignal } from "../services/roomApi.js";
import { roomWsUrl } from "../services/roomWs.js";

/**
 * مزامنة فورية للغرفة + توصيل إشارات WebRTC عبر WebSocket، مع استطلاع خفيف احتياطي.
 */
export function useRoomChannel(code, token, enabled) {
  const [room, setRoom] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const signalListenersRef = useRef(new Set());

  const subscribeSignals = useCallback((fn) => {
    signalListenersRef.current.add(fn);
    return () => signalListenersRef.current.delete(fn);
  }, []);

  const sendSignal = useCallback(
    (to, msg) => {
      const w = wsRef.current;
      if (w?.readyState === 1) {
        try {
          w.send(JSON.stringify({ type: "signal", to, msg }));
          return;
        } catch {
          /* fall through */
        }
      }
      const c = String(code || "").toUpperCase().trim();
      if (c && token) void postWebRtcSignal(c, token, { to, msg }).catch(() => {});
    },
    [code, token],
  );

  useEffect(() => {
    if (!enabled || !code || !token) {
      const t = requestAnimationFrame(() => {
        setRoom(null);
        setConnected(false);
      });
      return () => cancelAnimationFrame(t);
    }
    const upper = String(code).toUpperCase().trim();
    let cancelled = false;
    let ws;
    let reconnectTimer = null;
    let attempt = 0;

    const emitSignal = (from, msg) => {
      for (const fn of signalListenersRef.current) {
        try {
          fn(from, msg);
        } catch {
          /* ignore */
        }
      }
    };

    const clearReconnect = () => {
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      clearReconnect();
      if (cancelled) return;
      const delay = Math.min(25000, 500 + attempt * 550);
      attempt = Math.min(attempt + 1, 10);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const fallbackPoll = setInterval(() => {
      if (cancelled || ws?.readyState === 1) return;
      void (async () => {
        try {
          const data = await getRoom(upper);
          if (!cancelled) setRoom(data);
        } catch {
          /* ignore */
        }
      })();
    }, 6500);

    function connect() {
      clearReconnect();
      if (cancelled) return;
      try {
        ws = new WebSocket(roomWsUrl());
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;
      ws.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        setConnected(true);
        try {
          ws.send(JSON.stringify({ type: "auth", code: upper, token }));
        } catch {
          /* ignore */
        }
      };
      ws.onmessage = (ev) => {
        if (cancelled) return;
        try {
          const d = JSON.parse(ev.data);
          if (d.type === "snapshot" && d.room) setRoom(d.room);
          if (d.type === "signal" && d.from != null && d.msg != null) emitSignal(String(d.from), d.msg);
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        if (wsRef.current === ws) wsRef.current = null;
        scheduleReconnect();
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    }

    void (async () => {
      try {
        const data = await getRoom(upper);
        if (!cancelled) setRoom(data);
      } catch {
        /* ignore */
      }
    })();

    connect();

    return () => {
      cancelled = true;
      clearReconnect();
      clearInterval(fallbackPoll);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      if (wsRef.current === ws) wsRef.current = null;
      setConnected(false);
    };
  }, [code, token, enabled]);

  return { room, connected, subscribeSignals, sendSignal };
}
