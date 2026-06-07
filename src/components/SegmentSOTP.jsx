/* SegmentSOTP.jsx — lightweight, interactive Sum-of-the-Parts for diversified
   conglomerates that a single-sector DCF can't value (Reliance, Adani Ent).
   The model flags these LOW CONF; this panel gives an editable SOTP so you can
   build a defensible fair value by segment. Seeded values are ILLUSTRATIVE
   starting points — edit each segment's EV to your own estimate. Nothing here
   is auto-computed from financials (we don't ingest segment data); it's a
   transparent calculator, which is exactly how SOTP is done by hand. */

import { useState } from "react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { fmt, inr } from "../lib/formatters.js";

// Illustrative segment EV starting points (₹ Cr) + net debt + share count.
// These are editable defaults, not ingested truth — adjust to taste.
const PRESETS = {
  RELIANCE: {
    netDebt: 120788, shares: 1601.78,
    segments: [
      { name: "Jio — Digital Services", ev: 1100000 },
      { name: "Reliance Retail", ev: 900000 },
      { name: "O2C — Oil-to-Chemicals", ev: 450000 },
      { name: "Oil & Gas E&P + New Energy", ev: 150000 },
    ],
  },
  ADANIENT: {
    netDebt: 97672, shares: 130.2,
    segments: [
      { name: "Adani Airports", ev: 60000 },
      { name: "Adani New Industries (green H2 / ANIL)", ev: 120000 },
      { name: "Roads & Infrastructure", ev: 40000 },
      { name: "Data Centres (AdaniConneX)", ev: 35000 },
      { name: "Mining, IRM & Others", ev: 80000 },
    ],
  },
};

export default function SegmentSOTP({ ticker, price, isMobile }) {
  const preset = PRESETS[(ticker || "").toUpperCase()];
  // Hooks must run unconditionally — seed empty if not a known conglomerate.
  const [segs, setSegs] = useState(preset ? preset.segments : []);
  const [netDebt, setNetDebt] = useState(preset ? preset.netDebt : 0);
  if (!preset) return null;

  const shares = preset.shares;
  const totalEV = segs.reduce((s, x) => s + (Number(x.ev) || 0), 0);
  const equity = totalEV - Number(netDebt || 0);
  const perShare = shares > 0 ? equity / shares : null;
  const mos = price && perShare ? perShare / price - 1 : null;

  const setEv = (i, v) => setSegs(segs.map((s, j) => (j === i ? { ...s, ev: v } : s)));

  const inputStyle = {
    ...mono, fontSize: 13, color: C.text, background: "rgba(10,9,7,0.6)",
    border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 8px",
    width: 130, textAlign: "right",
  };

  return (
    <div style={{ border: `1px solid ${C.gold}3d`, borderRadius: 12, background: C.bg900, padding: 18, marginBottom: 24 }}>
      <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: "#857d65" }}>
        Sum-of-the-Parts · {ticker}
      </div>
      <div style={{ ...sans, fontSize: 11, color: "#5b5440", marginTop: 6, lineHeight: 1.6, maxWidth: 620 }}>
        A single DCF mis-values this conglomerate — its parts trade on different economics. Build a fair value by segment below.
        Values are illustrative starting points; edit each segment's enterprise value to your own estimate.
      </div>

      {/* Segment rows */}
      <div style={{ marginTop: 16 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid rgba(220,213,193,.07)` }}>
            <span style={{ ...sans, fontSize: 13, color: C.text200 }}>{s.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ ...sans, fontSize: 11, color: "#5b5440" }}>₹</span>
              <input type="number" value={s.ev} onChange={e => setEv(i, e.target.value)} style={inputStyle} />
              <span style={{ ...sans, fontSize: 11, color: "#5b5440" }}>Cr EV</span>
            </div>
          </div>
        ))}
        {/* Net debt */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid rgba(220,213,193,.07)` }}>
          <span style={{ ...sans, fontSize: 13, color: C.red }}>(−) Net debt</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ ...sans, fontSize: 11, color: "#5b5440" }}>₹</span>
            <input type="number" value={netDebt} onChange={e => setNetDebt(e.target.value)} style={inputStyle} />
            <span style={{ ...sans, fontSize: 11, color: "#5b5440" }}>Cr</span>
          </div>
        </div>
      </div>

      {/* Result */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginTop: 18 }}>
        {[
          ["Total EV", "₹" + fmt(Math.round(totalEV)) + " Cr", C.text],
          ["Equity value", "₹" + fmt(Math.round(equity)) + " Cr", C.text],
          ["Per share", perShare != null ? inr(perShare, 0) : "—", C.gold],
          ["vs CMP " + (price ? inr(price, 0) : "—"), mos != null ? (mos >= 0 ? "+" : "") + (mos * 100).toFixed(0) + "%" : "—", mos == null ? C.dim : mos >= 0 ? C.green : C.red],
        ].map(([l, v, col]) => (
          <div key={l} style={{ background: "rgba(10,9,7,0.45)", border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#857d65" }}>{l}</div>
            <div style={{ ...serif, fontSize: 22, color: col, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
