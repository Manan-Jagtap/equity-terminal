/* Company.jsx — 7-tab editorial design (Step 5).
   Tabs: Overview · Financials · Ratios · DCF · Peers · AI Thesis · Verdict
   Consumes /financials, /metrics from the backend; falls back gracefully
   when data is missing. AI Thesis tab is a placeholder (Step 6). */

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus,
  BarChart2, FileText, Calculator, PieChart,
  Users, Brain, Gauge, ChevronRight, Info,
  Activity, Zap,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

import { C, mono, sans, serif } from "../lib/theme.js";
import { fmt, inr, pct, cr, safe } from "../lib/formatters.js";
import { recommend } from "../lib/recommend.js";
import { fundamentals, valuate } from "../lib/valuation.js";
import { technicals } from "../lib/technicals.js";
import { VerdictBadge, Stat, Field, MTable, TH, TR } from "./primitives.jsx";
import DCFModel from "./DCFModel.jsx";

const TABS = [
  { id: "overview",    icon: Activity,    label: "Overview" },
  { id: "financials",  icon: FileText,    label: "Financials" },
  { id: "ratios",      icon: PieChart,    label: "Ratios" },
  { id: "dcf",         icon: Calculator,  label: "DCF" },
  { id: "peers",       icon: Users,       label: "Peers" },
  { id: "thesis",      icon: Brain,       label: "AI Thesis" },
  { id: "verdict",     icon: Gauge,       label: "Verdict" },
];

/* ── Tiny helpers ─────────────────────────────────────────────────── */
function Delta({ v, suffix = "%" }) {
  if (v == null || isNaN(v)) return <span style={{ color: C.faint }}>—</span>;
  const up = v >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const color = up ? C.green : C.red;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color }}>
      <Icon size={12} />
      <span style={mono}>{Math.abs(v * 100).toFixed(1)}{suffix}</span>
    </span>
  );
}

function KVRow({ label, value, color, bold, border }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "8px 0",
      borderBottom: border ? `1px solid ${C.line}22` : "none",
    }}>
      <span style={{ ...sans, color: C.dim, fontSize: 12 }}>{label}</span>
      <span style={{ ...mono, color: color || C.text, fontSize: 13, fontWeight: bold ? 600 : 400 }}>{value}</span>
    </div>
  );
}

function SectionHead({ title, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...sans, color: C.text, fontSize: 14, fontWeight: 600 }}>{title}</div>
      {sub && <div style={{ ...sans, color: C.faint, fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: C.panel,
      border: `1px solid ${C.line}`,
      borderRadius: 10,
      padding: 18,
      ...style,
    }}>{children}</div>
  );
}

function Badge({ label, color }) {
  const col = color || C.gold;
  return (
    <span style={{
      ...sans, fontSize: 10, fontWeight: 600,
      color: col, border: `1px solid ${col}55`,
      background: col + "18", padding: "2px 8px",
      borderRadius: 20, letterSpacing: "0.06em",
      textTransform: "uppercase",
    }}>{label}</span>
  );
}

/* ── Overview Tab ─────────────────────────────────────────────────── */
function OverviewTab({ co, rec, liveMetrics }) {
  const t = rec.t;
  const f = rec.f;
  const isF = co.type === "financial";

  // Pull key metrics from live API data if available
  const growth = liveMetrics?.categories?.find(c => c.name === "Growth")?.metrics || [];
  const patGrowth = growth.find(m => m.key === "pat_growth_yoy");
  const revenueGrowth = growth.find(m => m.key === "rev_growth_yoy") || growth.find(m => m.key === "nii_growth_yoy");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Investment thesis */}
      <Card style={{ gridColumn: "1 / -1" }}>
        <SectionHead title="Investment Thesis" sub={`${co.sector} · ${co.type === "financial" ? "Financial Services" : "Non-Financial"}`} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 10, marginBottom: 14 }}>
          {[
            ["CMP", inr(co.price)],
            ["Intrinsic Value", inr(rec.v.intrinsic), C.gold],
            ["Margin of Safety", pct(rec.mos), rec.mos >= 0 ? C.green : C.red],
            ["ROE", pct(f.roe)],
            [isF ? "P/B" : "P/E", isF ? fmt(f.pb, 2) + "x" : (f.pe ? fmt(f.pe, 1) + "x" : "—")],
            ["Composite Score", fmt(rec.composite) + "/100"],
          ].map(([l, v, col]) => (
            <div key={l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ ...sans, color: C.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{l}</div>
              <div style={{ ...mono, color: col || C.text, fontSize: 17 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Badge label={co.type === "financial" ? "Residual Income Model" : "FCFF DCF"} />
          <Badge label={co.sector} color={C.blue} />
          {patGrowth?.value != null && (
            <Badge label={`PAT +${(patGrowth.value * 100).toFixed(0)}% YoY`} color={C.green} />
          )}
        </div>
      </Card>

      {/* Price chart */}
      <Card>
        <SectionHead title="Price — 250 Sessions" sub={`RSI ${fmt(t.rsi)} · ${t.aboveSMA50 ? "Above" : "Below"} 50-DMA`} />
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={t.data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.gold} stopOpacity={0.2} />
                <stop offset="95%" stopColor={C.gold} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="i" tick={false} axisLine={{ stroke: C.line }} />
            <YAxis domain={["auto", "auto"]} tick={{ fill: C.faint, fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={{ stroke: C.line }} width={52} />
            <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: "monospace", fontSize: 11 }} />
            <Area type="monotone" dataKey="close" stroke={C.gold} strokeWidth={1.6} fill="url(#priceGrad)" dot={false} name="Price" />
            <Line type="monotone" dataKey="sma50" stroke={C.dim} strokeWidth={1} dot={false} strokeDasharray="4 3" name="50-DMA" />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          {[["52W High", inr(t.hi)], ["52W Low", inr(t.lo)], ["RSI", fmt(t.rsi)]].map(([l, v]) => (
            <div key={l} style={{ ...sans }}>
              <div style={{ color: C.faint, fontSize: 10 }}>{l}</div>
              <div style={{ ...mono, color: C.text, fontSize: 12 }}>{v}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Key metrics snapshot */}
      <Card>
        <SectionHead title="Key Metrics" sub="Latest available" />
        {liveMetrics?.categories ? (
          liveMetrics.categories.slice(0, 2).map(cat => (
            <div key={cat.name} style={{ marginBottom: 10 }}>
              <div style={{ ...sans, color: C.goldDim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{cat.name}</div>
              {cat.metrics.filter(m => m.value != null).slice(0, 4).map(m => (
                <KVRow key={m.key} label={m.label} value={m.formatted} border
                  color={m.good === true ? C.green : m.good === false ? C.red : C.text} />
              ))}
            </div>
          ))
        ) : (
          <>
            <KVRow label="ROE" value={pct(f.roe)} border color={f.roe > 0.15 ? C.green : C.text} />
            <KVRow label="P/B" value={fmt(f.pb, 2) + "x"} border />
            <KVRow label="P/E" value={f.pe ? fmt(f.pe, 1) + "x" : "—"} border />
            <KVRow label="BVPS" value={inr(co.equity / co.shares)} border />
          </>
        )}
      </Card>

      {/* Valuation verdict summary */}
      <Card style={{ gridColumn: "1 / -1" }}>
        <SectionHead title="Valuation at a Glance" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {rec.reasons.map(r => (
            <div key={r.label} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ ...sans, color: C.dim, fontSize: 11, marginBottom: 6 }}>{r.label}</div>
              <div style={{ height: 4, background: C.line, borderRadius: 2, marginBottom: 6 }}>
                <div style={{ width: `${r.score}%`, height: "100%", borderRadius: 2, background: r.good ? C.green : r.bad ? C.red : C.gold }} />
              </div>
              <div style={{ ...mono, color: r.good ? C.green : r.bad ? C.red : C.text, fontSize: 13 }}>{fmt(r.score)}/100</div>
              <div style={{ ...sans, color: C.faint, fontSize: 11, marginTop: 2 }}>{r.note}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ── Financials Tab ───────────────────────────────────────────────── */
function FinancialsTab({ co, API, liveFinancials }) {
  const [stmt, setStmt] = useState("pl");
  const isF = co.type === "financial";

  const { years, statements, hasData, template } = useMemo(() => {
    if (liveFinancials?.has_data) {
      return {
        years: liveFinancials.years_available,
        statements: liveFinancials.statements,
        hasData: true,
        template: liveFinancials.template,
      };
    }
    return { years: [], statements: {}, hasData: false, template: null };
  }, [liveFinancials]);

  const cols = ["Line Item", ...years.map(y => `FY${String(y).slice(2)}`)];
  const get = (yr, st, key) => statements[yr]?.[st]?.[key];
  const fmtV = v => v == null ? "—" : cr(v);

  const StmtBtn = ({ id, label }) => (
    <button onClick={() => setStmt(id)} style={{
      ...sans, fontSize: 12, fontWeight: 500, cursor: "pointer",
      background: stmt === id ? C.gold + "22" : "transparent",
      border: `1px solid ${stmt === id ? C.gold + "55" : C.line}`,
      color: stmt === id ? C.gold : C.dim,
      padding: "6px 14px", borderRadius: 6,
    }}>{label}</button>
  );

  if (!hasData) {
    return (
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ ...sans, fontSize: 11, color: C.gold, border: `1px solid ${C.gold}55`, background: C.gold + "14", padding: "3px 10px", borderRadius: 20 }}>
            ⚠ Historical data not yet ingested — run bulk_ingester to populate
          </div>
        </div>
        <div style={{ ...sans, color: C.dim, fontSize: 13, lineHeight: 1.7 }}>
          Financial statements will appear here once the XBRL / Screener ingestion pipeline runs.
          The DCF tab uses projected financials in the meantime.
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ ...sans, fontSize: 11, color: C.green, border: `1px solid ${C.green}55`, background: C.green + "14", padding: "3px 10px", borderRadius: 20 }}>
          ✓ Actual data · {years.length} fiscal years · {template}
        </div>
        <div style={{ ...sans, fontSize: 11, color: C.faint }}>₹ crore · A = Actual</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <StmtBtn id="pl" label={isF ? "P&L" : "Income Statement"} />
        <StmtBtn id="bs" label="Balance Sheet" />
        <StmtBtn id="cf" label="Cash Flow" />
      </div>

      {stmt === "pl" && (
        <MTable>
          <thead><TH cols={cols} /></thead>
          <tbody>
            {isF ? (
              <>
                <TR cells={["Interest Income", ...years.map(y => fmtV(get(y,"PL","interest_income") || get(y,"PL","revenue")))]} />
                <TR cells={["Net Interest Income (NII)", ...years.map(y => fmtV(get(y,"PL","nii")))]} bold color={C.text} bg={C.panel2+"80"} />
                <TR cells={["Provisions", ...years.map(y => fmtV(get(y,"PL","provisions")))]} color={C.red} />
                <TR cells={["PBT", ...years.map(y => fmtV(get(y,"PL","pbt")))]} />
                <TR cells={["Tax", ...years.map(y => get(y,"PL","tax") != null ? "(" + cr(get(y,"PL","tax")) + ")" : "—")]} color={C.dim} />
                <TR cells={["PAT", ...years.map(y => fmtV(get(y,"PL","pat")))]} bold color={C.green} bg={C.panel2+"80"} />
              </>
            ) : (
              <>
                <TR cells={["Revenue", ...years.map(y => fmtV(get(y,"PL","revenue")))]} bold bg={C.panel2+"80"} />
                <TR cells={["EBITDA", ...years.map(y => fmtV(get(y,"PL","ebitda")))]} />
                <TR cells={["EBITDA Margin", ...years.map(y => {
                  const e = get(y,"PL","ebitda"), r = get(y,"PL","revenue");
                  return e && r ? pct(e/r) : "—";
                })]} color={C.blue} />
                <TR cells={["EBIT", ...years.map(y => fmtV(get(y,"PL","ebit")))]} />
                <TR cells={["Interest", ...years.map(y => fmtV(get(y,"PL","interest") || get(y,"PL","interest_expense")))]} color={C.dim} />
                <TR cells={["PBT", ...years.map(y => fmtV(get(y,"PL","pbt")))]} />
                <TR cells={["Tax", ...years.map(y => get(y,"PL","tax") != null ? "(" + cr(get(y,"PL","tax")) + ")" : "—")]} color={C.dim} />
                <TR cells={["PAT", ...years.map(y => fmtV(get(y,"PL","pat")))]} bold color={C.green} bg={C.panel2+"80"} />
                <TR cells={["PAT Margin", ...years.map(y => {
                  const p = get(y,"PL","pat"), r = get(y,"PL","revenue");
                  return p && r ? pct(p/r) : "—";
                })]} color={C.green} />
              </>
            )}
          </tbody>
        </MTable>
      )}

      {stmt === "bs" && (
        <MTable>
          <thead><TH cols={cols} /></thead>
          <tbody>
            <TR cells={["Equity / Net Worth", ...years.map(y => fmtV(get(y,"BS","equity") || get(y,"BS","net_worth")))]} bold color={C.green} bg={C.panel2+"80"} />
            <TR cells={["Borrowings", ...years.map(y => fmtV(get(y,"BS","borrowings") || get(y,"BS","total_debt")))]} color={C.red} />
            <TR cells={["Cash", ...years.map(y => fmtV(get(y,"BS","cash")))]} color={C.blue} />
            <TR cells={["Total Assets", ...years.map(y => fmtV(get(y,"BS","total_assets")))]} bold />
            <TR cells={["Debt / Equity", ...years.map(y => {
              const b = get(y,"BS","borrowings") || get(y,"BS","total_debt");
              const e = get(y,"BS","equity") || get(y,"BS","net_worth");
              return b && e ? fmt(b/e, 2) + "x" : "—";
            })]} />
          </tbody>
        </MTable>
      )}

      {stmt === "cf" && (
        <MTable>
          <thead><TH cols={cols} /></thead>
          <tbody>
            <TR cells={["PAT", ...years.map(y => fmtV(get(y,"PL","pat")))]} bg={C.panel2+"80"} />
            <TR cells={["Operating Cash Flow", ...years.map(y => fmtV(get(y,"CF","operating_cf")))]} bold color={C.green} />
            <TR cells={["CapEx", ...years.map(y => fmtV(get(y,"CF","capex")))]} color={C.red} />
            <TR cells={["Free Cash Flow", ...years.map(y => fmtV(get(y,"CF","fcf")))]} bold color={C.blue} bg={C.panel2+"80"} />
            <TR cells={["Dividends", ...years.map(y => fmtV(get(y,"CF","dividends")))]} />
          </tbody>
        </MTable>
      )}

      {/* PAT trend chart */}
      {years.length >= 2 && (
        <Card style={{ marginTop: 14 }}>
          <SectionHead title="PAT Trend" sub="₹ crore" />
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={years.map(y => ({ fy: `FY${String(y).slice(2)}`, pat: get(y,"PL","pat") }))}>
              <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="fy" tick={{ fill: C.dim, fontSize: 11, fontFamily: "monospace" }} axisLine={{ stroke: C.line }} tickLine={false} />
              <YAxis tick={{ fill: C.faint, fontSize: 10, fontFamily: "monospace" }} axisLine={{ stroke: C.line }} tickLine={false} width={60} />
              <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: "monospace", fontSize: 11 }} />
              <Bar dataKey="pat" fill={C.green} opacity={0.8} radius={[4, 4, 0, 0]} name="PAT (₹ cr)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

/* ── Ratios Tab ──────────────────────────────────────────────────── */
function RatiosTab({ co, liveMetrics, f }) {
  const [activeCategory, setActiveCategory] = useState(null);

  const categories = liveMetrics?.categories || [];

  // Fallback categories from local computation
  const fallback = [
    {
      name: "Profitability",
      metrics: [
        { label: "ROE", formatted: pct(f.roe), good: f.roe > 0.12 },
        { label: "P/B", formatted: fmt(f.pb, 2) + "x", good: null },
        { label: "P/E", formatted: f.pe ? fmt(f.pe, 1) + "x" : "—", good: null },
      ],
    },
  ];

  const cats = categories.length ? categories : fallback;
  const display = activeCategory
    ? cats.filter(c => c.name === activeCategory)
    : cats;

  return (
    <div>
      {/* Category filter pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <button
          onClick={() => setActiveCategory(null)}
          style={{
            ...sans, fontSize: 11, cursor: "pointer", borderRadius: 20,
            padding: "4px 12px", fontWeight: 500,
            background: !activeCategory ? C.gold + "22" : "transparent",
            border: `1px solid ${!activeCategory ? C.gold + "55" : C.line}`,
            color: !activeCategory ? C.gold : C.dim,
          }}
        >All</button>
        {cats.map(cat => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(cat.name === activeCategory ? null : cat.name)}
            style={{
              ...sans, fontSize: 11, cursor: "pointer", borderRadius: 20,
              padding: "4px 12px", fontWeight: 500,
              background: activeCategory === cat.name ? C.gold + "22" : "transparent",
              border: `1px solid ${activeCategory === cat.name ? C.gold + "55" : C.line}`,
              color: activeCategory === cat.name ? C.gold : C.dim,
            }}
          >{cat.name}</button>
        ))}
      </div>

      {/* Metric grids */}
      {display.map(cat => {
        const populated = cat.metrics.filter(m => m.value !== null && m.formatted !== "—");
        if (!populated.length) return null;
        return (
          <div key={cat.name} style={{ marginBottom: 18 }}>
            <div style={{ ...sans, color: C.goldDim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              {cat.name}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
              {populated.map(m => (
                <div key={m.key || m.label} style={{
                  background: C.panel,
                  border: `1px solid ${C.line}`,
                  borderRadius: 8, padding: "10px 12px",
                  borderLeft: `3px solid ${m.good === true ? C.green : m.good === false ? C.red : C.line}`,
                }}>
                  <div style={{ ...sans, color: C.dim, fontSize: 11, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ ...mono, color: m.good === true ? C.green : m.good === false ? C.red : C.text, fontSize: 15 }}>
                    {m.formatted}
                  </div>
                  {m.note && (
                    <div style={{ ...sans, color: C.faint, fontSize: 10, marginTop: 3, lineHeight: 1.4 }}>{m.note}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {!liveMetrics && (
        <div style={{ ...sans, color: C.faint, fontSize: 12, textAlign: "center", padding: 30 }}>
          Live metrics require API connection. Showing local estimates only.
        </div>
      )}
    </div>
  );
}

/* ── Peers Tab ───────────────────────────────────────────────────── */
function PeersTab({ co, allCompanies, rec }) {
  const peers = useMemo(() => {
    const isF = co.type === "financial";
    return allCompanies
      .filter(c => c.ticker !== co.ticker && c.type === co.type)
      .slice(0, 8)
      .map(peer => {
        try {
          const r = recommend(peer, peer.assumptions);
          const f = fundamentals(peer);
          return { co: peer, rec: r, f };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.rec.composite - a.rec.composite)
      .slice(0, 6);
  }, [co, allCompanies]);

  const isF = co.type === "financial";
  const selfRec = rec;
  const selfF = rec.f;
  const allRows = [
    { co, rec: selfRec, f: selfF, isSelf: true },
    ...peers.map(p => ({ ...p, isSelf: false })),
  ];

  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <SectionHead title="Peer Comparison" sub={`${co.type === "financial" ? "Financial Services" : co.sector} — ranked by composite score`} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
                {["Company", "CMP", "Intrinsic", "MoS", "ROE", isF ? "P/B" : "P/E", "Score", "Verdict"].map((h, i) => (
                  <th key={h} style={{ ...sans, color: C.dim, fontSize: 11, fontWeight: 500, textAlign: i === 0 ? "left" : "right", padding: "9px 12px", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.map(({ co: c, rec: r, f: fi, isSelf }, idx) => (
                <tr key={c.ticker} style={{ background: isSelf ? C.gold + "0e" : "transparent", borderTop: `1px solid ${C.line}22` }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ ...sans, color: C.text, fontSize: 13, fontWeight: isSelf ? 600 : 400 }}>{c.name}</div>
                    <div style={{ ...mono, color: C.faint, fontSize: 10 }}>{c.ticker}</div>
                  </td>
                  <td style={{ ...mono, fontSize: 12, textAlign: "right", padding: "10px 12px" }}>{inr(c.price)}</td>
                  <td style={{ ...mono, fontSize: 12, textAlign: "right", padding: "10px 12px", color: C.gold }}>{inr(r.v.intrinsic)}</td>
                  <td style={{ ...mono, fontSize: 12, textAlign: "right", padding: "10px 12px", color: r.mos >= 0 ? C.green : C.red }}>{pct(r.mos)}</td>
                  <td style={{ ...mono, fontSize: 12, textAlign: "right", padding: "10px 12px" }}>{pct(fi.roe)}</td>
                  <td style={{ ...mono, fontSize: 12, textAlign: "right", padding: "10px 12px" }}>{isF ? fmt(fi.pb, 2) + "x" : (fi.pe ? fmt(fi.pe, 1) + "x" : "—")}</td>
                  <td style={{ ...mono, fontSize: 12, textAlign: "right", padding: "10px 12px" }}>{fmt(r.composite)}</td>
                  <td style={{ textAlign: "right", padding: "10px 12px" }}><VerdictBadge verdict={r.verdict} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Scatter: ROE vs P/B */}
      <Card>
        <SectionHead title="ROE vs Valuation" sub={isF ? "ROE × P/B scatter" : "ROE × P/E scatter"} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allRows.map(({ co: c, f: fi, isSelf }) => {
            const x = fi.roe || 0;
            const y = isF ? (fi.pb || 0) : (fi.pe || 0);
            return (
              <div key={c.ticker} style={{
                background: isSelf ? C.gold + "22" : C.panel2,
                border: `1px solid ${isSelf ? C.gold + "55" : C.line}`,
                borderRadius: 8, padding: "8px 12px", minWidth: 120,
              }}>
                <div style={{ ...mono, color: isSelf ? C.gold : C.text, fontSize: 12, fontWeight: isSelf ? 600 : 400 }}>{c.ticker}</div>
                <div style={{ ...sans, color: C.dim, fontSize: 10, marginTop: 2 }}>ROE {pct(x)} · {isF ? "P/B" : "P/E"} {fmt(y, 1)}x</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ── AI Thesis Tab ───────────────────────────────────────────────── */
function AIThesisTab({ co, API }) {
  const [thesis, setThesis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [cached, setCached] = useState(false);

  const generate = async (force = false) => {
    if (!API) {
      setError("API not configured — set VITE_API_URL in Vercel environment variables.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/api/companies/${co.ticker}/thesis${force ? "?force_refresh=true" : ""}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.error) {
        setError(data.thesis);
      } else {
        setThesis(data.thesis);
        setCached(data.cached || false);
      }
    } catch (e) {
      setError("Network error — " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (text) => text.split("\n").map((line, i) => {
    if (line.startsWith("# "))  return null;   // strip top-level title
    if (line.startsWith("## ")) return (
      <div key={i} style={{ ...sans, color: C.gold, fontSize: 13, fontWeight: 600, marginTop: 18, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {line.replace("## ", "")}
      </div>
    );
    if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
    return <div key={i} style={{ ...sans, color: C.text, fontSize: 13, lineHeight: 1.75 }}>{line}</div>;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: thesis ? 16 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Brain size={16} color={C.gold} />
            <div style={{ ...sans, color: C.text, fontSize: 14, fontWeight: 600 }}>AI Investment Thesis</div>
            {cached && <Badge label="Cached" color={C.blue} />}
          </div>
          <button onClick={() => generate(!!thesis)} disabled={loading} style={{
            ...sans, fontSize: 12, fontWeight: 600, cursor: loading ? "wait" : "pointer",
            padding: "8px 18px", background: C.gold + "22",
            border: `1px solid ${C.gold}55`, color: C.gold, borderRadius: 7,
          }}>
            {loading ? "Generating…" : thesis ? "Regenerate" : `Generate thesis for ${co.name}`}
          </button>
        </div>

        {!thesis && !loading && !error && (
          <div style={{ ...sans, color: C.dim, fontSize: 13, lineHeight: 1.75 }}>
            Generates a grounded investment thesis using live financials, key metrics, and peer comparison.
            Every figure is validated against real data.
          </div>
        )}
        {loading && <div style={{ ...sans, color: C.gold, fontSize: 13, padding: "20px 0" }}>Analysing {co.name} data…</div>}
        {error && (
          <div style={{ ...sans, color: C.red, fontSize: 13, padding: "12px", background: C.red + "14", borderRadius: 8, border: `1px solid ${C.red}33` }}>{error}</div>
        )}
        {thesis && (
          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>{renderMarkdown(thesis)}</div>
        )}
      </Card>

      {thesis && (
        <Card style={{ border: `1px solid ${C.line}44` }}>
          <div style={{ ...sans, color: C.faint, fontSize: 11, lineHeight: 1.65 }}>
            Generated by Claude Sonnet · Grounded in {co.ticker} financial data · Numbers validated against DB · Cached 6h ·{" "}
            <b style={{ color: C.text }}>Not investment advice.</b>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Verdict Tab ─────────────────────────────────────────────────── */
function VerdictTab({ rec }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ ...serif, color: C.text, fontSize: 20, fontWeight: 600 }}>Composite Recommendation</div>
            <div style={{ ...sans, color: C.dim, fontSize: 13, marginTop: 3 }}>
              45% valuation · 28% quality · 14% momentum · 13% risk
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ ...sans, color: C.dim, fontSize: 10 }}>COMPOSITE SCORE</div>
              <div style={{ ...mono, color: C.text, fontSize: 26 }}>{fmt(rec.composite)}<span style={{ color: C.faint, fontSize: 13 }}>/100</span></div>
            </div>
            <VerdictBadge verdict={rec.verdict} big />
          </div>
        </div>

        {rec.reasons.map(r => (
          <div key={r.label} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <span style={{ ...sans, color: C.text, fontSize: 13, fontWeight: 500 }}>{r.label}</span>
              <span style={{ ...mono, color: r.good ? C.green : r.bad ? C.red : C.text, fontSize: 13 }}>{fmt(r.score)}/100</span>
            </div>
            <div style={{ height: 6, background: C.panel2, borderRadius: 3, overflow: "hidden", border: `1px solid ${C.line}` }}>
              <div style={{ width: `${r.score}%`, height: "100%", background: r.good ? C.green : r.bad ? C.red : C.gold, borderRadius: 3 }} />
            </div>
            <div style={{ ...sans, color: C.faint, fontSize: 12, marginTop: 3 }}>{r.note}</div>
          </div>
        ))}
      </Card>

      <Card style={{ border: `1px solid ${C.goldDim}55`, background: C.panel }}>
        <div style={{ display: "flex", gap: 10 }}>
          <Info size={15} color={C.gold} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ ...sans, color: C.dim, fontSize: 12, lineHeight: 1.7 }}>
            <b style={{ color: C.text }}>Not investment advice.</b> Scores are mechanical outputs of a model with fixed assumptions. Verify all figures against the company's latest filings. SEBI Research Analyst regulations apply for public recommendations.
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── Main Company component ──────────────────────────────────────── */
export default function Company({ co, assumptions, setAssumptions, price, setPrice, onBack, API, allCompanies }) {
  const [tab, setTab] = useState("overview");
  const [liveFinancials, setLiveFinancials] = useState(null);
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  const co2 = useMemo(() => ({ ...co, price, assumptions }), [co, price, assumptions]);
  const rec = useMemo(() => recommend(co2, assumptions), [co2, assumptions]);
  const set = useCallback(k => val => setAssumptions(prev => ({ ...prev, [k]: val })), [setAssumptions]);

  // Fetch live data from API once on mount
  useEffect(() => {
    if (!API || !co.ticker) return;
    setLoadingData(true);
    Promise.all([
      fetch(`${API}/api/companies/${co.ticker}/financials`).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/companies/${co.ticker}/metrics`).then(r => r.json()).catch(() => null),
    ]).then(([fins, mets]) => {
      setLiveFinancials(fins);
      setLiveMetrics(mets);
    }).finally(() => setLoadingData(false));
  }, [co.ticker, API]);

  const snapshot = [
    { label: "CMP", value: inr(price) },
    { label: "Intrinsic", value: inr(rec.v.intrinsic), color: C.gold },
    { label: "MoS", value: pct(rec.mos), color: rec.mos >= 0 ? C.green : C.red },
    { label: "ROE", value: pct(rec.f.roe) },
    { label: rec.f.pe ? "P/E" : "P/B", value: rec.f.pe ? fmt(rec.f.pe, 1) + "x" : fmt(rec.f.pb, 2) + "x" },
    { label: "Score", value: fmt(rec.composite) + "/100" },
  ];

  return (
    <div>
      {/* Back */}
      <button onClick={onBack} style={{ ...sans, display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: C.dim, fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
        <ArrowLeft size={15} /> Back to screener
      </button>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 14 }}>
        <div>
          <div style={{ ...serif, color: C.text, fontSize: 30, fontWeight: 600, lineHeight: 1.1 }}>{co.name}</div>
          <div style={{ ...mono, color: C.faint, fontSize: 12, marginTop: 5, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span>{co.ticker}</span>
            <span style={{ color: C.line }}>·</span>
            <span>{co.sector}</span>
            <span style={{ color: C.line }}>·</span>
            <span>{liveMetrics?.template || (co.type === "financial" ? "NBFC" : "MANUFACTURING")}</span>
            {loadingData && <span style={{ color: C.gold }}>· loading…</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ ...sans, color: C.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>Score</div>
            <div style={{ ...mono, color: C.text, fontSize: 24 }}>{fmt(rec.composite)}<span style={{ color: C.faint, fontSize: 12 }}>/100</span></div>
          </div>
          <VerdictBadge verdict={rec.verdict} big />
        </div>
      </div>

      {/* Snapshot strip */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {snapshot.map(s => (
          <div key={s.label} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 14px", flex: "0 0 auto" }}>
            <div style={{ ...sans, color: C.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
            <div style={{ ...mono, color: s.color || C.text, fontSize: 15, marginTop: 3 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: `1px solid ${C.line}`, paddingBottom: 0 }}>
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              ...sans, display: "flex", alignItems: "center", gap: 6,
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${tab === id ? C.gold : "transparent"}`,
              color: tab === id ? C.gold : C.dim,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: tab === id ? 600 : 400,
              cursor: "pointer",
              marginBottom: -1,
              transition: "color 0.15s",
            }}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview"   && <OverviewTab    co={co2} rec={rec} liveMetrics={liveMetrics} />}
      {tab === "financials" && <FinancialsTab  co={co2} API={API} liveFinancials={liveFinancials} />}
      {tab === "ratios"     && <RatiosTab      co={co2} liveMetrics={liveMetrics} f={rec.f} />}
      {tab === "dcf"        && <DCFModel       co={co2} a={assumptions} set={set} price={price} setPrice={setPrice} />}
      {tab === "peers"      && <PeersTab       co={co2} allCompanies={allCompanies || [co2]} rec={rec} />}
      {tab === "thesis"     && <AIThesisTab    co={co2} API={API} />}
      {tab === "verdict"    && <VerdictTab     rec={rec} />}
    </div>
  );
}
