import { useState } from "react";
import { createRoom, joinRoom } from "../services/roomApi.js";
import { useRoomChannel } from "../hooks/useRoomChannel.js";

const HOST_KEY = "qadha_room_host";

export default function OnlineLobby({ th, onBack, onStartGame }) {
  const [tab, setTab] = useState("create");
  const [code, setCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [hostToken, setHostToken] = useState(() => {
    try {
      return sessionStorage.getItem(HOST_KEY) || "";
    } catch {
      return "";
    }
  });
  const [joinCreds, setJoinCreds] = useState(null);

  const wsToken = hostToken || joinCreds?.playerToken || "";
  const channelEnabled = Boolean(code && wsToken);
  const { room: liveRoom, connected } = useRoomChannel(code, wsToken, channelEnabled);

  const handleCreate = async () => {
    setErr("");
    try {
      const data = await createRoom();
      setCode(data.code);
      setHostToken(data.hostToken);
      setJoinCreds(null);
      try {
        sessionStorage.setItem(HOST_KEY, data.hostToken);
      } catch {
        /* ignore */
      }
    } catch {
      setErr(`تعذر إنشاء الغرفة. تحقق من الاتصال ثم أعد المحاولة.`);
    }
  };

  const handleJoin = async () => {
    setErr("");
    const c = joinInput.toUpperCase().trim();
    if (c.length < 4) {
      setErr("أدخل كود الغرفة");
      return;
    }
    const playerName = name.trim();
    if (playerName.length < 2) {
      setErr("اكتب اسمك (حرفين على الأقل)");
      return;
    }
    try {
      const jr = await joinRoom(c, playerName);
      setCode(c);
      setHostToken("");
      setJoinCreds({ playerId: jr.playerId, playerToken: jr.playerToken });
      try {
        sessionStorage.removeItem(HOST_KEY);
      } catch {
        /* ignore */
      }
    } catch {
      setErr("تعذر الدخول. تحقق من الكود.");
    }
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: "min(100dvh, 100svh)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding:
          "max(16px, env(safe-area-inset-top)) max(22px, env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px)) max(28px, env(safe-area-inset-bottom))",
        boxSizing: "border-box",
        background: th.bg,
        color: th.text,
        direction: "rtl",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: th.card,
          border: `1px solid ${th.cardBd}`,
          borderRadius: 20,
          padding: 22,
        }}
      >
        <h2 style={{ fontFamily: "'Tajawal',sans-serif", fontSize: 22, color: th.accent, marginBottom: 8, textAlign: "center" }}>
          اللعب الجماعي عبر الشبكة
        </h2>
        <p style={{ fontSize: 13, color: th.textDim, textAlign: "center", lineHeight: 1.55, marginBottom: 18 }}>
          شارك كود الغرفة مع من تلعب معه، ثم اضغط متابعة لاختيار الدولة والثمان فئات.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["create", "join"].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTab(k);
                setErr("");
              }}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 14,
                border: `2px solid ${tab === k ? th.accent : th.cardBd}`,
                background: tab === k ? `rgba(${th.accentRgb},.18)` : th.gridCell,
                color: tab === k ? th.accent : th.textDim,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "'Tajawal',sans-serif",
              }}
            >
              {k === "create" ? "إنشاء غرفة" : "الدخول"}
            </button>
          ))}
        </div>

        {tab === "create" && !code && (
          <button
            type="button"
            onClick={handleCreate}
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 14,
              border: `2px solid ${th.accent}`,
              background: th.btnBg,
              color: th.btnText,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "'Tajawal',sans-serif",
            }}
          >
            إنشاء غرفة
          </button>
        )}

        {tab === "join" && !code && (
          <>
            <input
              className="inp"
              placeholder="اسمك"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: "100%",
                marginBottom: 10,
                padding: 14,
                borderRadius: 14,
                border: `1px solid ${th.inputBd}`,
                background: th.input,
                color: th.text,
                fontSize: 16,
                boxSizing: "border-box",
              }}
            />
            <input
              className="inp"
              placeholder="كود الغرفة"
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
              style={{
                width: "100%",
                marginBottom: 12,
                padding: 14,
                borderRadius: 14,
                border: `1px solid ${th.inputBd}`,
                background: th.input,
                color: th.text,
                fontSize: 18,
                letterSpacing: 4,
                textAlign: "center",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={handleJoin}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 14,
                border: `2px solid ${th.accent}`,
                background: th.btnBg,
                color: th.btnText,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "'Tajawal',sans-serif",
              }}
            >
              دخول
            </button>
          </>
        )}

        {code && !liveRoom && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: 4,
                color: th.accent,
                fontFamily: "'Tajawal',sans-serif",
                marginBottom: 8,
              }}
            >
              {code}
            </div>
            <p style={{ fontSize: 14, color: th.textDim }}>جاري التحميل…</p>
          </div>
        )}

        {code && liveRoom && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                textAlign: "center",
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: 6,
                color: th.accent,
                marginBottom: 4,
                fontFamily: "'Tajawal',sans-serif",
              }}
            >
              {liveRoom.code}
            </div>
            <p style={{ textAlign: "center", fontSize: 11, color: connected ? "#4ADE80" : th.textDim2, marginBottom: 12 }}>
              {connected ? "● متصل" : "○ جاري الاتصال…"}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px" }}>
              {liveRoom.players.map((p) => (
                <li
                  key={p.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: th.gridCell,
                    marginBottom: 6,
                    fontSize: 14,
                  }}
                >
                  {p.name}
                </li>
              ))}
            </ul>
            {Boolean(hostToken) && liveRoom.players.length < 2 && (
              <p style={{ textAlign: "center", fontSize: 12, color: th.textDim, marginBottom: 8 }}>
                انتظر دخول لاعب واحد على الأقل قبل المتابعة.
              </p>
            )}
            {typeof onStartGame === "function" && (
              <button
                type="button"
                onClick={() => {
                  onStartGame({
                    code: liveRoom.code,
                    isHost: Boolean(hostToken),
                    hostToken: hostToken || null,
                    playerId: hostToken ? "host" : joinCreds?.playerId || null,
                    voiceToken: hostToken || joinCreds?.playerToken || null,
                  });
                }}
                disabled={Boolean(hostToken) && liveRoom.players.length < 2}
                style={{
                  width: "100%",
                  marginTop: 14,
                  padding: 16,
                  borderRadius: 14,
                  border: `2px solid ${th.accent}`,
                  background: th.btnBg,
                  color: th.btnText,
                  fontWeight: 800,
                  cursor: "pointer",
                  opacity: Boolean(hostToken) && liveRoom.players.length < 2 ? 0.5 : 1,
                  fontFamily: "'Tajawal',sans-serif",
                  fontSize: 15,
                }}
              >
                متابعة
              </button>
            )}
          </div>
        )}

        {err && (
          <p style={{ color: "#F87171", fontSize: 13, marginTop: 14, textAlign: "center", lineHeight: 1.45 }}>{err}</p>
        )}

        <button
          type="button"
          onClick={() => {
            setCode("");
            setErr("");
            onBack();
          }}
          style={{
            width: "100%",
            marginTop: 18,
            padding: 14,
            borderRadius: 14,
            border: `1px solid ${th.accentDim}`,
            background: "transparent",
            color: th.accent,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          رجوع
        </button>
      </div>
    </div>
  );
}
