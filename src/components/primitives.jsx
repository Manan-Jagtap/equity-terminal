/* Reusable UI primitives used across multiple tabs.
   All read from the central theme tokens — no hard-coded colors. */

import { C, mono, sans } from "../lib/theme.js";
import { verdictLabel, verdictTitle } from "../lib/formatters.js";

export function VerdictBadge({ verdict, big }) {
  const col =
    verdict === "BUY" || verdict === "ACCUMULATE" ? C.green :
    verdict === "HOLD" ? C.gold :
    verdict === "TRIM" || verdict === "REDUCE" || verdict === "AVOID" ? C.red :
    C.dim; // NO DATA / NO CALL → neutral grey, never green
  return (
    <span title={verdictTitle(verdict)} style={{
      ...mono,
      color: col,
      border: `1px solid ${col}55`,
      background: col + "14",
      padding: big ? "6px 16px" : "2px 9px",
      borderRadius: 6,
      fontSize: big ? 15 : 11,
      letterSpacing: "0.08em",
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}>{verdictLabel(verdict)}</span>
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

// UX-11: pin the first column so the row label (ticker/company) stays visible
// when a wide table is scrolled horizontally on mobile. The sticky cell needs an
// OPAQUE background to cover content sliding under it.
const _stickyFirst = (bg) => ({
  position: "sticky", left: 0, zIndex: 1, background: bg,
});

export function TH({ cols }) {
  return (
    <tr style={{ background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
      {cols.map((c, i) => (
        <th key={i} scope="col" style={{   // UX-08: scope for screen-reader header association
          ...sans, color: C.dim, fontSize: 11, fontWeight: 500,
          textAlign: i === 0 ? "left" : "right",
          padding: "9px 12px",
          whiteSpace: "nowrap",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          ...(i === 0 ? { ..._stickyFirst(C.panel2), zIndex: 2 } : {}),
        }}>{c}</th>
      ))}
    </tr>
  );
}

export function TR({ cells, bold, color, bg, highlight }) {
  const rowBg = bg || C.panel;
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
          ...(i === 0 ? _stickyFirst(rowBg) : {}),
        }}>{c}</td>
      ))}
    </tr>
  );
}

export function MTable({ children, caption }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{
        width: "100%",
        borderCollapse: "collapse",
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 8,
        overflow: "hidden",
      }}>
        {/* UX-08: a screen-reader-only caption names the table for AT users. */}
        {caption && (
          <caption style={{
            position: "absolute", width: 1, height: 1, overflow: "hidden",
            clip: "rect(0 0 0 0)", whiteSpace: "nowrap",
          }}>{caption}</caption>
        )}
        {children}
      </table>
    </div>
  );
}
