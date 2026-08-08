/* ThreeStatementModel.jsx — an editable, driver-based 3-statement projection.

   An analyst SCRATCHPAD, deliberately separate from the headline engine (which
   is parity-locked to the backend): edit the operating drivers and watch a
   linked P&L → cash-flow → net-debt roll project forward, valued by a
   transparent FCFF DCF. Every cell is derived from the inputs above it — no
   black box. Seeds from the company's own figures + the engine's derived
   drivers so the base case is sensible. Not investment advice. */
import { useMemo, useState } from "react";
import { Table, RotateCcw } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";
import { th, td, tdNum } from "../design/table.js";
import * as engine from "../lib/engine.js";

const cr = v => v == null ? "—" : "₹" + Math.round(v).toLocaleString("en-IN");
const pct1 = v => v == null ? "—" : (v * 100).toFixed(1) + "%";
const rupee = v => v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function project(d) {
  const { rev0, shares, netDebt0, g1, gT, years, ebitMargin, daPct, capexPct,
          nwcPct, taxRate, intRate, wacc } = d;
  const N = Math.max(2, Math.min(15, Math.round(years)));
  const rows = [];
  let rev = rev0, nd = netDebt0, pvSum = 0, lastFcff = 0;
  for (let t = 1; t <= N; t++) {
    const g = N <= 1 ? g1 : g1 + (gT - g1) * ((t - 1) / (N - 1));
    rev = rev * (1 + g);
    const ebit = rev * ebitMargin;
    const da = rev * daPct;
    const ebitda = ebit + da;
    const interest = intRate * nd;                 // on opening net debt (income if net cash)
    const pbt = ebit - interest;
    const tax = Math.max(0, pbt) * taxRate;
    const pat = pbt - tax;
    const capex = rev * capexPct;
    const dNWC = (rev - (rows.length ? rows[rows.length - 1].rev : rev0)) * nwcPct;
    const fcff = ebit * (1 - taxRate) + da - capex - dNWC;
    const fcfe = fcff - interest * (1 - taxRate);
    nd = nd - fcfe;                                 // FCFE pays down debt / builds cash
    const disc = Math.pow(1 + wacc, t);
    const pv = fcff / disc;
    pvSum += pv;
    lastFcff = fcff;
    rows.push({ t, g, rev, ebitda, ebit, da, interest, pat, capex, dNWC, fcff, fcfe, netDebt: nd, pv });
  }
  const tv = wacc > gT ? (lastFcff * (1 + gT)) / (wacc - gT) : 0;
  const tvPv = tv / Math.pow(1 + wacc, N);
  const ev = pvSum + tvPv;
  const equity = ev - netDebt0;
  const perShare = shares > 0 ? equity / shares : null;
  return { rows, pvExplicit: pvSum, tvPv, ev, equity, perShare, tvShare: ev ? tvPv / ev : null };
}

function Driver({ label, value, set, step = 0.005, pct = true, suffix, width = 76 }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ ...sans, fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".07em", color: C.dim }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input type="number" value={pct ? +(value * 100).toFixed(2) : value} step={pct ? step * 100 : step}
               onChange={e => set(pct ? Number(e.target.value) / 100 : Number(e.target.value))}
               style={{ ...mono, fontSize: 13, width, background: C.panel2, color: C.text, border: `1px solid ${C.line2}`, borderRadius: 6, padding: "5px 7px" }} />
        <span style={{ ...sans, fontSize: 11, color: C.faint }}>{suffix ?? (pct ? "%" : "")}</span>
      </div>
    </label>
  );
}

export default function ThreeStatementModel({ co, price, apiVal }) {
  const isFin = co.type === "financial" || ["NBFC", "BANK", "INSURANCE"].includes(co.template_code);
  const base = apiVal?.assumptions || {};
  const vs = base._valuation_sector || co.valuation_sector || "MANUFACTURING";
  const sp = engine.params(vs);

  const rev0 = co.revenue || 0;
  const shares = co.shares || 0;
  const netDebt0 = co.netDebt ?? co.net_debt ?? 0;

  // WACC seed from the engine's cost-of-capital, with the same floor logic.
  const ke = (base.risk_free ?? engine.RISK_FREE) + (base.beta ?? sp.beta) * (base.erp ?? engine.ERP);
  const dw = base.debt_weight ?? 0.20;
  const taxSeed = base.tax_rate ?? 0.25;
  const waccSeed = Math.max((1 - dw) * ke + dw * (base.cost_debt ?? 0.085) * (1 - taxSeed),
                            (base.terminal_growth ?? sp.terminal_growth) + 0.03);

  const [g1, setG1] = useState(base.rev_growth ?? 0.10);
  const [gT, setGT] = useState(base.terminal_growth ?? sp.terminal_growth);
  const [years, setYears] = useState(base.fade_years ?? 8);
  const [ebitMargin, setEbit] = useState(base.ebit_margin ?? 0.15);
  const [daPct, setDa] = useState(0.04);
  const [capexPct, setCapex] = useState(0.06);
  const [nwcPct, setNwc] = useState(0.15);
  const [taxRate, setTax] = useState(taxSeed);
  const [intRate, setInt] = useState(base.cost_debt ?? 0.085);
  const [wacc, setWacc] = useState(waccSeed);

  const reset = () => {
    setG1(base.rev_growth ?? 0.10); setGT(base.terminal_growth ?? sp.terminal_growth);
    setYears(base.fade_years ?? 8); setEbit(base.ebit_margin ?? 0.15);
    setDa(0.04); setCapex(0.06); setNwc(0.15); setTax(taxSeed);
    setInt(base.cost_debt ?? 0.085); setWacc(waccSeed);
  };

  const m = useMemo(() => project({ rev0, shares, netDebt0, g1, gT, years, ebitMargin, daPct, capexPct, nwcPct, taxRate, intRate, wacc }),
    [rev0, shares, netDebt0, g1, gT, years, ebitMargin, daPct, capexPct, nwcPct, taxRate, intRate, wacc]);

  if (isFin) return (
    <div className="fadein" style={{ padding: "28px 6px", ...sans, fontSize: 13.5, color: C.dim, lineHeight: 1.7, maxWidth: 620 }}>
      A 3-statement FCFF model doesn’t fit a lender — for banks &amp; NBFCs, book value, ROE and credit costs drive value, not free cash flow.
      Use the <b style={{ color: C.text200 }}>Residual-Income drivers in the Valuation tab</b> for {co.name}.
    </div>
  );
  if (!rev0 || !shares) return (
    <div className="fadein" style={{ padding: "28px 6px", ...sans, fontSize: 13.5, color: C.dim }}>
      Not enough data to seed the model — revenue and share count are required.
    </div>
  );

  const upside = (m.perShare != null && price > 0) ? m.perShare / price - 1 : null;

  return (
    <div className="fadein" style={{ padding: "4px 2px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ ...serif, fontSize: 20, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
          <Table size={17} color={C.gold} /> 3-Statement Model
        </span>
        <span style={{ ...sans, fontSize: 12, color: C.dim }}>your editable scratchpad · separate from the engine headline</span>
        <button onClick={reset} style={{ ...sans, marginLeft: "auto", fontSize: 11.5, color: C.dim, background: "transparent", border: `1px solid ${C.line2}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          <RotateCcw size={12} /> Reset to base
        </button>
      </div>

      {/* drivers */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "14px 16px", border: `1px solid ${C.line}`, borderRadius: 12, background: "rgba(16,14,10,0.4)", marginBottom: 16 }}>
        <Driver label="Growth yr-1" value={g1} set={setG1} />
        <Driver label="Terminal g" value={gT} set={setGT} step={0.0025} />
        <Driver label="Forecast yrs" value={years} set={setYears} pct={false} step={1} suffix="yr" width={54} />
        <Driver label="EBIT margin" value={ebitMargin} set={setEbit} />
        <Driver label="D&A % rev" value={daPct} set={setDa} step={0.0025} />
        <Driver label="Capex % rev" value={capexPct} set={setCapex} step={0.0025} />
        <Driver label="ΔNWC % Δrev" value={nwcPct} set={setNwc} />
        <Driver label="Tax rate" value={taxRate} set={setTax} />
        <Driver label="Int. on debt" value={intRate} set={setInt} />
        <Driver label="WACC" value={wacc} set={setWacc} step={0.0025} />
      </div>

      {/* valuation summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 12, marginBottom: 18 }}>
        {[
          ["Enterprise value", cr(m.ev), C.text],
          ["− Net debt", cr(netDebt0), C.dim],
          ["Equity value", cr(m.equity), C.text],
          ["Fair value / share", rupee(m.perShare), C.gold],
          ["vs CMP " + rupee(price), upside == null ? "—" : (upside >= 0 ? "+" : "") + (upside * 100).toFixed(0) + "%", upside == null ? C.dim : upside >= 0 ? C.green : C.red],
          ["Terminal % of EV", m.tvShare == null ? "—" : (m.tvShare * 100).toFixed(0) + "%", m.tvShare > 0.75 ? C.gold : C.text200],
        ].map(([l, v, col]) => (
          <div key={l} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "11px 13px", background: C.panel2 }}>
            <div style={{ ...sans, fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".08em", color: C.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</div>
            <div style={{ ...mono, fontSize: 17, color: col, marginTop: 3 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* projection table */}
      <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
          <thead style={{ background: C.bg900 }}>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Year</th>
              <th style={th}>Revenue</th><th style={th}>Growth</th>
              <th style={th}>EBITDA</th><th style={th}>EBIT</th><th style={th}>PAT</th>
              <th style={th}>Capex</th><th style={th}>FCFF</th>
              <th style={th}>Net debt</th><th style={th}>PV(FCFF)</th>
            </tr>
          </thead>
          <tbody>
            {m.rows.map(r => (
              <tr key={r.t} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ ...td, textAlign: "left", color: C.faint }}>Y{r.t}</td>
                <td style={tdNum}>{cr(r.rev)}</td>
                <td style={{ ...tdNum, color: C.dim }}>{pct1(r.g)}</td>
                <td style={tdNum}>{cr(r.ebitda)}</td>
                <td style={tdNum}>{cr(r.ebit)}</td>
                <td style={{ ...tdNum, color: r.pat >= 0 ? C.text : C.red }}>{cr(r.pat)}</td>
                <td style={{ ...tdNum, color: C.dim }}>{cr(r.capex)}</td>
                <td style={{ ...tdNum, color: r.fcff >= 0 ? C.green : C.red }}>{cr(r.fcff)}</td>
                <td style={{ ...tdNum, color: r.netDebt > 0 ? C.text200 : C.green }}>{cr(r.netDebt)}</td>
                <td style={{ ...tdNum, color: C.gold }}>{cr(r.pv)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...sans, fontSize: 10, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
        Linked projection: P&amp;L (Revenue→EBIT→PAT) → cash flow (FCFF = EBIT×(1−tax) + D&amp;A − Capex − ΔNWC) → net-debt roll
        (FCFE pays down debt). Value = ΣPV(FCFF) + PV(terminal), less opening net debt, per share. All ₹ crore unless per-share.
        A transparent scratchpad — a driver model, not a circular audited statement, and not investment advice.
      </div>
    </div>
  );
}
