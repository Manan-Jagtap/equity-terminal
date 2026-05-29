/* Reusable UI primitives used across multiple tabs.
   All read from the central theme tokens — no hard-coded colors. */

import { C, mono, sans } from "../lib/theme.js";

export function VerdictBadge({ verdict, big }) {
  const col = verdict === "BUY" ? C.green : verdict === "HOLD" ? C.gold : C.red;
  return (
    <span style={{
      ...mono,
      color: col,
      border: `1px solid ${col}55`,
      background: col + "14",
      padding: big ? "6px 16px" : "2px 9px",
      borderRadius: 6,
      fontSize: big ? 15 : 11,
      letterSpacing: "0.08em",
      fontWeight: 600,
    }}>{verdict}</span>
  );
}

export function Stat({ label, value, sub, color }) {
  return (
    <div style={{
      background: C.panel2,
      border: `1px solid ${C.line}`,
      borderRadius: 8,
      padding: "12px 14px",
    }}>
      <div style={{ ...sans, color: C.dim, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ ...mono, color: color || C.text, fontSize: 20, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ ...sans, color: C.faint, fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function Field({ label, value, onChange, step = 0.005, suffix = "%", scale = 100, min, max }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ ...sans, color: C.dim, fontSize: 12 }}>{label}</span>
        <span style={{ ...mono, color: C.gold, fontSize: 13 }}>
          {suffix === "%" ? (value * scale).toFixed(2) : value.toFixed(2)}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: C.gold, cursor: "pointer" }}
      />
    </div>
  );
}

export function BRow({ label, value, color, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
      <span style={{ ...sans, color: bold ? C.text : C.dim, fontSize: 12, fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ ...mono, color: color || C.text, fontSize: 13, fontWeight: bold ? 600 : 400 }}>{value}</span>
    </div>
  );
}

export function TH({ cols }) {
  return (
    <tr style={{ background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
      {cols.map((c, i) => (
        <th key={i} style={{
          ...sans, color: C.dim, fontSize: 11, fontWeight: 500,
          textAlign: i === 0 ? "left" : "right",
          padding: "9px 12px",
          whiteSpace: "nowrap",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}>{c}</th>
      ))}
    </tr>
  );
}

export function TR({ cells, bold, color, bg, highlight }) {
  return (
    <tr style={{ borderTop: `1px solid ${C.line}22`, background: bg || "transparent" }}>
      {cells.map((c, i) => (
        <td key={i} style={{
          ...mono, fontSize: 12,
          padding: "8px 12px",
          textAlign: i === 0 ? "left" : "right",
          color: color || (i === 0 ? C.dim : C.text),
          fontWeight: bold ? "600" : "400",
          background: highlight && i > 0 ? C.gold + "18" : "transparent",
        }}>{c}</td>
      ))}
    </tr>
  );
}

export function MTable({ children }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{
        width: "100%",
        borderCollapse: "collapse",
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 8,
        overflow: "hidden",
      }}>{children}</table>
    </div>
  );
}
