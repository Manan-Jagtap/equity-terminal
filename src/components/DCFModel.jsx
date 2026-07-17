/**
 * DCFModel.jsx — interactive valuation tab.
 *
 * UNIFIED ENGINE: every number here is computed by lib/engine.js, a bit-for-bit
 * port of the backend (app/engines.py, proven by tests/engineParity.mjs). The
 * sliders edit the SAME parameter set the backend derives (snake_case), seeded
 * from apiVal.assumptions — so the base case equals the backend headline exactly
 * and the first slider touch moves smoothly. There is no second model.
 *
 * Sections: blended headline + method breakdown · reverse DCF · projection chart
 * · Monte Carlo · sensitivity grid · year-by-year schedule.
 */
import { useMemo, useState, useRef, useEffect } from "react";
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { Info } from "lucide-react";

import { C, mono, sans, serif } from "../lib/theme.js";
import { useIsMobile } from "../lib/useResponsive.js";
import SegmentSOTP from "./SegmentSOTP.jsx";
import * as engine from "../lib/engine.js";
import { deriveClientAssumptions, isEngineDialect } from "../lib/derive.js";

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

const fmtN = (v, d=0) => v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits:d });
const fmtP = v => v == null || !isFinite(v) ? "—" : (v * 100).toFixed(2) + "%";
const verdColor = v => !v ? C.dim : /buy|accumulate/i.test(v) ? C.green : /hold/i.test(v) ? C.gold : C.red;
const liveVerdictOf = (mos) => mos == null ? "—"
  : mos > 0.15 ? "BUY" : mos > 0.05 ? "ACCUMULATE" : mos >= -0.10 ? "HOLD" : mos >= -0.25 ? "REDUCE" : "AVOID";

/* ── Main component ─────────────────────────────────────────────── */
const ENGINE_KEYS = ["risk_free","erp","beta","tax_rate","terminal_growth","fade_years",
  "rev_growth","ebit_margin","reinvest_rate","debt_weight","cost_debt",
  "forecast_roe","terminal_roe","payout","_valuation_sector"];

export default function DCFModel({ co, price, apiVal, a, onWork }) {
  const isMobile = useIsMobile();
  const isF = co.type === "financial" || ["NBFC","BANK","INSURANCE"].includes(co.template_code);

  // Base assumption block = the backend's OWN derived drivers (snake_case),
  // OVERLAID with any engine-dialect keys in the shared `assumptions` state —
  // that's how a loaded scenario or a shared ?scenario= link actually reaches
  // the sliders (they were disconnected before: wiring audit #5). The parent
  // re-keys this component on scenario load, so useState re-seeds.
  // FALLBACK floor: when the backend valuation hasn't loaded (seed mode), seed
  // the sliders from lib/derive.js — the backend's own derivation run locally —
  // so the tab opens AT the same base case the screener/header shows. The `a`
  // overlay only applies when the shared state is unambiguously engine-dialect
  // (a loaded scenario / backend-seeded block): legacy camelCase seed
  // assumptions share the beta/erp/payout key names and must not leak in.
  // Memoized: deriveClientAssumptions runs the whole backend-parity derivation,
  // and it's only needed to SEED the sliders (useState reads it on mount). The
  // component is re-keyed on scenario/ticker load, so this recomputes exactly
  // when it must, not on every render/slider drag (audit E5).
  const base = useMemo(() => ({
    ...deriveClientAssumptions(co, null),
    ...(apiVal?.assumptions || {}),
    ...(isEngineDialect(a)
      ? Object.fromEntries(ENGINE_KEYS.filter(k => a?.[k] !== undefined).map(k => [k, a[k]]))
      : {}),
  }), [co, apiVal, a]);
  const vs = base._valuation_sector || co.valuation_sector || co.template_code || "MANUFACTURING";
  const sp = engine.params(vs);

  // ── Sliders (the backend's parameter set) ──
  const [rf,   setRf]   = useState(base.risk_free ?? engine.RISK_FREE);
  const [erp,  setErp]  = useState(base.erp ?? engine.ERP);
  const [beta, setBeta] = useState(base.beta ?? sp.beta);
  const [taxRate, setTaxRate] = useState(base.tax_rate ?? 0.25);
  const [gT,   setGT]   = useState(base.terminal_growth ?? sp.terminal_growth);
  const [fadeYears, setFadeYears] = useState(base.fade_years ?? 8);
  // non-financial
  const [revGrowth, setRevGrowth] = useState(base.rev_growth ?? 0.10);
  const [ebitMargin, setEbitMargin] = useState(base.ebit_margin ?? 0.15);
  const [reinvest, setReinvest] = useState(base.reinvest_rate ?? 0.40);
  const [debtW, setDebtW] = useState(base.debt_weight ?? 0.20);
  const [costDebt, setCostDebt] = useState(base.cost_debt ?? 0.085);
  // financial
  const [forecastROE, setForecastROE] = useState(base.forecast_roe ?? 0.15);
  const [terminalROE, setTerminalROE] = useState(base.terminal_roe ?? 0.13);
  const [payout, setPayout] = useState(base.payout ?? 0.25);

  // ── Working assumption block fed to the engine ──
  const aWork = {
    risk_free: rf, erp, beta, tax_rate: taxRate,
    terminal_growth: gT, fade_years: fadeYears,
    rev_growth: revGrowth, ebit_margin: ebitMargin, reinvest_rate: reinvest,
    debt_weight: debtW, cost_debt: costDebt,
    forecast_roe: forecastROE, terminal_roe: terminalROE, payout,
    _valuation_sector: vs,
  };
  const coSnake = useMemo(() => engine.toEngineCo(co, price), [co, price]);

  // Serialize the working assumptions ONCE per render and reuse the string as
  // the stable memo/effect key everywhere below (audit E5 — it was stringified
  // 3× per render and re-used inline in useMemo deps, the classic perf trap on
  // every slider drag).
  const aKey = JSON.stringify(aWork);

  // Mirror sliders up into the shared assumptions so Save-scenario captures
  // what the user actually set (guarded: only fires when values change).
  const lastMirror = useRef(null);
  useEffect(() => {
    if (onWork && lastMirror.current !== aKey) {
      lastMirror.current = aKey;
      onWork(aWork);
    }
  }, [aKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const eb  = useMemo(() => engine.blended(coSnake, aWork), [coSnake, aKey]);
  const v   = eb.valuation;
  const iv  = eb.blended;
  const mos = (iv != null && price) ? iv / price - 1 : null;

  // Untouched → backend canonical (identical to screener & header); touched →
  // the live engine recompute. Same model either way, so no jump on first touch.
  const baseKeyRef = useRef(null);
  if (baseKeyRef.current === null) baseKeyRef.current = aKey;
  const touched = aKey !== baseKeyRef.current;

  const apiRec  = apiVal?.recommendation;
  const apiIv   = apiRec?.blended ?? apiRec?.intrinsic;
  const apiMos  = apiRec?.mos;
  const apiVerd = apiRec?.verdict;
  const apiComps = apiRec?.components || [];

  const showApi   = apiIv > 0 && !touched;
  const headIv    = showApi ? apiIv : iv;
  const headMos   = showApi ? apiMos : mos;
  const headVerd  = showApi ? apiVerd : liveVerdictOf(mos);
  const headComps = (showApi ? apiComps : eb.components) || [];
  const headKe    = v?.ke;
  const headWacc  = v?.wacc;
  const tvPct     = (v && v.tv_pv != null && v.pv_explicit != null && (v.pv_explicit + v.tv_pv) !== 0)
    ? (v.tv_pv / (v.pv_explicit + v.tv_pv)) * 100 : null;

  // Monte Carlo (deferred — expensive)
  const [mcResult, setMcResult] = useState(null);
  const runMC = () => setMcResult(engine.monteCarlo(coSnake, aWork, 500));

  const sens    = useMemo(() => engine.sensitivity(coSnake, aWork), [coSnake, aKey]);
  const reverse = useMemo(() => engine.reverseDCF(coSnake, aWork), [coSnake, aKey]);
  const fwdDriver = isF ? forecastROE : revGrowth;

  // Projection chart from the engine's own schedule rows.
  const rows = v?.rows || [];
  const chartData = rows.map(r => isF
    ? { year: "Y"+r.t, val: Math.round(r.ri * (co.shares || 1)), pv: Math.round((r.pv || 0) * (co.shares || 1)) }
    : { year: "Y"+r.t, val: Math.round(r.fcff || 0), pv: Math.round(r.pv || 0) });

  return (
    <div className="fadein" style={{ padding: isMobile ? 16 : 32 }}>
      {/* Conglomerates: a single DCF can't value them — offer an editable SOTP. */}
      <SegmentSOTP ticker={co.ticker} price={price} isMobile={isMobile} />

      {headIv > 0 && (
        <Card style={{ marginBottom:24, borderColor:`${C.gold}3d`, position:"relative", overflow:"hidden" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16 }}>
            <div>
              <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:"#857d65" }}>
                Valuation · Blended Fair Value
                <span style={{ color: touched ? C.gold : "#3a3528", marginLeft:8 }}>
                  · {touched ? "your assumptions" : "base case"}
                </span>
              </div>
              <div style={{ display:"flex", alignItems:"baseline", gap:16, marginTop:8, flexWrap:"wrap" }}>
                <span style={{ ...serif, fontSize:64, color:C.text, lineHeight:1, letterSpacing:"-0.02em" }}>₹{fmtN(headIv)}</span>
                <span style={{ ...sans, fontSize:16, fontWeight:600, color: (headMos ?? 0)>=0?C.green:C.red }}>
                  {(headMos ?? 0)>=0?"+":""}{((headMos ?? 0)*100).toFixed(1)}% MoS
                </span>
                <span style={{ ...sans, fontSize:13, fontWeight:600, padding:"4px 12px", borderRadius:6,
                  color:verdColor(headVerd), border:`1px solid ${verdColor(headVerd)}55` }}>{headVerd}</span>
              </div>
              <div style={{ ...sans, fontSize:11, color:"#5b5440", marginTop:10, lineHeight:1.6, maxWidth:600 }}>
                {isF ? "Ke" : "WACC"} {fmtP(isF ? headKe : headWacc)} · triangulated from this company's own history.
                {touched
                  ? " Reflecting your slider changes — reset by reloading. Base case matches the screener & header."
                  : " This is the figure shown on the screener and the company header — one engine, no drift."}
              </div>
            </div>
          </div>

          {headComps.length > 0 && (
            <div style={{ display:"grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : `repeat(${headComps.length + 1}, 1fr)`,
              gap:12, marginTop:22 }}>
              {headComps.map(c => (
                <div key={c.method} style={{ background:"rgba(10,9,7,0.45)", border:"1px solid rgba(220,213,193,.08)", padding:"14px 16px" }}>
                  <div style={{ ...sans, fontSize:11, color:"#857d65", textTransform:"uppercase", letterSpacing:"0.05em" }}>{c.method}</div>
                  <div style={{ ...serif, fontSize:32, color: c.value>0 ? C.text : "#4a4537", marginTop:6, lineHeight:1 }}>
                    {c.value>0 ? "₹"+fmtN(c.value) : "N/A"}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10 }}>
                    <div style={{ flex:1, height:4, background:"rgba(220,213,193,.08)", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ width:`${c.weight*100}%`, height:"100%", background: c.value>0 ? C.gold+"aa" : "#4a4537" }} />
                    </div>
                    <span style={{ ...mono, fontSize:11, color:"#857d65" }}>{(c.weight*100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
              <div style={{ background:C.gold+"14", border:`1px solid ${C.gold}55`, padding:"14px 16px", display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
                <div style={{ ...sans, fontSize:11, color:C.gold, textTransform:"uppercase", letterSpacing:"0.05em" }}>Blended</div>
                <div style={{ ...serif, fontSize:32, color:C.gold, marginTop:6, lineHeight:1 }}>₹{fmtN(headIv)}</div>
                <div style={{ ...sans, fontSize:10, color:"#857d65", marginTop:10 }}>weighted fair value</div>
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:24, flexWrap:"wrap", ...mono, fontSize:11, color:"#857d65", marginTop:18, paddingTop:14, borderTop:"1px solid rgba(220,213,193,.07)" }}>
            <span>TV = {tvPct != null ? tvPct.toFixed(1) : "—"}% of total</span>
            {isF
              ? <span>Ke = {fmtP(headKe)}</span>
              : <span>WACC = {fmtP(headWacc)} · Reinvest = {fmtP(reinvest)}</span>}
            {tvPct != null && (
              <span style={{ color: tvPct>85||tvPct<35 ? C.red : C.green }}>
                {tvPct>85?"⚠ TV heavy — reduce terminal growth":tvPct<35?"ℹ TV light — long growth runway":"✓ TV% in range"}
              </span>
            )}
          </div>
        </Card>
      )}

      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "300px 1fr", gap:24 }}>
        {/* ── LEFT PANEL ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <Card>
            <Label accent={isF ? "COST OF EQUITY" : "WACC BUILDER"}>DISCOUNT RATE</Label>
            <SliderRow label="10Y G-Sec (Rf)" value={rf} setValue={setRf} min={0.04} max={0.10} step={0.001}
              hint="RBI 10-year benchmark yield" />
            <SliderRow label="Equity Risk Premium" value={erp} setValue={setErp} min={0.04} max={0.10} step={0.0025}
              hint="Mature ERP added to the G-Sec (already embeds country risk)." />
            <SliderRow label="Beta (β)" value={beta} setValue={setBeta} min={0.4} max={2.0} step={0.05}
              display={x => x.toFixed(2) + "x"}
              hint={`Sector β = ${sp.beta.toFixed(2)} (${vs})`} />
            {!isF && (
              <>
                {debtW > 0.001 && (
                  <SliderRow label="Cost of Debt (pre-tax)" value={costDebt} setValue={setCostDebt} min={0.06} max={0.16} step={0.005} />
                )}
                <SliderRow label="Debt weight" value={debtW} setValue={setDebtW} min={0} max={0.6} step={0.01}
                  hint="D / (D+E) used in the WACC" />
                <SliderRow label="Tax rate" value={taxRate} setValue={setTaxRate} min={0.15} max={0.35} step={0.005} />
              </>
            )}
            <HL />
            <div style={{ background:"rgba(10,9,7,0.6)", padding:"12px 14px", fontFamily:"'JetBrains Mono',monospace", fontSize:12, lineHeight:1.9, color:"#857d65" }}>
              <div>Ke = {fmtP(rf)} + {beta.toFixed(2)} × {fmtP(erp)} = <span style={{color:C.green}}>{fmtP(rf + beta*erp)}</span></div>
              {!isF && <>
                <div>Kd(post-tax) = {fmtP(costDebt)} × (1−{fmtP(taxRate)}) = <span style={{color:C.green}}>{fmtP(costDebt*(1-taxRate))}</span></div>
                <div style={{color:C.gold, fontWeight:600}}>WACC = {fmtP(headWacc)}</div>
              </>}
            </div>
          </Card>

          <Card>
            <Label accent={isF ? "RESIDUAL INCOME" : "FCFF"}>GROWTH & RETURNS</Label>
            {isF ? (
              <>
                <SliderRow label="Forecast ROE (Stage 1)" value={forecastROE} setValue={setForecastROE} min={0.06} max={0.30} step={0.005} />
                <SliderRow label="Terminal ROE"           value={terminalROE} setValue={setTerminalROE} min={0.08} max={0.22} step={0.005}
                  hint="ROE the franchise fades to in steady state" />
                <SliderRow label="Dividend payout"        value={payout}      setValue={setPayout}      min={0} max={0.70} step={0.01} />
              </>
            ) : (
              <>
                <SliderRow label="Revenue growth"   value={revGrowth} setValue={setRevGrowth} min={0.02} max={0.40} step={0.005}
                  hint="Starting growth, fades linearly to terminal" />
                <SliderRow label="EBIT margin"      value={ebitMargin} setValue={setEbitMargin} min={0.02} max={0.45} step={0.005}
                  hint="NOPAT = EBIT × (1 − tax)" />
                <SliderRow label="Reinvestment rate" value={reinvest}  setValue={setReinvest} min={0.05} max={0.80} step={0.01}
                  hint="Share of NOPAT reinvested · FCFF = NOPAT × (1 − reinvestment)" />
              </>
            )}
            <SliderRow label="Fade years" value={fadeYears} setValue={setFadeYears} min={5} max={12} step={1} display={x=>x+"  yrs"} />
            <SliderRow label="Terminal growth (g∞)" value={gT} setValue={setGT} min={0.02} max={0.07} step={0.005}
              hint="Capped below nominal GDP" />
          </Card>

          <Card>
            <Label accent="CROSS-CHECK">RELATIVE MULTIPLES</Label>
            <div style={{ ...sans, fontSize:11, color:"#857d65", lineHeight:1.9 }}>
              {isF ? (
                <>Sector P/E <span style={{ ...mono, color:C.text }}>{sp.exit_pe}x</span> · Justified P/B <span style={{ ...mono, color:C.text }}>{sp.exit_pb ?? "—"}x</span></>
              ) : (
                <>Sector EV/EBITDA <span style={{ ...mono, color:C.text }}>{sp.exit_ev_ebitda}x</span> · Sector P/E <span style={{ ...mono, color:C.text }}>{sp.exit_pe}x</span></>
              )}
            </div>
            <HL />
            <div style={{ ...sans, fontSize:11, color:"#5b5440", lineHeight:1.65 }}>
              {isF
                ? "Blended = RI 65% · Justified P/B 20% · P/E 15%"
                : "Blended = FCFF DCF 55% · Exit Multiple 30% · P/E 15%"}
              {" — sector-median multiples (Damodaran India), used as a cross-check, not user-set."}
            </div>
          </Card>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

          {/* Reverse DCF */}
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
                  <div style={{ ...sans, fontSize:11, color:"#857d65", textTransform:"uppercase", letterSpacing:"0.08em" }}>Your assumption</div>
                  <div style={{ ...serif, fontSize:40, color:C.text, lineHeight:1.1, marginTop:4 }}>{(fwdDriver*100).toFixed(1)}%</div>
                  <div style={{ ...sans, fontSize:11, color: fwdDriver >= reverse.value ? C.green : C.red, marginTop:4 }}>
                    {fwdDriver >= reverse.value
                      ? "Your assumption clears the bar → upside"
                      : "Market expects more than you assume → caution"}
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
              <Label accent={isF?"₹ CR · RESIDUAL INCOME":"₹ CR · FCFF SCHEDULE"}>
                {isF ? "RESIDUAL INCOME PROJECTION" : "FCFF PROJECTION"}
              </Label>
            </div>
            <div style={{ height:220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top:8, right:20, left:-10, bottom:0 }}>
                  <CartesianGrid strokeDasharray="2 3" stroke="rgba(220,213,193,.07)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill:"#857d65", fontSize:11 }} axisLine={{ stroke:"rgba(220,213,193,.1)" }} tickLine={false} />
                  <YAxis tick={{ fill:"#857d65", fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={x=>x>=1000?(x/1000).toFixed(0)+"k":x} />
                  <Tooltip contentStyle={{ background:"#181510", border:"1px solid #2c2820", borderRadius:0, fontSize:12 }} labelStyle={{ color:C.text }}
                    formatter={(x,n)=>["₹"+fmtN(x)+" Cr", n==="val"?(isF?"RI (₹ Cr)":"FCFF (₹ Cr)"):"PV (₹ Cr)"]} />
                  <Bar dataKey="val" fill="rgba(212,169,62,.20)" stroke="rgba(212,169,62,.4)" radius={[2,2,0,0]} />
                  <Line type="monotone" dataKey="pv" stroke={C.gold} strokeWidth={2.5} dot={{ fill:C.gold, r:3 }} name="PV" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Monte Carlo */}
          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <Label accent="500 SIMULATIONS">MONTE CARLO</Label>
              {!mcResult && (
                <button onClick={runMC} style={{
                  ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.14em", fontWeight:500,
                  padding:"8px 16px", border:`1px solid ${C.gold}99`, color:C.gold,
                  background:C.gold+"0d", cursor:"pointer",
                }}>Run Simulation</button>
              )}
            </div>
            {!mcResult && (
              <div style={{ ...sans, fontSize:12, color:"#857d65", lineHeight:1.7 }}>
                Simulate 500 scenarios by randomly varying growth (σ=30%), margin (σ=15%), discount rate (σ=75bps) and terminal growth (σ=50bps) to produce a probability distribution of the blended fair value.
              </div>
            )}
            {mcResult && mcResult.simulations > 0 && (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:16 }}>
                  {[["P10 (Bear)",mcResult.p10,"neg"],["P25",mcResult.p25,null],["P50 (Median)",mcResult.p50,"gold"],["P75",mcResult.p75,null],["P90 (Bull)",mcResult.p90,"pos"]].map(([l,x,t]) => (
                    <div key={l} style={{ textAlign:"center", background:"rgba(10,9,7,.5)", padding:"10px 6px" }}>
                      <div style={{ ...sans, fontSize:10, color:"#857d65", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.08em" }}>{l}</div>
                      <div style={{ ...mono, fontSize:14, color:t==="gold"?C.gold:t==="pos"?C.green:t==="neg"?C.red:C.text }}>₹{fmtN(x)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height:140 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mcResult.histogram} margin={{ top:4, right:10, left:-20, bottom:0 }}>
                      <CartesianGrid strokeDasharray="2 3" stroke="rgba(220,213,193,.07)" vertical={false} />
                      <XAxis dataKey="x" tick={{ fill:"#857d65", fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={x=>"₹"+fmtN(x)} />
                      <YAxis tick={{ fill:"#857d65", fontSize:9 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background:"#181510", border:"1px solid #2c2820", fontSize:11 }}
                        formatter={(x,n,p)=>[p.payload.pct.toFixed(1)+"%","Probability"]} labelFormatter={x=>"₹"+fmtN(x)} />
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
                <div style={{ marginTop:10, display:"flex", gap:20, ...sans, fontSize:12, flexWrap:"wrap" }}>
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
              <div style={{ ...sans, fontSize:11, color:"#5b5440", marginTop:4 }}>Rows: ±100bps on Rf · Cols: ±100bps on g∞ · Centre = base case (primary model)</div>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse", marginTop:12 }}>
                <thead>
                  <tr>
                    <th style={{ ...sans, textAlign:"left", color:"#857d65", fontSize:10, paddingBottom:8, paddingRight:12 }}>Rf ↓ / g∞ →</th>
                    {sens.g_deltas.map((g, i) => (
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
                        {(sens.rate_deltas[ri]>=0?"+":"")+(sens.rate_deltas[ri]*100).toFixed(1)}%
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
            </div>
          </Card>

          {/* Year-by-year schedule */}
          <Card style={{ padding:0, overflow:"hidden" }}>
            <div style={{ padding:"16px 20px 8px" }}>
              <Label accent={isF?"ROE · BOOK VALUE":"FCFF · PRESENT VALUE"}>
                {isF ? "RESIDUAL INCOME SCHEDULE" : "FCFF SCHEDULE"}
              </Label>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ borderTop:`1px solid rgba(220,213,193,.08)`, borderBottom:`1px solid rgba(220,213,193,.08)` }}>
                    {(isF ? ["Year","BV/sh","ROE","RI","PV(RI)"] : ["Year","Revenue (₹Cr)","FCFF (₹Cr)","PV (₹Cr)"]).map((h,i) => (
                      <th key={i} style={{ ...sans, textAlign:i===0?"left":"right", padding:"8px 12px", fontSize:10, textTransform:"uppercase", color:"#857d65", fontWeight:500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ borderBottom:`1px solid rgba(220,213,193,.05)` }}>
                      {(isF ? [
                        ["Y"+r.t,"left"], ["₹"+fmtN(r.bv_begin,1)], [fmtP(r.roe)], ["₹"+fmtN(r.ri,1)], ["₹"+fmtN(r.pv,1)],
                      ] : [
                        ["Y"+r.t,"left"], ["₹"+fmtN(r.rev,0)], ["₹"+fmtN(r.fcff,0)], ["₹"+fmtN(r.pv,0)],
                      ]).map(([val,align],j) => (
                        <td key={j} style={{ ...mono, textAlign:align||"right", padding:"7px 12px", color:j===0?C.text:"#b8b09a", fontSize:11 }}>{val}</td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ borderTop:`1px solid ${C.gold}55`, background:`${C.gold}0d` }}>
                    <td colSpan={isF?4:3} style={{ ...sans, padding:"8px 12px", color:C.gold, fontSize:11, fontWeight:500 }}>TERMINAL VALUE (PV)</td>
                    <td style={{ ...mono, textAlign:"right", padding:"8px 12px", color:C.gold, fontSize:11 }}>₹{fmtN(v?.tv_pv, isF?1:0)}{isF?"":" Cr"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Methodology */}
          <Card style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
            <Info size={14} color={C.gold} style={{ flexShrink:0, marginTop:2 }} />
            <div style={{ ...sans, fontSize:12, color:"#857d65", lineHeight:1.7 }}>
              <strong style={{ color:C.text }}>Methodology.</strong>{" "}
              {isF
                ? "Two-stage Residual Income (Excess Return). Ke from CAPM. ROE holds for the high-return phase then fades to terminal ROE; book compounds at ROE × retention. Terminal RI = (ROE−Ke)×BV / (Ke−g)."
                : "Single-stage FCFF DCF — revenue growth fades linearly to terminal over the fade horizon; FCFF = NOPAT × (1 − reinvestment). WACC = Ke×E% + Kd(1−t)×D%. Terminal reinvestment = g∞ / sector mature ROIC."}{" "}
              Identical math to the backend engine (proven by an automated parity test) — the interactive figure reconciles exactly with the headline.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
