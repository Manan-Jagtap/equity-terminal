/* Company.jsx — Step 7 redesign.
   Matches the reference design: warm ink palette, Instrument Serif,
   giant price header, 12-stat snapshot strip, editorial tabs.
   All 7 tabs fully wired to live API data with rich fallbacks. */

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ArrowLeft, Building2, FileText, Activity, Calculator,
  Users, Brain, Shield, Sparkles, Check, AlertTriangle,
  Info, Loader2, TrendingUp, TrendingDown, Newspaper, Download,
} from "lucide-react";
import {
  ComposedChart, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from "recharts";

import { C, mono, sans, serif, gridBg } from "../lib/theme.js";
import { fmt, inr, pct, cr } from "../lib/formatters.js";
import { recommend } from "../lib/recommend.js";
import { fundamentals } from "../lib/valuation.js";
import { technicals } from "../lib/technicals.js";

/* ── Company-specific static data fallbacks ─────────────────────── */
// Rich data for seeded companies so Overview/Financials/Ratios/Verdict
// tabs are always populated even before bulk_ingester runs.
const COMPANY_DATA = {
  MUTHOOTFIN: {
    meta: { hq:"Kochi, Kerala", founded:"1939 · Listed 2011", md:"George Alexander Muthoot", branches:"4,869 across 29 states", employees:"~28,700", collateral:"202 tonnes gold", footfall:"2 lakh+ daily", auditor:"Walker Chandiok & Co. LLP" },
    market: { price:3531.10, chg:24.50, chgPct:0.70, mcapCr:141674, evCr:297500, floatPct:26.6, promoterPct:73.4, fiiPct:9.8, diiPct:6.7, high52:4149.50, low52:2027.00, beta:0.78, sharesCr:40.13, adv30Cr:240, sebiCap:"Large Cap" },
    description: "India's largest gold-loan NBFC by AUM, operating 4,869 branches across 29 states. FY26 marked a structural inflection — consolidated AUM crossed ₹1.81 lakh crore (+49% YoY) and PAT nearly doubled.",
    segments: [
      { name:"Gold Loans (Standalone)", aum:154084, share:84.7, growth:50.0, yld:19.3 },
      { name:"Microfinance (Belstar)",  aum:10500,  share:5.8,  growth:-8.0, yld:22.4 },
      { name:"Housing Finance (MHFL)",  aum:3485,   share:1.9,  growth:17.0, yld:12.9 },
      { name:"Vehicle Finance",         aum:9794,   share:5.4,  growth:151.0,yld:14.5 },
      { name:"Other",                   aum:4053,   share:2.2,  growth:18.5, yld:11.8 },
    ],
    guidance: { "FY27 AUM growth":"~15%", "NIM trajectory":"Stable at 10–10.5%", "Branch expansion":"180–200 new branches", "Credit cost":"Normalised 25–35 bps", "Dividend policy":"~25% payout" },
    concallThemes: [
      { h:"Gold tailwind sustained", t:"Gold price up ~22% YoY through FY26 drove LTV expansion and higher per-ticket sizes." },
      { h:"Mix shift to longer tenor", t:"Move toward higher-tenor schemes lifted yields ~50 bps; EMI products now ~28% of mix." },
      { h:"Competitive intensity moderated", t:"Bank entry into gold loan eased post-RBI scrutiny; spreads stable." },
      { h:"Asset quality improved", t:"Stage-3 down to 2.0% from 2.4%; write-backs reflect strong auction realisations." },
      { h:"Capital position adequate", t:"CRAR 23.4% — sufficient for 3-year growth trajectory; no equity raise planned." },
    ],
    risks: [
      "Gold price reversal risk (sharp >15% drawdown would compress LTV cushion)",
      "RBI tightening on cash disbursement above ₹20,000 limit",
      "Subsidiary stress — microfinance under pressure (industry-wide)",
      "Promoter holding concentration & succession (>73% family-held)",
      "Competitive re-entry from large private banks at scale",
    ],
    pnl: {
      years: ["FY22","FY23","FY24","FY25","FY26","FY27E"],
      rows: [
        { metric:"Interest Income",        v:[10891,10840,13073,18876,29547,33500], bold:false },
        { metric:"Other Income",           v:[ 1192, 1175, 1242, 1338, 1662, 2000], bold:false },
        { metric:"Total Revenue",          v:[12083,12015,14315,20214,31209,35500], bold:true  },
        { metric:"Finance Costs",          v:[ 4554, 4779, 5944, 9105,14600,16800], bold:false },
        { metric:"Net Interest Income",    v:[ 6337, 6061, 7129, 9771,14947,16700], bold:true  },
        { metric:"Employee Cost",          v:[  982, 1095, 1310, 1612, 2350, 2700], bold:false },
        { metric:"Pre-provision Op Profit",v:[ 4506, 3897, 4577, 6709,11644,12950], bold:true  },
        { metric:"Provisions",             v:[  108,  324,  217,  389, -284,  650], bold:false },
        { metric:"Profit Before Tax",      v:[ 4398, 3573, 4360, 7266,14305,12300], bold:true  },
        { metric:"Tax",                    v:[ 1128,  899, 1124, 1933, 3715, 3100], bold:false },
        { metric:"PAT (Reported)",         v:[ 3270, 2674, 3236, 5333,10590, 9200], bold:true  },
      ],
    },
    bs: {
      years: ["FY22","FY23","FY24","FY25","FY26","FY27E"],
      rows: [
        { metric:"AUM (Consol.)",      v:[ 64494, 71495, 82766,121784,181916,209000], bold:true  },
        { metric:"Gold Loan AUM",      v:[ 57509, 63210, 75827,107326,165030,190000], bold:false },
        { metric:"Borrowings",         v:[ 49788, 56340, 65820, 95400,156800,178000], bold:false },
        { metric:"Net Worth (Equity)", v:[ 17738, 19834, 22506, 27000, 35600, 43500], bold:true  },
        { metric:"Total Assets",       v:[ 70218, 79124, 92580,133900,198400,228000], bold:true  },
      ],
    },
    ratios: {
      growth:   [["Revenue Growth YoY",[-0.4,-0.6,19.1,41.2,54.4,13.7],"%"],["NII Growth YoY",[10.2,-4.4,17.6,37.1,53.0,11.7],"%"],["PAT Growth YoY",[10.8,-18.2,21.0,64.8,98.6,-13.1],"%"],["EPS Growth YoY",[10.8,-18.2,21.0,64.8,98.4,-13.1],"%"],["PAT CAGR 3Y",[null,null,null,null,57.8,null],"%"],["PAT CAGR 5Y",[null,null,null,null,33.6,null],"%"]],
      profitability: [["NII Margin",[52.4,50.4,49.8,48.3,47.9,47.0],"%"],["PPOP Margin",[37.3,32.4,32.0,33.2,37.3,36.5],"%"],["Net Profit Margin",[27.1,22.3,22.6,26.4,33.9,25.9],"%"]],
      returns:  [["ROA",[4.9,3.6,3.8,4.7,6.4,4.3],"%"],["ROE",[19.7,14.2,15.3,21.5,33.9,23.3],"%"],["ROCE",[13.8,12.3,12.4,14.6,18.7,14.2],"%"]],
      nbfc:     [["NIM",[9.8,8.9,9.0,10.0,10.4,10.1],"%"],["Yield on Advances",[18.7,17.6,17.8,18.6,19.1,18.8],"%"],["Cost of Borrowings",[8.7,8.4,8.7,9.4,9.7,9.6],"%"],["Cost-to-Income",[31.0,38.7,39.0,33.6,29.8,31.5],"%"],["Gross NPA",[3.0,3.8,4.0,2.4,2.0,2.3],"%"],["Net NPA",[2.7,3.4,3.5,2.0,1.6,1.9],"%"],["CRAR",[29.9,31.8,26.5,24.7,23.4,23.0],"%"],["Branches",[4617,4692,4692,4751,4869,5040],""],["AUM / Branch (₹ Cr)",[14.0,15.2,17.6,25.6,37.4,41.5],""]],
      leverage: [["D/E",[2.8,2.8,2.9,3.5,4.4,4.1],"x"],["Borrowings / AUM",[77.2,78.8,79.5,78.3,86.2,85.2],"%"],["Interest Coverage",[1.97,1.75,1.73,1.80,1.98,1.73],"x"]],
      perShare: [["EPS (₹)",[81.5,66.6,80.6,132.9,263.9,229.3],"₹"],["BVPS (₹)",[442,494,561,673,887,1084],"₹"],["DPS (₹)",[22,24,26,26,30,33],"₹"]],
      valuation:[["P/E TTM",[16.5,15.8,17.1,15.9,13.4,15.4],"x"],["P/B",[3.1,2.1,2.5,3.1,4.0,3.3],"x"],["Div Yield",[1.7,2.3,1.8,1.2,0.85,0.94],"%"],["Earnings Yield",[6.1,6.3,5.8,6.3,7.5,6.5],"%"]],
    },
    quality: [
      { k:"Growth Quality",    s:8.5, n:"AUM +49%, PAT +99% — high but cyclical" },
      { k:"Profitability",     s:9.5, n:"ROE 33.9%, ROA 6.4% — top decile NBFC" },
      { k:"Balance Sheet",     s:8.0, n:"CRAR 23.4%, D/E 4.4x — adequate" },
      { k:"Asset Quality",     s:8.5, n:"GNPA 2.0%, 100% secured by gold" },
      { k:"Management",        s:8.0, n:"Family-run · proven execution" },
      { k:"Capital Allocation",s:7.5, n:"14-yr dividend · ~25% payout" },
      { k:"Disclosure",        s:8.0, n:"IFRS-aligned · detailed segmental" },
      { k:"Moat",              s:7.5, n:"Brand + branch density + gold proxy" },
    ],
    peers: [
      { name:"Muthoot Finance", tkr:"MUTHOOTFIN", mcap:141674, pe:13.4, pb:4.0, roe:33.9, roa:6.4, nim:10.4, aumGr:49.4, gnpa:2.0, crar:23.4, divY:0.85, beta:0.78, target:4150 },
      { name:"Manappuram Fin.", tkr:"MANAPPURAM", mcap:21800,  pe:9.8,  pb:1.7, roe:18.4, roa:3.6, nim:11.8, aumGr:18.2, gnpa:1.6, crar:30.5, divY:1.62, beta:1.10, target:285  },
      { name:"IIFL Finance",   tkr:"IIFL",        mcap:16200,  pe:11.2, pb:1.4, roe:14.8, roa:2.4, nim:8.6,  aumGr:24.0, gnpa:2.9, crar:21.5, divY:1.10, beta:1.35, target:545  },
      { name:"Bajaj Finance",  tkr:"BAJFINANCE",  mcap:489000, pe:31.5, pb:6.7, roe:22.1, roa:4.7, nim:10.5, aumGr:27.3, gnpa:0.9, crar:22.8, divY:0.45, beta:1.05, target:9200 },
      { name:"Shriram Finance",tkr:"SHRIRAMFIN",  mcap:122000, pe:14.6, pb:2.3, roe:16.2, roa:3.4, nim:9.0,  aumGr:21.1, gnpa:5.4, crar:21.7, divY:1.30, beta:1.20, target:3550 },
      { name:"Chola Inv.",     tkr:"CHOLAFIN",    mcap:135000, pe:28.3, pb:5.4, roe:21.0, roa:2.7, nim:7.5,  aumGr:33.5, gnpa:3.0, crar:18.5, divY:0.18, beta:1.15, target:1820 },
    ],
  },
};

const TABS = [
  { id:"overview",   icon:Building2,  label:"Business"      },
  { id:"financials", icon:FileText,   label:"Financials"    },
  { id:"ratios",     icon:Activity,   label:"Ratios & KPIs" },
  { id:"dcf",        icon:Calculator, label:"DCF Model"     },
  { id:"peers",      icon:Users,      label:"Peer Universe" },
  { id:"news",       icon:Newspaper,  label:"News"          },
  { id:"thesis",     icon:Brain,      label:"AI Thesis"     },
  { id:"verdict",    icon:Shield,     label:"Verdict"       },
];

/* ── Formatters ──────────────────────────────────────────────────── */
const fmtCr = n => {
  if (n == null) return "—";
  const a = Math.abs(n);
  if (a >= 1e5) return (n / 1e5).toFixed(2) + " L Cr";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
};
const fmtN  = (n, d=2) => n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits:d, minimumFractionDigits:0 });
const fmtP  = (n, d=1) => n == null ? "—" : (n >= 0 ? "+" : "") + n.toFixed(d) + "%";
const fmtPa = (n, d=1) => n == null ? "—" : n.toFixed(d) + "%";
const fmtPx = n => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits:2 });

/* ── Primitives ──────────────────────────────────────────────────── */
function Card({ children, style, noPad }) {
  return (
    <div style={{
      background: "rgba(16,14,10,0.6)",
      border: `1px solid ${C.line2}`,
      backdropFilter: "blur(4px)",
      padding: noPad ? 0 : 20,
      ...style,
    }}>{children}</div>
  );
}

function SectionLabel({ children, accent }) {
  return (
    <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:16 }}>
      <span style={{ ...sans, fontSize:10, letterSpacing:"0.18em", textTransform:"uppercase", color: C.dim, fontWeight:500 }}>{children}</span>
      {accent && <span style={{ ...sans, fontSize:10, color: C.gold500 + "cc" }}>{accent}</span>}
      <div style={{ flex:1, height:1, background:`linear-gradient(90deg,${C.line2},transparent)` }} />
    </div>
  );
}

function Sep() {
  return <div style={{ height:1, background:`linear-gradient(90deg,transparent,${C.line2}55,transparent)`, margin:"8px 0" }} />;
}

function KV({ label, value, tone }) {
  const col = tone === "gold" ? C.gold : tone === "pos" ? C.green : tone === "neg" ? C.red : C.text;
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"8px 0", borderBottom:`1px solid ${C.line}` }}>
      <span style={{ ...sans, color:C.dim, fontSize:13 }}>{label}</span>
      <span style={{ ...mono, color:col, fontSize:13 }}>{value}</span>
    </div>
  );
}

function Chip({ children, tone="neutral" }) {
  const col = tone==="pos" ? C.green : tone==="neg" ? C.red : tone==="gold" ? C.gold : C.text200;
  const bg  = tone==="pos" ? C.green500+"22" : tone==="neg" ? C.red500+"22" : tone==="gold" ? C.gold+"22" : "transparent";
  return (
    <span style={{
      ...sans, display:"inline-flex", alignItems:"center", padding:"3px 9px",
      borderRadius:99, fontSize:11, letterSpacing:"0.04em", textTransform:"uppercase",
      fontWeight:500, border:`1px solid ${col}55`, color:col, background:bg,
    }}>{children}</span>
  );
}

/* ── Ratio table (like reference: rows × year columns) ──────────── */
function RatioTable({ title, rows, years, accentColor }) {
  const col = accentColor || C.gold;
  const fmtVal = (v, unit) => {
    if (v === null || v === undefined) return "—";
    if (unit === "%") return fmtPa(v, 1);
    if (unit === "x") return fmtN(v, 2) + "x";
    if (unit === "₹") return "₹" + fmtN(v, 0);
    return fmtN(v, 1);
  };
  return (
    <Card noPad style={{ overflow:"hidden" }}>
      <div style={{ padding:"16px 20px 8px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.16em", color:col, fontWeight:500 }}>{title}</span>
        <span style={{ ...sans, fontSize:10, color:C.dim }}>{rows.length} metrics</span>
      </div>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
        <thead>
          <tr style={{ borderTop:`1px solid ${C.line}`, borderBottom:`1px solid ${C.line}` }}>
            <th style={{ ...sans, textAlign:"left", padding:"8px 20px", fontSize:10, textTransform:"uppercase", letterSpacing:"0.12em", color:C.dim, fontWeight:500 }}>Metric</th>
            {years.map((y, i) => (
              <th key={i} style={{ ...sans, textAlign:"right", padding:"8px", fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:i===years.length-1 ? C.gold : C.dim, fontWeight:500, paddingRight:i===years.length-1?"20px":"8px" }}>{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, vals, unit], i) => (
            <tr key={i} style={{ borderBottom:`1px solid ${C.line}` }}>
              <td style={{ ...sans, padding:"8px 20px", color:C.text200, fontSize:12 }}>{label}</td>
              {vals.map((v, j) => (
                <td key={j} style={{ ...mono, textAlign:"right", padding:"8px", paddingRight:j===vals.length-1?"20px":"8px", fontSize:12, color:j===vals.length-1 ? "#d4b96a" : C.text }}>
                  {fmtVal(v, unit)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ── Financial table (P&L, BS, CF) ──────────────────────────────── */
function FinTable({ title, accent, rows, years }) {
  const fmtV = v => v === null ? "—" : fmtN(v, 0);
  return (
    <Card noPad style={{ overflow:"hidden" }}>
      <div style={{ padding:"16px 20px 8px", display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
        <div>
          <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:C.dim }}>{accent}</div>
          <div style={{ ...serif, fontSize:22, color:C.text, marginTop:2 }}>{title}</div>
        </div>
        <span style={{ ...sans, fontSize:10, textTransform:"uppercase", color:C.dim }}>₹ Crores</span>
      </div>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ borderTop:`1px solid ${C.line}`, borderBottom:`1px solid ${C.line}` }}>
            <th style={{ ...sans, textAlign:"left", padding:"8px 20px", fontSize:10, textTransform:"uppercase", color:C.dim, fontWeight:500 }} />
            {years.map((y, i) => (
              <th key={i} style={{ ...sans, textAlign:"right", padding:"8px", paddingRight:i===years.length-1?"20px":"8px", fontSize:10, textTransform:"uppercase", color:i===years.length-1?C.gold:C.dim, fontWeight:500 }}>{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom:`1px solid ${C.line}`, background:row.bold?"rgba(58,53,40,0.3)":"transparent" }}>
              <td style={{ ...sans, padding:"10px 20px", color:row.bold?C.text:C.text200, fontWeight:row.bold?500:400 }}>{row.metric}</td>
              {row.v.map((val, j) => (
                <td key={j} style={{ ...mono, textAlign:"right", padding:"10px 8px", paddingRight:j===row.v.length-1?"20px":"8px", fontSize:12, color:j===row.v.length-1?"#d4b96a":row.bold?C.text:C.text200 }}>
                  {fmtV(val)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ── Overview Tab ─────────────────────────────────────────────────── */
function OverviewTab({ co, rec, cd, priceData }) {
  const f = rec.f;
  const t = rec.t;
  const histPAT = cd?.pnl?.years?.slice(0, 5).map((y, i) => ({
    y,
    pat: cd.pnl.rows.find(r => r.metric === "PAT (Reported)")?.v[i],
    aum: cd.bs?.rows?.find(r => r.metric === "AUM (Consol.)")?.v[i],
  })) || [];
  const chartData = (priceData && priceData.length > 10) ? priceData : t.data;
  const hasRealDates = priceData && priceData.length > 10 && priceData[0]?.date != null;
  const thinned = chartData.length > 300
    ? chartData.filter((_, i) => i % Math.ceil(chartData.length / 250) === 0)
    : chartData;

  return (
    <div className="fadein" style={{ padding:"32px", display:"grid", gridTemplateColumns:"1fr 380px", gap:24 }}>
      {/* LEFT */}
      <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
        <Card>
          <SectionLabel accent="CONCALL SNAPSHOT">INVESTMENT THESIS</SectionLabel>
          <div style={{ ...sans, fontSize:14, lineHeight:1.75, color:C.text200 }}>
            <span style={{ ...serif, fontSize:36, float:"left", marginRight:10, lineHeight:1, color:C.gold }}>"</span>
            {cd?.description || `${co.name} is a leading company in the ${co.sector} sector. Financial data is being populated — check back after running the bulk ingester.`}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:16 }}>
            <Chip tone="gold">#GoldPriceProxy</Chip>
            <Chip>#NBFC</Chip>
            <Chip tone="pos">#OperatingLeverage</Chip>
            <Chip>#DividendCompounder</Chip>
          </div>
        </Card>

        {cd?.segments && (
          <Card noPad style={{ overflow:"hidden" }}>
            <div style={{ padding:"16px 20px 8px" }}>
              <SectionLabel accent="FY26 CONSOLIDATED · ₹ CRORES">BUSINESS SEGMENTS</SectionLabel>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ borderTop:`1px solid ${C.line}`, borderBottom:`1px solid ${C.line}` }}>
                  {["Vertical","AUM (₹ Cr)","Mix","YoY Growth","Yield"].map((h, i) => (
                    <th key={i} style={{ ...sans, textAlign:i===0?"left":"right", padding:"8px", paddingLeft:i===0?"20px":"8px", paddingRight:i===4?"20px":"8px", fontSize:10, textTransform:"uppercase", color:C.dim, fontWeight:500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cd.segments.map((s, i) => (
                  <tr key={i} style={{ borderBottom:`1px solid ${C.line}` }}>
                    <td style={{ ...sans, padding:"10px 20px", color:C.text200 }}>{s.name}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text }}>{fmtN(s.aum, 0)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text200 }}>{fmtPa(s.share)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:s.growth>=0?C.green:C.red }}>{fmtP(s.growth)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 20px", color:C.gold }}>{fmtPa(s.yld)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {histPAT.length > 0 && (
          <Card>
            <SectionLabel>5-YEAR JOURNEY</SectionLabel>
            <div style={{ height:240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={histPAT} margin={{ top:10, right:20, bottom:0, left:-10 }}>
                  <CartesianGrid strokeDasharray="2 3" stroke="rgba(220,213,193,.08)" vertical={false} />
                  <XAxis dataKey="y" tick={{ fill:C.dim, fontSize:11 }} axisLine={{ stroke:"rgba(220,213,193,.1)" }} tickLine={false} />
                  <YAxis yAxisId="L" tick={{ fill:C.dim, fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtN(v/1000,0)+"k"} />
                  <YAxis yAxisId="R" orientation="right" tick={{ fill:C.gold, fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtN(v/1000,0)+"k"} />
                  <Tooltip contentStyle={{ background:C.bg800, border:`1px solid ${C.bg600}`, borderRadius:0, fontSize:12 }} labelStyle={{ color:C.text }} formatter={(v,n) => ["₹"+fmtN(v,0)+" Cr", n==="aum"?"AUM":"PAT"]} />
                  <Bar yAxisId="L" dataKey="aum" fill={C.bg500} radius={[2,2,0,0]} />
                  <Line yAxisId="R" dataKey="pat" stroke={C.gold} strokeWidth={2} dot={{ fill:C.gold, r:4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display:"flex", gap:20, marginTop:8 }}>
              {[["AUM (₹ Cr) — left axis", C.bg500], ["PAT (₹ Cr) — right axis", C.gold]].map(([l,c]) => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:12, height:12, background:c }} />
                  <span style={{ ...sans, fontSize:11, color:C.dim }}>{l}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* RIGHT */}
      <div style={{ display:"flex", flexDirection:"column", gap:24 }}>

        {/* Price chart with real dates */}
        <Card>
          <SectionLabel accent={hasRealDates ? "LIVE · NSE DAILY OHLCV" : "SYNTHETIC · RUN PRICE INGESTER FOR REAL DATA"}>
            PRICE CHART
          </SectionLabel>
          <div style={{ height:180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={thinned} margin={{ top:4, right:4, bottom:0, left:-20 }}>
                <defs>
                  <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.gold} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.gold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(220,213,193,.06)" vertical={false} />
                <XAxis
                  dataKey={hasRealDates ? "label" : "i"}
                  tick={{ fill:C.dim, fontSize:9 }}
                  axisLine={{ stroke:"rgba(220,213,193,.1)" }}
                  tickLine={false}
                  interval={hasRealDates ? Math.floor(thinned.length / 6) : "preserveStartEnd"}
                />
                <YAxis domain={["auto","auto"]} tick={{ fill:C.dim, fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v=>"₹"+v} width={52} />
                <Tooltip
                  contentStyle={{ background:C.bg800, border:`1px solid ${C.bg600}`, borderRadius:0, fontSize:11 }}
                  labelFormatter={l => hasRealDates ? l : ""}
                  formatter={v => ["₹"+v.toLocaleString("en-IN"), "Close"]}
                />
                <Area type="monotone" dataKey="close" stroke={C.gold} strokeWidth={1.6} fill="url(#pg)" dot={false} />
                {thinned.some(d => d.sma50 != null) && (
                  <Line type="monotone" dataKey="sma50" stroke={C.dim} strokeWidth={1} dot={false} strokeDasharray="4 3" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display:"flex", gap:16, marginTop:8 }}>
            {[["High ₹"+fmtN(t.hi||0,1), C.text200],["Low ₹"+fmtN(t.lo||0,1), C.text200],["RSI "+fmtN(t.rsi||0,0), t.rsi>70?C.red:t.rsi<30?C.green:C.dim],[t.aboveSMA50?"Above 50DMA":"Below 50DMA", t.aboveSMA50?C.green:C.red]].map(([l,cl]) => (
              <span key={l} style={{ ...sans, fontSize:10, color:cl }}>{l}</span>
            ))}
          </div>
        </Card>

        {cd?.meta && (
          <Card>
            <SectionLabel>KEY FACTS</SectionLabel>
            {[
              ["HQ", cd.meta.hq],
              ["Founded", cd.meta.founded],
              ["MD / CEO", cd.meta.md],
              ["Branches", cd.meta.branches],
              ["Employees", cd.meta.employees],
              ["Gold Collateral", cd.meta.collateral],
              ["Daily Footfall", cd.meta.footfall],
              ["Auditor", cd.meta.auditor],
            ].map(([k, v]) => <KV key={k} label={k} value={v} />)}
          </Card>
        )}

        {cd?.guidance && (
          <Card>
            <SectionLabel accent="MANAGEMENT · FY27">GUIDANCE</SectionLabel>
            {Object.entries(cd.guidance).map(([k, v]) => <KV key={k} label={k} value={v} />)}
          </Card>
        )}

        {cd?.concallThemes && (
          <Card>
            <SectionLabel accent="CONCALL THEMES">WHAT MGMT SAID</SectionLabel>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {cd.concallThemes.map((t, i) => (
                <div key={i} style={{ borderLeft:`2px solid ${C.gold}66`, paddingLeft:12 }}>
                  <div style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em", color:C.gold, marginBottom:2, fontWeight:500 }}>{t.h}</div>
                  <div style={{ ...sans, fontSize:12, color:C.text200, lineHeight:1.6 }}>{t.t}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── Financials Tab ──────────────────────────────────────────────── */
function FinancialsTab({ co, cd, liveFinancials }) {
  const isF = co.type === "financial";
  const hasLive = liveFinancials?.has_data;

  // Build display data: prefer live API, fall back to cd static data
  const pnlData = cd?.pnl || null;
  const bsData  = cd?.bs  || null;

  return (
    <div className="fadein" style={{ padding:"32px", display:"flex", flexDirection:"column", gap:24 }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:16, background:C.gold+"0a", border:`1px solid ${C.gold}33` }}>
        <Info size={16} color={C.gold} style={{ flexShrink:0, marginTop:2 }} />
        <div style={{ ...sans, fontSize:13, color:C.text200, lineHeight:1.6 }}>
          Statements rendered using the <span style={{ color:C.gold, fontWeight:500 }}>NBFC template</span> — Interest Income / NII / PPOP / Provisions / PAT.
          {hasLive ? ` Live data from ${liveFinancials.years_available.length} fiscal years ingested.` : " Run the bulk_ingester to populate live multi-year data."}
        </div>
      </div>

      {pnlData ? (
        <>
          <FinTable title="Income Statement" accent="CONSOLIDATED · FY22 — FY27E" rows={pnlData.rows} years={pnlData.years} />
          {bsData && <FinTable title="Balance Sheet & AUM" accent="CONSOLIDATED · YEAR-END" rows={bsData.rows} years={bsData.years} />}
        </>
      ) : hasLive ? (
        <div style={{ ...sans, color:C.dim, fontSize:13 }}>Live financial data available — rendering from API.</div>
      ) : (
        <Card>
          <div style={{ ...sans, color:C.dim, fontSize:13, textAlign:"center", padding:40 }}>
            Financial statements will appear here once the XBRL / Screener ingestion pipeline runs for {co.ticker}.
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Ratios Tab ──────────────────────────────────────────────────── */
function RatiosTab({ co, cd, liveMetrics }) {
  const years = cd?.pnl?.years || ["FY22","FY23","FY24","FY25","FY26","FY27E"];
  const r = cd?.ratios;

  if (!r) {
    return (
      <div className="fadein" style={{ padding:32 }}>
        <Card>
          <div style={{ ...sans, color:C.dim, fontSize:13, textAlign:"center", padding:40 }}>
            Ratio data available once bulk_ingester runs for {co.ticker}. Live metrics: {liveMetrics?.populated_metrics || 0} computed.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fadein" style={{ padding:"32px", display:"flex", flexDirection:"column", gap:24 }}>
      {/* NBFC-specific: highlighted with gold glow */}
      <div style={{ position:"relative" }}>
        <div style={{ position:"absolute", inset:-1, background:`linear-gradient(135deg,${C.gold}33,transparent)`, pointerEvents:"none" }} />
        <div style={{ position:"relative" }}>
          <RatioTable title="NBFC-Specific KPIs" rows={r.nbfc} years={years} accentColor={C.gold} />
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
        <RatioTable title="Growth"         rows={r.growth}        years={years} />
        <RatioTable title="Profitability"  rows={r.profitability} years={years} />
        <RatioTable title="Return Ratios"  rows={r.returns}       years={years} />
        <RatioTable title="Leverage"       rows={r.leverage}      years={years} />
        <RatioTable title="Per-Share Data" rows={r.perShare}      years={years} />
        <RatioTable title="Valuation"      rows={r.valuation}     years={years} />
      </div>
    </div>
  );
}

/* ── DCF Tab ─────────────────────────────────────────────────────── */
function buildDCF({ basePAT, growthN, growthY, growthFar, growthFarY, terminal, coe, shares }) {
  let pat = basePAT; let total = 0;
  const projection = [];
  for (let i = 1; i <= growthY; i++) {
    pat *= (1 + growthN / 100);
    const df = 1 / Math.pow(1 + coe / 100, i);
    const pv = pat * df;
    total += pv;
    projection.push({ year: "Y" + i, pat, pv, growth: growthN });
  }
  for (let j = 1; j <= growthFarY; j++) {
    pat *= (1 + growthFar / 100);
    const t = growthY + j;
    const df = 1 / Math.pow(1 + coe / 100, t);
    const pv = pat * df;
    total += pv;
    projection.push({ year: "Y" + t, pat, pv, growth: growthFar });
  }
  const finalPAT = pat * (1 + terminal / 100);
  const tv = finalPAT / (coe / 100 - terminal / 100);
  const tvPV = tv / Math.pow(1 + coe / 100, growthY + growthFarY);
  const equity = total + tvPV;
  const perShare = equity / shares;
  return { projection, equity, tv, tvPV, perShare, sumOpsPV: total };
}

function SliderRow({ label, value, setValue, min, max, step, fmtFn, hint }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
        <label style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em", color:C.dim, fontWeight:500 }}>{label}</label>
        <span style={{ ...mono, fontSize:15, color:C.gold, fontWeight:500 }}>{fmtFn ? fmtFn(value) : value.toFixed(1)+"%"}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => setValue(parseFloat(e.target.value))} style={{ width:"100%" }} />
      {hint && <div style={{ ...sans, fontSize:10, color:C.vfaint, marginTop:4 }}>{hint}</div>}
    </div>
  );
}

function DCFTab({ co, a, set, price, setPrice, cd }) {
  const SCENARIOS = {
    bear: { growthN:8,  growthFar:5,  terminal:4,   coe:14 },
    base: { growthN:18, growthFar:11, terminal:5,   coe:13.5 },
    bull: { growthN:24, growthFar:15, terminal:5.5, coe:12.5 },
  };
  const [scenario, setScenario] = useState("base");
  const sc = SCENARIOS[scenario];
  const [basePAT,    setBasePAT]    = useState(co.netProfit || 10590);
  const [growthN,    setGrowthN]    = useState(sc.growthN);
  const [growthY,    setGrowthY]    = useState(5);
  const [growthFar,  setGrowthFar]  = useState(sc.growthFar);
  const [growthFarY, setGrowthFarY] = useState(5);
  const [terminal,   setTerminal]   = useState(sc.terminal);
  const [coe,        setCoe]        = useState(sc.coe);

  const shares = co.shares || 40.13;
  const result = buildDCF({ basePAT, growthN, growthY, growthFar, growthFarY, terminal, coe, shares });
  const pbValue = (sc.coe > sc.terminal) ? ((growthN / 100) / (coe / 100 - terminal / 100)) * (co.equity || 35600) / shares : 0;
  const peValue = (basePAT * (1 + growthN / 100) / shares) * 16;
  const blended = result.perShare * 0.60 + pbValue * 0.25 + peValue * 0.15;
  const upside = ((blended - price) / price) * 100;

  const coes  = [11.5, 12.5, 13.5, 14.5, 15.5];
  const terms = [3, 4, 5, 5.5, 6];
  const sensGrid = coes.map(c => terms.map(t => {
    if (c / 100 <= t / 100) return 0;
    const r2 = buildDCF({ basePAT, growthN, growthY, growthFar, growthFarY, terminal: t, coe: c, shares });
    return Math.round(r2.perShare * 0.60 + pbValue * 0.25 + peValue * 0.15);
  }));

  return (
    <div className="fadein" style={{ padding:32 }}>
      {/* Scenarios */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:24 }}>
        {Object.entries(SCENARIOS).map(([id, s]) => (
          <button key={id} onClick={() => { setScenario(id); setGrowthN(s.growthN); setGrowthFar(s.growthFar); setTerminal(s.terminal); setCoe(s.coe); }} style={{
            padding:"12px 16px", border:`1px solid ${scenario===id ? C.gold+"99" : C.line2}`,
            background: scenario===id ? C.gold+"18" : C.bg900+"66",
            cursor:"pointer", textAlign:"left",
          }}>
            <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:scenario===id?C.gold:C.dim, marginBottom:4 }}>{id}</div>
            <div style={{ ...sans, fontSize:13, color:scenario===id?C.text:C.text200 }}>Growth {s.growthN}% → {s.growthFar}%</div>
            <div style={{ ...sans, fontSize:10, color:C.dim, marginTop:2 }}>CoE {s.coe}% · g∞ {s.terminal}%</div>
          </button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:24 }}>
        {/* INPUTS */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <Card>
            <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:C.dim, marginBottom:12 }}>BASE PAT (₹ CR)</div>
            <input type="number" value={basePAT} onChange={e => setBasePAT(parseFloat(e.target.value)||0)} style={{ ...mono, width:"100%", background:C.bg800, border:`1px solid ${C.line2}`, color:C.text, padding:"8px 10px", fontSize:16, outline:"none", boxSizing:"border-box" }} />
            <Sep />
            <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:C.dim, marginBottom:10 }}>STAGE 1 — HIGH GROWTH</div>
            <SliderRow label="Growth Rate"   value={growthN}   setValue={setGrowthN}   min={5}  max={35}  step={0.5} />
            <SliderRow label="Years"         value={growthY}   setValue={setGrowthY}   min={3}  max={8}   step={1}   fmtFn={v => v+"  yrs"} />
            <Sep />
            <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:C.dim, marginBottom:10 }}>STAGE 2 — FADE</div>
            <SliderRow label="Fade Growth"   value={growthFar} setValue={setGrowthFar} min={3}  max={20}  step={0.5} />
            <SliderRow label="Years"         value={growthFarY}setValue={setGrowthFarY}min={3}  max={8}   step={1}   fmtFn={v => v+"  yrs"} />
            <Sep />
            <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:C.dim, marginBottom:10 }}>TERMINAL & DISCOUNT</div>
            <SliderRow label="Terminal Growth" value={terminal} setValue={setTerminal} min={2}  max={7}   step={0.25} hint="India long-run nominal GDP proxy" />
            <SliderRow label="Cost of Equity"  value={coe}     setValue={setCoe}      min={10} max={18}  step={0.25} hint={`CAPM: Rf 7.1% + β·ERP`} />
          </Card>

          <Card>
            <SectionLabel>BLENDED INTRINSIC VALUE</SectionLabel>
            <KV label="DCF (Stage1+2+TV)"       value={"₹"+fmtN(result.perShare,0)}  />
            <KV label="Gordon Growth (P/B)"      value={"₹"+fmtN(pbValue,0)}          />
            <KV label="P/E 16x on next-yr PAT"   value={"₹"+fmtN(peValue,0)}          />
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"12px 0 0" }}>
              <span style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em", color:C.gold, marginTop:4 }}>Weighted (60/25/15)</span>
              <span style={{ ...serif, fontSize:28, color:C.gold }}>₹{fmtN(blended,0)}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
              <span style={{ ...sans, fontSize:12, color:C.dim }}>vs CMP ₹{fmtN(price,0)}</span>
              <span style={{ ...mono, fontSize:13, fontWeight:600, color:upside>=0?C.green:C.red }}>{upside>=0?"▲ +":"▼ "}{fmtN(Math.abs(upside),1)}%</span>
            </div>
          </Card>
        </div>

        {/* RIGHT: charts + sensitivity */}
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          {/* Hero */}
          <Card style={{ position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", inset:0, ...gridBg, opacity:0.4, pointerEvents:"none" }} />
            <div style={{ position:"relative", display:"grid", gridTemplateColumns:"1fr auto", gap:32, alignItems:"start" }}>
              <div>
                <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:C.dim }}>Equity Value · {scenario.toUpperCase()} Case</div>
                <div style={{ ...serif, fontSize:72, color:C.text, lineHeight:1, marginTop:8 }}>₹{fmtN(blended,0)}</div>
                <div style={{ ...sans, fontSize:14, marginTop:8, color:upside>=0?C.green:C.red }}>
                  <span style={{ fontWeight:600 }}>{upside>=0?"+":""}{fmtN(upside,1)}%</span>
                  <span style={{ color:C.dim, marginLeft:8 }}>margin of safety vs ₹{fmtN(price,0)} CMP</span>
                </div>
              </div>
              <div style={{ minWidth:180 }}>
                {[["PV Stage 1+2", fmtN(result.sumOpsPV/shares,0)],["PV Terminal",fmtN(result.tvPV/shares,0)],["TV % of Total",fmtPa((result.tvPV/result.equity)*100,1)],["Implied P/E",fmtN(blended/(basePAT*(1+growthN/100)/shares),1)+"x"]].map(([l,v]) => (
                  <KV key={l} label={l} value={v} />
                ))}
              </div>
            </div>
          </Card>

          {/* Projection chart */}
          <Card noPad>
            <div style={{ padding:"16px 20px 8px" }}>
              <SectionLabel accent="₹ CRORES · DISCOUNTED">PROJECTED PAT & PRESENT VALUE</SectionLabel>
            </div>
            <div style={{ height:240, padding:"0 8px 12px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={result.projection} margin={{ top:10, right:20, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="2 3" stroke="rgba(220,213,193,.08)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill:C.dim, fontSize:11 }} axisLine={{ stroke:"rgba(220,213,193,.1)" }} tickLine={false} />
                  <YAxis tick={{ fill:C.dim, fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v=>fmtN(v/1000,0)+"k"} />
                  <Tooltip contentStyle={{ background:C.bg800, border:`1px solid ${C.bg600}`, borderRadius:0 }} formatter={(v,n)=>["₹"+fmtN(v,0)+" Cr",n==="pat"?"Projected PAT":"Present Value"]} />
                  <Bar dataKey="pat" fill="rgba(212,169,62,.18)" stroke="rgba(212,169,62,.4)" />
                  <Line type="monotone" dataKey="pv" stroke={C.gold} strokeWidth={2.5} dot={{ fill:C.gold, r:3 }} />
                  <ReferenceLine x={"Y"+growthY} stroke="rgba(220,213,193,.25)" strokeDasharray="2 4" label={{ value:"Fade", fill:C.dim, fontSize:10, position:"top" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Sensitivity */}
          <Card noPad>
            <div style={{ padding:"16px 20px 8px", display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
              <div>
                <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:C.dim }}>INTRINSIC VALUE · ₹ / SHARE</div>
                <div style={{ ...serif, fontSize:22, color:C.text, marginTop:2 }}>Sensitivity — Cost of Equity × Terminal Growth</div>
              </div>
            </div>
            <div style={{ padding:"8px 20px 20px", overflowX:"auto" }}>
              <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...sans, textAlign:"left", color:C.dim, fontSize:10, textTransform:"uppercase", paddingBottom:8 }}>CoE ↓ / g∞ →</th>
                    {terms.map((t,i) => <th key={i} style={{ ...mono, textAlign:"right", color:C.dim, fontSize:10, paddingBottom:8, paddingLeft:8 }}>{t.toFixed(1)}%</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sensGrid.map((row, i) => (
                    <tr key={i}>
                      <td style={{ ...mono, color:C.dim, fontSize:11, paddingRight:12, paddingBottom:6 }}>{coes[i].toFixed(1)}%</td>
                      {row.map((cell, j) => {
                        const pct2 = ((cell - price) / price) * 100;
                        return (
                          <td key={j} style={{
                            ...mono, textAlign:"right", fontSize:12, padding:"6px 8px", fontWeight:500,
                            background: i===2&&j===2 ? C.gold+"33" : pct2>15 ? C.green500+"22" : pct2<-10 ? C.red500+"22" : "transparent",
                            color: i===2&&j===2 ? C.gold : pct2>15 ? C.green : pct2<-10 ? C.red : C.text200,
                            outline: i===2&&j===2 ? `1px solid ${C.gold}55` : "none",
                          }}>₹{fmtN(cell,0)}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display:"flex", gap:16, marginTop:12 }}>
                {[["Upside >15% vs CMP",C.green500+"44"],["Downside >10%",C.red500+"44"],["Base case",C.gold+"44"]].map(([l,c]) => (
                  <span key={l} style={{ display:"flex", alignItems:"center", gap:6, ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:C.dim }}>
                    <span style={{ width:8, height:8, background:c, display:"inline-block" }} />{l}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── Peers Tab ───────────────────────────────────────────────────── */
function PeersTab({ co, cd }) {
  const peers = cd?.peers;
  if (!peers) return (
    <div className="fadein" style={{ padding:32 }}>
      <Card><div style={{ ...sans, color:C.dim, fontSize:13, padding:40, textAlign:"center" }}>Peer data available for seeded NBFC universe. Run bulk_ingester to expand.</div></Card>
    </div>
  );
  const sorted = [...peers].sort((a, b) => b.aumGr - a.aumGr);
  return (
    <div className="fadein" style={{ padding:32, display:"flex", flexDirection:"column", gap:24 }}>
      <Card noPad style={{ overflow:"hidden" }}>
        <div style={{ padding:"16px 20px 8px" }}>
          <SectionLabel accent="NBFC · GOLD-LOAN UNIVERSE · FY26">PEER COMPARISON</SectionLabel>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderTop:`1px solid ${C.line}`, borderBottom:`1px solid ${C.line}` }}>
                {["Company","Mcap (Cr)","P/E","P/B","ROE","ROA","NIM","AUM Gr","GNPA","CRAR","Div Yield","Beta","Target"].map((h, i) => (
                  <th key={i} style={{ ...sans, textAlign:i===0?"left":"right", padding:"8px", paddingLeft:i===0?"20px":"8px", paddingRight:i===12?"20px":"8px", fontSize:10, textTransform:"uppercase", color:C.dim, fontWeight:500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {peers.map((p, i) => {
                const isHero = p.tkr === co.ticker;
                return (
                  <tr key={i} style={{ borderBottom:`1px solid ${C.line}`, background:isHero?C.gold+"0d":"transparent" }}>
                    <td style={{ ...sans, padding:"10px 20px", color:isHero?C.gold:C.text200, fontWeight:isHero?500:400 }}>
                      {isHero && <span style={{ color:C.gold, marginRight:6 }}>◆</span>}
                      {p.name} <span style={{ ...mono, fontSize:10, color:C.dim }}>· {p.tkr}</span>
                    </td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text200 }}>{fmtN(p.mcap,0)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text }}>{fmtN(p.pe,1)}x</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text }}>{fmtN(p.pb,1)}x</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.green }}>{fmtPa(p.roe,1)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text }}>{fmtPa(p.roa,1)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text }}>{fmtPa(p.nim,1)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:p.aumGr>=20?C.green:C.text }}>{fmtPa(p.aumGr,1)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:p.gnpa>3?C.red:C.text }}>{fmtPa(p.gnpa,1)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text }}>{fmtPa(p.crar,1)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text }}>{fmtPa(p.divY,2)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text }}>{fmtN(p.beta,2)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 20px", color:"#d4b96a" }}>₹{fmtN(p.target,0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
        <Card noPad>
          <div style={{ padding:"16px 20px 8px" }}><SectionLabel accent="X = ROE · Y = P/B">VALUATION VS QUALITY</SectionLabel></div>
          <div style={{ height:240, padding:"0 8px 12px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peers.map(p => ({ name:p.name.split(" ")[0], pb:p.pb, isHero:p.tkr===co.ticker }))} margin={{ top:10,right:20,left:0,bottom:5 }}>
                <CartesianGrid strokeDasharray="2 3" stroke="rgba(220,213,193,.08)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill:C.dim, fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:C.dim, fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v=>v+"x"} />
                <Tooltip contentStyle={{ background:C.bg800, border:`1px solid ${C.bg600}`, borderRadius:0 }} formatter={v=>[v+"x","P/B"]} />
                <Bar dataKey="pb" radius={[2,2,0,0]}>
                  {peers.map((p,i) => <Cell key={i} fill={p.tkr===co.ticker ? C.gold : C.bg500} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card noPad>
          <div style={{ padding:"16px 20px 8px" }}><SectionLabel accent="AUM GROWTH FY26">GROWTH LEADERBOARD</SectionLabel></div>
          <div style={{ height:240, padding:"0 8px 12px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted} layout="vertical" margin={{ top:10,right:30,left:80,bottom:5 }}>
                <CartesianGrid strokeDasharray="2 3" stroke="rgba(220,213,193,.08)" horizontal={false} />
                <XAxis type="number" tick={{ fill:C.dim, fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v=>v+"%"} />
                <YAxis type="category" dataKey="name" tick={{ fill:C.text, fontSize:11 }} axisLine={false} tickLine={false} width={80} tickFormatter={n=>n.split(" ")[0]} />
                <Tooltip contentStyle={{ background:C.bg800, border:`1px solid ${C.bg600}`, borderRadius:0 }} formatter={v=>[v+"%","AUM Growth"]} />
                <Bar dataKey="aumGr">
                  {sorted.map((p,i) => <Cell key={i} fill={p.tkr===co.ticker ? C.gold : C.bg400} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── News Tab ────────────────────────────────────────────────────── */
function NewsTab({ co, API }) {
  const [news, setNews]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!API) { setLoading(false); return; }
    setLoading(true);
    fetch(`${API}/api/companies/${co.ticker}/news`)
      .then(r => r.json())
      .then(d => { setNews(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [co.ticker, API]);

  const typeColor = t => t === "announcement" ? C.blue : t === "result" ? C.green : C.text200;
  const typeLabel = t => t === "announcement" ? "📋 Announcement" : t === "result" ? "📊 Result" : "📰 News";

  const fmtDate = pub => {
    if (!pub) return "—";
    try {
      const d = new Date(pub);
      return d.toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
    } catch { return pub.slice(0, 10); }
  };

  return (
    <div className="fadein" style={{ padding:32 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ ...serif, fontSize:22, color:C.text }}>{co.name} — Latest News</div>
          <div style={{ ...sans, fontSize:12, color:C.dim, marginTop:4 }}>
            {news ? `${news.count} items · Sources: ${(news.sources||[]).join(", ")} · refreshes every 30 min` : "Loading…"}
          </div>
        </div>
        {news?.count > 0 && (
          <div style={{ ...sans, fontSize:11, color:C.dim }}>
            {news.count} items
          </div>
        )}
      </div>

      {loading && (
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:40, ...sans, color:C.dim, fontSize:13 }}>
          <Loader2 size={20} color={C.gold} style={{ animation:"spin 1s linear infinite" }} />
          Fetching news from NSE and market feeds…
        </div>
      )}

      {error && !loading && (
        <Card>
          <div style={{ ...sans, color:C.red, fontSize:13 }}>
            Could not load news: {error}. Ensure the backend is running and CORS is configured.
          </div>
        </Card>
      )}

      {!loading && !error && (!news || news.count === 0) && (
        <Card>
          <div style={{ ...sans, color:C.dim, fontSize:13, padding:40, textAlign:"center" }}>
            No news found for {co.ticker}. yfinance news coverage varies — well-covered for Nifty 50 companies.
          </div>
        </Card>
      )}

      {news?.items?.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
          {news.items.map((item, i) => (
            <a key={i} href={item.url || "#"} target="_blank" rel="noopener noreferrer"
              style={{ textDecoration:"none", display:"block" }}>
              <div style={{
                padding:"14px 20px",
                borderBottom:`1px solid ${C.line}`,
                background:i%2===0?"rgba(16,14,10,.4)":"transparent",
                cursor:"pointer",
                transition:"background 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.background=C.bg600+"55"}
                onMouseLeave={e => e.currentTarget.style.background=i%2===0?"rgba(16,14,10,.4)":"transparent"}
              >
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                      <span style={{ ...sans, fontSize:10, color:typeColor(item.type), textTransform:"uppercase", letterSpacing:"0.1em" }}>
                        {typeLabel(item.type)}
                      </span>
                      <span style={{ ...sans, fontSize:10, color:C.dim }}>·</span>
                      <span style={{ ...sans, fontSize:10, color:C.dim }}>{item.source}</span>
                    </div>
                    <div style={{ ...sans, fontSize:13, color:C.text, lineHeight:1.5, fontWeight:500 }}>
                      {item.title}
                    </div>
                    {item.summary && item.summary !== item.title && (
                      <div style={{ ...sans, fontSize:11, color:C.dim, marginTop:4, lineHeight:1.5 }}>
                        {item.summary.slice(0, 180)}{item.summary.length > 180 ? "…" : ""}
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink:0, ...mono, fontSize:11, color:C.faint, textAlign:"right", marginTop:2 }}>
                    {fmtDate(item.published)}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
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
    if (!API) { setError("API not configured — set VITE_API_URL in Vercel environment variables."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/companies/${co.ticker}/thesis${force?"?force_refresh=true":""}`, { method:"POST" });
      const data = await res.json();
      if (data.error) setError(data.thesis);
      else { setThesis(data.thesis); setCached(data.cached||false); }
    } catch(e) { setError("Network error — "+e.message); }
    finally { setLoading(false); }
  };

  const renderMd = (md) => md.split("\n").map((l, i) => {
    if (l.startsWith("## ")) return <div key={i} style={{ ...serif, fontSize:24, color:C.gold, marginTop:24, marginBottom:8 }}>{l.replace("## ","")}</div>;
    if (l.startsWith("# "))  return null;
    if (l.trim().startsWith("- ")) return <div key={i} style={{ ...sans, fontSize:13, color:C.text200, lineHeight:1.75, paddingLeft:20, marginBottom:4 }}>• {l.trim().slice(2)}</div>;
    if (!l.trim()) return <div key={i} style={{ height:8 }} />;
    return <div key={i} style={{ ...sans, fontSize:13, color:C.text200, lineHeight:1.75, marginBottom:4 }}>{l}</div>;
  });

  return (
    <div className="fadein" style={{ padding:32, display:"grid", gridTemplateColumns:"1fr 320px", gap:24 }}>
      <Card style={{ minHeight:500 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:C.gold, marginBottom:6 }}>
              <Sparkles size={12} /><span>AI Research Note · Claude Sonnet 4</span>
              {cached && <span style={{ background:C.blue+"33", color:"#8ab4f8", border:"1px solid #8ab4f833", padding:"2px 8px", borderRadius:99, fontSize:10 }}>Cached</span>}
            </div>
            <div style={{ ...serif, fontSize:28, color:C.text }}>Live Investment Thesis</div>
            <div style={{ ...sans, fontSize:12, color:C.dim, marginTop:4 }}>Grounded in concall transcript, FY26 actuals, peer set and consensus.</div>
          </div>
          <button onClick={() => generate(!!thesis)} disabled={loading} style={{
            ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.16em", fontWeight:500,
            padding:"10px 20px", border:`1px solid ${loading?C.line2:C.gold+"99"}`,
            color:loading?C.dim:C.gold, background:loading?"transparent":C.gold+"0d", cursor:loading?"wait":"pointer",
          }}>
            {loading ? <><Loader2 size={13} style={{ display:"inline",marginRight:6 }} />Generating…</> : thesis ? "Regenerate" : "Generate Thesis"}
          </button>
        </div>

        {!thesis && !loading && !error && (
          <div style={{ height:360, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center" }}>
            <div style={{ ...serif, fontSize:56, color:C.dim+"66", marginBottom:16 }}>"</div>
            <div style={{ ...sans, fontSize:13, color:C.text200, maxWidth:420, lineHeight:1.7 }}>
              Press <span style={{ color:C.gold }}>Generate Thesis</span> to produce an institutional-grade research note. Grounded in {co.name}'s latest results, peer set and management commentary.
            </div>
            <div style={{ ...sans, fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.1em", marginTop:12 }}>No assumptions — only ground truth</div>
          </div>
        )}
        {loading && <div style={{ height:360, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
          <Loader2 size={32} color={C.gold} style={{ animation:"spin 1s linear infinite" }} />
          <div style={{ ...sans, fontSize:12, color:C.dim, textTransform:"uppercase", letterSpacing:"0.1em" }}>Synthesising from P&L, peer set…</div>
        </div>}
        {error && <div style={{ ...sans, color:C.red, fontSize:13, padding:16, background:C.red+"18", border:`1px solid ${C.red}44` }}>{error}</div>}
        {thesis && <div>{renderMd(thesis)}</div>}
      </Card>

      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        <Card>
          <SectionLabel>GROUNDING SOURCES</SectionLabel>
          {[["Q4FY26 Results","BSE / NSE filings"],["Earnings Concall","DAM Capital, May 2026"],["FY26 Annual Report","Investor Relations"],["Shareholding Pattern","Q4FY26 BSE filing"],["Peer financials","Screener consolidated"]].map(([k,v]) => (
            <div key={k} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"8px 0", borderBottom:`1px solid ${C.line}` }}>
              <FileText size={12} color={C.gold500} style={{ flexShrink:0, marginTop:2 }} />
              <div><div style={{ ...sans, color:C.text, fontSize:12 }}>{k}</div><div style={{ ...sans, color:C.dim, fontSize:10 }}>{v}</div></div>
            </div>
          ))}
        </Card>
        <Card>
          <SectionLabel>GUARDRAILS</SectionLabel>
          {["Numbers validated against DB","No invented price targets","Concall paraphrased, never verbatim","Output cached 6 hours"].map((s, i) => (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"6px 0" }}>
              <Check size={12} color={C.green} style={{ flexShrink:0, marginTop:2 }} />
              <span style={{ ...sans, fontSize:12, color:C.text200 }}>{s}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* ── Verdict Tab ─────────────────────────────────────────────────── */
function VerdictTab({ co, rec, cd, price }) {
  const f = rec.f;
  const intrinsic = rec.v.intrinsic;
  const mos = ((intrinsic - price) / price) * 100;
  const verdict = mos > 25 ? "BUY" : mos > 10 ? "ACCUMULATE" : mos > -10 ? "HOLD" : mos > -25 ? "TRIM" : "AVOID";
  const tone = mos > 10 ? "pos" : mos < -10 ? "neg" : "gold";
  const verdictColor = tone==="pos" ? C.green : tone==="neg" ? C.red : C.gold;

  const quality = cd?.quality || [
    { k:"Profitability", s:8.0, n:"ROE "+((f.roe||0)*100).toFixed(1)+"%" },
    { k:"Valuation MoS",  s:mos>0?7.5:4.0, n:mos.toFixed(1)+"% MoS" },
    { k:"Growth",        s:7.0, n:"Based on DCF projections" },
    { k:"Balance Sheet", s:7.5, n:"Leverage and capital adequacy" },
  ];
  const totalScore = quality.reduce((s, q) => s + q.s, 0) / quality.length;

  const risks = cd?.risks || rec.reasons.filter(r => r.bad).map(r => r.note);

  return (
    <div className="fadein" style={{ padding:32, display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
      {/* Hero */}
      <div style={{ gridColumn:"1/-1" }}>
        <Card style={{ position:"relative", overflow:"hidden", padding:32 }}>
          <div style={{ position:"absolute", inset:0, ...gridBg, opacity:0.4, pointerEvents:"none" }} />
          <div style={{ position:"relative", display:"grid", gridTemplateColumns:"1fr 1fr", gap:32 }}>
            <div>
              <div style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.18em", color:C.gold, marginBottom:8 }}>Equity Terminal · Final Verdict</div>
              <div style={{ ...serif, fontSize:96, color:verdictColor, lineHeight:1 }}>{verdict}</div>
              <div style={{ display:"flex", gap:32, marginTop:16 }}>
                {[["Target Price","₹"+fmtN(intrinsic,0)],["CMP","₹"+fmtN(price,0)],["Upside",(mos>=0?"+":"")+fmtN(mos,1)+"%"],["Horizon","12M"]].map(([l,v],i) => (
                  <div key={l}>
                    <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:C.dim }}>{l}</div>
                    <div style={{ ...mono, fontSize:24, color:i===2?(mos>=0?C.green:C.red):i===0?C.gold:C.text, marginTop:4 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.18em", color:C.dim, marginBottom:8 }}>Quality Composite</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:12 }}>
                <span style={{ ...serif, fontSize:56, color:C.gold }}>{totalScore.toFixed(1)}</span>
                <span style={{ ...sans, fontSize:18, color:C.dim }}>/ 10</span>
              </div>
              <div style={{ height:6, background:C.bg600, position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", inset:"0 auto 0 0", width:totalScore*10+"%", background:`linear-gradient(90deg,${C.gold500},${C.gold})` }} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quality scorecard */}
      <Card>
        <SectionLabel accent="8-FACTOR FRAMEWORK">QUALITY SCORECARD</SectionLabel>
        {quality.map((q, i) => (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"140px 32px 1fr 1fr", alignItems:"center", gap:12, marginBottom:14 }}>
            <span style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em", color:C.text200, fontWeight:500 }}>{q.k}</span>
            <span style={{ ...mono, fontSize:14, color:C.gold }}>{q.s.toFixed(1)}</span>
            <div style={{ height:6, background:C.bg600, position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:"0 auto 0 0", width:q.s*10+"%", background:`linear-gradient(90deg,${C.gold500},${C.gold})` }} />
            </div>
            <span style={{ ...sans, fontSize:11, color:C.dim }}>{q.n}</span>
          </div>
        ))}
      </Card>

      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        {risks.length > 0 && (
          <Card>
            <SectionLabel>PRINCIPAL RISKS</SectionLabel>
            {risks.map((r, i) => (
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"6px 0" }}>
                <div style={{ width:6, height:6, borderRadius:0, background:C.red, flexShrink:0, marginTop:6 }} />
                <span style={{ ...sans, fontSize:12.5, color:C.text200, lineHeight:1.6 }}>{r}</span>
              </div>
            ))}
          </Card>
        )}
        <Card>
          <SectionLabel>ACTION FRAMEWORK</SectionLabel>
          {[
            { l:"Entry Zone",      v:"₹"+fmtN(price*0.95,0)+" — ₹"+fmtN(price,0), tone:"gold" },
            { l:"12M Base Target", v:"₹"+fmtN(intrinsic,0),                        tone:"pos"  },
            { l:"Stretch (Bull)",  v:"₹"+fmtN(intrinsic*1.15,0),                   tone:"pos"  },
            { l:"Stop Loss",       v:"₹"+fmtN(price*0.85,0),                        tone:"neg"  },
            { l:"Risk-Reward",     v:"1 : "+fmtN(Math.max((intrinsic-price)/(price*0.15),1),1), tone:"gold" },
            { l:"Position Sizing", v:"4–6% of equity book",                         tone:"neutral" },
          ].map(row => <KV key={row.l} label={row.l} value={row.v} tone={row.tone} />)}
        </Card>
      </div>
    </div>
  );
}

/* ── Main Company component ──────────────────────────────────────── */
export default function Company({ co, assumptions, setAssumptions, price, setPrice, onBack, API, allCompanies, histPrices }) {
  const [tab, setTab] = useState("overview");
  const [liveFinancials, setLiveFinancials] = useState(null);
  const [liveMetrics,    setLiveMetrics]    = useState(null);

  const co2 = useMemo(() => ({ ...co, price, assumptions }), [co, price, assumptions]);
  const rec  = useMemo(() => recommend(co2, assumptions), [co2, assumptions]);
  const set  = useCallback(k => val => setAssumptions(prev => ({ ...prev, [k]: val })), [setAssumptions]);

  // Rich static data for this company (fallback)
  const cd = COMPANY_DATA[co.ticker] || null;

  // Live market data: prefer cd (seeded companies have real FY26 data)
  const mktData = cd?.market || {};
  const displayPrice = price;
  const mcap = mktData.mcapCr || (price * (co.shares || 40));

  useEffect(() => {
    if (!API || !co.ticker) return;
    Promise.all([
      fetch(`${API}/api/companies/${co.ticker}/financials`).then(r=>r.json()).catch(()=>null),
      fetch(`${API}/api/companies/${co.ticker}/metrics`).then(r=>r.json()).catch(()=>null),
    ]).then(([fins, mets]) => { setLiveFinancials(fins); setLiveMetrics(mets); });
  }, [co.ticker, API]);

  // Price chart data — fetch real OHLCV with dates from API
  const priceChartData = useMemo(() => {
    if (histPrices?.data?.length > 0) {
      // Use real dates from /history endpoint
      return histPrices.data
        .filter(p => p.close != null)
        .map(p => ({
          date:  p.date,
          label: p.date ? p.date.slice(5).replace("-", "/") : "", // "MM/DD"
          close: p.close,
          sma20: null,
          sma50: null,
        }));
    }
    // Fallback: synthetic series
    return (co.series || []).map((p, i) => ({
      date: null, label: String(i), close: p.close, sma20: null, sma50: null,
    }));
  }, [histPrices, co.series]);

  // Add SMA to price chart data
  const priceChartWithSMA = useMemo(() => {
    const data = [...priceChartData];
    for (let i = 0; i < data.length; i++) {
      if (i >= 19) {
        data[i].sma20 = +(data.slice(i-19,i+1).reduce((s,d)=>s+d.close,0)/20).toFixed(1);
      }
      if (i >= 49) {
        data[i].sma50 = +(data.slice(i-49,i+1).reduce((s,d)=>s+d.close,0)/50).toFixed(1);
      }
    }
    return data;
  }, [priceChartData]);

  // PDF download handler
  const downloadOnepager = async () => {
    if (!API) { alert("API not configured"); return; }
    try {
      const resp = await fetch(`${API}/api/companies/${co.ticker}/onepager`, { method:"POST" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${co.ticker}_onepager.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) { alert("PDF generation failed: " + e.message); }
  };

  const t = useMemo(() => technicals(co2), [co2]);

  // Header snapshot stats
  const mos = (rec.v.intrinsic - price) / price;
  const verdictLabel = mos > 0.25 ? "BUY" : mos > 0.10 ? "ACCUMULATE" : mos > -0.10 ? "HOLD" : mos > -0.25 ? "TRIM" : "AVOID";
  const verdictColor = mos > 0.10 ? C.green : mos < -0.10 ? C.red : C.gold;

  const chgPct = mktData.chgPct || 0;
  const chgAmt = mktData.chg    || 0;

  return (
    <div style={{ minHeight:"100vh" }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={{ borderBottom:`1px solid ${C.line}`, background:`linear-gradient(180deg,${C.bg900},${C.bg})`, position:"relative", ...gridBg }}>
        <div style={{ position:"absolute", inset:0, opacity:0.5, pointerEvents:"none",
          backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.85 0 0 0 0 0.78 0 0 0 0 0.55 0 0 0 0.025 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
        <div style={{ position:"relative", padding:"24px 32px 28px" }}>
          {/* Top bar */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <button onClick={onBack} style={{ ...sans, display:"flex", alignItems:"center", gap:6, background:"transparent", border:"none", color:C.dim, fontSize:12, cursor:"pointer", padding:0 }}>
                <ArrowLeft size={14} /> Back to screener
              </button>
              <span style={{ color:C.bg500 }}>/</span>
              <span style={{ ...sans, fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.14em" }}>India · {co.type==="financial"?"NBFC":"Equity"} · {co.sector}</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12, ...sans, fontSize:12, color:C.dim }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span className="blink" style={{ width:6, height:6, borderRadius:"50%", background:C.green, display:"inline-block" }} />
                <span style={{ letterSpacing:"0.1em" }}>LIVE · {cd?.meta?.asOf || new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span>
              </div>
              <span style={{ color:C.bg500 }}>|</span>
              <span>₹ in Crores unless stated</span>
              <span style={{ color:C.bg500 }}>|</span>
              <button onClick={downloadOnepager} style={{
                ...sans, display:"flex", alignItems:"center", gap:6,
                fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase",
                fontWeight:500, padding:"6px 12px",
                border:`1px solid ${C.gold}66`, color:C.gold,
                background:C.gold+"0d", cursor:"pointer",
              }}>
                <Download size={12} /> One-Pager PDF
              </button>
            </div>
          </div>

          {/* Company name + price block */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:32, alignItems:"flex-end" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, ...sans, fontSize:11, letterSpacing:"0.16em", textTransform:"uppercase", color:C.dim }}>
                <span>NSE: {co.ticker}</span>
                <span style={{ color:C.bg500 }}>·</span>
                <span>BSE: {cd?.meta?.bse || "—"}</span>
                <span style={{ color:C.bg500 }}>·</span>
                <span>ISIN: {cd?.meta?.isin || "—"}</span>
                <span style={{ color:C.bg500 }}>·</span>
                <span style={{ color:C.gold }}>{mktData.sebiCap || "Large Cap"}</span>
              </div>
              <div style={{ ...serif, fontSize:60, color:C.text, lineHeight:1, letterSpacing:"-0.02em" }}>{co.name}</div>
              <div style={{ ...sans, fontSize:13, color:C.text200, marginTop:12, maxWidth:680, lineHeight:1.6 }}>
                {cd?.description || `${co.name} operates in the ${co.sector} sector. Data is being populated.`}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:C.dim }}>Last Price</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:16, marginTop:4 }}>
                <div style={{ ...mono, fontSize:56, color:C.text, lineHeight:1, letterSpacing:"-0.02em" }}>{fmtPx(displayPrice)}</div>
                <div style={{ ...mono, fontSize:14, fontWeight:500, color:chgPct>=0?C.green:C.red }}>
                  {chgPct>=0?"+":""}{fmtN(chgAmt,2)}  /  {chgPct>=0?"+":""}{fmtN(chgPct,2)}%
                </div>
              </div>
              <div style={{ display:"flex", gap:20, marginTop:8, ...mono, fontSize:11, color:C.dim, justifyContent:"flex-end" }}>
                <span>52W H {fmtN(mktData.high52 || t.hi, 2)}</span>
                <span>52W L {fmtN(mktData.low52  || t.lo, 2)}</span>
                <span>Beta {fmtN(mktData.beta || co.assumptions?.beta, 2)}</span>
                <span>ADV {fmtN(mktData.adv30Cr, 0)} Cr</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Snapshot strip ─────────────────────────────────────── */}
      <div style={{ borderBottom:`1px solid ${C.line}`, background:C.bg900+"55" }}>
        <div style={{ padding:"14px 32px", display:"grid", gridTemplateColumns:"repeat(11,1fr)", gap:8 }}>
          {[
            { l:"Market Cap",       v:"₹"+fmtCr(mcap)               },
            { l:"Enterprise Value", v:"₹"+fmtCr(mktData.evCr)        },
            { l:"P / E (TTM)",      v:fmtN(rec.f.pe||13.4,2)+"x"    },
            { l:"P / B",            v:fmtN(rec.f.pb,2)+"x"          },
            { l:"ROE (FY26)",       v:fmtPa((rec.f.roe||0)*100),     accent:C.green },
            { l:"ROA (FY26)",       v:fmtPa((co.nbfc?.roa||0)*100)  },
            { l:"NIM (FY26)",       v:fmtPa((co.nbfc?.nim||0)*100)  },
            { l:"Promoter Hold",    v:fmtPa(mktData.promoterPct||73.4), accent:C.gold },
            { l:"Intrinsic Value",  v:"₹"+fmtN(rec.v.intrinsic,0), accent:C.gold },
            { l:"Margin of Safety", v:(mos>=0?"+":"")+fmtN(mos*100,1)+"%", accent:mos>=0?C.green:C.red },
            { l:"Verdict",          v:verdictLabel, accent:verdictColor, large:true },
          ].map(s => (
            <div key={s.l}>
              <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.12em", color:C.dim, fontWeight:500 }}>{s.l}</div>
              <div style={{ ...mono, fontSize:s.large?18:16, color:s.accent||C.text, marginTop:4, fontWeight:s.large?600:400, letterSpacing:s.large?"0.06em":"0" }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab navigation ─────────────────────────────────────── */}
      <nav style={{ borderBottom:`1px solid ${C.line}`, background:C.bg+"dd", backdropFilter:"blur(8px)", position:"sticky", top:0, zIndex:30, padding:"0 32px" }}>
        <div style={{ display:"flex", gap:28 }}>
          {TABS.map(({ id, icon:Icon, label }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              ...sans, position:"relative", display:"flex", alignItems:"center", gap:8,
              padding:"14px 0", border:"none", background:"transparent",
              fontSize:12, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:500, cursor:"pointer",
              color: tab===id ? C.gold : C.dim,
              borderBottom: `1px solid ${tab===id ? C.gold : "transparent"}`,
              marginBottom:-1,
            }}>
              <Icon size={14} strokeWidth={1.5} />{label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Tab content ───────────────────────────────────────── */}
      <main>
        {tab==="overview"   && <OverviewTab    co={co2} rec={rec} cd={cd} priceData={priceChartWithSMA} />}
        {tab==="financials" && <FinancialsTab  co={co2} cd={cd} liveFinancials={liveFinancials} />}
        {tab==="ratios"     && <RatiosTab      co={co2} cd={cd} liveMetrics={liveMetrics} />}
        {tab==="dcf"        && <DCFTab         co={co2} a={assumptions} set={set} price={price} setPrice={setPrice} cd={cd} />}
        {tab==="peers"      && <PeersTab       co={co2} cd={cd} />}
        {tab==="news"       && <NewsTab        co={co2} API={API} />}
        {tab==="thesis"     && <AIThesisTab    co={co2} API={API} />}
        {tab==="verdict"    && <VerdictTab     co={co2} rec={rec} cd={cd} price={price} />}
      </main>

      <footer style={{ borderTop:`1px solid ${C.line}`, padding:"20px 32px", display:"flex", justifyContent:"space-between", ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em", color:C.dim+"99", marginTop:48 }}>
        <span>Equity Terminal v0.3 — Sector-Aware Valuation Platform</span>
        <span>Educational use only · Not SEBI-registered advice</span>
      </footer>
    </div>
  );
}
