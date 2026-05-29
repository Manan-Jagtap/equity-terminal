/* Verdict tab — shows how the composite is built, with bar visualisation
   per reason and a SEBI-style disclaimer footer. */

import { ShieldAlert } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { fmt } from "../lib/formatters.js";
import { VerdictBadge } from "./primitives.jsx";

export default function Verdict({ rec }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 12 }}>
          <div style={{ ...serif, color: C.text, fontSize: 20, fontWeight: 600 }}>How the verdict is built</div>
          <VerdictBadge verdict={rec.verdict} big />
        </div>
        <div style={{ ...sans, color: C.dim, fontSize: 13, marginBottom: 18 }}>
          Composite = 45% valuation + 28% quality + 14% momentum + 13% risk. Score {fmt(rec.composite)}/100.
        </div>

        {rec.reasons.map(r => (
          <div key={r.label} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <span style={{ ...sans, color: C.text, fontSize: 13, fontWeight: 500 }}>{r.label}</span>
              <span style={{ ...mono, color: r.good ? C.green : r.bad ? C.red : C.text, fontSize: 13 }}>{fmt(r.score)}/100</span>
            </div>
            <div style={{ height: 6, background: C.panel2, borderRadius: 3, overflow: "hidden", border: `1px solid ${C.line}` }}>
              <div style={{ width: `${r.score}%`, height: "100%", background: r.good ? C.green : r.bad ? C.red : C.gold }} />
            </div>
            <div style={{ ...sans, color: C.faint, fontSize: 12, marginTop: 4 }}>{r.note}</div>
          </div>
        ))}
      </div>

      <div style={{
        background: C.panel,
        border: `1px solid ${C.goldDim}55`,
        borderRadius: 10,
        padding: "14px 18px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}>
        <ShieldAlert size={16} color={C.gold} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ ...sans, color: C.dim, fontSize: 12, lineHeight: 1.65 }}>
          <b style={{ color: C.text }}>Not investment advice.</b> This shows what a stock is worth under your assumptions.
          Sector EBIT margins are calibrated to industry norms but should be verified against actual filings.
          SEBI Research Analyst regulations apply for public recommendations.
        </div>
      </div>
    </div>
  );
}
