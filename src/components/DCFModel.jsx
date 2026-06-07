/**
 * DCFModel.jsx — Institutional-grade DCF tab.
 *
 * Sections:
 *   1. Scenario selector (Bear / Base / Bull)
 *   2. WACC Builder (live formula, all components editable)
 *   3. Growth assumptions (3-stage sliders)
 *   4. Blended valuation hero card (DCF + Exit Multiple + P/E)
 *   5. Monte Carlo distribution (500 simulations)
 *   6. Projection schedule (year-by-year FCFF or RI)
 *   7. Sensitivity grid (discount rate × terminal growth)
 */

import { useMemo, useState } from "react";
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { Info } from "lucide-react";

import { C, mono, sans, serif } from "../lib/theme.js";
import { useIsMobile } from "../lib/useResponsive.js";
import { fmt, inr, pct, cr } from "../lib/formatters.js";
import {
  RF, ERP, DEFAULT_TAX, MAX_G,
  SECTOR_UNLEVERED_BETAS, SECTOR_EV_EBITDA, SECTOR_PE,
  calcKe, buildWACC, blendedValuation, monteCarlo, sensitivityGrid,
  releveredBeta, safeDiv, reverseDCF, isFinancial,
} from "../lib/valuation.js";

/* ── Primitives ─────────────────────────────────────────────────── */
const Card = ({ children, style }) => (
  <div style={{ background:"rgba(16,14,10,0.6)", border:`1px solid rgba(220,213,193,0.10)`, padding:18, ...style }}>
    {children}
  </div>
);

const HL = ({ style }) => (
  <div style={{ height:1, background:`linear-gradient(90deg,transparent,rgba(220,213,193,.15),transparent)`, margin:"12px 0", ...style }} />
);

const Label = ({ children, accent }) => (
  <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:14 }}>
    <span style={{ ...sans, fontSize:10, letterSpacing:"0.18em", textTransform:"uppercase", color:"#857d65", fontWeight:500 }}>{children}</span>
    {accent && <span style={{ ...sans, fontSize:10, color:C.gold+"cc" }}>{accent}</span>}
    <div style={{ flex:1, height:1, background:"rgba(220,213,193,.08)" }} />
  </div>
);

function SliderRow({ label, value, setValue, min, max, step, display, hint }) {
  const shown = display ? display(value) : (value * 100).toFixed(2) + "%";
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
        <span style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.09em", color:"#857d65", fontWeight:500 }}>{label}</span>
        <span style={{ ...mono, fontSize:14, color:C.gold, fontWeight:500 }}>{shown}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => setValue(parseFloat(e.target.value))}
        style={{ width:"100%" }} />
      {hint && <div style={{ ...sans, fontSize:10, color:"#3a3528", marginTop:3 }}>{hint}</div>}
    </div>
  );
}

function KV({ label, value, tone, bold, border=true }) {
  const col = tone==="gold"?C.gold:tone==="pos"?C.green:tone==="neg"?C.red:C.text;
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"7px 0", borderBottom:border?`1px solid rgba(220,213,193,.07)`:"none" }}>
      <span style={{ ...sans, color:"#857d65", fontSize:12 }}>{label}</span>
      <span style={{ ...mono, color:col, fontSize:13, fontWeight:bold?600:400 }}>{value}</span>
    </div>
  );
}

/* ── Scenario presets ───────────────────────────────────────────────
   Growth / ROE are absolute; MARGIN and MULTIPLES are expressed relative to the
   company's own data (marginDelta in pp, multFactor × sector multiple) so the
   BASE case anchors to the firm's actual profitability and sector multiples
   rather than a generic 12% margin / 15x P/E. */
const SCENARIOS = {
  bear: {
    label:"Bear",
    sub:"Growth disappointment · margin compression",
    revGrowth1:0.05, revGrowth2:0.03, terminalGrowth:0.04,
    forecastROE:0.13, terminalROE:0.11,
    marginDelta:-0.03, multFactor:0.80,
  },
  base: {
    label:"Base",
    sub:"Steady execution · sector-median multiples",
    revGrowth1:0.10, revGrowth2:0.07, terminalGrowth:0.05,
    forecastROE:0.18, terminalROE:0.14,
    marginDelta:0.0, multFactor:1.00,
  },
  bull: {
    label:"Bull",
    sub:"Share gains · margin expansion",
    revGrowth1:0.16, revGrowth2:0.11, terminalGrowth:0.055,
    forecastROE:0.24, terminalROE:0.17,
    marginDelta:0.03, multFactor:1.15,
  },
};

/* ── Main component ─────────────────────────────────────────────── */
export default function DCFModel({ co, a, set, price, setPrice }) {
  const isMobile = useIsMobile();
  const isF = co.type === "financial" || ["NBFC","BANK","INSURANCE"].includes(co.template_code);
  const template = co.template_code || (isF ? "NBFC" : "MANUFACTURING");

  // Data-driven anchors — the BASE case is built around the firm's own margin
  // and its sector's trading multiples, not a generic preset.
  const sectorPE   = SECTOR_PE[template] ?? 18;
  const sectorEV   = SECTOR_EV_EBITDA[template] ?? 12;
  // Prefer the REAL EBIT margin (from the live statement) when available.
  const dataMargin = (co.ebit != null && co.revenue) ? co.ebit / co.revenue : (a?.ebitMargin ?? 0.15);

  // Scenario state
  const [scenario,   setScenario]  = useState("base");
  const sc = SCENARIOS[scenario];

  // CAPM inputs — seed from the company's own assumptions so the DCF tab's
  // BASE case equals the value shown in the header/screener (single source of
  // truth). Sliders still let the user explore from there.
  const [rf,   setRf]   = useState(a?.rf ?? RF);
  const [erp,  setErp]  = useState(a?.erp ?? ERP);
  const [beta, setBeta] = useState(
    a?.beta ?? releveredBeta(SECTOR_UNLEVERED_BETAS[template] ?? 0.90,
      safeDiv(co.netDebt ?? 0, co.equity ?? 1) ?? 0.3)
  );
  const [kd,   setKd]   = useState(a?.kd ?? 0.09);
  const [taxRate, setTaxRate] = useState(a?.taxRate ?? DEFAULT_TAX);

  // Capital structure
  const equity  = co.equity || 10000;
  const debt    = co.netDebt != null ? Math.max(0, co.netDebt) : equity * 0.3;
  const totalV  = equity + debt;
  const debtW   = Math.min(debt / totalV, 0.80);

  // Growth inputs — seed from company assumptions, fall back to scenario base
  const [g1,    setG1]    = useState(a?.revGrowth1 ?? sc.revGrowth1);
  const [g2,    setG2]    = useState(a?.revGrowth2 ?? sc.revGrowth2);
  const [gT,    setGT]    = useState(a?.terminalGrowth ?? sc.terminalGrowth);
  const [N1,    setN1]    = useState(a?.stage1Years ?? 5);
  const [N2,    setN2]    = useState(a?.stage2Years ?? 5);

  // Financial-specific
  const [forecastROE, setForecastROE] = useState(a?.forecastROE ?? sc.forecastROE);
  const [terminalROE, setTerminalROE] = useState(a?.terminalROE ?? sc.terminalROE);
  const [payout,      setPayout]      = useState(a?.payout ?? 0.25);

  // Non-financial — anchored to the company's data margin and sector multiples
  const [ebitMargin,  setEbitMargin]  = useState(dataMargin);
  const [peMultiple,  setPeMultiple]  = useState(a?.peMultiple ?? sectorPE);
  const [evMultiple,  setEvMultiple]  = useState(a?.evEbitdaMultiple ?? sectorEV);

  // Apply scenario preset — margin/multiples flex around the data anchors
  const applyScenario = (id) => {
    setScenario(id);
    const s = SCENARIOS[id];
    setG1(s.revGrowth1); setG2(s.revGrowth2); setGT(s.terminalGrowth);
    setForecastROE(s.forecastROE); setTerminalROE(s.terminalROE);
    setEbitMargin(Math.max(0.02, dataMargin + s.marginDelta));
    setPeMultiple(+(sectorPE * s.multFactor).toFixed(1));
    setEvMultiple(+(sectorEV * s.multFactor).toFixed(1));
  };

  // Derived WACC / Ke
  const ke   = calcKe(beta, rf, erp);
  const wacc = isF ? ke : ke * (1 - debtW) + kd * (1 - taxRate) * debtW;

  // Build assumptions object for engines
  const assumptions = {
    rf, erp, kd, taxRate,
    stage1Years: N1, stage2Years: N2,
    revGrowth1: g1, revGrowth2: g2, terminalGrowth: gT,
    forecastROE, terminalROE, payout,
    ebitMargin, evEbitdaMultiple: evMultiple, peMultiple,
    beta,
    // pass computed ke/wacc for override
    _ke: ke, _wacc: wacc,
  };

  // Full valuation
  const blend = useMemo(() => blendedValuation(co, assumptions), [co, JSON.stringify(assumptions)]);
  const v     = blend.v;
  const iv    = blend.blended;
  const mos   = (iv - price) / price;

  // Monte Carlo (deferred until user toggles — expensive)
  const [showMC,  setShowMC]  = useState(false);
  const [mcResult, setMcResult] = useState(null);
  const runMC = () => {
    const r = monteCarlo(co, assumptions, 500);
    setMcResult(r);
    setShowMC(true);
  };

  // Sensitivity grid
  const sens = useMemo(() => sensitivityGrid(co, assumptions), [co, JSON.stringify(assumptions)]);

  // Reverse DCF — the growth/ROE the market is implicitly pricing in at today's
  // CMP. Compared against your forecast, it tells you whether expectations are
  // cheap or demanding.
  const reverse = useMemo(() => reverseDCF(co, assumptions), [co, JSON.stringify(assumptions)]);
  const fwdDriver = isF ? forecastROE : g1;

  // Chart data
  const projRows = v.rows?.slice(0, N1 + N2) || [];
  const chartData = projRows.map(r => ({
    year: "Y" + r.year,
    stage: r.stage,
    fcff: isF ? Math.round(r.ri * co.shares) : Math.round(r.fcff),
    pv:   Math.round(r.pvRI ?? r.pvFcff ?? r.pv ?? 0),
    growth: ((r.g || 0) * 100).toFixed(1),
  }));

  const fmtP  = v => v == null ? "—" : (v * 100).toFixed(2) + "%";
  const fmtN  = (v, d=0) => v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits:d });

  return (
    <div className="fadein" style={{ padding: isMobile ? 16 : 32 }}>
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "300px 1fr", gap:24 }}>
        {/* ── LEFT PANEL ──────────────────────────────────────── */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* WACC / Ke Builder */}
          <Card>
            <Label accent={isF ? "COST OF EQUITY" : "WACC BUILDER"}>DISCOUNT RATE</Label>

            <SliderRow label="10Y G-Sec (Rf)" value={rf} setValue={setRf} min={0.04} max={0.10} step={0.001}
              hint="RBI 10-year benchmark yield" />
            <SliderRow label="Equity Risk Premium" value={erp} setValue={setErp} min={0.04} max={0.10} step={0.0025}
              hint="Mature ERP added to the G-Sec (already embeds country risk). ~5% → Ke ≈ Damodaran India 7.46% on default-adjusted Rf." />
            <SliderRow label="Beta (β)" value={beta} setValue={setBeta} min={0.4} max={2.0} step={0.05}
              display={v => v.toFixed(2) + "x"}
              hint={`Damodaran ${template} sector βU = ${(SECTOR_UNLEVERED_BETAS[template]??0.90).toFixed(2)}, relevered`} />

            {!isF && (
              <>
                <SliderRow label="Cost of Debt (pre-tax)" value={kd} setValue={setKd} min={0.06} max={0.16} step={0.005} />
                <SliderRow label="Tax rate" value={taxRate} setValue={setTaxRate} min={0.15} max={0.35} step={0.005} />
              </>
            )}

            <HL />
            {/* Live WACC formula */}
            <div style={{ background:"rgba(10,9,7,0.6)", padding:"12px 14px", fontFamily:"'JetBrains Mono',monospace", fontSize:12, lineHeight:1.9, color:"#857d65" }}>
              {isF ? (
                <>
                  <div>Ke = Rf + β × ERP</div>
                  <div>Ke = <span style={{color:C.text}}>{fmtP(rf)}</span> + <span style={{color:C.text}}>{beta.toFixed(2)}</span> × <span style={{color:C.text}}>{fmtP(erp)}</span></div>
                  <div style={{color:C.gold, fontWeight:600}}>Ke = {fmtP(ke)}</div>
                </>
              ) : (
                <>
                  <div>Ke = {fmtP(rf)} + {beta.toFixed(2)} × {fmtP(erp)} = <span style={{color:C.green}}>{fmtP(ke)}</span></div>
                  <div>Kd(post-tax) = {fmtP(kd)} × (1−{fmtP(taxRate)}) = <span style={{color:C.green}}>{fmtP(kd*(1-taxRate))}</span></div>
                  <div>E% = {(( 1-debtW)*100).toFixed(1)}%  ·  D% = {(debtW*100).toFixed(1)}%</div>
                  <div style={{color:C.gold, fontWeight:600}}>WACC = {fmtP(wacc)}</div>
                </>
              )}
            </div>
          </Card>

          {/* Growth assumptions */}
          <Card>
            <Label accent="3-STAGE">GROWTH INPUTS</Label>

            {isF ? (
              <>
                <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.15em", color:"#5b5440", marginBottom:10 }}>STAGE 1 — EXPLICIT FORECAST</div>
                <SliderRow label="Forecast ROE (Yr 1)" value={forecastROE} setValue={setForecastROE} min={0.08} max={0.40} step={0.005} />
                <SliderRow label="Stage 1 Years"       value={N1}          setValue={setN1}          min={3} max={8} step={1} display={v=>v+"  yrs"} />
                <HL />
                <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.15em", color:"#5b5440", marginBottom:10 }}>STAGE 2 — FADE</div>
                <SliderRow label="Terminal ROE"         value={terminalROE}   setValue={setTerminalROE} min={0.08} max={0.25} step={0.005}
                  hint="ROE converges → Ke + 2% in perpetuity" />
                <SliderRow label="Dividend payout"      value={payout}        setValue={setPayout}      min={0} max={0.60} step={0.01} />
                <SliderRow label="Stage 2 Years"        value={N2}            setValue={setN2}          min={3} max={8}  step={1} display={v=>v+"  yrs"} />
                <HL />
                <SliderRow label="Terminal growth (g∞)" value={gT}  setValue={setGT}  min={0.02} max={MAX_G} step={0.005}
                  hint={`Cap: ${(MAX_G*100).toFixed(0)}% (India nominal GDP proxy)`} />
              </>
            ) : (
              <>
                <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.15em", color:"#5b5440", marginBottom:10 }}>STAGE 1 — HIGH GROWTH</div>
                <SliderRow label="Revenue growth"    value={g1}          setValue={setG1}         min={0.02} max={0.40} step={0.005} />
                <SliderRow label="EBIT margin"       value={ebitMargin}  setValue={setEbitMargin} min={0.02} max={0.40} step={0.005}
                  hint="NOPAT = EBIT × (1 - tax)" />
                <SliderRow label="Stage 1 Years"     value={N1}          setValue={setN1}          min={3} max={8}  step={1} display={v=>v+"  yrs"} />
                <HL />
                <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.15em", color:"#5b5440", marginBottom:10 }}>STAGE 2 — FADE</div>
                <SliderRow label="Fade-period growth"  value={g2}  setValue={setG2}  min={0.01} max={0.25} step={0.005} />
                <SliderRow label="Stage 2 Years"       value={N2}  setValue={setN2}  min={3}    max={8}    step={1} display={v=>v+"  yrs"} />
                <HL />
                <SliderRow label="Terminal growth (g∞)" value={gT} setValue={setGT} min={0.02} max={MAX_G} step={0.005}
                  hint="Reinvestment = g∞ / terminal ROIC (converges to WACC)" />
              </>
            )}
          </Card>

          {/* Exit multiple / P/E */}
          <Card>
            <Label accent="CROSS-CHECK">MULTIPLES</Label>
            {!isF && (
              <SliderRow label={`EV/EBITDA (Damodaran ${template})`} value={evMultiple} setValue={setEvMultiple}
                min={4} max={40} step={0.5} display={v=>v.toFixed(1)+"x"}
                hint={`Sector median = ${SECTOR_EV_EBITDA[template]??12}x`} />
            )}
            <SliderRow label="P/E Multiple" value={peMultiple} setValue={setPeMultiple}
              min={8} max={40} step={0.5} display={v=>v.toFixed(1)+"x"} />

            <HL />
            <div style={{ ...sans, fontSize:11, color:"#5b5440", lineHeight:1.65 }}>
              {isF
                ? "Blended = RI 65% · Justified P/B 20% · P/E 15%"
                : "Blended = FCFF DCF 55% · Exit Multiple 30% · P/E 15%"}
            </div>
          </Card>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────── */}
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

          {/* Hero blended value */}
          <Card style={{ position:"relative", overflow:"hidden" }}>
            <div style={{
              position:"absolute", inset:0, pointerEvents:"none",
              backgroundImage:`linear-gradient(rgba(220,213,193,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(220,213,193,.025) 1px,transparent 1px)`,
              backgroundSize:"56px 56px", opacity:0.5,
            }} />
            <div style={{ position:"relative" }}>
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap:24, alignItems:"start", marginBottom:16 }}>
                <div>
                  <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:"#857d65" }}>Blended Intrinsic Value · {scenario.toUpperCase()}</div>
                  <div style={{ ...serif, fontSize:72, color:C.text, lineHeight:1, letterSpacing:"-0.02em", marginTop:6 }}>₹{fmtN(iv)}</div>
                  <div style={{ ...sans, fontSize:14, marginTop:8, color:mos>=0?C.green:C.red }}>
                    <span style={{ fontWeight:600 }}>{mos>=0?"+":""}{(mos*100).toFixed(1)}%</span>
                    <span style={{ color:"#857d65", marginLeft:8 }}>margin of safety vs ₹{fmtN(price)} CMP</span>
                  </div>
                </div>
                {/* Method breakdown */}
                <div style={{ minWidth:220 }}>
                  {blend.components.map(c => (
                    <div key={c.method} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"6px 0", borderBottom:`1px solid rgba(220,213,193,.07)` }}>
                      <div>
                        <div style={{ ...sans, fontSize:11, color:"#857d65" }}>{c.method}</div>
                        <div style={{ ...sans, fontSize:10, color:"#3a3528" }}>{(c.weight*100).toFixed(0)}% weight</div>
                      </div>
                      <span style={{ ...mono, fontSize:13, color:C.text }}>₹{fmtN(c.value)}</span>
                    </div>
                  ))}
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0 0", alignItems:"baseline" }}>
                    <span style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em", color:C.gold }}>Blended</span>
                    <span style={{ ...serif, fontSize:22, color:C.gold }}>₹{fmtN(iv)}</span>
                  </div>
                </div>
              </div>

              {/* TV% check */}
              <div style={{ display:"flex", gap:24, ...mono, fontSize:11, color:"#857d65" }}>
                <span>TV = {v.tvPct?.toFixed(1) ?? "—"}% of total</span>
                {isF
                  ? <span>Ke = {fmtP(ke)} · Justified P/B = {(v.justifiedPB??0).toFixed(2)}x</span>
                  : <span>WACC = {fmtP(wacc)} · Current ROIC = {fmtP(v.currentROIC)}</span>}
                <span style={{ color:v.tvPct>80||v.tvPct<40 ? C.red : C.green }}>
                  {v.tvPct>80?"⚠ TV heavy — reduce terminal growth":v.tvPct<40?"ℹ TV light — long growth runway":"✓ TV% in range"}
                </span>
              </div>
            </div>
          </Card>

          {/* Reverse DCF — market-implied expectations */}
          <Card>
            <Label accent="WHAT THE PRICE IMPLIES">REVERSE DCF</Label>
            {reverse == null ? (
              <div style={{ ...sans, fontSize:12, color:"#857d65" }}>Not computable from available data.</div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div>
                  <div style={{ ...sans, fontSize:11, color:"#857d65", textTransform:"uppercase", letterSpacing:"0.08em" }}>{reverse.label}</div>
                  <div style={{ ...serif, fontSize:40, color:C.gold, lineHeight:1.1, marginTop:4 }}>
                    {reverse.bounded === "above" ? ">" : reverse.bounded === "below" ? "<" : ""}{(reverse.value*100).toFixed(1)}%
                  </div>
                  <div style={{ ...sans, fontSize:11, color:"#5b5440", marginTop:4 }}>implied by CMP ₹{fmtN(price)}</div>
                </div>
                <div>
                  <div style={{ ...sans, fontSize:11, color:"#857d65", textTransform:"uppercase", letterSpacing:"0.08em" }}>Your forecast</div>
                  <div style={{ ...serif, fontSize:40, color:C.text, lineHeight:1.1, marginTop:4 }}>{(fwdDriver*100).toFixed(1)}%</div>
                  <div style={{ ...sans, fontSize:11, color: fwdDriver >= reverse.value ? C.green : C.red, marginTop:4 }}>
                    {fwdDriver >= reverse.value
                      ? "Your forecast clears the bar → upside"
                      : "Market expects more than your forecast → caution"}
                  </div>
                </div>
                {reverse.note && (
                  <div style={{ gridColumn:"1/-1", ...sans, fontSize:11, color:"#857d65", lineHeight:1.6 }}>{reverse.note}</div>
                )}
              </div>
            )}
          </Card>

          {/* Projection chart */}
          <Card style={{ padding:"16px 12px 12px" }}>
            <div style={{ padding:"0 8px 12px" }}>
              <Label accent={isF?"₹ CR · RI SCHEDULE":"₹ CR · FCFF SCHEDULE"}>
                {isF ? "RESIDUAL INCOME PROJECTION" : "FCFF PROJECTION"}
              </Label>
            </div>
            <div style={{ height:220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top:8, right:20, left:-10, bottom:0 }}>
                  <CartesianGrid strokeDasharray="2 3" stroke="rgba(220,213,193,.07)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill:"#857d65", fontSize:11 }} axisLine={{ stroke:"rgba(220,213,193,.1)" }} tickLine={false} />
                  <YAxis tick={{ fill:"#857d65", fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?(v/1000).toFixed(0)+"k":v} />
                  <Tooltip contentStyle={{ background:"#181510", border:"1px solid #2c2820", borderRadius:0, fontSize:12 }} labelStyle={{ color:C.text }}
                    formatter={(v,n)=>["₹"+fmtN(v)+" Cr", n==="fcff"?(isF?"RI (₹ Cr)":"FCFF (₹ Cr)"):"PV (₹ Cr)"]} />
                  <Bar dataKey="fcff" fill="rgba(212,169,62,.20)" stroke="rgba(212,169,62,.4)" radius={[2,2,0,0]} />
                  <Line type="monotone" dataKey="pv" stroke={C.gold} strokeWidth={2.5} dot={{ fill:C.gold, r:3 }} name="PV" />
                  <ReferenceLine x={"Y"+N1} stroke="rgba(220,213,193,.25)" strokeDasharray="2 4"
                    label={{ value:"Fade", fill:"#857d65", fontSize:10, position:"top" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Monte Carlo */}
          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <Label accent="500 SIMULATIONS">MONTE CARLO</Label>
              {!showMC && (
                <button onClick={runMC} style={{
                  ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.14em", fontWeight:500,
                  padding:"8px 16px", border:`1px solid ${C.gold}99`, color:C.gold,
                  background:C.gold+"0d", cursor:"pointer",
                }}>Run Simulation</button>
              )}
            </div>

            {!showMC && (
              <div style={{ ...sans, fontSize:12, color:"#857d65", lineHeight:1.7 }}>
                Simulate 500 scenarios by randomly varying growth (σ=30%), margin (σ=15%), discount rate (σ=75bps) and terminal growth (σ=50bps) to produce a probability distribution of intrinsic values.
              </div>
            )}

            {showMC && mcResult && (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:16 }}>
                  {[["P10 (Bear)",mcResult.p10,"neg"],["P25",mcResult.p25,null],["P50 (Median)",mcResult.p50,"gold"],["P75",mcResult.p75,null],["P90 (Bull)",mcResult.p90,"pos"]].map(([l,v,t]) => (
                    <div key={l} style={{ textAlign:"center", background:"rgba(10,9,7,.5)", padding:"10px 6px" }}>
                      <div style={{ ...sans, fontSize:10, color:"#857d65", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.08em" }}>{l}</div>
                      <div style={{ ...mono, fontSize:14, color:t==="gold"?C.gold:t==="pos"?C.green:t==="neg"?C.red:C.text }}>₹{fmtN(v)}</div>
                    </div>
                  ))}
                </div>

                <div style={{ height:140 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mcResult.histogram} margin={{ top:4, right:10, left:-20, bottom:0 }}>
                      <CartesianGrid strokeDasharray="2 3" stroke="rgba(220,213,193,.07)" vertical={false} />
                      <XAxis dataKey="x" tick={{ fill:"#857d65", fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v=>"₹"+fmtN(v)} />
                      <YAxis tick={{ fill:"#857d65", fontSize:9 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background:"#181510", border:"1px solid #2c2820", fontSize:11 }}
                        formatter={(v,n,p)=>[p.payload.pct.toFixed(1)+"%","Probability"]} labelFormatter={v=>"₹"+fmtN(v)} />
                      <Bar dataKey="count">
                        {mcResult.histogram.map((b,i) => (
                          <Cell key={i} fill={b.x>=price ? "rgba(90,143,90,.55)" : "rgba(168,81,72,.40)"} />
                        ))}
                      </Bar>
                      <ReferenceLine x={price} stroke={C.gold} strokeWidth={1.5} strokeDasharray="3 3"
                        label={{ value:"CMP", fill:C.gold, fontSize:10, position:"top" }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ marginTop:10, display:"flex", gap:20, ...sans, fontSize:12 }}>
                  <div>Mean: <span style={{ ...mono, color:C.gold }}>₹{fmtN(mcResult.mean)}</span></div>
                  <div>Prob. undervalued: <span style={{ ...mono, color:mcResult.probUpside>0.5?C.green:C.red }}>{(mcResult.probUpside*100).toFixed(0)}%</span></div>
                  <div>Simulations: <span style={{ ...mono, color:"#857d65" }}>{mcResult.simulations}</span></div>
                  <button onClick={runMC} style={{ ...sans, fontSize:11, background:"transparent", border:`1px solid rgba(220,213,193,.15)`, color:"#857d65", padding:"3px 10px", cursor:"pointer" }}>Re-run</button>
                </div>
              </>
            )}
          </Card>

          {/* Sensitivity grid */}
          <Card style={{ padding:"16px" }}>
            <div style={{ marginBottom:8 }}>
              <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:"#857d65" }}>INTRINSIC VALUE · ₹ / SHARE</div>
              <div style={{ ...serif, fontSize:20, color:C.text, marginTop:2 }}>Sensitivity — Discount Rate × Terminal Growth</div>
              <div style={{ ...sans, fontSize:11, color:"#5b5440", marginTop:4 }}>Rows: ±100bps on {isF?"Ke":"WACC"} · Cols: ±100bps on g∞ · Centre = base case</div>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse", marginTop:12 }}>
                <thead>
                  <tr>
                    <th style={{ ...sans, textAlign:"left", color:"#857d65", fontSize:10, paddingBottom:8, paddingRight:12 }}>
                      {isF?"Ke":"WACC"} ↓ / g∞ →
                    </th>
                    {sens.dG.map((g, i) => (
                      <th key={i} style={{ ...mono, textAlign:"right", color:"#857d65", fontSize:10, paddingBottom:8, paddingLeft:8 }}>
                        {(g>=0?"+":"")+(g*100).toFixed(1)}%
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sens.grid.map((row, ri) => (
                    <tr key={ri}>
                      <td style={{ ...mono, color:"#857d65", fontSize:11, paddingRight:12, paddingBottom:6 }}>
                        {(sens.dR[ri]>=0?"+":"")+(sens.dR[ri]*100).toFixed(1)}%
                      </td>
                      {row.map((cell, ci) => {
                        const pct2 = cell ? ((cell - price) / price) * 100 : null;
                        const isBase = ri === 2 && ci === 2;
                        return (
                          <td key={ci} style={{
                            ...mono, textAlign:"right", fontSize:12, padding:"6px 8px", fontWeight:isBase?600:400,
                            background:isBase ? C.gold+"33" : pct2>15 ? "rgba(90,143,90,.15)" : pct2!=null&&pct2<-10 ? "rgba(168,81,72,.15)" : "transparent",
                            color:isBase ? C.gold : pct2>15 ? C.green : pct2!=null&&pct2<-10 ? C.red : "#b8b09a",
                            outline:isBase ? `1px solid ${C.gold}66` : "none",
                          }}>
                            {cell ? "₹"+fmtN(cell) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display:"flex", gap:16, marginTop:10 }}>
                {[["Upside >15%","rgba(90,143,90,.4)"],["Downside >10%","rgba(168,81,72,.4)"],["Base case",C.gold+"55"]].map(([l,c]) => (
                  <span key={l} style={{ display:"flex", alignItems:"center", gap:6, ...sans, fontSize:10, textTransform:"uppercase", color:"#857d65" }}>
                    <span style={{ width:8, height:8, background:c, display:"inline-block" }} />{l}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* Year-by-year schedule */}
          <Card style={{ padding:0, overflow:"hidden" }}>
            <div style={{ padding:"16px 20px 8px" }}>
              <Label accent={isF?"COST OF EQUITY · ROE FADE":"WACC · ROIC CONVERGENCE"}>
                {isF ? "RESIDUAL INCOME SCHEDULE" : "FCFF SCHEDULE"}
              </Label>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ borderTop:`1px solid rgba(220,213,193,.08)`, borderBottom:`1px solid rgba(220,213,193,.08)` }}>
                    {(isF
                      ? ["Year","Stage","BV/sh","ROE","EPS","DPS","Excess Ret","PV(RI)","Cum PV"]
                      : ["Year","Stage","Growth","NOPAT","ROIC","RR","FCFF","Disc","PV"]
                    ).map((h,i) => (
                      <th key={i} style={{ ...sans, textAlign:i===0?"left":"right", padding:"8px 10px", fontSize:10, textTransform:"uppercase", color:"#857d65", fontWeight:500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {v.rows?.map((r, i) => (
                    <tr key={i} style={{ borderBottom:`1px solid rgba(220,213,193,.05)`, background:r.stage===2?"rgba(58,53,40,.2)":"transparent" }}>
                      {isF ? [
                        ["Y"+r.year,"left"],
                        [r.stage===1?"1 · High":"2 · Fade","left"],
                        ["₹"+fmtN(r.bv,1)],
                        [fmtP(r.roe)],
                        ["₹"+fmtN(r.eps,1)],
                        ["₹"+fmtN(r.dps,1)],
                        ["₹"+fmtN(r.ri,1)],
                        ["₹"+fmtN(r.pvRI,1)],
                        ["₹"+fmtN(r.cumPv,1)],
                      ].map(([val,align],j) => (
                        <td key={j} style={{ ...mono, textAlign:align||"right", padding:"7px 10px", color:j===0?C.text200:"#b8b09a", fontSize:11 }}>{val}</td>
                      )) : [
                        ["Y"+r.year,"left"],
                        [r.stage===1?"1 · High":"2 · Fade","left"],
                        [fmtP(r.g)],
                        ["₹"+fmtN(r.nopat,0)+" Cr"],
                        [fmtP(r.roic)],
                        [(r.rr*100).toFixed(0)+"%"],
                        ["₹"+fmtN(r.fcff,0)+" Cr"],
                        [r.df?.toFixed(3)],
                        ["₹"+fmtN(r.pv,0)+" Cr"],
                      ].map(([val,align],j) => (
                        <td key={j} style={{ ...mono, textAlign:align||"right", padding:"7px 10px", color:j===0?C.text200:"#b8b09a", fontSize:11 }}>{val}</td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ borderTop:`1px solid ${C.gold}55`, background:`${C.gold}0d` }}>
                    <td colSpan={isF?6:7} style={{ ...sans, padding:"8px 10px", color:C.gold, fontSize:11, fontWeight:500 }}>TERMINAL VALUE</td>
                    <td style={{ ...mono, textAlign:"right", padding:"8px 10px", color:C.gold, fontSize:11 }}>₹{fmtN(v.tvRaw,0)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"8px 10px", color:C.gold, fontSize:11 }}>PV ₹{fmtN(v.tvPv,0)}</td>
                    {!isF && <td />}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Methodology note */}
          <Card style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
            <Info size={14} color={C.gold} style={{ flexShrink:0, marginTop:2 }} />
            <div style={{ ...sans, fontSize:12, color:"#857d65", lineHeight:1.7 }}>
              <strong style={{ color:C.text }}>Methodology.</strong>{" "}
              {isF
                ? "Residual Income (Excess Return) model — appropriate for financial firms where debt is an operating input. Ke from CAPM (India 10Y G-Sec ~6.9% + β × ~5% ERP). ROE fades to terminal ROE over the explicit horizon. Terminal RI = (ROE − Ke) × BV / (Ke − g)."
                : "3-Stage FCFF DCF. FCFF = NOPAT × (1 − RR), where RR = g/ROIC (reinvestment rate). ROIC converges from current to sector median (Damodaran India). WACC = Ke × E% + Kd(1−t) × D%. Terminal value capped when ROIC = WACC."}{" "}
              Exit multiple uses Damodaran India sector EV/EBITDA medians (Jan 2025).
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
