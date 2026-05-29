import React, { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Search, TrendingUp, Activity, Calculator, Layers, ChevronRight, ArrowLeft,
  CircleDollarSign, Gauge, ShieldAlert, Info, Database,
} from "lucide-react";

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

function rng(seed) {
  let s = Math.abs(seed) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function makeSeries(seed, start, drift, vol, n = 250) {
  const r = rng(seed); const out = []; let p = Math.max(start, 1);
  for (let i = 0; i < n; i++) {
    p = p * (1 + drift / n + (r() - 0.5) * vol);
    out.push({ i, close: +p.toFixed(1) });
  }
  return out;
}

const SEED = [
  {
    id: 1, name: "Muthoot Finance", ticker: "MUTHOOTFIN", type: "financial",
    sector: "Gold Loan NBFC", price: 3311, shares: 40.1, equity: 26500, netProfit: 4470,
    nbfc: { aum: 92000, gnpa: 0.029, nnpa: 0.026, crar: 0.288, nim: 0.115, roa: 0.052, pledge: 0 },
    assumptions: { beta: 1.05, riskFree: 0.069, erp: 0.065, forecastRoe: 0.225, terminalRoe: 0.155, payout: 0.22, fadeYears: 8, terminalGrowth: 0.05 },
    series: makeSeries(11, 2800, 0.20, 0.022),
  },
  {
    id: 2, name: "Manappuram Finance", ticker: "MANAPPURAM", type: "financial",
    sector: "Gold Loan NBFC", price: 329, shares: 84.6, equity: 11900, netProfit: 2200,
    nbfc: { aum: 44000, gnpa: 0.045, nnpa: 0.040, crar: 0.302, nim: 0.135, roa: 0.048, pledge: 0 },
    assumptions: { beta: 1.20, riskFree: 0.069, erp: 0.065, forecastRoe: 0.195, terminalRoe: 0.140, payout: 0.20, fadeYears: 8, terminalGrowth: 0.045 },
    series: makeSeries(23, 280, 0.16, 0.028),
  },
  {
    id: 3, name: "Fedbank Financial (Fedfina)", ticker: "FEDFINA", type: "financial",
    sector: "Diversified NBFC", price: 161, shares: 37.0, equity: 2400, netProfit: 280,
    nbfc: { aum: 14500, gnpa: 0.020, nnpa: 0.015, crar: 0.205, nim: 0.080, roa: 0.022, pledge: 0 },
    assumptions: { beta: 1.10, riskFree: 0.069, erp: 0.065, forecastRoe: 0.135, terminalRoe: 0.135, payout: 0.0, fadeYears: 9, terminalGrowth: 0.06 },
    series: makeSeries(37, 130, 0.22, 0.030),
  },
  {
    id: 4, name: "IIFL Finance", ticker: "IIFL", type: "financial",
    sector: "Diversified NBFC", price: 480, shares: 42.5, equity: 11200, netProfit: 1550,
    nbfc: { aum: 78000, gnpa: 0.024, nnpa: 0.012, crar: 0.213, nim: 0.090, roa: 0.024, pledge: 0 },
    assumptions: { beta: 1.30, riskFree: 0.069, erp: 0.065, forecastRoe: 0.165, terminalRoe: 0.140, payout: 0.18, fadeYears: 8, terminalGrowth: 0.05 },
    series: makeSeries(53, 520, -0.10, 0.035),
  },
  {
    id: 5, name: "Bajaj Finance", ticker: "BAJFINANCE", type: "financial",
    sector: "Diversified NBFC", price: 935, shares: 62.0, equity: 95000, netProfit: 16700,
    nbfc: { aum: 410000, gnpa: 0.010, nnpa: 0.004, crar: 0.219, nim: 0.105, roa: 0.045, pledge: 0 },
    assumptions: { beta: 1.15, riskFree: 0.069, erp: 0.065, forecastRoe: 0.215, terminalRoe: 0.160, payout: 0.10, fadeYears: 10, terminalGrowth: 0.06 },
    series: makeSeries(71, 800, 0.14, 0.020),
  },
  {
    id: 6, name: "Titan Company", ticker: "TITAN", type: "nonfinancial",
    sector: "Consumer / Retail", price: 4155, shares: 88.8,
    equity: 12000, netProfit: 3900,
    fcff: { revenue: 56000, netDebt: 8000, costDebt: 0.085, debtWeight: 0.15 },
    assumptions: { beta: 0.95, riskFree: 0.069, erp: 0.065, ebitMargin: 0.115, taxRate: 0.25, reinvestRate: 0.40, revGrowth: 0.135, fadeYears: 9, terminalGrowth: 0.055 },
    series: makeSeries(91, 3500, 0.12, 0.021),
  },
];

// Build a full company object from the flat API screener row
function buildFromApi(r) {
  const seed = SEED.find((s) => s.ticker === r.ticker);
  if (seed) return { ...seed, price: r.price };

  const tickerSeed = r.ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const series = makeSeries(tickerSeed, r.price * 0.85, 0.10, 0.025);
  const shares = r.pb && r.intrinsic ? (r.price / r.pb) * 10 : 50;

  if (r.type === "financial") {
    const equity = r.pb ? (r.price * shares) / r.pb : shares * 200;
    const netProfit = r.roe ? equity * r.roe : null;
    return {
      id: r.ticker, name: r.name, ticker: r.ticker,
      type: "financial", sector: r.sector,
      price: r.price, shares,
      equity, netProfit,
      nbfc: { aum: equity * 4, gnpa: 0.025, nnpa: 0.015, crar: 0.20, nim: 0.09, roa: 0.025, pledge: 0 },
      assumptions: {
        beta: 1.1, riskFree: 0.069, erp: 0.065,
        forecastRoe: r.roe || 0.15, terminalRoe: 0.13,
        payout: 0.20, fadeYears: 8, terminalGrowth: 0.05,
      },
      series,
    };
  } else {
    const equity = r.pb ? (r.price * shares) / r.pb : shares * 200;
    const netProfit = r.pe ? (r.price * shares) / r.pe : null;
    return {
      id: r.ticker, name: r.name, ticker: r.ticker,
      type: "nonfinancial", sector: r.sector,
      price: r.price, shares,
      equity, netProfit,
      fcff: {
        revenue: r.price * shares * 0.8,
        netDebt: r.price * shares * 0.1,
        costDebt: 0.085, debtWeight: 0.20,
      },
      assumptions: {
        beta: 1.0, riskFree: 0.069, erp: 0.065,
        ebitMargin: 0.14, taxRate: 0.25, reinvestRate: 0.35,
        revGrowth: 0.12, fadeYears: 8, terminalGrowth: 0.055,
      },
      series,
    };
  }
}

function costOfEquity(a) { return a.riskFree + a.beta * a.erp; }

function residualIncome(co, a) {
  const ke = costOfEquity(a);
  const bvps0 = co.equity / co.shares;
  const retention = 1 - a.payout;
  const N = Math.max(3, Math.round(a.fadeYears));
  let bv = bvps0, pv = 0; const rows = [];
  for (let t = 1; t <= N; t++) {
    const roe = a.forecastRoe + (a.terminalRoe - a.forecastRoe) * (t / N);
    const ri = (roe - ke) * bv;
    const disc = Math.pow(1 + ke, t);
    pv += ri / disc;
    rows.push({ t, roe, bvBegin: bv, ri, pv: ri / disc });
    bv = bv * (1 + roe * retention);
  }
  const riNext = (a.terminalRoe - ke) * bv;
  const tv = a.terminalGrowth < ke ? riNext / (ke - a.terminalGrowth) : 0;
  const tvPv = tv / Math.pow(1 + ke, N);
  return { ke, bvps0, intrinsic: bvps0 + pv + tvPv, pvExplicit: pv, tvPv, rows, method: "Residual Income" };
}

function fcffDCF(co, a) {
  const ke = costOfEquity(a);
  const ew = 1 - co.fcff.debtWeight;
  const wacc = ew * ke + co.fcff.debtWeight * co.fcff.costDebt * (1 - a.taxRate);
  const N = Math.max(3, Math.round(a.fadeYears));
  let rev = co.fcff.revenue, pv = 0; const rows = [];
  for (let t = 1; t <= N; t++) {
    const g = a.revGrowth + (a.terminalGrowth - a.revGrowth) * (t / N);
    rev = rev * (1 + g);
    const fcff = rev * a.ebitMargin * (1 - a.taxRate) * (1 - a.reinvestRate);
    const disc = Math.pow(1 + wacc, t);
    pv += fcff / disc;
    rows.push({ t, rev, fcff, pv: fcff / disc });
  }
  const fcffNext = rows[N - 1].fcff * (1 + a.terminalGrowth);
  const tv = a.terminalGrowth < wacc ? fcffNext / (wacc - a.terminalGrowth) : 0;
  const tvPv = tv / Math.pow(1 + wacc, N);
  const ev = pv + tvPv;
  const intrinsic = (ev - co.fcff.netDebt) / co.shares;
  return { ke, wacc, intrinsic, ev, equityVal: ev - co.fcff.netDebt, pvExplicit: pv, tvPv, rows, method: "FCFF DCF" };
}

function valuate(co, a) {
  return co.type === "financial" ? residualIncome(co, a) : fcffDCF(co, a);
}

function sensitivity(co, a) {
  const rateDeltas = [-0.01, -0.005, 0, 0.005, 0.01];
  const gDeltas = [-0.01, -0.005, 0, 0.005, 0.01];
  const grid = rateDeltas.map((rd) =>
    gDeltas.map((gd) => valuate(co, { ...a, terminalGrowth: a.terminalGrowth + gd, riskFree: a.riskFree + rd }).intrinsic)
  );
  return { rateDeltas, gDeltas, grid };
}

function fundamentals(co) {
  const bvps = co.equity / co.shares;
  const eps = co.netProfit ? co.netProfit / co.shares : null;
  return { bvps, eps, pb: co.price / bvps, pe: eps ? co.price / eps : null, roe: co.netProfit ? co.netProfit / co.equity : null };
}

function sma(arr, n) {
  return arr.map((d, i) => {
    if (i < n - 1) return { ...d, [`sma${n}`]: null };
    let s = 0; for (let j = i - n + 1; j <= i; j++) s += arr[j].close;
    return { ...d, [`sma${n}`]: +(s / n).toFixed(1) };
  });
}
function rsiCalc(arr, n = 14) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= n; i++) { const ch = arr[i].close - arr[i-1].close; if (ch >= 0) gains += ch; else losses -= ch; }
  let ag = gains / n, al = losses / n;
  for (let i = n + 1; i < arr.length; i++) { const ch = arr[i].close - arr[i-1].close; ag = (ag*(n-1)+Math.max(ch,0))/n; al = (al*(n-1)+Math.max(-ch,0))/n; }
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}
function technicals(co) {
  let s = sma(co.series, 20); s = sma(s, 50);
  const last = s[s.length - 1];
  return { data: s, rsi: rsiCalc(co.series), hi: Math.max(...co.series.map(d => d.close)), lo: Math.min(...co.series.map(d => d.close)),
    last: last.close, aboveSMA50: last.sma50 ? last.close > last.sma50 : false, aboveSMA20: last.sma20 ? last.close > last.sma20 : false };
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function recommend(co, a) {
  const v = valuate(co, a); const f = fundamentals(co); const t = technicals(co);
  const mos = (v.intrinsic - co.price) / co.price;
  const reasons = [];
  const valuation = clamp(50 + mos * 100, 0, 100);
  reasons.push({ label: "Valuation", score: valuation, note: `${pct(mos)} margin of safety vs intrinsic ${inr(v.intrinsic)}`, good: mos > 0.1, bad: mos < -0.1 });
  let quality, qnote;
  if (co.type === "financial") {
    quality = 0.5*clamp((f.roe-0.10)/0.15*100,0,100) + 0.3*clamp((0.05-co.nbfc.gnpa)/0.05*100,0,100) + 0.2*clamp((co.nbfc.crar-0.15)/0.15*100,0,100);
    qnote = `ROE ${pct(f.roe)}, GNPA ${pct(co.nbfc.gnpa,2)}, CRAR ${pct(co.nbfc.crar)}`;
  } else {
    quality = 0.45*clamp((f.roe-0.10)/0.15*100,0,100) + 0.35*clamp(a.ebitMargin/0.20*100,0,100) + 0.2*clamp((0.3-co.fcff.debtWeight)/0.3*100,0,100);
    qnote = `ROE ${pct(f.roe)}, EBIT margin ${pct(a.ebitMargin)}`;
  }
  reasons.push({ label: "Quality", score: quality, note: qnote, good: quality > 60, bad: quality < 40 });
  let momentum = 50;
  if (t.aboveSMA50) momentum += 18; if (t.aboveSMA20) momentum += 10; if (t.rsi > 70) momentum -= 15; if (t.rsi < 30) momentum += 8;
  momentum = clamp(momentum, 0, 100);
  reasons.push({ label: "Momentum", score: momentum, note: `${t.aboveSMA50?"Above":"Below"} 50-DMA, RSI ${fmt(t.rsi)}`, good: t.aboveSMA50, bad: !t.aboveSMA50 });
  let risk = 0; const flags = [];
  if (co.type === "financial") { if (co.nbfc.gnpa > 0.04) { risk += 25; flags.push("Elevated GNPA"); } if (co.nbfc.crar < 0.16) { risk += 20; flags.push("Thin CRAR"); } }
  else { if (co.fcff.debtWeight > 0.4) { risk += 25; flags.push("High leverage"); } }
  if (mos < -0.25) { risk += 15; flags.push("Trading above intrinsic"); }
  const riskScore = 100 - clamp(risk, 0, 100);
  reasons.push({ label: "Risk", score: riskScore, note: flags.length ? flags.join(", ") : "No major flags", good: flags.length === 0, bad: flags.length >= 2 });
  const composite = 0.45*valuation + 0.28*quality + 0.14*momentum + 0.13*riskScore;
  return { v, f, t, mos, reasons, composite, verdict: composite >= 65 ? "BUY" : composite >= 45 ? "HOLD" : "AVOID" };
}

const mono = { fontFamily: "'JetBrains Mono', monospace" };
const serif = { fontFamily: "'Fraunces', serif" };
const sans = { fontFamily: "'Hanken Grotesk', sans-serif" };

function VerdictBadge({ verdict, big }) {
  const col = verdict === "BUY" ? C.green : verdict === "HOLD" ? C.gold : C.red;
  return <span style={{ ...mono, color: col, border: `1px solid ${col}55`, background: col+"14", padding: big?"6px 16px":"2px 9px", borderRadius: 6, fontSize: big?15:11, letterSpacing:"0.08em", fontWeight:600 }}>{verdict}</span>;
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ ...sans, color: C.dim, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ ...mono, color: color||C.text, fontSize: 20, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ ...sans, color: C.faint, fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Field({ label, value, onChange, step=0.005, suffix="%", scale=100, min, max }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
        <span style={{ ...sans, color: C.dim, fontSize: 12 }}>{label}</span>
        <span style={{ ...mono, color: C.gold, fontSize: 13 }}>{suffix==="%"?(value*scale).toFixed(2):value.toFixed(2)}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(parseFloat(e.target.value))} style={{ width:"100%", accentColor:C.gold, cursor:"pointer" }} />
    </div>
  );
}

function Screener({ companies, onOpen, loading }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("composite");
  const [sectorFilter, setSectorFilter] = useState("All");

  const sectors = useMemo(() => {
    const s = new Set(companies.map(c => {
      const sec = c.sector || "";
      if (sec.toLowerCase().includes("financial") || sec.toLowerCase().includes("bank")) return "Financials";
      if (sec.toLowerCase().includes("tech") || sec.toLowerCase().includes("information")) return "Technology";
      if (sec.toLowerCase().includes("pharma") || sec.toLowerCase().includes("health")) return "Healthcare";
      if (sec.toLowerCase().includes("auto")) return "Auto";
      if (sec.toLowerCase().includes("fmcg") || sec.toLowerCase().includes("consumer")) return "Consumer";
      if (sec.toLowerCase().includes("energy") || sec.toLowerCase().includes("oil")) return "Energy";
      return "Other";
    }));
    return ["All", ...Array.from(s).sort()];
  }, [companies]);

  const rows = useMemo(() => {
    return companies
      .map((co) => { const r = recommend(co, co.assumptions); const f = fundamentals(co); return { co, ...r, pb: f.pb, pe: f.pe, roe: f.roe }; })
      .filter((r) => {
        const matchQ = (r.co.name + r.co.ticker).toLowerCase().includes(q.toLowerCase());
        if (sectorFilter === "All") return matchQ;
        const sec = r.co.sector || "";
        if (sectorFilter === "Financials") return matchQ && (sec.toLowerCase().includes("financial") || sec.toLowerCase().includes("bank"));
        if (sectorFilter === "Technology") return matchQ && (sec.toLowerCase().includes("tech") || sec.toLowerCase().includes("information"));
        if (sectorFilter === "Healthcare") return matchQ && (sec.toLowerCase().includes("pharma") || sec.toLowerCase().includes("health"));
        if (sectorFilter === "Auto") return matchQ && sec.toLowerCase().includes("auto");
        if (sectorFilter === "Consumer") return matchQ && (sec.toLowerCase().includes("fmcg") || sec.toLowerCase().includes("consumer"));
        if (sectorFilter === "Energy") return matchQ && (sec.toLowerCase().includes("energy") || sec.toLowerCase().includes("oil"));
        return matchQ;
      })
      .sort((a, b) => {
        if (sort === "composite") return b.composite - a.composite;
        if (sort === "mos") return b.mos - a.mos;
        if (sort === "roe") return (b.roe||0) - (a.roe||0);
        if (sort === "price") return b.co.price - a.co.price;
        return a.co.name.localeCompare(b.co.name);
      });
  }, [companies, q, sort, sectorFilter]);

  const Th = ({ children, k }) => (
    <th onClick={() => k && setSort(k)} style={{ ...sans, color: sort===k?C.gold:C.dim, fontSize:11, fontWeight:500, textAlign:"right", padding:"10px 12px", textTransform:"uppercase", letterSpacing:"0.04em", cursor:k?"pointer":"default", whiteSpace:"nowrap" }}>{children}</th>
  );

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:C.panel2, border:`1px solid ${C.line}`, borderRadius:8, padding:"8px 12px", flex:"1 1 240px" }}>
          <Search size={15} color={C.dim} />
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search company or ticker…"
            style={{ ...sans, background:"transparent", border:"none", outline:"none", color:C.text, fontSize:14, width:"100%" }} />
        </div>
        <select value={sectorFilter} onChange={(e)=>setSectorFilter(e.target.value)}
          style={{ ...sans, background:C.panel2, border:`1px solid ${C.line}`, borderRadius:8, color:C.text, padding:"8px 12px", fontSize:13, cursor:"pointer", outline:"none" }}>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ ...sans, color:C.faint, fontSize:12 }}>
          {loading ? "Loading companies…" : `${rows.length} companies · click a row to open`}
        </div>
      </div>

      <div style={{ border:`1px solid ${C.line}`, borderRadius:10, overflow:"hidden", background:C.panel }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead style={{ background:C.panel2, borderBottom:`1px solid ${C.line}` }}>
            <tr>
              <th onClick={()=>setSort("name")} style={{ ...sans, color:sort==="name"?C.gold:C.dim, fontSize:11, fontWeight:500, textAlign:"left", padding:"10px 16px", textTransform:"uppercase", letterSpacing:"0.04em", cursor:"pointer" }}>Company</th>
              <Th k="mos">Price / Value</Th>
              <Th k="mos">Mgn. Safety</Th>
              <Th k="roe">ROE</Th>
              <Th>P/B</Th>
              <Th>P/E</Th>
              <Th k="composite">Score</Th>
              <Th>Verdict</Th>
              <th style={{ width:30 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ ...sans, textAlign:"center", padding:40, color:C.faint }}>Loading live data from Railway…</td></tr>
            ) : rows.map((r, idx) => (
              <tr key={r.co.ticker||r.co.id} onClick={()=>onOpen(r.co.ticker||r.co.id)}
                style={{ borderTop:idx?`1px solid ${C.line}`:"none", cursor:"pointer" }}
                onMouseEnter={(e)=>(e.currentTarget.style.background=C.panel2)}
                onMouseLeave={(e)=>(e.currentTarget.style.background="transparent")}>
                <td style={{ padding:"12px 16px" }}>
                  <div style={{ ...sans, color:C.text, fontSize:13, fontWeight:500 }}>{r.co.name}</div>
                  <div style={{ ...mono, color:C.faint, fontSize:10 }}>{r.co.ticker} · {r.co.sector}</div>
                </td>
                <td style={{ ...mono, textAlign:"right", padding:"12px 12px", fontSize:12, color:C.text }}>{inr(r.co.price)} <span style={{ color:C.faint }}>/</span> <span style={{ color:C.gold }}>{inr(r.v.intrinsic)}</span></td>
                <td style={{ ...mono, textAlign:"right", padding:"12px 12px", fontSize:12, color:r.mos>=0?C.green:C.red }}>{pct(r.mos)}</td>
                <td style={{ ...mono, textAlign:"right", padding:"12px 12px", fontSize:12, color:C.text }}>{pct(r.roe)}</td>
                <td style={{ ...mono, textAlign:"right", padding:"12px 12px", fontSize:12, color:C.text }}>{fmt(r.pb,2)}</td>
                <td style={{ ...mono, textAlign:"right", padding:"12px 12px", fontSize:12, color:C.text }}>{r.pe?fmt(r.pe,1):"—"}</td>
                <td style={{ ...mono, textAlign:"right", padding:"12px 12px", fontSize:12, color:C.text }}>{fmt(r.composite)}</td>
                <td style={{ textAlign:"right", padding:"12px 12px" }}><VerdictBadge verdict={r.verdict} /></td>
                <td style={{ textAlign:"center" }}><ChevronRight size={14} color={C.faint} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop:16, border:`1px solid ${C.line}`, borderRadius:10, background:C.panel, padding:"12px 18px", display:"flex", alignItems:"center", gap:10 }}>
        <Database size={15} color={C.gold} />
        <span style={{ ...sans, color:C.dim, fontSize:12 }}>Prices pulled live from Yahoo Finance via Railway. Refreshes daily at market close. NBFC metrics updated quarterly.</span>
      </div>
    </div>
  );
}

function Company({ co, assumptions, setAssumptions, price, setPrice, onBack }) {
  const [tab, setTab] = useState("valuation");
  const co2 = { ...co, price, assumptions };
  const rec = useMemo(() => recommend(co2, assumptions), [co2, assumptions]);
  const f = rec.f;
  const set = (k) => (val) => setAssumptions({ ...assumptions, [k]: val });

  const Tab = ({ id, icon: Icon, label }) => (
    <button onClick={()=>setTab(id)} style={{ ...sans, display:"flex", alignItems:"center", gap:7, background:tab===id?C.panel2:"transparent", border:`1px solid ${tab===id?C.line:"transparent"}`, color:tab===id?C.gold:C.dim, padding:"8px 15px", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer" }}>
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div>
      <button onClick={onBack} style={{ ...sans, display:"flex", alignItems:"center", gap:6, background:"transparent", border:"none", color:C.dim, fontSize:13, cursor:"pointer", marginBottom:14 }}>
        <ArrowLeft size={15} /> Back to screener
      </button>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16, marginBottom:18 }}>
        <div>
          <div style={{ ...serif, color:C.text, fontSize:28, fontWeight:600, lineHeight:1.1 }}>{co.name}</div>
          <div style={{ ...mono, color:C.faint, fontSize:12, marginTop:4 }}>{co.ticker} · {co.sector} · {co.type==="financial"?"Residual-income model":"FCFF model"}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:22 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ ...sans, color:C.dim, fontSize:11, textTransform:"uppercase", letterSpacing:"0.04em" }}>Composite</div>
            <div style={{ ...mono, color:C.text, fontSize:24 }}>{fmt(rec.composite)}<span style={{ color:C.faint, fontSize:14 }}>/100</span></div>
          </div>
          <VerdictBadge verdict={rec.verdict} big />
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10, marginBottom:18 }}>
        <Stat label="Market Price" value={inr(price)} />
        <Stat label="Intrinsic Value" value={inr(rec.v.intrinsic)} color={C.gold} />
        <Stat label="Margin of Safety" value={pct(rec.mos)} color={rec.mos>=0?C.green:C.red} sub={rec.mos>=0?"Undervalued":"Overvalued"} />
        <Stat label="ROE" value={pct(f.roe)} />
        <Stat label={co.type==="financial"?"P/B":"P/E"} value={co.type==="financial"?fmt(f.pb,2):(f.pe?fmt(f.pe,1):"—")} />
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:18, flexWrap:"wrap" }}>
        <Tab id="valuation" icon={Calculator} label="Valuation / DCF" />
        <Tab id="fundamentals" icon={Layers} label="Fundamentals" />
        <Tab id="technical" icon={Activity} label="Technicals" />
        <Tab id="verdict" icon={Gauge} label="Verdict" />
      </div>
      {tab==="valuation" && <Valuation co={co2} a={assumptions} set={set} rec={rec} price={price} setPrice={setPrice} />}
      {tab==="fundamentals" && <Fundamentals co={co2} f={f} />}
      {tab==="technical" && <Technical rec={rec} />}
      {tab==="verdict" && <Verdict rec={rec} />}
    </div>
  );
}

function Valuation({ co, a, set, rec, price, setPrice }) {
  const sens = useMemo(() => sensitivity(co, a), [co, a]);
  const isFin = co.type === "financial";
  return (
    <div style={{ display:"grid", gridTemplateColumns:"minmax(260px,320px) 1fr", gap:18, alignItems:"start" }}>
      <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, padding:18 }}>
        <div style={{ ...sans, color:C.text, fontSize:14, fontWeight:600, marginBottom:16, display:"flex", alignItems:"center", gap:7 }}>
          <CircleDollarSign size={16} color={C.gold} /> Input Assumptions
        </div>
        <div style={{ marginBottom:14, paddingBottom:14, borderBottom:`1px solid ${C.line}` }}>
          <div style={{ ...sans, color:C.dim, fontSize:12, marginBottom:5 }}>Current market price (₹)</div>
          <input type="number" value={price} onChange={(e)=>setPrice(parseFloat(e.target.value)||0)}
            style={{ ...mono, width:"100%", background:C.panel2, border:`1px solid ${C.line}`, borderRadius:6, color:C.text, padding:"7px 10px", fontSize:14, outline:"none" }} />
        </div>
        <div style={{ ...sans, color:C.goldDim, fontSize:11, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Discount rate (CAPM)</div>
        <Field label="Risk-free rate" value={a.riskFree} onChange={set("riskFree")} min={0.04} max={0.10} />
        <Field label="Beta" value={a.beta} onChange={set("beta")} suffix="" min={0.5} max={1.8} step={0.05} />
        <Field label="Equity risk premium" value={a.erp} onChange={set("erp")} min={0.03} max={0.09} />
        {isFin ? (<>
          <div style={{ ...sans, color:C.goldDim, fontSize:11, textTransform:"uppercase", letterSpacing:"0.05em", margin:"16px 0 10px" }}>Excess-return drivers</div>
          <Field label="Forecast ROE (yr 1)" value={a.forecastRoe} onChange={set("forecastRoe")} min={0.08} max={0.30} />
          <Field label="Terminal ROE" value={a.terminalRoe} onChange={set("terminalRoe")} min={0.08} max={0.22} />
          <Field label="Dividend payout" value={a.payout} onChange={set("payout")} min={0} max={0.6} />
          <Field label="Fade horizon (yrs)" value={a.fadeYears} onChange={set("fadeYears")} suffix="" min={3} max={12} step={1} />
          <Field label="Terminal growth" value={a.terminalGrowth} onChange={set("terminalGrowth")} min={0.02} max={0.08} />
        </>) : (<>
          <div style={{ ...sans, color:C.goldDim, fontSize:11, textTransform:"uppercase", letterSpacing:"0.05em", margin:"16px 0 10px" }}>FCFF drivers</div>
          <Field label="Revenue growth (yr 1)" value={a.revGrowth} onChange={set("revGrowth")} min={0.02} max={0.25} />
          <Field label="EBIT margin" value={a.ebitMargin} onChange={set("ebitMargin")} min={0.05} max={0.30} />
          <Field label="Tax rate" value={a.taxRate} onChange={set("taxRate")} min={0.15} max={0.35} />
          <Field label="Reinvestment rate" value={a.reinvestRate} onChange={set("reinvestRate")} min={0.1} max={0.7} />
          <Field label="Fade horizon (yrs)" value={a.fadeYears} onChange={set("fadeYears")} suffix="" min={3} max={12} step={1} />
          <Field label="Terminal growth" value={a.terminalGrowth} onChange={set("terminalGrowth")} min={0.02} max={0.08} />
        </>)}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, padding:18 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <span style={{ ...sans, color:C.text, fontSize:14, fontWeight:600 }}>{rec.v.method}</span>
            <span style={{ ...mono, color:C.dim, fontSize:12 }}>{isFin?`Ke ${pct(rec.v.ke)}`:`WACC ${pct(rec.v.wacc)} · Ke ${pct(rec.v.ke)}`}</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <Stat label="Intrinsic / share" value={inr(rec.v.intrinsic)} color={C.gold} />
            <Stat label="Market price" value={inr(price)} />
            <Stat label="Upside / (Downside)" value={pct(rec.mos)} color={rec.mos>=0?C.green:C.red} />
          </div>
          <div style={{ ...sans, color:C.faint, fontSize:12, marginTop:12, lineHeight:1.6 }}>
            {isFin?`Value = book value per share (${inr(rec.v.bvps0)}) + PV of excess returns above the ${pct(rec.v.ke)} cost of equity.`
              :`Enterprise value discounted at WACC, less net debt, divided by shares. ${pct(rec.v.tvPv/(rec.v.pvExplicit+rec.v.tvPv))} sits in terminal value.`}
          </div>
        </div>
        <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, padding:18 }}>
          <div style={{ ...sans, color:C.text, fontSize:14, fontWeight:600, marginBottom:4 }}>Sensitivity — intrinsic value (₹)</div>
          <div style={{ ...sans, color:C.faint, fontSize:11, marginBottom:12 }}>Rows: discount rate shift · Columns: terminal growth shift</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              <th style={{ ...mono, fontSize:11, color:C.faint, padding:6 }}>Δrate\Δg</th>
              {sens.gDeltas.map((g,i)=><th key={i} style={{ ...mono, fontSize:11, color:C.dim, padding:6, textAlign:"center" }}>{(g*100>=0?"+":"")+(g*100).toFixed(1)}%</th>)}
            </tr></thead>
            <tbody>{sens.grid.map((row,ri)=>(
              <tr key={ri}>
                <td style={{ ...mono, fontSize:11, color:C.dim, padding:6 }}>{(sens.rateDeltas[ri]*100>=0?"+":"")+(sens.rateDeltas[ri]*100).toFixed(1)}%</td>
                {row.map((val,ci)=>{const center=ri===2&&ci===2; const up=val>price; return(
                  <td key={ci} style={{ ...mono, fontSize:12, padding:"6px 4px", textAlign:"center", color:center?C.gold:up?C.green:C.red, background:center?C.gold+"18":"transparent", border:center?`1px solid ${C.gold}55`:`1px solid ${C.line}`, fontWeight:center?600:400 }}>{fmt(val)}</td>
                );})}
              </tr>
            ))}</tbody>
          </table>
          <div style={{ ...sans, color:C.faint, fontSize:11, marginTop:10 }}>Green = intrinsic above {inr(price)}. Centre = base case.</div>
        </div>
      </div>
    </div>
  );
}

function Fundamentals({ co, f }) {
  const isFin = co.type === "financial";
  const cards = isFin
    ? [["Net worth", inr(co.equity)+" cr"],["Net profit", co.netProfit?inr(co.netProfit)+" cr":"—"],["Book value / share", inr(f.bvps)],["EPS", f.eps?inr(f.eps):"—"],["ROE", pct(f.roe)],["ROA", pct(co.nbfc.roa,2)],["AUM", inr(co.nbfc.aum)+" cr"],["NIM", pct(co.nbfc.nim)],["GNPA", pct(co.nbfc.gnpa,2)],["NNPA", pct(co.nbfc.nnpa,2)],["CRAR", pct(co.nbfc.crar)],["P/B", fmt(f.pb,2)]]
    : [["Revenue", co.fcff?inr(co.fcff.revenue)+" cr":"—"],["EBIT margin", pct(co.assumptions.ebitMargin)],["Net debt", co.fcff?inr(co.fcff.netDebt)+" cr":"—"],["Book value / share", inr(f.bvps)],["EPS", f.eps?inr(f.eps):"—"],["P/E", f.pe?fmt(f.pe,1):"—"],["ROE", pct(f.roe)],["P/B", fmt(f.pb,2)]];
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10 }}>
        {cards.map(([l,v])=>(
          <div key={l} style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:8, padding:"12px 14px" }}>
            <div style={{ ...sans, color:C.dim, fontSize:11 }}>{l}</div>
            <div style={{ ...mono, color:C.text, fontSize:17, marginTop:4 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ ...sans, color:C.faint, fontSize:12, marginTop:14, display:"flex", gap:8, alignItems:"flex-start" }}>
        <Info size={13} color={C.goldDim} style={{ marginTop:1, flexShrink:0 }} />
        <span>{isFin?"NBFC metrics updated quarterly from result PDFs.":"Replace with audited figures from the annual report."}</span>
      </div>
    </div>
  );
}

function Technical({ rec }) {
  const t = rec.t;
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:10, marginBottom:14 }}>
        <Stat label="Last close" value={inr(t.last)} />
        <Stat label="RSI (14)" value={fmt(t.rsi)} color={t.rsi>70?C.red:t.rsi<30?C.green:C.text} sub={t.rsi>70?"Overbought":t.rsi<30?"Oversold":"Neutral"} />
        <Stat label="Vs 50-DMA" value={t.aboveSMA50?"Above":"Below"} color={t.aboveSMA50?C.green:C.red} />
        <Stat label="52w High" value={inr(t.hi)} />
        <Stat label="52w Low" value={inr(t.lo)} />
      </div>
      <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, padding:"16px 8px 8px 0" }}>
        <div style={{ ...sans, color:C.dim, fontSize:12, padding:"0 0 8px 16px" }}>Price · 20-DMA · 50-DMA (1 year)</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={t.data} margin={{ top:5, right:20, bottom:5, left:0 }}>
            <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="i" tick={{ fill:C.faint, fontSize:10, fontFamily:"monospace" }} tickLine={false} axisLine={{ stroke:C.line }} />
            <YAxis domain={["auto","auto"]} tick={{ fill:C.faint, fontSize:10, fontFamily:"monospace" }} tickLine={false} axisLine={{ stroke:C.line }} width={55} />
            <Tooltip contentStyle={{ background:C.panel2, border:`1px solid ${C.line}`, borderRadius:6, fontFamily:"monospace", fontSize:12 }} labelStyle={{ color:C.dim }} />
            <Line type="monotone" dataKey="close" stroke={C.gold} dot={false} strokeWidth={1.6} name="Price" />
            <Line type="monotone" dataKey="sma20" stroke={C.blue} dot={false} strokeWidth={1.1} name="20-DMA" />
            <Line type="monotone" dataKey="sma50" stroke={C.dim} dot={false} strokeWidth={1.1} strokeDasharray="4 3" name="50-DMA" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Verdict({ rec }) {
  return (
    <div style={{ display:"grid", gap:16 }}>
      <div style={{ background:C.panel, border:`1px solid ${C.line}`, borderRadius:10, padding:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6, flexWrap:"wrap", gap:12 }}>
          <div style={{ ...serif, color:C.text, fontSize:20, fontWeight:600 }}>How the verdict is built</div>
          <VerdictBadge verdict={rec.verdict} big />
        </div>
        <div style={{ ...sans, color:C.dim, fontSize:13, marginBottom:18 }}>Composite = 45% valuation + 28% quality + 14% momentum + 13% risk. Score {fmt(rec.composite)}/100.</div>
        {rec.reasons.map((r)=>(
          <div key={r.label} style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
              <span style={{ ...sans, color:C.text, fontSize:13, fontWeight:500 }}>{r.label}</span>
              <span style={{ ...mono, color:r.good?C.green:r.bad?C.red:C.text, fontSize:13 }}>{fmt(r.score)}/100</span>
            </div>
            <div style={{ height:6, background:C.panel2, borderRadius:3, overflow:"hidden", border:`1px solid ${C.line}` }}>
              <div style={{ width:`${r.score}%`, height:"100%", background:r.good?C.green:r.bad?C.red:C.gold }} />
            </div>
            <div style={{ ...sans, color:C.faint, fontSize:12, marginTop:4 }}>{r.note}</div>
          </div>
        ))}
      </div>
      <div style={{ background:C.panel, border:`1px solid ${C.goldDim}55`, borderRadius:10, padding:"14px 18px", display:"flex", gap:10, alignItems:"flex-start" }}>
        <ShieldAlert size={16} color={C.gold} style={{ flexShrink:0, marginTop:1 }} />
        <div style={{ ...sans, color:C.dim, fontSize:12, lineHeight:1.65 }}>
          <b style={{ color:C.text }}>Not investment advice.</b> This calculator shows what a stock is worth under your assumptions. Publishing buy/sell calls publicly in India may require SEBI Research Analyst registration.
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const API = import.meta.env.VITE_API_URL;
  const [companies, setCompanies] = useState(SEED);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("screener");
  const [selectedId, setSelectedId] = useState(null);
  const [assumptions, setAssumptions] = useState(null);
  const [price, setPrice] = useState(0);

  useEffect(() => {
    if (!API) return;
    setLoading(true);
    fetch(`${API}/api/companies`)
      .then((r) => r.json())
      .then((rows) => {
        const mapped = rows.map((r) => buildFromApi(r));
        setCompanies(mapped.length > 0 ? mapped : SEED);
      })
      .catch(() => { console.warn("API unreachable, using sample data"); setCompanies(SEED); })
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(() => {
    return companies.find((c) => (c.ticker || c.id) === selectedId);
  }, [companies, selectedId]);

  const open = (id) => {
    const co = companies.find((c) => (c.ticker || c.id) === id);
    if (!co) return;
    setSelectedId(id);
    setAssumptions({ ...co.assumptions });
    setPrice(co.price);
    setView("company");
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        body{margin:0} *::-webkit-scrollbar{height:8px;width:8px} *::-webkit-scrollbar-thumb{background:${C.line};border-radius:4px}
        input[type=range]{height:4px;border-radius:2px;background:${C.line}} select option{background:${C.panel2}}`}</style>
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"22px 20px 60px" }}>
        <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingBottom:16, borderBottom:`1px solid ${C.line}`, marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:34, height:34, borderRadius:8, background:C.gold+"18", border:`1px solid ${C.gold}55`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <TrendingUp size={18} color={C.gold} />
            </div>
            <div>
              <div style={{ ...serif, fontSize:20, fontWeight:600, color:C.text, lineHeight:1 }}>Equity Research Terminal</div>
              <div style={{ ...mono, fontSize:11, color:C.faint, marginTop:3 }}>DCF · fundamentals · technicals · verdict</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {!loading && <div style={{ ...sans, fontSize:11, color:C.faint }}>{companies.length} companies</div>}
            <div style={{ ...sans, fontSize:11, color:C.goldDim, border:`1px solid ${C.goldDim}55`, padding:"4px 10px", borderRadius:20, background:C.gold+"0d" }}>
              {API ? "LIVE DATA" : "SAMPLE DATA"}
            </div>
          </div>
        </header>
        {view === "screener" && <Screener companies={companies} onOpen={open} loading={loading} />}
        {view === "company" && selected && assumptions && (
          <Company co={selected} assumptions={assumptions} setAssumptions={setAssumptions}
            price={price} setPrice={setPrice} onBack={() => setView("screener")} />
        )}
      </div>
    </div>
  );
}
