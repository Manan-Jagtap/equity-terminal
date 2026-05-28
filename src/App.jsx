import React, { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Search, TrendingUp, Activity, Calculator, Layers, ChevronRight, ArrowLeft,
  CircleDollarSign, Gauge, ShieldAlert, Info, Database,
} from "lucide-react";

/* ============================================================================
   EQUITY RESEARCH TERMINAL  —  single-file analytical core
   - Residual-income (excess return) model for FINANCIALS (NBFCs/banks)
   - FCFF DCF for NON-FINANCIALS
   - CAPM-driven discount rates, sensitivity grids
   - Fundamentals ratios, technicals, explainable BUY/HOLD/AVOID verdict
   All figures below are ILLUSTRATIVE SAMPLE DATA — edit and replace with real ones.
   ========================================================================== */

const C = {
  bg: "#0b0d10", panel: "#13161b", panel2: "#181c22", line: "#262b33",
  text: "#e9e5db", dim: "#878d97", faint: "#5a606a",
  gold: "#d6a85a", goldDim: "#8a6f3c",
  green: "#46b98a", red: "#df6553", blue: "#5e93d6",
};

const fmt = (n, d = 0) =>
  n === null || n === undefined || isNaN(n) ? "—" :
  n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });
const inr = (n, d = 0) => "\u20B9" + fmt(n, d);
const pct = (n, d = 1) => (n === null || isNaN(n) ? "—" : (n * 100).toFixed(d) + "%");

/* deterministic PRNG so synthetic price series are stable per company */
function rng(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function makeSeries(seed, start, drift, vol, n = 250) {
  const r = rng(seed); const out = []; let p = start;
  for (let i = 0; i < n; i++) {
    p = p * (1 + drift / n + (r() - 0.5) * vol);
    out.push({ i, close: +p.toFixed(1) });
  }
  return out;
}

/* ---------------------------------------------------------------------------
   SEED UNIVERSE — illustrative. Replace `price`, `equity`, financials, etc.
   `type: financial` routes to the residual-income model.
--------------------------------------------------------------------------- */
const SEED = [
  {
    id: 1, name: "Muthoot Finance", ticker: "MUTHOOTFIN", type: "financial",
    sector: "Gold Loan NBFC", price: 1980, shares: 40.1, equity: 26500, netProfit: 4470,
    nbfc: { aum: 92000, gnpa: 0.029, nnpa: 0.026, crar: 0.288, nim: 0.115, roa: 0.052, pledge: 0 },
    assumptions: { beta: 1.05, riskFree: 0.069, erp: 0.065, forecastRoe: 0.225, terminalRoe: 0.155, payout: 0.22, fadeYears: 8, terminalGrowth: 0.05 },
    series: makeSeries(11, 1650, 0.20, 0.022),
  },
  {
    id: 2, name: "Manappuram Finance", ticker: "MANAPPURAM", type: "financial",
    sector: "Gold Loan NBFC", price: 178, shares: 84.6, equity: 11900, netProfit: 2200,
    nbfc: { aum: 44000, gnpa: 0.045, nnpa: 0.040, crar: 0.302, nim: 0.135, roa: 0.048, pledge: 0 },
    assumptions: { beta: 1.20, riskFree: 0.069, erp: 0.065, forecastRoe: 0.195, terminalRoe: 0.140, payout: 0.20, fadeYears: 8, terminalGrowth: 0.045 },
    series: makeSeries(23, 150, 0.16, 0.028),
  },
  {
    id: 3, name: "Fedbank Financial (Fedfina)", ticker: "FEDFINA", type: "financial",
    sector: "Diversified NBFC", price: 118, shares: 37.0, equity: 2400, netProfit: 280,
    nbfc: { aum: 14500, gnpa: 0.020, nnpa: 0.015, crar: 0.205, nim: 0.080, roa: 0.022, pledge: 0 },
    assumptions: { beta: 1.10, riskFree: 0.069, erp: 0.065, forecastRoe: 0.135, terminalRoe: 0.135, payout: 0.0, fadeYears: 9, terminalGrowth: 0.06 },
    series: makeSeries(37, 95, 0.22, 0.030),
  },
  {
    id: 4, name: "IIFL Finance", ticker: "IIFL", type: "financial",
    sector: "Diversified NBFC", price: 430, shares: 42.5, equity: 11200, netProfit: 1550,
    nbfc: { aum: 78000, gnpa: 0.024, nnpa: 0.012, crar: 0.213, nim: 0.090, roa: 0.024, pledge: 0 },
    assumptions: { beta: 1.30, riskFree: 0.069, erp: 0.065, forecastRoe: 0.165, terminalRoe: 0.140, payout: 0.18, fadeYears: 8, terminalGrowth: 0.05 },
    series: makeSeries(53, 520, -0.10, 0.035),
  },
  {
    id: 5, name: "Bajaj Finance", ticker: "BAJFINANCE", type: "financial",
    sector: "Diversified NBFC", price: 7100, shares: 62.0, equity: 95000, netProfit: 16700,
    nbfc: { aum: 410000, gnpa: 0.010, nnpa: 0.004, crar: 0.219, nim: 0.105, roa: 0.045, pledge: 0 },
    assumptions: { beta: 1.15, riskFree: 0.069, erp: 0.065, forecastRoe: 0.215, terminalRoe: 0.160, payout: 0.10, fadeYears: 10, terminalGrowth: 0.06 },
    series: makeSeries(71, 6600, 0.14, 0.020),
  },
  {
    id: 6, name: "Titan Company", ticker: "TITAN", type: "nonfinancial",
    sector: "Consumer / Retail", price: 3450, shares: 88.8,
    fcff: { revenue: 56000, netDebt: 8000, costDebt: 0.085, debtWeight: 0.15 },
    assumptions: { beta: 0.95, riskFree: 0.069, erp: 0.065, ebitMargin: 0.115, taxRate: 0.25, reinvestRate: 0.40, revGrowth: 0.135, fadeYears: 9, terminalGrowth: 0.055 },
    series: makeSeries(91, 3200, 0.12, 0.021),
  },
];

/* ---------------------------------------------------------------------------
   VALUATION ENGINES
--------------------------------------------------------------------------- */
function costOfEquity(a) { return a.riskFree + a.beta * a.erp; }

// Residual Income (excess return) model — FINANCIALS. Per-share.
function residualIncome(co, a) {
  const ke = costOfEquity(a);
  const bvps0 = co.equity / co.shares;
  const retention = 1 - a.payout;
  const N = Math.max(3, Math.round(a.fadeYears));
  let bv = bvps0, pv = 0;
  const rows = [];
  for (let t = 1; t <= N; t++) {
    const roe = a.forecastRoe + (a.terminalRoe - a.forecastRoe) * (t / N);
    const ri = (roe - ke) * bv;
    const disc = Math.pow(1 + ke, t);
    pv += ri / disc;
    rows.push({ t, roe, bvBegin: bv, ri, pv: ri / disc });
    bv = bv * (1 + roe * retention);
  }
  // terminal: RI growing at g forever from year N
  const riNext = (a.terminalRoe - ke) * bv;
  const tv = a.terminalGrowth < ke ? riNext / (ke - a.terminalGrowth) : 0;
  const tvPv = tv / Math.pow(1 + ke, N);
  const intrinsic = bvps0 + pv + tvPv;
  return { ke, bvps0, intrinsic, pvExplicit: pv, tvPv, rows, method: "Residual Income" };
}

// FCFF DCF — NON-FINANCIALS. Returns per-share intrinsic.
function fcffDCF(co, a) {
  const ke = costOfEquity(a);
  const ew = 1 - co.fcff.debtWeight;
  const wacc = ew * ke + co.fcff.debtWeight * co.fcff.costDebt * (1 - a.taxRate);
  const N = Math.max(3, Math.round(a.fadeYears));
  let rev = co.fcff.revenue, pv = 0; const rows = [];
  for (let t = 1; t <= N; t++) {
    const g = a.revGrowth + (a.terminalGrowth - a.revGrowth) * (t / N);
    rev = rev * (1 + g);
    const ebit = rev * a.ebitMargin;
    const nopat = ebit * (1 - a.taxRate);
    const fcff = nopat * (1 - a.reinvestRate);
    const disc = Math.pow(1 + wacc, t);
    pv += fcff / disc;
    rows.push({ t, rev, fcff, pv: fcff / disc });
  }
  const fcffNext = rows[N - 1].fcff * (1 + a.terminalGrowth);
  const tv = a.terminalGrowth < wacc ? fcffNext / (wacc - a.terminalGrowth) : 0;
  const tvPv = tv / Math.pow(1 + wacc, N);
  const ev = pv + tvPv;
  const equityVal = ev - co.fcff.netDebt;
  const intrinsic = equityVal / co.shares;
  return { ke, wacc, intrinsic, ev, equityVal, pvExplicit: pv, tvPv, rows, method: "FCFF DCF" };
}

function valuate(co, a) {
  return co.type === "financial" ? residualIncome(co, a) : fcffDCF(co, a);
}

// sensitivity: discount rate (rows) x terminal growth (cols)
function sensitivity(co, a) {
  const baseRate = co.type === "financial" ? costOfEquity(a) : null;
  const rateDeltas = [-0.01, -0.005, 0, 0.005, 0.01];
  const gDeltas = [-0.01, -0.005, 0, 0.005, 0.01];
  const grid = rateDeltas.map((rd) =>
    gDeltas.map((gd) => {
      const a2 = { ...a, terminalGrowth: a.terminalGrowth + gd };
      if (co.type === "financial") a2.riskFree = a.riskFree; // adjust ke via erp proxy
      // shift discount rate by adjusting riskFree
      const a3 = { ...a2, riskFree: a.riskFree + rd };
      return valuate(co, a3).intrinsic;
    })
  );
  return { rateDeltas, gDeltas, grid, baseRate };
}

/* ---------------------------------------------------------------------------
   FUNDAMENTALS
--------------------------------------------------------------------------- */
function fundamentals(co) {
  const bvps = co.equity / co.shares;
  const eps = co.netProfit ? co.netProfit / co.shares : null;
  const pb = co.price / bvps;
  const pe = eps ? co.price / eps : null;
  const roe = co.netProfit ? co.netProfit / co.equity : null;
  return { bvps, eps, pb, pe, roe };
}

/* ---------------------------------------------------------------------------
   TECHNICALS
--------------------------------------------------------------------------- */
function sma(arr, n, key = "close") {
  return arr.map((d, i) => {
    if (i < n - 1) return { ...d, [`sma${n}`]: null };
    let s = 0; for (let j = i - n + 1; j <= i; j++) s += arr[j][key];
    return { ...d, [`sma${n}`]: +(s / n).toFixed(1) };
  });
}
function rsi(arr, n = 14) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= n; i++) {
    const ch = arr[i].close - arr[i - 1].close;
    if (ch >= 0) gains += ch; else losses -= ch;
  }
  let ag = gains / n, al = losses / n;
  for (let i = n + 1; i < arr.length; i++) {
    const ch = arr[i].close - arr[i - 1].close;
    ag = (ag * (n - 1) + Math.max(ch, 0)) / n;
    al = (al * (n - 1) + Math.max(-ch, 0)) / n;
  }
  const rs = al === 0 ? 100 : ag / al;
  return al === 0 ? 100 : 100 - 100 / (1 + rs);
}
function technicals(co) {
  let s = sma(co.series, 20);
  s = sma(s, 50);
  const last = s[s.length - 1];
  const r = rsi(co.series);
  const hi = Math.max(...co.series.map((d) => d.close));
  const lo = Math.min(...co.series.map((d) => d.close));
  const aboveSMA50 = last.sma50 ? last.close > last.sma50 : false;
  const aboveSMA20 = last.sma20 ? last.close > last.sma20 : false;
  return { data: s, rsi: r, hi, lo, last: last.close, aboveSMA50, aboveSMA20 };
}

/* ---------------------------------------------------------------------------
   RECOMMENDATION ENGINE — explainable composite
--------------------------------------------------------------------------- */
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function recommend(co, a) {
  const v = valuate(co, a);
  const f = fundamentals(co);
  const t = technicals(co);
  const mos = (v.intrinsic - co.price) / co.price;

  const reasons = [];

  // valuation: +50% MoS => 100
  const valuation = clamp(50 + mos * 100, 0, 100);
  reasons.push({
    label: "Valuation", score: valuation,
    note: `${pct(mos)} margin of safety vs intrinsic ${inr(v.intrinsic)}`,
    good: mos > 0.1, bad: mos < -0.1,
  });

  // quality
  let quality, qnote;
  if (co.type === "financial") {
    const roeS = clamp((f.roe - 0.10) / 0.15 * 100, 0, 100);
    const apS = clamp((0.05 - co.nbfc.gnpa) / 0.05 * 100, 0, 100);
    const capS = clamp((co.nbfc.crar - 0.15) / 0.15 * 100, 0, 100);
    quality = 0.5 * roeS + 0.3 * apS + 0.2 * capS;
    qnote = `ROE ${pct(f.roe)}, GNPA ${pct(co.nbfc.gnpa, 2)}, CRAR ${pct(co.nbfc.crar)}`;
  } else {
    const roeS = clamp((f.roe - 0.10) / 0.15 * 100, 0, 100);
    const marginS = clamp(a.ebitMargin / 0.20 * 100, 0, 100);
    const levS = clamp((0.3 - co.fcff.debtWeight) / 0.3 * 100, 0, 100);
    quality = 0.45 * roeS + 0.35 * marginS + 0.2 * levS;
    qnote = `ROE ${pct(f.roe)}, EBIT margin ${pct(a.ebitMargin)}, low leverage`;
  }
  reasons.push({ label: "Quality", score: quality, note: qnote, good: quality > 60, bad: quality < 40 });

  // momentum
  let momentum = 50;
  if (t.aboveSMA50) momentum += 18;
  if (t.aboveSMA20) momentum += 10;
  if (t.rsi > 70) momentum -= 15;
  if (t.rsi < 30) momentum += 8;
  momentum = clamp(momentum, 0, 100);
  reasons.push({
    label: "Momentum", score: momentum,
    note: `${t.aboveSMA50 ? "Above" : "Below"} 50-DMA, RSI ${fmt(t.rsi)}`,
    good: t.aboveSMA50, bad: !t.aboveSMA50,
  });

  // risk penalty (0 good, up to 100 bad)
  let risk = 0; const flags = [];
  if (co.type === "financial") {
    if (co.nbfc.gnpa > 0.04) { risk += 25; flags.push("Elevated GNPA"); }
    if (co.nbfc.crar < 0.16) { risk += 20; flags.push("Thin capital adequacy"); }
    if (co.nbfc.pledge > 0) { risk += 15; flags.push("Promoter pledge"); }
  } else {
    if (co.fcff.debtWeight > 0.4) { risk += 25; flags.push("High leverage"); }
  }
  if (mos < -0.25) { risk += 15; flags.push("Trading well above intrinsic"); }
  risk = clamp(risk, 0, 100);
  const riskScore = 100 - risk;
  reasons.push({
    label: "Risk", score: riskScore,
    note: flags.length ? flags.join(", ") : "No major flags",
    good: flags.length === 0, bad: flags.length >= 2,
  });

  const composite = 0.45 * valuation + 0.28 * quality + 0.14 * momentum + 0.13 * riskScore;
  const verdict = composite >= 65 ? "BUY" : composite >= 45 ? "HOLD" : "AVOID";
  return { v, f, t, mos, reasons, composite, verdict };
}

/* ---------------------------------------------------------------------------
   UI PRIMITIVES
--------------------------------------------------------------------------- */
const mono = { fontFamily: "'JetBrains Mono', monospace" };
const serif = { fontFamily: "'Fraunces', serif" };
const sans = { fontFamily: "'Hanken Grotesk', sans-serif" };

function VerdictBadge({ verdict, big }) {
  const col = verdict === "BUY" ? C.green : verdict === "HOLD" ? C.gold : C.red;
  return (
    <span style={{
      ...mono, color: col, border: `1px solid ${col}55`, background: col + "14",
      padding: big ? "6px 16px" : "2px 9px", borderRadius: 6,
      fontSize: big ? 15 : 11, letterSpacing: "0.08em", fontWeight: 600,
    }}>{verdict}</span>
  );
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ ...sans, color: C.dim, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ ...mono, color: color || C.text, fontSize: 20, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ ...sans, color: C.faint, fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Field({ label, value, onChange, step = 0.005, suffix = "%", scale = 100, min, max }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ ...sans, color: C.dim, fontSize: 12 }}>{label}</span>
        <span style={{ ...mono, color: C.gold, fontSize: 13 }}>
          {suffix === "%" ? (value * scale).toFixed(2) : value.toFixed(2)}{suffix}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: C.gold, cursor: "pointer" }} />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   SCREENER
--------------------------------------------------------------------------- */
function Screener({ companies, onOpen }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("composite");

  const rows = useMemo(() => {
    return companies
      .map((co) => {
        const r = recommend(co, co.assumptions);
        const f = fundamentals(co);
        return { co, ...r, pb: f.pb, pe: f.pe, roe: f.roe };
      })
      .filter((r) => (r.co.name + r.co.ticker).toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => {
        if (sort === "composite") return b.composite - a.composite;
        if (sort === "mos") return b.mos - a.mos;
        if (sort === "roe") return (b.roe || 0) - (a.roe || 0);
        return a.co.name.localeCompare(b.co.name);
      });
  }, [companies, q, sort]);

  const Th = ({ children, k, w }) => (
    <th onClick={() => k && setSort(k)} style={{
      ...sans, color: sort === k ? C.gold : C.dim, fontSize: 11, fontWeight: 500,
      textAlign: "right", padding: "10px 12px", textTransform: "uppercase", letterSpacing: "0.04em",
      cursor: k ? "pointer" : "default", width: w, whiteSpace: "nowrap",
    }}>{children}</th>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px", flex: "1 1 280px" }}>
          <Search size={15} color={C.dim} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company or ticker…"
            style={{ ...sans, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 14, width: "100%" }} />
        </div>
        <div style={{ ...sans, color: C.faint, fontSize: 12 }}>{rows.length} companies · click a row to open</div>
      </div>

      <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", background: C.panel }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
            <tr>
              <th onClick={() => setSort("name")} style={{ ...sans, color: sort === "name" ? C.gold : C.dim, fontSize: 11, fontWeight: 500, textAlign: "left", padding: "10px 16px", textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer" }}>Company</th>
              <Th k="mos">Price / Value</Th>
              <Th k="mos">Mgn. Safety</Th>
              <Th k="roe">ROE</Th>
              <Th>P/B</Th>
              <Th>P/E</Th>
              <Th k="composite">Score</Th>
              <Th>Verdict</Th>
              <th style={{ width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.co.id} onClick={() => onOpen(r.co.id)}
                style={{ borderTop: idx ? `1px solid ${C.line}` : "none", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.panel2)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "13px 16px" }}>
                  <div style={{ ...sans, color: C.text, fontSize: 14, fontWeight: 500 }}>{r.co.name}</div>
                  <div style={{ ...mono, color: C.faint, fontSize: 11 }}>{r.co.ticker} · {r.co.sector}</div>
                </td>
                <td style={{ ...mono, textAlign: "right", padding: "13px 12px", fontSize: 13, color: C.text }}>
                  {inr(r.co.price)} <span style={{ color: C.faint }}>/</span> <span style={{ color: C.gold }}>{inr(r.v.intrinsic)}</span>
                </td>
                <td style={{ ...mono, textAlign: "right", padding: "13px 12px", fontSize: 13, color: r.mos >= 0 ? C.green : C.red }}>{pct(r.mos)}</td>
                <td style={{ ...mono, textAlign: "right", padding: "13px 12px", fontSize: 13, color: C.text }}>{pct(r.roe)}</td>
                <td style={{ ...mono, textAlign: "right", padding: "13px 12px", fontSize: 13, color: C.text }}>{fmt(r.pb, 2)}</td>
                <td style={{ ...mono, textAlign: "right", padding: "13px 12px", fontSize: 13, color: C.text }}>{r.pe ? fmt(r.pe, 1) : "—"}</td>
                <td style={{ ...mono, textAlign: "right", padding: "13px 12px", fontSize: 13, color: C.text }}>{fmt(r.composite)}</td>
                <td style={{ textAlign: "right", padding: "13px 12px" }}><VerdictBadge verdict={r.verdict} /></td>
                <td style={{ textAlign: "center" }}><ChevronRight size={15} color={C.faint} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HowToReal />
    </div>
  );
}

function HowToReal() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 22, border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel, overflow: "hidden" }}>
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", cursor: "pointer" }}>
        <Database size={16} color={C.gold} />
        <span style={{ ...sans, color: C.text, fontSize: 14, fontWeight: 500 }}>How to wire in real data (replace the sample numbers)</span>
        <ChevronRight size={16} color={C.dim} style={{ marginLeft: "auto", transform: open ? "rotate(90deg)" : "none", transition: "0.2s" }} />
      </div>
      {open && (
        <div style={{ ...sans, padding: "0 18px 18px", color: C.dim, fontSize: 13, lineHeight: 1.7 }}>
          <p style={{ marginTop: 0 }}>The engines here are real. The <em>numbers</em> are illustrative seeds. To make this production-grade:</p>
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            <li><b style={{ color: C.text }}>Financials</b> — pull quarterly results from the BSE/NSE <b style={{ color: C.gold }}>XBRL</b> feeds (machine-readable, deterministic). Map each tagged line item into the company object's fields.</li>
            <li><b style={{ color: C.text }}>Prices</b> — replace each <code>series</code> with real OHLC from a market-data API (TrueData, Twelve Data, or a broker API).</li>
            <li><b style={{ color: C.text }}>Annual reports / decks</b> — extract tables (Textract / Camelot) then an LLM pass to JSON, and <b style={{ color: C.gold }}>always reconcile against the XBRL figure</b> before trusting it.</li>
            <li><b style={{ color: C.text }}>Backend</b> — move the universe + a nightly ingest job behind an API (FastAPI + PostgreSQL/TimescaleDB). This React app becomes the front end that reads from it.</li>
          </ol>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   COMPANY VIEW
--------------------------------------------------------------------------- */
function Company({ co, assumptions, setAssumptions, price, setPrice, onBack }) {
  const [tab, setTab] = useState("valuation");
  const co2 = { ...co, price, assumptions };
  const rec = useMemo(() => recommend(co2, assumptions), [co2, assumptions]);
  const f = rec.f;

  const set = (k) => (val) => setAssumptions({ ...assumptions, [k]: val });

  const Tab = ({ id, icon: Icon, label }) => (
    <button onClick={() => setTab(id)} style={{
      ...sans, display: "flex", alignItems: "center", gap: 7, background: tab === id ? C.panel2 : "transparent",
      border: `1px solid ${tab === id ? C.line : "transparent"}`, color: tab === id ? C.gold : C.dim,
      padding: "8px 15px", borderRadius: 8, fontSize: 13.5, fontWeight: 500, cursor: "pointer",
    }}><Icon size={15} /> {label}</button>
  );

  return (
    <div>
      <button onClick={onBack} style={{ ...sans, display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: C.dim, fontSize: 13, cursor: "pointer", marginBottom: 14 }}>
        <ArrowLeft size={15} /> Back to screener
      </button>

      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 18 }}>
        <div>
          <div style={{ ...serif, color: C.text, fontSize: 30, fontWeight: 600, lineHeight: 1.1 }}>{co.name}</div>
          <div style={{ ...mono, color: C.faint, fontSize: 13, marginTop: 4 }}>{co.ticker} · {co.sector} · {co.type === "financial" ? "Residual-income model" : "FCFF model"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ ...sans, color: C.dim, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Composite</div>
            <div style={{ ...mono, color: C.text, fontSize: 26 }}>{fmt(rec.composite)}<span style={{ color: C.faint, fontSize: 15 }}>/100</span></div>
          </div>
          <VerdictBadge verdict={rec.verdict} big />
        </div>
      </div>

      {/* top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 20 }}>
        <Stat label="Market Price" value={inr(price)} />
        <Stat label="Intrinsic Value" value={inr(rec.v.intrinsic)} color={C.gold} />
        <Stat label="Margin of Safety" value={pct(rec.mos)} color={rec.mos >= 0 ? C.green : C.red} sub={rec.mos >= 0 ? "Undervalued" : "Overvalued"} />
        <Stat label="ROE" value={pct(f.roe)} />
        <Stat label={co.type === "financial" ? "P/B" : "P/E"} value={co.type === "financial" ? fmt(f.pb, 2) : (f.pe ? fmt(f.pe, 1) : "—")} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <Tab id="valuation" icon={Calculator} label="Valuation / DCF" />
        <Tab id="fundamentals" icon={Layers} label="Fundamentals" />
        <Tab id="technical" icon={Activity} label="Technicals" />
        <Tab id="verdict" icon={Gauge} label="Verdict" />
      </div>

      {tab === "valuation" && <Valuation co={co2} a={assumptions} set={set} rec={rec} price={price} setPrice={setPrice} />}
      {tab === "fundamentals" && <Fundamentals co={co2} f={f} />}
      {tab === "technical" && <Technical rec={rec} />}
      {tab === "verdict" && <Verdict rec={rec} />}
    </div>
  );
}

/* ----- Valuation tab ----- */
function Valuation({ co, a, set, rec, price, setPrice }) {
  const sens = useMemo(() => sensitivity(co, a), [co, a]);
  const isFin = co.type === "financial";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,340px) 1fr", gap: 18, alignItems: "start" }}>
      {/* inputs */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 18 }}>
        <div style={{ ...sans, color: C.text, fontSize: 14, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
          <CircleDollarSign size={16} color={C.gold} /> Input Assumptions
        </div>

        <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${C.line}` }}>
          <div style={{ ...sans, color: C.dim, fontSize: 12, marginBottom: 5 }}>Current market price (₹)</div>
          <input type="number" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
            style={{ ...mono, width: "100%", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, color: C.text, padding: "7px 10px", fontSize: 14, outline: "none" }} />
        </div>

        <div style={{ ...sans, color: C.goldDim, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Discount rate (CAPM)</div>
        <Field label="Risk-free rate" value={a.riskFree} onChange={set("riskFree")} min={0.04} max={0.10} />
        <Field label="Beta" value={a.beta} onChange={set("beta")} suffix="" min={0.5} max={1.8} step={0.05} />
        <Field label="Equity risk premium" value={a.erp} onChange={set("erp")} min={0.03} max={0.09} />

        {isFin ? (
          <>
            <div style={{ ...sans, color: C.goldDim, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", margin: "16px 0 10px" }}>Excess-return drivers</div>
            <Field label="Forecast ROE (yr 1)" value={a.forecastRoe} onChange={set("forecastRoe")} min={0.08} max={0.30} />
            <Field label="Terminal ROE" value={a.terminalRoe} onChange={set("terminalRoe")} min={0.08} max={0.22} />
            <Field label="Dividend payout" value={a.payout} onChange={set("payout")} min={0} max={0.6} />
            <Field label="Fade horizon (yrs)" value={a.fadeYears} onChange={set("fadeYears")} suffix="" min={3} max={12} step={1} />
            <Field label="Terminal growth" value={a.terminalGrowth} onChange={set("terminalGrowth")} min={0.02} max={0.08} />
          </>
        ) : (
          <>
            <div style={{ ...sans, color: C.goldDim, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", margin: "16px 0 10px" }}>FCFF drivers</div>
            <Field label="Revenue growth (yr 1)" value={a.revGrowth} onChange={set("revGrowth")} min={0.02} max={0.25} />
            <Field label="EBIT margin" value={a.ebitMargin} onChange={set("ebitMargin")} min={0.05} max={0.30} />
            <Field label="Tax rate" value={a.taxRate} onChange={set("taxRate")} min={0.15} max={0.35} />
            <Field label="Reinvestment rate" value={a.reinvestRate} onChange={set("reinvestRate")} min={0.1} max={0.7} />
            <Field label="Fade horizon (yrs)" value={a.fadeYears} onChange={set("fadeYears")} suffix="" min={3} max={12} step={1} />
            <Field label="Terminal growth" value={a.terminalGrowth} onChange={set("terminalGrowth")} min={0.02} max={0.08} />
          </>
        )}
      </div>

      {/* output */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ ...sans, color: C.text, fontSize: 14, fontWeight: 600 }}>{rec.v.method}</span>
            <span style={{ ...mono, color: C.dim, fontSize: 12 }}>
              {isFin ? `Ke ${pct(rec.v.ke)}` : `WACC ${pct(rec.v.wacc)} · Ke ${pct(rec.v.ke)}`}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Stat label="Intrinsic / share" value={inr(rec.v.intrinsic)} color={C.gold} />
            <Stat label="Market price" value={inr(price)} />
            <Stat label="Upside / (Downside)" value={pct(rec.mos)} color={rec.mos >= 0 ? C.green : C.red} />
          </div>
          <div style={{ ...sans, color: C.faint, fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
            {isFin
              ? `Value = book value per share (${inr(rec.v.bvps0)}) + PV of excess returns earned above the ${pct(rec.v.ke)} cost of equity over the fade horizon and into perpetuity. Appropriate for lenders, where FCFF is not meaningful.`
              : `Enterprise value of ${inr(rec.v.ev)} cr discounted at WACC, less net debt, divided by shares. ${pct(rec.v.tvPv / (rec.v.pvExplicit + rec.v.tvPv))} of value sits in the terminal — watch the terminal growth assumption.`}
          </div>
        </div>

        {/* sensitivity */}
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 18 }}>
          <div style={{ ...sans, color: C.text, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Sensitivity — intrinsic value (₹)</div>
          <div style={{ ...sans, color: C.faint, fontSize: 11, marginBottom: 12 }}>Rows: discount rate shift · Columns: terminal growth shift</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...mono, fontSize: 11, color: C.faint, padding: 6 }}>Δrate \ Δg</th>
                {sens.gDeltas.map((g, i) => (
                  <th key={i} style={{ ...mono, fontSize: 11, color: C.dim, padding: 6, textAlign: "center" }}>{(g * 100 >= 0 ? "+" : "") + (g * 100).toFixed(1)}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sens.grid.map((row, ri) => (
                <tr key={ri}>
                  <td style={{ ...mono, fontSize: 11, color: C.dim, padding: 6 }}>{(sens.rateDeltas[ri] * 100 >= 0 ? "+" : "") + (sens.rateDeltas[ri] * 100).toFixed(1)}%</td>
                  {row.map((val, ci) => {
                    const center = ri === 2 && ci === 2;
                    const up = val > price;
                    return (
                      <td key={ci} style={{
                        ...mono, fontSize: 12.5, padding: "7px 6px", textAlign: "center",
                        color: center ? C.gold : up ? C.green : C.red,
                        background: center ? C.gold + "18" : "transparent",
                        border: center ? `1px solid ${C.gold}55` : `1px solid ${C.line}`,
                        fontWeight: center ? 600 : 400,
                      }}>{fmt(val)}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ ...sans, color: C.faint, fontSize: 11, marginTop: 10 }}>
            Green = intrinsic above current price ({inr(price)}). The centre cell is your base case.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----- Fundamentals tab ----- */
function Fundamentals({ co, f }) {
  const isFin = co.type === "financial";
  const cards = isFin
    ? [
        ["Net worth", inr(co.equity) + " cr"],
        ["Net profit", inr(co.netProfit) + " cr"],
        ["Book value / share", inr(f.bvps)],
        ["EPS", f.eps ? inr(f.eps) : "—"],
        ["ROE", pct(f.roe)],
        ["ROA", pct(co.nbfc.roa, 2)],
        ["AUM", inr(co.nbfc.aum) + " cr"],
        ["Net interest margin", pct(co.nbfc.nim)],
        ["GNPA", pct(co.nbfc.gnpa, 2)],
        ["NNPA", pct(co.nbfc.nnpa, 2)],
        ["Capital adequacy (CRAR)", pct(co.nbfc.crar)],
        ["P/B", fmt(f.pb, 2)],
      ]
    : [
        ["Revenue", inr(co.fcff.revenue) + " cr"],
        ["EBIT margin", pct(co.assumptions.ebitMargin)],
        ["Net debt", inr(co.fcff.netDebt) + " cr"],
        ["Book value / share", inr(f.bvps)],
        ["EPS", f.eps ? inr(f.eps) : "—"],
        ["P/E", f.pe ? fmt(f.pe, 1) : "—"],
        ["ROE", pct(f.roe)],
        ["P/B", fmt(f.pb, 2)],
      ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 10 }}>
        {cards.map(([l, v]) => (
          <div key={l} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "13px 15px" }}>
            <div style={{ ...sans, color: C.dim, fontSize: 11.5 }}>{l}</div>
            <div style={{ ...mono, color: C.text, fontSize: 18, marginTop: 5 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ ...sans, color: C.faint, fontSize: 12, marginTop: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Info size={14} color={C.goldDim} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>{isFin
          ? "NBFC-specific metrics (AUM, NIM, GNPA, CRAR) drive the quality score. For a real build these come straight from the XBRL quarterly results filing."
          : "For non-financials the model uses revenue, margins and reinvestment. Replace with audited figures from the annual report."}</span>
      </div>
    </div>
  );
}

/* ----- Technical tab ----- */
function Technical({ rec }) {
  const t = rec.t;
  const data = t.data.filter((_, i) => i % 1 === 0);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 16 }}>
        <Stat label="Last close" value={inr(t.last)} />
        <Stat label="RSI (14)" value={fmt(t.rsi)} color={t.rsi > 70 ? C.red : t.rsi < 30 ? C.green : C.text} sub={t.rsi > 70 ? "Overbought" : t.rsi < 30 ? "Oversold" : "Neutral"} />
        <Stat label="Vs 50-DMA" value={t.aboveSMA50 ? "Above" : "Below"} color={t.aboveSMA50 ? C.green : C.red} />
        <Stat label="Range high" value={inr(t.hi)} />
        <Stat label="Range low" value={inr(t.lo)} />
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "18px 8px 8px 0" }}>
        <div style={{ ...sans, color: C.dim, fontSize: 12, padding: "0 0 8px 18px" }}>Price · 20-DMA · 50-DMA (illustrative series)</div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="i" tick={{ fill: C.faint, fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={{ stroke: C.line }} />
            <YAxis domain={["auto", "auto"]} tick={{ fill: C.faint, fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={{ stroke: C.line }} width={50} />
            <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: "monospace", fontSize: 12 }} labelStyle={{ color: C.dim }} />
            <Line type="monotone" dataKey="close" stroke={C.gold} dot={false} strokeWidth={1.6} name="Price" />
            <Line type="monotone" dataKey="sma20" stroke={C.blue} dot={false} strokeWidth={1.1} name="20-DMA" />
            <Line type="monotone" dataKey="sma50" stroke={C.dim} dot={false} strokeWidth={1.1} strokeDasharray="4 3" name="50-DMA" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ----- Verdict tab ----- */
function Verdict({ rec }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 12 }}>
          <div style={{ ...serif, color: C.text, fontSize: 22, fontWeight: 600 }}>How the verdict is built</div>
          <VerdictBadge verdict={rec.verdict} big />
        </div>
        <div style={{ ...sans, color: C.dim, fontSize: 13, marginBottom: 20 }}>
          Composite = 45% valuation + 28% quality + 14% momentum + 13% risk. Score {fmt(rec.composite)}/100.
          Every factor is shown — nothing is a black box.
        </div>

        {rec.reasons.map((r) => (
          <div key={r.label} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ ...sans, color: C.text, fontSize: 14, fontWeight: 500 }}>{r.label}</span>
              <span style={{ ...mono, color: r.good ? C.green : r.bad ? C.red : C.text, fontSize: 14 }}>{fmt(r.score)}/100</span>
            </div>
            <div style={{ height: 7, background: C.panel2, borderRadius: 4, overflow: "hidden", border: `1px solid ${C.line}` }}>
              <div style={{ width: `${r.score}%`, height: "100%", background: r.good ? C.green : r.bad ? C.red : C.gold }} />
            </div>
            <div style={{ ...sans, color: C.faint, fontSize: 12, marginTop: 5 }}>{r.note}</div>
          </div>
        ))}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.goldDim}55`, borderRadius: 10, padding: "16px 18px", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <ShieldAlert size={17} color={C.gold} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ ...sans, color: C.dim, fontSize: 12.5, lineHeight: 1.65 }}>
          <b style={{ color: C.text }}>Not investment advice.</b> This is a calculator that shows what a stock is worth <em>under your assumptions</em>. Publishing buy/sell calls to the public in India can fall under SEBI's Research Analyst regulations — keep this personal/internal, or get a legal check before going public-facing.
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   ROOT
--------------------------------------------------------------------------- */
export default function App() {
  const API = import.meta.env.VITE_API_URL;
const [companies, setCompanies] = useState(SEED);
useEffect(() => {
  if (!API) return;
  fetch(`${API}/api/companies`)
    .then((r) => r.json())
    .then((rows) => {
      const updated = SEED.map((s) => {
        const live = rows.find((r) => r.ticker === s.ticker);
        if (!live) return s;
        return { ...s, price: live.price };
      });
      setCompanies(updated);
    })
    .catch(() => console.warn("API unreachable, using sample data"));
}, []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        body{margin:0} *::-webkit-scrollbar{height:8px;width:8px} *::-webkit-scrollbar-thumb{background:${C.line};border-radius:4px}
        input[type=range]{height:4px;border-radius:2px;background:${C.line}}`}</style>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 22px 60px" }}>
        {/* masthead */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 18, borderBottom: `1px solid ${C.line}`, marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: C.gold + "18", border: `1px solid ${C.gold}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={18} color={C.gold} />
            </div>
            <div>
              <div style={{ ...serif, fontSize: 21, fontWeight: 600, color: C.text, lineHeight: 1 }}>Equity Research Terminal</div>
              <div style={{ ...mono, fontSize: 11, color: C.faint, marginTop: 3 }}>DCF · fundamentals · technicals · verdict</div>
            </div>
          </div>
          <div style={{ ...sans, fontSize: 11, color: C.goldDim, border: `1px solid ${C.goldDim}55`, padding: "5px 11px", borderRadius: 20, background: C.gold + "0d" }}>
            SAMPLE DATA — edit & replace
          </div>
        </header>

        {view === "screener" && <Screener companies={companies} onOpen={open} />}
        {view === "company" && selected && assumptions && (
          <Company co={selected} assumptions={assumptions} setAssumptions={setAssumptions}
            price={price} setPrice={setPrice} onBack={() => setView("screener")} />
        )}
      </div>
    </div>
  );
}
