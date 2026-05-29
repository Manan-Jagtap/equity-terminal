/* DCF Model tab. Two-column layout: assumptions on the left,
   valuation bridge + sensitivity + year-by-year on the right. */

import { useMemo } from "react";
import { CircleDollarSign } from "lucide-react";
import { C, mono, sans } from "../lib/theme.js";
import { fmt, inr, pct, cr } from "../lib/formatters.js";
import { currentFY, fyLabel } from "../lib/fyHelpers.js";
import { valuate, sensitivity, ke } from "../lib/valuation.js";
import { Field, BRow, VerdictBadge, MTable, TH, TR } from "./primitives.jsx";

export default function DCFModel({ co, a, set, price, setPrice }) {
  const isF = co.type === "financial";
  const v = valuate(co, a);
  const mos = (v.intrinsic - price) / price;
  const sens = useMemo(() => sensitivity(co, a), [co, a]);
  const lastActualFY = currentFY() - 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
        {/* INPUTS */}
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 18 }}>
          <div style={{ ...sans, color: C.text, fontSize: 14, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
            <CircleDollarSign size={16} color={C.gold} /> Assumptions
          </div>
          <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.line}` }}>
            <div style={{ ...sans, color: C.dim, fontSize: 11, marginBottom: 4 }}>Market price (₹) — CMP</div>
            <input type="number" value={price} onChange={e => setPrice(parseFloat(e.target.value) || 0)} style={{
              ...mono, width: "100%", background: C.panel2,
              border: `1px solid ${C.line}`, borderRadius: 6,
              color: C.text, padding: "7px 10px", fontSize: 14, outline: "none",
            }} />
          </div>

          <div style={{ ...sans, color: C.goldDim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Cost of Equity (CAPM)
          </div>
          <Field label="Risk-free rate (10Y G-Sec)" value={a.riskFree} onChange={set("riskFree")} min={0.04} max={0.10} />
          <Field label="Beta (systematic risk)" value={a.beta} onChange={set("beta")} suffix="" min={0.5} max={1.8} step={0.05} />
          <Field label="Equity Risk Premium (India)" value={a.erp} onChange={set("erp")} min={0.03} max={0.09} />

          <div style={{ background: C.panel2, borderRadius: 6, padding: "8px 10px", marginBottom: 12, fontSize: 11, ...mono, color: C.dim }}>
            Ke = {pct(a.riskFree)} + {a.beta.toFixed(2)} × {pct(a.erp)} = <span style={{ color: C.gold }}>{pct(ke(a))}</span>
            {!isF && v.WACC && <span> · WACC = <span style={{ color: C.blue }}>{pct(v.WACC)}</span></span>}
          </div>

          <div style={{ ...sans, color: C.goldDim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            {isF ? "Excess-Return Drivers" : "FCFF Drivers"}
          </div>

          {isF ? (
            <>
              <Field label="Forecast ROE (Yr 1)" value={a.forecastRoe} onChange={set("forecastRoe")} min={0.08} max={0.30} />
              <Field label="Terminal ROE (steady state)" value={a.terminalRoe} onChange={set("terminalRoe")} min={0.08} max={0.22} />
              <Field label="Dividend payout ratio" value={a.payout} onChange={set("payout")} min={0} max={0.6} />
            </>
          ) : (
            <>
              <Field label="Revenue growth (Yr 1)" value={a.revGrowth} onChange={set("revGrowth")} min={0.01} max={0.30} />
              <Field label="EBIT margin" value={a.ebitMargin} onChange={set("ebitMargin")} min={0.01} max={0.40} />
              <Field label="Tax rate" value={a.taxRate} onChange={set("taxRate")} min={0.15} max={0.35} />
              <Field label="Reinvestment rate" value={a.reinvestRate} onChange={set("reinvestRate")} min={0.05} max={0.80} />
            </>
          )}
          <Field label="Explicit forecast horizon (yrs)" value={a.fadeYears} onChange={set("fadeYears")} suffix="" min={3} max={12} step={1} />
          <Field label="Terminal growth rate (g)" value={a.terminalGrowth} onChange={set("terminalGrowth")} min={0.02} max={0.08} />
        </div>

        {/* OUTPUT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Valuation bridge */}
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ ...sans, color: C.text, fontSize: 14, fontWeight: 600 }}>{v.method}</div>
                <div style={{ ...mono, color: C.faint, fontSize: 11, marginTop: 2 }}>
                  Based on {fyLabel(lastActualFY, lastActualFY)} actuals + {a.fadeYears}-year projections
                </div>
              </div>
              <VerdictBadge verdict={mos >= 0.15 ? "BUY" : mos >= -0.15 ? "HOLD" : "AVOID"} big />
            </div>

            <div style={{ background: C.panel2, borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <div style={{ ...sans, color: C.dim, fontSize: 11, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Intrinsic Value Bridge (per share)
              </div>
              {isF ? (
                <>
                  <BRow label={`Book Value/share (${fyLabel(lastActualFY, lastActualFY)})`} value={inr(v.bvps0)} color={C.text} />
                  <BRow label={`+ PV of excess returns (${v.N} years, Ke=${pct(v.Ke)})`} value={inr(v.pvExplicit)} color={C.blue} />
                  <BRow label={`+ PV of terminal value (g=${pct(a.terminalGrowth)})`} value={inr(v.tvPv)} color={C.purple} />
                  <div style={{ borderTop: `1px solid ${C.line}`, margin: "8px 0" }} />
                  <BRow label="= Intrinsic Value / share" value={inr(v.intrinsic)} color={C.gold} bold />
                  <BRow label="Current Market Price (CMP)" value={inr(price)} color={C.text} />
                  <BRow label="Margin of Safety" value={pct(mos)} color={mos >= 0 ? C.green : C.red} bold />
                  <BRow label="Implied P/B at intrinsic" value={fmt(v.intrinsic / (co.equity / co.shares), 2) + "x"} color={C.faint} />
                </>
              ) : (
                <>
                  <BRow label={`Base revenue (${fyLabel(lastActualFY, lastActualFY)})`} value={cr(v.rev0)} color={C.faint} />
                  <BRow label={`PV of FCFFs (${v.N} years, WACC=${pct(v.WACC)})`} value={cr(v.pvExplicit)} color={C.blue} />
                  <BRow label={`+ PV of terminal value (g=${pct(a.terminalGrowth)})`} value={cr(v.tvPv)} color={C.purple} />
                  <div style={{ borderTop: `1px solid ${C.line}`, margin: "8px 0" }} />
                  <BRow label="= Enterprise Value (EV)" value={cr(v.ev)} color={C.text} bold />
                  <BRow label="− Net Debt" value={cr(v.netDebt)} color={C.red} />
                  <BRow label="= Equity Value" value={cr(v.equityVal)} color={C.text} bold />
                  <BRow label={`÷ Shares outstanding (${fmt(co.shares, 1)} cr)`} value="" color={C.faint} />
                  <div style={{ borderTop: `1px solid ${C.line}`, margin: "8px 0" }} />
                  <BRow label="= Intrinsic Value / share" value={inr(v.intrinsic)} color={C.gold} bold />
                  <BRow label="Current Market Price (CMP)" value={inr(price)} color={C.text} />
                  <BRow label="Margin of Safety" value={pct(mos)} color={mos >= 0 ? C.green : C.red} bold />
                </>
              )}
            </div>

            <div style={{ ...sans, color: C.faint, fontSize: 12, lineHeight: 1.7 }}>
              Terminal value = <b style={{ color: C.gold }}>{pct((v.tvPv) / (v.pvExplicit + v.tvPv))}</b> of total.
              {isF
                ? ` CAPM Ke=${pct(v.Ke)}. Fair P/B ≈ ROE/(Ke−g) = ${fmt(a.forecastRoe / (ke(a) - a.terminalGrowth), 2)}x.`
                : ` WACC=${pct(v.WACC)}. EBIT margin=${pct(a.ebitMargin)} calibrated to sector "${co.sector}".`}
            </div>
          </div>

          {/* Sensitivity grid */}
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 18 }}>
            <div style={{ ...sans, color: C.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Sensitivity (₹ / share)</div>
            <div style={{ ...sans, color: C.faint, fontSize: 11, marginBottom: 12 }}>
              Rows: Δ discount rate · Columns: Δ terminal growth
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...mono, color: C.faint, padding: "6px 10px", fontSize: 11 }}>Δr\Δg</th>
                    {sens.gd.map((g, i) => (
                      <th key={i} style={{ ...mono, color: C.dim, padding: "6px 10px", textAlign: "center", fontSize: 11 }}>
                        {(g * 100 >= 0 ? "+" : "") + (g * 100).toFixed(1)}%
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sens.grid.map((row, ri) => (
                    <tr key={ri}>
                      <td style={{ ...mono, color: C.dim, padding: "6px 10px", fontSize: 11 }}>
                        {(sens.rd[ri] * 100 >= 0 ? "+" : "") + (sens.rd[ri] * 100).toFixed(1)}%
                      </td>
                      {row.map((val, ci) => {
                        const center = ri === 2 && ci === 2;
                        const up = val > price;
                        return (
                          <td key={ci} style={{
                            ...mono, fontSize: 12, padding: "7px 8px", textAlign: "center",
                            color: center ? C.gold : up ? C.green : C.red,
                            background: center ? C.gold + "18" : "transparent",
                            border: center ? `1px solid ${C.gold}55` : `1px solid ${C.line}22`,
                            fontWeight: center ? 600 : 400,
                          }}>{fmt(val)}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ ...sans, color: C.faint, fontSize: 11, marginTop: 8 }}>
              Base case (centre) = {inr(v.intrinsic)}. Green = below CMP {inr(price)}.
            </div>
          </div>
        </div>
      </div>

      {/* Year-by-year */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 18 }}>
        <div style={{ ...sans, color: C.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          {isF ? "Residual Income Schedule — Year-by-Year" : "FCFF Projection — Year-by-Year"}
        </div>
        <div style={{ ...sans, color: C.faint, fontSize: 12, marginBottom: 12 }}>
          {isF
            ? `Ke = ${pct(v.Ke)} · BV/share compounds at ROE × retention · excess return = (ROE − Ke) × BV`
            : `WACC = ${pct(v.WACC)} · Revenue grows from ${fyLabel(lastActualFY, lastActualFY)} base · FCFF = NOPAT × (1 − reinvestment rate)`}
        </div>

        {isF ? (
          <MTable>
            <thead><TH cols={["FY", "BV/sh (₹)", "ROE", "EPS/sh", "DPS/sh", "Excess Ret/sh", "Disc Factor", "PV(RI)", "Cum PV"]} /></thead>
            <tbody>
              <TR cells={[fyLabel(lastActualFY, lastActualFY) + " (base)", inr(v.bvps0), "—", "—", "—", "—", "—", "—", "—"]} color={C.faint} />
              {v.rows.map((r, i) => (
                <TR key={i} cells={[
                  fyLabel(lastActualFY + r.t, lastActualFY),
                  inr(r.bv), pct(r.roe, 1), inr(r.eps, 1), inr(r.dps, 1),
                  inr(r.ri, 1), r.disc.toFixed(3), inr(r.pvRi, 1), inr(r.cumPv, 1),
                ]} bg={i % 2 === 0 ? C.panel2 + "80" : "transparent"} />
              ))}
              <TR cells={["Terminal", "—", "→ " + pct(a.terminalRoe, 1), "—", "—", inr(v.tvRaw, 1), "→ ∞", inr(v.tvPv, 1), "—"]} bold bg={C.purple + "18"} />
              <TR cells={["Total", inr(v.bvps0) + " (BV₀)", "", "", "", "Σ=" + inr(v.pvExplicit, 1), "", "TV=" + inr(v.tvPv, 1), "= " + inr(v.intrinsic)]} bold color={C.gold} />
            </tbody>
          </MTable>
        ) : (
          <MTable>
            <thead><TH cols={["FY", "Revenue (cr)", "Growth", "EBIT (cr)", "Tax", "NOPAT", "Reinvest", "FCFF (cr)", "Disc", "PV(FCFF)", "Cum PV"]} /></thead>
            <tbody>
              {v.rows.map((r, i) => (
                <TR key={i} cells={[
                  fyLabel(lastActualFY + r.t, lastActualFY),
                  cr(r.rev, 0), pct(r.g, 1), cr(r.ebit, 0), cr(r.tax, 0),
                  cr(r.nopat, 0), cr(r.reinv, 0), cr(r.fcff, 0),
                  r.disc.toFixed(3), cr(r.pvFcff, 0), cr(r.cumPv, 0),
                ]} bg={i % 2 === 0 ? C.panel2 + "80" : "transparent"} />
              ))}
              <TR cells={["Terminal", "—", "→ " + pct(a.terminalGrowth, 1), "—", "—", "—", "—", cr(v.rows[v.N - 1]?.fcff * (1 + a.terminalGrowth), 0), "→ ∞", cr(v.tvPv, 0), "—"]} bold bg={C.purple + "18"} />
              <TR cells={["", "", "", "", "", "", `Σ PV=${cr(v.pvExplicit, 0)}`, "", "", `TV=${cr(v.tvPv, 0)}`, `EV=${cr(v.ev, 0)}`]} bold color={C.gold} />
            </tbody>
          </MTable>
        )}
      </div>
    </div>
  );
}
