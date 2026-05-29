/* Fundamentals tab — snapshot cards. Sector-specific card set for
   financials (NBFC ratios) vs non-financials (revenue / margins). */

import { C, mono, sans } from "../lib/theme.js";
import { fmt, inr, pct, cr, safe } from "../lib/formatters.js";

export default function Fundamentals({ co, f }) {
  const isF = co.type === "financial";
  const cards = isF
    ? [
        ["Net worth",  cr(co.equity)],
        ["Net profit", co.netProfit ? cr(co.netProfit) : "—"],
        ["BV/share",   inr(f.bvps)],
        ["EPS",        f.eps ? inr(f.eps) : "—"],
        ["ROE",        pct(f.roe)],
        ["ROA",        pct(safe(co.nbfc?.roa, 0.02), 2)],
        ["AUM",        cr(safe(co.nbfc?.aum, 0))],
        ["NIM",        pct(safe(co.nbfc?.nim, 0.09))],
        ["GNPA",       pct(safe(co.nbfc?.gnpa, 0.03), 2)],
        ["NNPA",       pct(safe(co.nbfc?.nnpa, 0.015), 2)],
        ["CRAR",       pct(safe(co.nbfc?.crar, 0.18))],
        ["P/B",        fmt(f.pb, 2)],
      ]
    : [
        ["Revenue",     cr(co.revenue)],
        ["EBIT margin", pct(safe(co.assumptions?.ebitMargin, 0.12))],
        ["Net debt",    cr(co.netDebt)],
        ["BV/share",    inr(f.bvps)],
        ["EPS",         f.eps ? inr(f.eps) : "—"],
        ["P/E",         f.pe ? fmt(f.pe, 1) : "—"],
        ["ROE",         pct(f.roe)],
        ["P/B",         fmt(f.pb, 2)],
      ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
      {cards.map(([l, v]) => (
        <div key={l} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ ...sans, color: C.dim, fontSize: 11 }}>{l}</div>
          <div style={{ ...mono, color: C.text, fontSize: 17, marginTop: 4 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}
