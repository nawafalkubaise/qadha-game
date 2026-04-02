/**
 * رسم توضيحي بسيط ومميز لكل فئة (SVG) — أسلوب موحّد، شكل مختلف لكل id.
 */
import { useId } from "react";

function hashId(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ألوان مساعدة من لون الفئة الأساسي */
function palette(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex) || ["", "888888"];
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const dim = `rgba(${r},${g},${b},.35)`;
  const mid = `rgba(${r},${g},${b},.65)`;
  const lit = `rgba(${Math.min(255, r + 55)},${Math.min(255, g + 55)},${Math.min(255, b + 55)},.9)`;
  return { dim, mid, lit, stroke: `rgba(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)},.85)` };
}

export function CategoryArt({ id, color = "#888888", size = 68, radius = 14, className }) {
  const uid = useId().replace(/:/g, "");
  const h = hashId(String(id));
  const rnd = mulberry32(h);
  const { dim, mid, lit, stroke } = palette(color);
  const rot = (h % 72) - 36;
  const parts = [];
  const n = 4 + (h % 5);

  for (let i = 0; i < n; i++) {
    const x = 12 + rnd() * 76;
    const y = 12 + rnd() * 76;
    const w = 8 + rnd() * 28;
    const kind = (h + i * 17) % 4;
    if (kind === 0) {
      parts.push(
        <circle key={i} cx={x} cy={y} r={w * 0.45} fill={i % 2 ? mid : dim} opacity={0.75 + rnd() * 0.2} />
      );
    } else if (kind === 1) {
      parts.push(
        <rect
          key={i}
          x={x - w / 2}
          y={y - w / 2}
          width={w}
          height={w * (0.4 + rnd() * 0.6)}
          rx={w * 0.15}
          fill={i % 2 ? lit : dim}
          opacity={0.55 + rnd() * 0.25}
          transform={`rotate(${(rnd() * 80 - 40).toFixed(1)} ${x} ${y})`}
        />
      );
    } else if (kind === 2) {
      const x2 = x + (rnd() - 0.5) * 40;
      const y2 = y + (rnd() - 0.5) * 40;
      parts.push(
        <line
          key={i}
          x1={x}
          y1={y}
          x2={x2}
          y2={y2}
          stroke={stroke}
          strokeWidth={1.2 + rnd() * 2}
          strokeLinecap="round"
          opacity={0.45 + rnd() * 0.35}
        />
      );
    } else {
      parts.push(
        <ellipse
          key={i}
          cx={x}
          cy={y}
          rx={w * 0.5}
          ry={w * 0.28}
          fill="none"
          stroke={mid}
          strokeWidth={1.5}
          opacity={0.6}
          transform={`rotate(${rot + i * 22} ${x} ${y})`}
        />
      );
    }
  }

  const gradId = `qcg${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ borderRadius: radius, display: "block", flexShrink: 0 }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={lit} stopOpacity={0.95} />
          <stop offset="100%" stopColor={dim} stopOpacity={0.5} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" rx={radius * (100 / size)} fill={`url(#${gradId})`} />
      <g style={{ mixBlendMode: "multiply" }}>{parts}</g>
      <rect
        x="1"
        y="1"
        width="98"
        height="98"
        rx={radius * (100 / size) - 1}
        fill="none"
        stroke={stroke}
        strokeWidth={0.8}
        opacity={0.25}
      />
    </svg>
  );
}
