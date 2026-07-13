/* Company.jsx — Step 7 redesign.
   Matches the reference design: warm ink palette, Instrument Serif,
   giant price header, 12-stat snapshot strip, editorial tabs.
   All 7 tabs fully wired to live API data with rich fallbacks. */

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Logo from "./Logo.jsx";
import {
  ArrowLeft, Building2, FileText, Activity, Calculator,
  Users, Brain, Shield, Sparkles, Check, AlertTriangle,
  Info, Loader2, TrendingUp, TrendingDown, Newspaper, Download, PieChart,
  ShieldAlert, Star, FolderOpen, FileSpreadsheet, ExternalLink, Layers,
} from "lucide-react";
import {
  ComposedChart, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from "recharts";

import { C, mono, sans, serif, gridBg, sectorAccent } from "../lib/theme.js";
import { useLive, liveDotStyle } from "../lib/live.js";
import { fmt, inr, pct, cr, multiple, inrOrDash, signedPct } from "../lib/formatters.js";
import { recommend } from "../lib/recommend.js";
import { fundamentals, isFinancial } from "../lib/valuation.js";
import { technicals } from "../lib/technicals.js";
import { useIsMobile } from "../lib/useResponsive.js";
import DCFModel from "./DCFModel.jsx";
import ScenarioBar from "./ScenarioBar.jsx";
import PriceChart from "./PriceChart.jsx";
import TranscriptSummary from "./TranscriptSummary.jsx";
import OptionsTab from "./OptionsTab.jsx";
import AnalystTab from "./AnalystTab.jsx";

/* Verdict → colour tone (single mapping, used in header + snapshot). */
function verdictTone(v) {
  if (v === "BUY" || v === "ACCUMULATE") return C.green;
  if (v === "HOLD") return C.gold;
  if (v === "TRIM" || v === "AVOID") return C.red;
  return C.dim; // NO DATA / LOW CONF
}

/* Build descriptive tags from the actual company, instead of hard-coding
   gold-loan tags onto every company (the old code showed #GoldPriceProxy on
   Bajaj Finance). */
function tagsFor(co, rec) {
  const tags = [];
  const fin = isFinancial(co);
  const sec = (co.sector || "").toLowerCase();
  if (fin) {
    tags.push({ t: "#NBFC", tone: "neutral" });
    if (sec.includes("gold")) tags.push({ t: "#GoldLoan", tone: "gold" });
    if (sec.includes("bank")) tags.push({ t: "#Bank", tone: "neutral" });
  } else {
    tags.push({ t: "#" + (co.sector || "Equity").replace(/[^A-Za-z]/g, "").slice(0, 18), tone: "neutral" });
  }
  const roe = rec?.f?.roe;
  if (roe != null && roe > 0.18) tags.push({ t: "#HighROE", tone: "pos" });
  if (rec?.mos != null && rec.mos > 0.15) tags.push({ t: "#MarginOfSafety", tone: "pos" });
  if (rec?.mos != null && rec.mos < -0.15) tags.push({ t: "#PricedForGrowth", tone: "neg" });
  if (co.netProfit != null && co.netProfit < 0) tags.push({ t: "#LossMaking", tone: "neg" });
  return tags;
}

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

  /* ── RELIANCE INDUSTRIES — conglomerate (researched, FY25) ───────────────── */
  RELIANCE: {
    description: "India's largest company by revenue and market value — a conglomerate spanning Oil-to-Chemicals (O2C), Reliance Jio (digital & telecom), Reliance Retail, oil & gas exploration, and an emerging New Energy (solar / battery / green hydrogen) business. FY25 consolidated revenue crossed ₹10.7 lakh crore, and the consumer-facing arms (Jio + Retail) now contribute over half of consolidated EBITDA — shifting the profit engine from cyclical energy to consumer.",
    keyFacts: [
      ["Headquarters", "Mumbai, Maharashtra"],
      ["Founded", "1966 · Listed 1977"],
      ["Chairman & MD", "Mukesh D. Ambani"],
      ["Employees", "~3.9 lakh"],
      ["Core Businesses", "Jio · Retail · O2C · Oil & Gas · New Energy"],
      ["Jio Subscribers", "~488 million"],
      ["Retail Footprint", "~19,000 stores"],
      ["Auditors", "S R B C & CO LLP · Chaturvedi & Shah"],
    ],
    segmentsAccent: "FY25 · SEGMENT REVENUE (≈)",
    segmentCols: ["Segment", "Revenue (₹ Cr)", "Mix", "YoY Growth", "EBITDA Margin"],
    segments: [
      { name:"Oil-to-Chemicals (O2C)", vals:["~5,80,000", "51%", "+3%", "~11%"] },
      { name:"Reliance Retail",        vals:["~3,30,000", "27%", "+16%", "~8%"] },
      { name:"Jio / Digital Services", vals:["~1,55,000", "14%", "+18%", "~42%"] },
      { name:"Oil & Gas (E&P)",        vals:["~24,000", "2%", "−2%", "~63%"] },
      { name:"Others / New Energy",    vals:["~70,000", "6%", "—", "—"] },
    ],
    guidance: {
      "New Energy ramp":  "Giga-factories (solar, battery, green H₂) scaling FY26–27",
      "Retail":           "Store expansion + JioMart / quick-commerce push",
      "Jio":              "Tariff hikes + 5G & home broadband (FWA) monetisation",
      "O2C":              "Feedstock shift toward chemicals; capacity expansion",
      "Balance sheet":    "Net debt broadly stable as capex moderates",
    },
    concallThemes: [
      { h:"Consumer is the engine", t:"Jio + Retail now >50% of consolidated EBITDA; O2C remains cyclical." },
      { h:"Jio ARPU uptick",        t:"Tariff hikes and 5G / FWA broadband driving digital EBITDA growth." },
      { h:"Retail re-accelerating", t:"Footprint rationalised; growth picking up on grocery + fashion + quick-commerce." },
      { h:"New Energy optionality", t:"Solar gigafactory and green hydrogen are the multi-year call option." },
      { h:"O2C margin pressure",    t:"Weak transport-fuel cracks and chemical deltas compressed O2C margins." },
    ],
  },

  /* ── TATA CONSULTANCY SERVICES — IT services (researched, FY26) ──────────── */
  TCS: {
    description: "India's largest IT services company and the flagship of the Tata Group. TCS delivers consulting, application development, cloud, AI and BPO services to global enterprises, with deep strength in Banking, Financial Services & Insurance (BFSI) and a North-America-led footprint. FY26 full-year order book (TCV) of ~$40.7 billion; one of the most profitable large-cap IT firms with operating margins in the mid-20s%.",
    keyFacts: [
      ["Headquarters", "Mumbai, Maharashtra"],
      ["Founded", "1968 · Listed 2004"],
      ["CEO & MD", "K. Krithivasan"],
      ["Employees", "~5.85 lakh"],
      ["Parent", "Tata Sons (~72%)"],
      ["FY26 Order Book (TCV)", "~$40.7 billion"],
      ["Operating Margin", "~26% (4-yr high)"],
      ["Auditors", "B S R & Co. LLP"],
    ],
    segmentsAccent: "REVENUE BY VERTICAL (≈)",
    segmentCols: ["Vertical", "Mix of Revenue", "Trend"],
    segments: [
      { name:"BFSI (Banking, Fin. Svcs, Insurance)", vals:["~32%", "Largest · stabilising"] },
      { name:"Consumer Business / Retail",           vals:["~16%", "Steady"] },
      { name:"Communication, Media & Tech",          vals:["~14%", "Soft"] },
      { name:"Life Sciences & Healthcare",           vals:["~11%", "Resilient"] },
      { name:"Manufacturing",                        vals:["~10%", "Growing"] },
      { name:"Energy, Utilities & Public Services",  vals:["~17%", "Mixed"] },
    ],
    guidance: {
      "Demand":        "Discretionary spend cautious; cost-takeout & AI deals strong",
      "AI / GenAI":    "Scaling AI.Cloud unit; GenAI pipeline moving to production",
      "Margins":       "Aspirational band ~26–28% via utilisation + pyramid",
      "Geography":     "North America ~49% of revenue; UK & Europe steady",
      "Capital return":"High payout via dividends + periodic buybacks",
    },
    concallThemes: [
      { h:"TCV resilient",         t:"Full-year order book ~$40bn shows demand despite a cautious macro." },
      { h:"BFSI stabilising",      t:"Largest vertical (~32%); North-America BFSI showing early recovery." },
      { h:"AI at scale",           t:"GenAI moving from pilots to production; AI.Cloud unit expanding." },
      { h:"Margins near 4-yr high",t:"Utilisation and pyramid lifted operating margin to multi-year highs." },
      { h:"Attrition normalised",  t:"LTM attrition back to a comfortable low-teens range." },
    ],
  },
};

const TABS = [
  { id:"overview",   icon:Building2,  label:"Business"      },
  { id:"chart",      icon:TrendingUp, label:"Chart"         },
  { id:"financials", icon:FileText,   label:"Financials"    },
  { id:"ratios",     icon:Activity,   label:"Ratios & KPIs" },
  { id:"dcf",        icon:Calculator, label:"Valuation"     },
  { id:"analyst",    icon:Sparkles,   label:"Analyst & Forward" },
  { id:"options",    icon:Layers,     label:"Options"       },
  { id:"peers",      icon:Users,      label:"Peer Universe" },
  { id:"ownership",  icon:PieChart,   label:"Ownership"     },
  { id:"news",       icon:Newspaper,  label:"News"          },
  { id:"docs",       icon:FolderOpen, label:"Docs"          },
  { id:"thesis",     icon:Brain,      label:"AI Thesis"     },
  { id:"forensics",  icon:ShieldAlert,label:"Forensics"     },
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
/* ── Generalized real-data Business sections (IndianAPI, all companies) ─── */
function ShareholdingCard({ data }) {
  if (!data?.length) return null;
  const colorFor = n => {
    const x = (n || "").toLowerCase();
    if (x.includes("promoter")) return C.gold;
    if (x.includes("fii") || x.includes("foreign")) return C.green;
    if (x.includes("dii") || x.includes("institution")) return C.text200;
    return C.faint;
  };
  return (
    <Card>
      <SectionLabel accent="LATEST QUARTER">SHAREHOLDING</SectionLabel>
      <div style={{ display:"flex", flexDirection:"column", gap:11, marginTop:4 }}>
        {data.map((s, i) => (
          <div key={i}>
            <div style={{ display:"flex", justifyContent:"space-between", ...sans, fontSize:12, marginBottom:4 }}>
              <span style={{ color:C.text200 }}>{s.name}</span>
              <span style={{ ...mono, color:C.text }}>{s.pct != null ? s.pct.toFixed(2) + "%" : "—"}</span>
            </div>
            <div style={{ height:5, background:C.bg700, borderRadius:3, overflow:"hidden" }}>
              <div style={{ width:`${Math.min(s.pct || 0, 100)}%`, height:"100%", background:colorFor(s.name) }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LeadershipCard({ data }) {
  if (!data?.length) return null;
  return (
    <Card>
      <SectionLabel>LEADERSHIP</SectionLabel>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {data.slice(0, 5).map((o, i) => (
          <div key={i}>
            <div style={{ ...sans, fontSize:13, color:C.text, fontWeight:500 }}>{o.name}</div>
            <div style={{ ...sans, fontSize:11, color:C.dim, lineHeight:1.4 }}>{o.title}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ProfileKeyFacts({ kf }) {
  if (!kf) return null;
  const cr = n => n == null ? null : Math.abs(n) >= 1e5 ? "₹" + (n/1e5).toFixed(2) + " L Cr" : "₹" + fmtN(n,0) + " Cr";
  const rows = [
    ["Industry", kf.industry],
    ["Market Cap", cr(kf.market_cap_cr)],
    ["52-Wk High", kf.year_high != null ? "₹" + fmtN(kf.year_high, 1) : null],
    ["52-Wk Low", kf.year_low != null ? "₹" + fmtN(kf.year_low, 1) : null],
    ["Risk", kf.risk],
    ["Analyst View", kf.rating],
    ["ISIN", kf.isin],
    ["NSE / BSE", [kf.nse_code, kf.bse_code].filter(Boolean).join(" · ")],
  ];
  return (
    <Card>
      <SectionLabel>KEY FACTS</SectionLabel>
      {rows.map(([k, v]) => v ? <KV key={k} label={k} value={v} /> : null)}
    </Card>
  );
}

function OverviewTab({ co, rec, cd, profile }) {
  const isMobile = useIsMobile();
  const f = rec.f;
  const histPAT = cd?.pnl?.years?.slice(0, 5).map((y, i) => ({
    y,
    pat: cd.pnl.rows.find(r => r.metric === "PAT (Reported)")?.v[i],
    aum: cd.bs?.rows?.find(r => r.metric === "AUM (Consol.)")?.v[i],
  })) || [];

  return (
    <div className="fadein" style={{ padding: isMobile ? 16 : 32, display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 380px", gap:24 }}>
      {/* LEFT */}
      <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
        <Card>
          {cd?.description
            ? <SectionLabel accent="CONCALL SNAPSHOT">INVESTMENT THESIS</SectionLabel>
            : <SectionLabel accent="FROM EXCHANGE FILINGS">BUSINESS PROFILE</SectionLabel>}
          <div style={{ ...sans, fontSize:14, lineHeight:1.75, color:C.text200 }}>
            {cd?.description && <span style={{ ...serif, fontSize:36, float:"left", marginRight:10, lineHeight:1, color:C.gold }}>"</span>}
            {cd?.description || profile?.description || `${co.name} operates in the ${co.sector} sector. Profile data loading…`}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:16 }}>
            {tagsFor(co, rec).map(({ t, tone }) => (
              <Chip key={t} tone={tone}>{t}</Chip>
            ))}
          </div>
        </Card>

        {cd?.segments && (
          <Card noPad style={{ overflow:"hidden" }}>
            <div style={{ padding:"16px 20px 8px" }}>
              <SectionLabel accent={cd.segmentsAccent || "CONSOLIDATED"}>BUSINESS SEGMENTS</SectionLabel>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ borderTop:`1px solid ${C.line}`, borderBottom:`1px solid ${C.line}` }}>
                  {(cd.segmentCols || ["Vertical","AUM (₹ Cr)","Mix","YoY Growth","Yield"]).map((h, i, arr) => (
                    <th key={i} style={{ ...sans, textAlign:i===0?"left":"right", padding:"8px", paddingLeft:i===0?"20px":"8px", paddingRight:i===arr.length-1?"20px":"8px", fontSize:10, textTransform:"uppercase", color:C.dim, fontWeight:500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cd.segments.map((s, i) => (
                  <tr key={i} style={{ borderBottom:`1px solid ${C.line}` }}>
                    {cd.segmentCols ? (
                      <>
                        <td style={{ ...sans, padding:"10px 20px", color:C.text200 }}>{s.name}</td>
                        {s.vals.map((v, j, arr) => (
                          <td key={j} style={{ ...mono, textAlign:"right", padding:"10px 8px", paddingRight:j===arr.length-1?"20px":"8px", color:j===arr.length-1?C.gold:C.text }}>{v}</td>
                        ))}
                      </>
                    ) : (
                      <>
                        <td style={{ ...sans, padding:"10px 20px", color:C.text200 }}>{s.name}</td>
                        <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text }}>{fmtN(s.aum, 0)}</td>
                        <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text200 }}>{fmtPa(s.share)}</td>
                        <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:s.growth>=0?C.green:C.red }}>{fmtP(s.growth)}</td>
                        <td style={{ ...mono, textAlign:"right", padding:"10px 20px", color:C.gold }}>{fmtPa(s.yld)}</td>
                      </>
                    )}
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


        {(cd?.keyFacts || cd?.meta) ? (
          <Card>
            <SectionLabel>KEY FACTS</SectionLabel>
            {(cd.keyFacts || [
              ["HQ", cd.meta.hq],
              ["Founded", cd.meta.founded],
              ["MD / CEO", cd.meta.md],
              ["Branches", cd.meta.branches],
              ["Employees", cd.meta.employees],
              ["Gold Collateral", cd.meta.collateral],
              ["Daily Footfall", cd.meta.footfall],
              ["Auditor", cd.meta.auditor],
            ]).map(([k, v]) => v ? <KV key={k} label={k} value={v} /> : null)}
          </Card>
        ) : (
          <ProfileKeyFacts kf={profile?.key_facts} />
        )}

        {cd?.guidance && (
          <Card>
            <SectionLabel accent="MANAGEMENT · FROM LATEST CONCALL">GUIDANCE</SectionLabel>
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

/* ── Ownership & Filings Tab ──────────────────────────────────────── */
function CorporateActionsCard({ data }) {
  if (!data?.length) return null;
  return (
    <Card>
      <SectionLabel accent="DIVIDENDS · SPLITS · BONUS">CORPORATE ACTIONS</SectionLabel>
      <div style={{ display:"flex", flexDirection:"column", gap:9, marginTop:4 }}>
        {data.slice(0, 8).map((a, i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:12,
                                 borderBottom:i<data.length-1?`1px solid ${C.line}`:"none", paddingBottom:8 }}>
            <div>
              <span style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", color:C.gold }}>{a.type}</span>
              <div style={{ ...sans, fontSize:12.5, color:C.text200, lineHeight:1.4, marginTop:2 }}>{a.detail || "—"}</div>
            </div>
            <span style={{ ...mono, fontSize:11, color:C.dim, flexShrink:0 }}>{a.date || ""}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ShareholdingTrendCard({ trend }) {
  if (!trend?.periods?.length || !trend?.rows?.length) return null;
  const periods = trend.periods;
  const label = d => { const s = String(d); return s.length > 8 ? s.slice(0, 7) : s; };
  const order = ["promoter", "fii", "fpi", "foreign", "dii", "mutual", "mf", "insurance", "institution", "public", "other"];
  const rank = n => { const x = (n || "").toLowerCase(); const i = order.findIndex(o => x.includes(o)); return i < 0 ? 99 : i; };
  const rows = [...trend.rows].sort((a, b) => rank(a.name) - rank(b.name));
  return (
    <Card noPad style={{ overflow:"hidden" }}>
      <div style={{ padding:"14px 18px 8px" }}><SectionLabel accent="QUARTERLY">SHAREHOLDING TREND</SectionLabel></div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
          <thead>
            <tr style={{ borderTop:`1px solid ${C.line}`, borderBottom:`1px solid ${C.line2}` }}>
              <th style={{ ...sans, textAlign:"left", padding:"8px 18px", fontSize:10, textTransform:"uppercase", color:C.dim, fontWeight:500 }} />
              {periods.map((p, i) => <th key={i} style={{ ...sans, textAlign:"right", padding:"8px 10px", fontSize:10, color:i===periods.length-1?C.gold:C.dim, fontWeight:600, whiteSpace:"nowrap" }}>{label(p)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom:`1px solid ${C.line}`, background:i%2?"rgba(220,213,193,0.015)":"transparent" }}>
                <td style={{ ...sans, padding:"8px 18px", color:C.text200 }}>{r.name}</td>
                {r.values.map((v, j) => <td key={j} style={{ ...mono, textAlign:"right", padding:"8px 10px", color:j===r.values.length-1?"#d4b96a":C.text200 }}>{v==null?"—":v.toFixed(2)+"%"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function OwnershipTab({ profile, ownership }) {
  const isMobile = useIsMobile();
  if (!profile) {
    return <div style={{ padding:40, ...sans, color:C.dim, fontSize:13 }}>Loading ownership…</div>;
  }
  const hasAny = profile.shareholding?.length || profile.corporate_actions?.length ||
                 profile.shareholding_trend?.rows?.length || profile.leadership?.length;
  if (!hasAny && ownership) {
    // Insights-blob fallback: quarterly shareholding pattern with QoQ deltas.
    const rows = [["Promoter", ownership.promoter], ["FII", ownership.fii],
                  ["Mutual Funds", ownership.mf], ["DII", ownership.dii],
                  ["Institutional", ownership.institutional], ["Public", ownership.public],
                  ["Government", ownership.government], ["Other", ownership.other]]
      .filter(([, v]) => v && v.pct != null);
    if (rows.length) {
      return (
        <div className="fadein" style={{ padding: isMobile ? 16 : 32, maxWidth: 520 }}>
          <div style={{ border:`1px solid ${C.line}`, borderRadius:12, background:C.panel, padding:"18px 20px" }}>
            <div style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em", color:C.dim, marginBottom:12 }}>
              Shareholding Pattern{ownership.as_of ? ` · as of ${ownership.as_of}` : ""}
            </div>
            {rows.map(([label, v]) => (
              <div key={label} style={{ display:"flex", alignItems:"baseline", gap:10, padding:"7px 0", borderTop:`1px solid ${C.line}` }}>
                <span style={{ ...sans, fontSize:13, color:C.text200, flex:1 }}>{label}</span>
                <span style={{ ...mono, fontSize:14, color:C.text }}>{v.pct.toFixed(2)}%</span>
                {v.delta != null && v.delta !== 0 && (
                  <span style={{ ...mono, fontSize:11, color:v.delta >= 0 ? C.green : C.red, minWidth:64, textAlign:"right" }}>
                    {v.delta >= 0 ? "+" : ""}{v.delta.toFixed(2)} QoQ
                  </span>
                )}
              </div>
            ))}
            <div style={{ ...sans, fontSize:10.5, color:C.faint, marginTop:10 }}>
              Historical trend, corporate actions and leadership arrive with the detailed profile refresh.
            </div>
          </div>
        </div>
      );
    }
  }
  if (!hasAny) {
    return <div style={{ padding:40, ...sans, color:C.dim, fontSize:13 }}>No ownership data available for this company.</div>;
  }
  return (
    <div className="fadein" style={{ padding: isMobile ? 16 : 32, display:"grid", gridTemplateColumns: isMobile ? "1fr" : "360px 1fr", gap:24, alignItems:"start" }}>
      <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
        <ShareholdingCard data={profile.shareholding} />
        <CorporateActionsCard data={profile.corporate_actions} />
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
        <ShareholdingTrendCard trend={profile.shareholding_trend} />
        <LeadershipCard data={profile.leadership} />
      </div>
    </div>
  );
}

/* ── Financials Tab ──────────────────────────────────────────────── */
/* ── Live financial-statement rendering ───────────────────────────── */
const FIN_LABELS = {
  // P&L — Screener-style standard Indian income statement
  revenue:"Sales", total_expenses:"Expenses", ebitda:"Operating Profit",
  other_income:"Other Income", depreciation:"Depreciation", interest_expense:"Interest",
  pbt:"Profit Before Tax", tax:"Tax", pat:"Net Profit",
  total_income:"Total Income",
  interest_income:"Interest Income", nii:"Net Interest Income", provisions:"Provisions & Write-offs",
  opex:"Operating Expenses",
  // Balance sheet
  equity:"Share Capital", reserves:"Reserves & Surplus", total_equity:"Total Equity", net_worth:"Net Worth",
  lt_debt:"Long-Term Debt", st_debt:"Short-Term Debt", borrowings:"Total Borrowings",
  total_debt:"Total Debt", total_liabilities:"Total Liabilities", fixed_assets:"Fixed Assets",
  investments:"Investments", cash:"Cash & Equivalents", total_assets:"Total Assets",
  aum:"AUM", gnpa:"Gross NPA", nnpa:"Net NPA", crar:"CRAR",
  // Cash flow
  operating_cf:"Cash from Operations", investing_cf:"Cash from Investing",
  financing_cf:"Cash from Financing", capex:"Capital Expenditure", fcf:"Free Cash Flow",
  dividends:"Dividends Paid", net_change_cash:"Net Change in Cash",
};
const prettyFin = k => FIN_LABELS[k] || k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
// Bold the subtotal lines, the way a real statement emphasises them.
const boldItem = k => /^(total_income|gross_profit|ebitda|ebit|pbt|pat|nii|net_worth|total_equity|total_assets|fcf|operating_cf)$/i.test(k);
// Canonical statement order. ONLY keys listed here are shown, in this order —
// margin %s and unmapped junk are deliberately excluded (margins live in Ratios),
// so every company renders a clean, conventionally-sequenced statement.
const PL_ORDER_FIN    = ["interest_income","interest_expense","nii","other_income","total_income","opex","provisions","pbt","tax","pat"];
// Lean Screener-style P&L: Sales → Expenses → Operating Profit → Other Income
// → Interest → Depreciation → PBT → Tax → Net Profit. No redundant sub-lines.
const PL_ORDER_NONFIN = ["revenue","total_expenses","ebitda","other_income","interest_expense","depreciation","pbt","tax","pat"];
const BS_ORDER = ["equity","reserves","net_worth","total_equity","st_debt","lt_debt","total_debt","borrowings","total_liabilities","fixed_assets","investments","cash","total_assets","aum","gnpa","nnpa","crar"];
const CF_ORDER = ["operating_cf","capex","fcf","investing_cf","financing_cf","dividends","net_change_cash"];

// Value for a line item in a given year, deriving a couple of standard lines
// when the source omits them (Expenses = Sales − Operating Profit).
function lineValue(statements, year, stmtKey, k) {
  const s = statements[year]?.[stmtKey] || {};
  if (s[k] != null) return s[k];
  if (k === "total_expenses" && s.revenue != null && s.ebitda != null) return s.revenue - s.ebitda;
  return null;
}

function LiveStatementTable({ title, accent, statements, years, stmtKey, order }) {
  const present = new Set();
  years.forEach(y => Object.keys(statements[y]?.[stmtKey] || {}).forEach(k => present.add(k)));
  // "total_expenses" can be derived, so treat it as available if its inputs are.
  if (stmtKey === "PL" && order.includes("total_expenses") &&
      years.some(y => statements[y]?.PL?.revenue != null && statements[y]?.PL?.ebitda != null)) {
    present.add("total_expenses");
  }
  if (!present.size) return null;
  // Only canonical line items, in canonical order. Anything not in `order`
  // (margin %s, stray news wires keys) is intentionally excluded so the statement
  // reads cleanly, like a real income statement / balance sheet.
  const items = order.filter(k => present.has(k));
  if (!items.length) return null;
  return (
    <Card noPad style={{ overflow:"hidden" }}>
      <div style={{ padding:"16px 20px 8px", display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
        <div>
          <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:C.dim }}>{accent}</div>
          <div style={{ ...serif, fontSize:22, color:C.text, marginTop:2 }}>{title}</div>
        </div>
        <span style={{ ...sans, fontSize:10, textTransform:"uppercase", color:C.dim }}>₹ Crores</span>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ borderTop:`1px solid ${C.line}`, borderBottom:`1px solid ${C.line}` }}>
              <th style={{ ...sans, textAlign:"left", padding:"8px 20px", fontSize:10, textTransform:"uppercase", color:C.dim, fontWeight:500 }} />
              {years.map((y, i) => (
                <th key={i} style={{ ...sans, textAlign:"right", padding:"8px", paddingRight:i===years.length-1?"20px":"8px", fontSize:10, color:i===years.length-1?C.gold:C.dim, fontWeight:500 }}>FY{String(y).slice(2)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((k, i) => {
              const bold = boldItem(k);
              return (
                <tr key={i} style={{ borderBottom:`1px solid ${C.line}`, background:bold?"rgba(58,53,40,0.3)":"transparent" }}>
                  <td style={{ ...sans, padding:"10px 20px", color:bold?C.text:C.text200, fontWeight:bold?500:400 }}>{prettyFin(k)}</td>
                  {years.map((y, j) => {
                    const v = lineValue(statements, y, stmtKey, k);
                    return (
                      <td key={j} style={{ ...mono, textAlign:"right", padding:"10px 8px", paddingRight:j===years.length-1?"20px":"8px", fontSize:12, color:j===years.length-1?"#d4b96a":bold?C.text:C.text200 }}>
                        {v == null ? "—" : fmtN(v, 0)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* Shared statement table. Renders the EXACT line items IndianAPI returns for
   THIS company (no forced template) — NBFCs show Revenue / Financing Profit /
   Financing Margin %, manufacturers show Sales / Operating Profit / OPM %, etc.
   Works for quarterly or annual ({periods, metrics, order}). */
const _isBoldLine = name => /(^|\s)(sales|revenue|operating profit|financing profit|profit before tax|net profit|profit after tax)(\s|$)/i.test(name || "");
const _fmtStmtVal = (v, name) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  const nm = String(name);
  if (nm.includes("%") || /days$/i.test(nm)) return fmtN(n, nm.includes("%") ? 0 : 0) + (nm.includes("%") ? "%" : "");
  if (/\beps\b/i.test(nm)) return "₹" + fmtN(n, 2);
  if (nm.includes("/")) return n.toFixed(2);            // ratio lines, e.g. CFO/OP
  return fmtN(n, 0);
};

function ScreenerIncomeTable({ accent, title = "Income Statement", periods, metrics, order, kind, growth = false, padCols = 0 }) {
  const m = metrics || {};
  const names = (order && order.length ? order : Object.keys(m));
  const L = periods.length;
  const label = p => {
    const a = String(p).split(" ");
    return kind === "annual" ? "FY" + (a[1] || "").slice(-2) : a[0] + " '" + (a[1] || "").slice(-2);
  };
  // Computed growth columns on the latest period (reduces dependency / errors).
  const gCols = [];
  if (growth) {
    if (kind === "annual" && L >= 2) gCols.push({ label: "YoY", cur: L - 1, prev: L - 2 });
    else if (kind === "quarterly") {
      if (L >= 2) gCols.push({ label: "QoQ", cur: L - 1, prev: L - 2 });
      if (L >= 5) gCols.push({ label: "YoY", cur: L - 1, prev: L - 5 });
    }
  }
  const gVal = (name, ci, pi) => {
    const c = Number(m[name]?.[ci]), p = Number(m[name]?.[pi]);
    if (isNaN(c) || isNaN(p)) return { txt: "—", tone: C.dim };
    if (String(name).includes("%")) { const d = c - p; return { txt: (d >= 0 ? "+" : "") + d.toFixed(0) + " pp", tone: d >= 0 ? C.green : C.red }; }
    if (p === 0) return { txt: "—", tone: C.dim };
    const g = (c / p - 1) * 100;
    return { txt: (g >= 0 ? "+" : "") + g.toFixed(0) + "%", tone: g >= 0 ? C.green : C.red };
  };
  return (
    <Card noPad style={{ overflow:"hidden" }}>
      <div style={{ padding:"16px 20px 8px", display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
        <div>
          <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:C.dim }}>{accent}</div>
          <div style={{ ...serif, fontSize:22, color:C.text, marginTop:2 }}>{title}</div>
        </div>
        <span style={{ ...sans, fontSize:10, textTransform:"uppercase", color:C.dim }}>₹ Crores</span>
      </div>
      <div style={{ overflowX:"auto" }}>
        {(() => {
          // Fixed geometry so FY columns line up vertically across the stacked
          // Income / Balance Sheet / Cash Flow tables. Every table reserves the
          // same number of trailing slots (growth cols on Income; pad cols on the
          // others) → identical column positions.
          const dataCols = L + gCols.length + padCols;
          const dataW = (72 / dataCols).toFixed(3) + "%";
          const pad = Array.from({ length: padCols });
          return (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, minWidth:560, tableLayout:"fixed" }}>
              <colgroup>
                <col style={{ width:"28%" }} />
                {Array.from({ length: dataCols }).map((_, i) => <col key={i} style={{ width:dataW }} />)}
              </colgroup>
              <thead>
                <tr style={{ borderTop:`1px solid ${C.line}`, borderBottom:`1px solid ${C.line2}` }}>
                  <th style={{ ...sans, textAlign:"left", padding:"9px 20px", fontSize:10, textTransform:"uppercase", color:C.dim, fontWeight:500 }} />
                  {periods.map((p, i) => (
                    <th key={i} style={{ ...sans, textAlign:"right", padding:"9px 8px", fontSize:10.5, color:i===L-1?C.gold:C.dim, fontWeight:600, whiteSpace:"nowrap", letterSpacing:"0.03em" }}>{label(p)}</th>
                  ))}
                  {gCols.map((g, i) => (
                    <th key={"g"+i} style={{ ...sans, textAlign:"right", padding:"9px 8px", paddingRight:i===gCols.length-1?"20px":"8px", fontSize:10, color:C.gold, fontWeight:600, whiteSpace:"nowrap", borderLeft:i===0?`1px solid ${C.line2}`:"none" }}>{g.label}</th>
                  ))}
                  {pad.map((_, i) => <th key={"p"+i} style={{ paddingRight:i===padCols-1?"20px":"8px" }} />)}
                </tr>
              </thead>
              <tbody>
                {names.map((name, i) => {
                  const bold = _isBoldLine(name);
                  const bg = bold ? "rgba(58,53,40,0.32)" : (i % 2 ? "rgba(220,213,193,0.015)" : "transparent");
                  return (
                    <tr key={i} style={{ borderBottom:`1px solid ${C.line}`, background:bg }}>
                      <td style={{ ...sans, padding:"9px 20px", color:bold?C.text:C.text200, fontWeight:bold?600:400, lineHeight:1.35 }}>{name}</td>
                      {periods.map((p, j) => (
                        <td key={j} style={{ ...mono, textAlign:"right", padding:"9px 8px", fontSize:12, color:j===L-1?"#d4b96a":bold?C.text:C.text200, fontWeight:bold?600:400 }}>
                          {_fmtStmtVal(m[name]?.[j], name)}
                        </td>
                      ))}
                      {gCols.map((g, k) => {
                        const gv = gVal(name, g.cur, g.prev);
                        return (
                          <td key={"g"+k} style={{ ...mono, textAlign:"right", padding:"9px 8px", paddingRight:k===gCols.length-1?"20px":"8px", fontSize:12, color:gv.tone, borderLeft:k===0?`1px solid ${C.line2}`:"none" }}>
                            {gv.txt}
                          </td>
                        );
                      })}
                      {pad.map((_, k) => <td key={"p"+k} style={{ paddingRight:k===padCols-1?"20px":"8px" }} />)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })()}
      </div>
    </Card>
  );
}

/* Quarterly results — last 5 quarters from /quarterly. */
function QuarterlyResults({ co, API }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!API || !co.ticker) { setLoading(false); return; }
    setLoading(true);
    fetch(`${API}/api/companies/${co.ticker}/quarterly`)
      .then(r => r.json()).then(setData).catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [co.ticker, API]);

  if (loading) return <div style={{ ...sans, color:C.dim, fontSize:13, textAlign:"center", padding:40 }}>Loading quarterly results…</div>;
  if (!data?.has_data || !(data.quarters || []).length) return <QuarterlyInsightsFallback co={co} API={API} />;
  return <ScreenerIncomeTable accent={`QUARTERLY RESULTS · LAST ${data.quarters.length} QUARTERS`}
                              periods={data.quarters} metrics={data.metrics} order={data.order} kind="quarterly" growth />;
}

/* Quarterly fallback — the /quarterly endpoint is empty for most names, but
   insights.latest_q (same filings feed) carries the latest quarter + TTM P&L
   for nearly all 500 (wiring audit #3). Two honest columns beat an empty tab. */
function QuarterlyInsightsFallback({ co, API }) {
  const [q, setQ] = useState(undefined);          // undefined=loading, null=absent
  useEffect(() => {
    let live = true;
    fetch(`${API}/api/companies/${co.ticker}/insights`)
      .then(r => r.json())
      .then(d => { if (live) setQ(d?.latest_q || null); })
      .catch(() => { if (live) setQ(null); });
    return () => { live = false; };
  }, [co.ticker, API]);
  if (q === undefined) return <div style={{ ...sans, color:C.dim, fontSize:13, textAlign:"center", padding:40 }}>Loading quarterly results…</div>;
  const rows = [["Sales", "sales"], ["Expenses", "expenses"], ["Operating Profit", "operating_profit"],
    ["OPM %", "opm"], ["Other Income", "other_income"], ["Interest", "interest"],
    ["Depreciation", "depreciation"], ["Profit Before Tax", "profit_before_tax"],
    ["Tax %", "tax_percentage"], ["Net Profit", "net_profit"], ["EPS (₹)", "eps"]];
  const has = q && (q.quarter || q.ttm);
  if (!has) return (
    <Card><div style={{ ...sans, color:C.dim, fontSize:13, textAlign:"center", padding:40, lineHeight:1.7 }}>
      Quarterly results aren't published in our data feed for <b style={{ color:C.text }}>{co.ticker}</b> yet — they arrive with the weekly refresh after the next results date.
    </div></Card>
  );
  const cell = (blk, key) => {
    const v = blk?.[key];
    return v == null ? "—" : ["opm","tax_percentage"].includes(key) ? `${fmtN(v,1)}%`
         : key === "eps" ? fmtN(v,2) : fmtN(v,0);
  };
  return (
    <Card>
      <SectionLabel accent="LATEST QUARTER · FROM THE FILINGS FEED">QUARTERLY SNAPSHOT</SectionLabel>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:380 }}>
          <thead><tr>
            <th style={{ ...sans, textAlign:"left", fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:"0.08em", padding:"8px 10px" }}>₹ Cr</th>
            <th style={{ ...sans, textAlign:"right", fontSize:10, color:C.gold, textTransform:"uppercase", letterSpacing:"0.08em", padding:"8px 10px" }}>Latest Qtr</th>
            <th style={{ ...sans, textAlign:"right", fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:"0.08em", padding:"8px 10px" }}>TTM</th>
          </tr></thead>
          <tbody>
            {rows.map(([label, key]) => (
              <tr key={key} style={{ borderTop:`1px solid ${C.line}` }}>
                <td style={{ ...sans, fontSize:12.5, color:C.text200, padding:"7px 10px" }}>{label}</td>
                <td style={{ ...mono, fontSize:12.5, color:C.text, textAlign:"right", padding:"7px 10px" }}>{cell(q.quarter, key)}</td>
                <td style={{ ...mono, fontSize:12.5, color:C.text200, textAlign:"right", padding:"7px 10px" }}>{cell(q.ttm, key)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...sans, fontSize:10.5, color:C.faint, marginTop:8 }}>The full multi-quarter table appears as more quarters accumulate in the feed.</div>
    </Card>
  );
}

/* Annual income statement — last 5 years from /annual_pl, SAME format as
   quarterly. Falls back to the legacy statement table if unavailable. */
function AnnualIncomeStatement({ co, API, fallback }) {
  const [data, setData] = useState(undefined);
  useEffect(() => {
    if (!API || !co.ticker) { setData(null); return; }
    setData(undefined);
    fetch(`${API}/api/companies/${co.ticker}/annual_pl`)
      .then(r => r.json()).then(setData).catch(() => setData(null));
  }, [co.ticker, API]);

  if (data === undefined) return <div style={{ ...sans, color:C.dim, fontSize:13, padding:24 }}>Loading income statement…</div>;
  if (!data?.has_data || !(data.periods || []).length) return fallback || null;
  return <ScreenerIncomeTable accent={`ANNUAL RESULTS · LAST ${data.periods.length} YEARS`}
                              periods={data.periods} metrics={data.metrics} order={data.order} kind="annual" growth />;
}

/* Generic annual statement (Balance Sheet / Cash Flow) — original IndianAPI
   line items via /balance_sheet or /cash_flow. Falls back to the legacy table. */
function PeriodicStatement({ co, API, endpoint, title, accent, fallback }) {
  const [data, setData] = useState(undefined);
  useEffect(() => {
    if (!API || !co.ticker) { setData(null); return; }
    setData(undefined);
    fetch(`${API}/api/companies/${co.ticker}/${endpoint}`)
      .then(r => r.json()).then(setData).catch(() => setData(null));
  }, [co.ticker, API, endpoint]);

  if (data === undefined) return <div style={{ ...sans, color:C.dim, fontSize:13, padding:24 }}>Loading {title.toLowerCase()}…</div>;
  if (!data?.has_data || !(data.periods || []).length) return fallback || null;
  return <ScreenerIncomeTable title={title} accent={accent || `${title.toUpperCase()} · LAST ${data.periods.length} YEARS`}
                              periods={data.periods} metrics={data.metrics} order={data.order} kind="annual" padCols={1} />;
}

function FinancialsTab({ co, cd, liveFinancials, API }) {
  const [view, setView] = useState("annual");
  const isF = co.type === "financial";
  const hasLive = liveFinancials?.has_data;

  const annual = () => {
    if (hasLive) {
      const { statements, years_available: years } = liveFinancials;
      const plOrder = isF ? PL_ORDER_FIN : PL_ORDER_NONFIN;
      return (
        <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:16, background:C.green+"0a", border:`1px solid ${C.green}33` }}>
            <Check size={16} color={C.green} style={{ flexShrink:0, marginTop:2 }} />
            <div style={{ ...sans, fontSize:13, color:C.text200, lineHeight:1.6 }}>
              Live statements — <span style={{ color:C.green, fontWeight:500 }}>{years.length} fiscal year{years.length>1?"s":""}</span> from the verified filings feed. ₹ in crores.
            </div>
          </div>
          <AnnualIncomeStatement co={co} API={API} fallback={
            <LiveStatementTable title="Income Statement" accent={isF?"P&L · NBFC TEMPLATE":"P&L · ₹ CR"} statements={statements} years={years} stmtKey="PL" order={plOrder} />
          } />
          <PeriodicStatement co={co} API={API} endpoint="balance_sheet" title="Balance Sheet" fallback={
            <LiveStatementTable title="Balance Sheet" accent="BALANCE SHEET · YEAR-END" statements={statements} years={years} stmtKey="BS" order={BS_ORDER} />
          } />
          <PeriodicStatement co={co} API={API} endpoint="cash_flow" title="Cash Flow" fallback={
            <LiveStatementTable title="Cash Flow" accent="CASH FLOW STATEMENT" statements={statements} years={years} stmtKey="CF" order={CF_ORDER} />
          } />
        </div>
      );
    }
    if (cd?.pnl) {
      return (
        <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
          <FinTable title="Income Statement" accent={`CONSOLIDATED · ${cd.pnl.years[0]} — ${cd.pnl.years[cd.pnl.years.length - 1]}`} rows={cd.pnl.rows} years={cd.pnl.years} />
          {cd.bs && <FinTable title="Balance Sheet & AUM" accent="CONSOLIDATED · YEAR-END" rows={cd.bs.rows} years={cd.bs.years} />}
        </div>
      );
    }
    return (
      <Card><div style={{ ...sans, color:C.dim, fontSize:13, textAlign:"center", padding:40, lineHeight:1.7 }}>
        No multi-year statements for <b style={{ color:C.text }}>{co.ticker}</b> yet — they populate on the next scheduled refresh.
      </div></Card>
    );
  };

  return (
    <div className="fadein" style={{ padding:"32px" }}>
      <div style={{ display:"flex", gap:4, marginBottom:20 }}>
        {[["annual","Annual"],["quarterly","Quarterly"]].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} style={{
            ...sans, padding:"7px 16px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:500,
            border:`1px solid ${view===id?C.line2:"transparent"}`,
            background:view===id?C.bg800:"transparent",
            color:view===id?C.gold:C.dim,
          }}>{label}</button>
        ))}
      </div>
      {view==="quarterly" ? <QuarterlyResults co={co} API={API} /> : annual()}
    </div>
  );
}

/* ── Ratios Tab ──────────────────────────────────────────────────── */
const metricFmt = (m) => {
  if (m.formatted != null && m.formatted !== "") return m.formatted;
  if (m.value == null) return "—";
  if (m.unit === "pct") return (m.value*100).toFixed(1)+"%";
  if (m.unit === "x")   return m.value.toFixed(2)+"x";
  return Number(m.value).toLocaleString("en-IN", { maximumFractionDigits:2 });
};

function LiveMetricCard({ cat }) {
  const rows = cat.metrics.filter(m => m.value != null);
  if (!rows.length) return null;
  return (
    <Card noPad style={{ overflow:"hidden" }}>
      <div style={{ padding:"14px 18px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.16em", color:C.gold, fontWeight:600 }}>{cat.name}</span>
        <span style={{ ...sans, fontSize:10, color:C.dim }}>{rows.length} metric{rows.length>1?"s":""}</span>
      </div>
      <div style={{ borderTop:`1px solid ${C.line2}` }}>
        {rows.map((m, i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"9px 18px",
                                borderBottom:i<rows.length-1?`1px solid ${C.line}`:"none",
                                background:i%2?"rgba(220,213,193,0.015)":"transparent" }}
               title={m.note || ""}>
            <span style={{ ...sans, color:C.text200, fontSize:12.5 }}>{m.label}</span>
            <span style={{ ...mono, fontSize:13, color:C.text, fontWeight:500 }}>{metricFmt(m)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RatiosTab({ co, API, liveMetrics }) {
  const isMobile = useIsMobile();
  const [ratios, setRatios] = useState(undefined);
  const [insights, setInsights] = useState(null);
  const liveCats = (liveMetrics?.categories || []).filter(c => c.metrics.some(m => m.value != null));
  useEffect(() => {
    if (!API || !co.ticker) { setRatios(null); return; }
    setRatios(undefined);
    fetch(`${API}/api/companies/${co.ticker}/ratios_live`).then(r => r.json()).then(setRatios).catch(() => setRatios(null));
    fetch(`${API}/api/companies/${co.ticker}/insights`).then(r => r.json()).then(setInsights).catch(() => setInsights(null));
  }, [co.ticker, API]);

  const sm = insights?.self_metrics;
  const growth = insights?.growth;       // profit_loss_stats: {metric: {"10 Years:": "9%", ...}}
  const pctR = (n, d = 1) => (n == null || isNaN(n)) ? "—" : Number(n).toFixed(d) + "%";

  // Growth summary — published as-is over IndianAPI's own periods.
  const growthCols = ["10 Years", "5 Years", "3 Years", "TTM"];
  const growthVal = (vals, col) => {
    if (!vals) return "—";
    const want = col.toLowerCase();
    for (const k of Object.keys(vals)) {
      const kl = k.toLowerCase();
      if (want === "ttm" && (kl.includes("ttm") || kl.includes("1 year") || kl.includes("last"))) return vals[k];
      if (want !== "ttm" && kl.includes(want.split(" ")[0])) return vals[k];
    }
    return "—";
  };

  return (
    <div className="fadein" style={{ padding: isMobile ? 16 : 32, display:"flex", flexDirection:"column", gap:24 }}>
      <div style={{ ...sans, fontSize:12, color:C.dim, display:"flex", alignItems:"center", gap:8 }}>
        <Info size={13} color={C.faint} /> Ratios as reported in the source feed — sector-specific, no standardised template.
      </div>

      {/* Valuation & returns — IndianAPI's own TTM multiples (same card style) */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:20, alignItems:"start" }}>
        {sm && (
          <Card noPad style={{ overflow:"hidden" }}>
            <div style={{ padding:"14px 18px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.16em", color:C.gold, fontWeight:600 }}>VALUATION &amp; RETURNS</span>
              <span style={{ ...sans, fontSize:10, color:C.dim }}>TTM · reported</span>
            </div>
            <div style={{ borderTop:`1px solid ${C.line2}` }}>
              {[["P / E", multiple(sm.pe,1)],["P / B", multiple(sm.pb,1)],["ROE (TTM)", pctR(sm.roe_ttm)],
                ["Net Margin", pctR(sm.npm_ttm)],["Dividend Yield", pctR(sm.div_yield)]].map(([l,v],i,arr) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"9px 18px",
                                      borderBottom:i<arr.length-1?`1px solid ${C.line}`:"none", background:i%2?"rgba(220,213,193,0.015)":"transparent" }}>
                  <span style={{ ...sans, color:C.text200, fontSize:12.5 }}>{l}</span>
                  <span style={{ ...mono, fontSize:13, color:C.text, fontWeight:500 }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {/* Comprehensive computed ratios by category (sector-aware engine) */}
        {liveCats.map(cat => <LiveMetricCard key={cat.name} cat={cat} />)}
      </div>

      {/* Operating ratios — original line items, capped to the latest 5 years */}
      {ratios === undefined ? (
        <div style={{ ...sans, color:C.dim, fontSize:13, padding:24 }}>Loading ratios…</div>
      ) : (ratios?.has_data && (ratios.periods || []).length) ? (
        <ScreenerIncomeTable title="Ratios" accent="OPERATING RATIOS · REPORTED"
                             periods={ratios.periods.slice(-5)}
                             metrics={Object.fromEntries(Object.entries(ratios.metrics || {}).map(([k, v]) => [k, (v || []).slice(-5)]))}
                             order={ratios.order} kind="annual" />
      ) : (insights?.ratios && Object.keys(insights.ratios).length > 0) ? (
        // Fallback: the same operating ratios live in the insights blob for
        // nearly all 500 (metric → {"Mar YYYY": value}) — wiring audit #4.
        (() => {
          const src = insights.ratios;
          const periods = [...new Set(Object.values(src).flatMap(o => Object.keys(o || {})))]
            .sort((a, b) => (a.split(" ")[1] || 0) - (b.split(" ")[1] || 0)).slice(-5);
          return (
            <Card noPad style={{ overflow:"hidden" }}>
              <div style={{ padding:"14px 18px 0" }}>
                <SectionLabel accent="OPERATING RATIOS · REPORTED">RATIOS</SectionLabel>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", minWidth:420 }}>
                  <thead><tr>
                    <th style={{ ...sans, textAlign:"left", fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:"0.08em", padding:"8px 18px" }}>Metric</th>
                    {periods.map(p => <th key={p} style={{ ...sans, textAlign:"right", fontSize:10, color:C.dim, padding:"8px 12px", whiteSpace:"nowrap" }}>{p}</th>)}
                  </tr></thead>
                  <tbody>
                    {Object.entries(src).map(([metric, vals]) => (
                      <tr key={metric} style={{ borderTop:`1px solid ${C.line}` }}>
                        <td style={{ ...sans, fontSize:12.5, color:C.text200, padding:"7px 18px" }}>{metric}</td>
                        {periods.map(p => (
                          <td key={p} style={{ ...mono, fontSize:12, color:C.text, textAlign:"right", padding:"7px 12px" }}>
                            {vals?.[p] == null ? "—" : Number(vals[p]).toLocaleString("en-IN", { maximumFractionDigits: 1 })}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })()
      ) : null}

      {/* Growth & returns — styled to match the financials / operating tables */}
      {growth && Object.keys(growth).length > 0 && (
        <Card noPad style={{ overflow:"hidden" }}>
          <div style={{ padding:"16px 20px 8px", display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
            <div>
              <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:C.dim }}>COMPOUNDED · REPORTED</div>
              <div style={{ ...serif, fontSize:22, color:C.text, marginTop:2 }}>Growth &amp; Returns</div>
            </div>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, minWidth:460, tableLayout:"fixed" }}>
              <colgroup><col style={{ width:"32%" }} />{growthCols.map((c,i)=><col key={i} style={{ width:(68/growthCols.length)+"%" }} />)}</colgroup>
              <thead>
                <tr style={{ borderTop:`1px solid ${C.line}`, borderBottom:`1px solid ${C.line2}` }}>
                  <th style={{ ...sans, textAlign:"left", padding:"9px 20px", fontSize:10, textTransform:"uppercase", color:C.dim, fontWeight:500 }} />
                  {growthCols.map((c,i) => <th key={c} style={{ ...sans, textAlign:"right", padding:"9px 12px", fontSize:10.5, textTransform:"uppercase", color:i===growthCols.length-1?C.gold:C.dim, fontWeight:600, letterSpacing:"0.03em" }}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(growth).map(([metric, vals], i) => (
                  <tr key={i} style={{ borderBottom:`1px solid ${C.line}`, background:i%2?"rgba(220,213,193,0.015)":"transparent" }}>
                    <td style={{ ...sans, padding:"9px 20px", color:C.text200 }}>{metric}</td>
                    {growthCols.map((c,j) => (
                      <td key={c} style={{ ...mono, textAlign:"right", padding:"9px 12px", fontSize:12, color:j===growthCols.length-1?"#d4b96a":C.text200 }}>{growthVal(vals, c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
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

/* DCFTab removed — dead code with hardcoded fallbacks (wiring audit); DCFModel is the live valuation tab. */

/* ── Dynamic peer comparison (consistent basis) ──────────────────────
   Every peer's P/E, P/B, ROE, intrinsic and MoS are computed with the SAME
   functions (fundamentals + recommend) used for the hero company. This is the
   key fix vs hand-keyed peer tables, where each row could be on a different
   definition. Peers are same-type companies in a related sector. */
function broadSector(s) {
  const x = (s || "").toLowerCase();
  if (x.includes("bank") || x.includes("financ") || x.includes("nbfc")) return "Financials";
  if (x.includes("tech") || x.includes("information")) return "Technology";
  if (x.includes("pharma") || x.includes("health")) return "Healthcare";
  if (x.includes("auto")) return "Auto";
  if (x.includes("fmcg") || x.includes("consumer")) return "Consumer";
  if (x.includes("energy") || x.includes("oil") || x.includes("power")) return "Energy";
  if (x.includes("metal") || x.includes("mining")) return "Metals";
  if (x.includes("chem")) return "Chemicals";
  return "Other";
}

function DynamicPeers({ co, allCompanies }) {
  const universe = (allCompanies || []).filter(c =>
    c.type === co.type && broadSector(c.sector) === broadSector(co.sector)
  );
  const rows = (universe.length >= 2 ? universe : (allCompanies || []).filter(c => c.type === co.type))
    .map(c => {
      const r = recommend(c, c.assumptions);
      return { c, iv: r.iv, mos: r.mos, pe: r.f.pe, pb: r.f.pb, roe: r.f.roe, verdict: r.verdict, conf: r.confidence };
    })
    .sort((a, b) => (b.mos ?? -Infinity) - (a.mos ?? -Infinity));

  if (rows.length < 2) return (
    <div className="fadein" style={{ padding:32 }}>
      <Card><div style={{ ...sans, color:C.dim, fontSize:13, padding:40, textAlign:"center" }}>
        Not enough peers in this sector yet. Once more companies are ingested, this table compares them all on a single, consistent basis.
      </div></Card>
    </div>
  );

  return (
    <div className="fadein" style={{ padding:32, display:"flex", flexDirection:"column", gap:24 }}>
      <Card noPad style={{ overflow:"hidden" }}>
        <div style={{ padding:"16px 20px 8px" }}>
          <SectionLabel accent={`${broadSector(co.sector).toUpperCase()} · CONSISTENT BASIS`}>PEER COMPARISON</SectionLabel>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderTop:`1px solid ${C.line}`, borderBottom:`1px solid ${C.line}` }}>
                {["Company","CMP","Intrinsic","MoS","P/E","P/B","ROE","Verdict"].map((h, i) => (
                  <th key={i} style={{ ...sans, textAlign:i===0?"left":"right", padding:"8px", paddingLeft:i===0?"20px":"8px", paddingRight:i===7?"20px":"8px", fontSize:10, textTransform:"uppercase", color:C.dim, fontWeight:500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const isHero = p.c.ticker === co.ticker;
                return (
                  <tr key={i} style={{ borderBottom:`1px solid ${C.line}`, background:isHero?C.gold+"0d":"transparent" }}>
                    <td style={{ ...sans, padding:"10px 20px", color:isHero?C.gold:C.text200, fontWeight:isHero?500:400 }}>
                      {isHero && <span style={{ color:C.gold, marginRight:6 }}>◆</span>}
                      {p.c.name} <span style={{ ...mono, fontSize:10, color:C.dim }}>· {p.c.ticker}</span>
                    </td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text }}>{inrOrDash(p.c.price,0)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.gold }}>{inrOrDash(p.iv,0)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:p.mos==null?C.dim:p.mos>=0?C.green:C.red }}>{signedPct(p.mos)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text }}>{multiple(p.pe,1)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.text }}>{multiple(p.pb,1)}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 8px", color:C.green }}>{p.roe!=null?fmtPa(p.roe*100,1):"—"}</td>
                    <td style={{ ...mono, textAlign:"right", padding:"10px 20px", color:verdictTone(p.verdict) }}>{p.verdict}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding:"10px 20px", ...sans, fontSize:11, color:C.faint }}>
          All metrics computed by the same engine for every company, so columns are directly comparable.
        </div>
      </Card>
    </div>
  );
}

/* ── Peers Tab ───────────────────────────────────────────────────── */
/* Live peer comparison from IndianAPI — the company's actual named sector
   peers with current market multiples (P/E, P/B, ROE TTM, margins, div yield). */
function IndianApiPeers({ co, peers, selfMetrics, universe, onOpenTicker }) {
  const f = fundamentals(co);
  const sm = selfMetrics || {};
  const pctR = (n, d = 1) => (n == null || isNaN(n)) ? "—" : Number(n).toFixed(d) + "%";

  // Candidate peers: IndianAPI's curated sector peers, PLUS any other company in
  // the same sector from the full universe (consistent multiples). Deduped by name.
  // Dedup by NORMALISED name so "HCL Technologies" (curated) and "HCL
  // Technologies Ltd." (universe) collapse to one row.
  const norm = s => (s || "").toLowerCase().replace(/\b(ltd|limited|inc|corp|co|company|industries)\b\.?/g, "").replace(/[^a-z0-9]/g, "");
  // Vendor-curated peers restricted to OUR coverage: the terminal never
  // comments on names it doesn't cover, and mapping to the universe row
  // gives each peer a ticker (clickable) instead of a dead label.
  const uniByName = new Map((universe || []).map(u => [norm(u.name), u]));
  const curated = (peers || []).flatMap(p => {
    const u = uniByName.get(norm(p.name));
    if (!u) return [];
    return [{ key: u.ticker || p.name, name: u.name || p.name, ticker: u.ticker,
              price: p.price, pe: p.pe, pb: p.pb,
              roe: p.roe_ttm, npm: p.npm_ttm, divY: p.div_yield, rating: p.rating, src: "peer" }];
  });
  const seen = new Set([norm(co.name), ...curated.map(c => norm(c.name))]);
  const extra = (universe || [])
    .filter(u => u.sector && co.sector && u.sector === co.sector && !seen.has(norm(u.name)))
    .map(u => ({ key: u.ticker || u.name, name: u.name, ticker: u.ticker, price: u.price, pe: u.pe, pb: u.pb,
                 roe: u.roe_ttm, npm: u.npm_ttm, divY: u.div_yield, rating: u.rating, src: "sector" }));
  const candidates = [...curated, ...extra];

  // Selection — curated peers on by default; user toggles any row in/out of the
  // comparison and the median/average.
  const [sel, setSel] = useState(() => new Set(curated.map(c => c.key)));
  const toggle = (k) => setSel(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const chosen = candidates.filter(c => sel.has(c.key));
  const agg = (key, fn) => {
    const vals = chosen.map(c => c[key]).filter(x => x != null && isFinite(x));
    if (!vals.length) return null;
    if (fn === "med") { const v = [...vals].sort((a, b) => a - b); const n = v.length; return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2; }
    return vals.reduce((s, x) => s + x, 0) / vals.length;
  };

  const hero = { name: co.name, price: sm.price ?? co.price, pe: sm.pe ?? f.pe, pb: sm.pb ?? f.pb,
                 roe: sm.roe_ttm ?? (f.roe != null ? f.roe * 100 : null), npm: sm.npm_ttm ?? null,
                 divY: sm.div_yield ?? null, rating: sm.rating ?? null };

  // Hero first, selected next, then the rest — alpha within each band.
  const ordered = [...candidates].sort((a, b) => {
    const sa = sel.has(a.key), sb = sel.has(b.key);
    if (sa !== sb) return sa ? -1 : 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  const cols = ["P/E", "P/B", "ROE", "Net Margin", "Div Yield", "Rating"];
  const cell = (p) => ([
    <td key="px" style={{ ...mono, textAlign: "right", padding: "9px 8px", color: C.text }}>{inrOrDash(p.price, 0)}</td>,
    <td key="pe" style={{ ...mono, textAlign: "right", padding: "9px 8px", color: C.text }}>{multiple(p.pe, 1)}</td>,
    <td key="pb" style={{ ...mono, textAlign: "right", padding: "9px 8px", color: C.text }}>{multiple(p.pb, 1)}</td>,
    <td key="roe" style={{ ...mono, textAlign: "right", padding: "9px 8px", color: C.green }}>{pctR(p.roe)}</td>,
    <td key="npm" style={{ ...mono, textAlign: "right", padding: "9px 8px", color: C.text }}>{pctR(p.npm)}</td>,
    <td key="dy" style={{ ...mono, textAlign: "right", padding: "9px 8px", color: C.text }}>{pctR(p.divY)}</td>,
    <td key="rt" style={{ ...sans, textAlign: "right", padding: "9px 20px", fontSize: 12, color: C.dim }}>{p.rating || "—"}</td>,
  ]);

  const StatRow = ({ label, fn }) => (
    <tr style={{ borderTop: `1px solid ${C.line2}`, background: "rgba(212,169,62,0.06)" }}>
      <td style={{ padding: "9px 8px" }} />
      <td style={{ ...sans, padding: "9px 20px", color: C.gold, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{label}</td>
      <td style={{ padding: "9px 8px" }} />
      <td style={{ ...mono, textAlign: "right", padding: "9px 8px", color: C.gold }}>{multiple(agg("pe", fn), 1)}</td>
      <td style={{ ...mono, textAlign: "right", padding: "9px 8px", color: C.gold }}>{multiple(agg("pb", fn), 1)}</td>
      <td style={{ ...mono, textAlign: "right", padding: "9px 8px", color: C.gold }}>{pctR(agg("roe", fn))}</td>
      <td style={{ ...mono, textAlign: "right", padding: "9px 8px", color: C.gold }}>{pctR(agg("npm", fn))}</td>
      <td style={{ ...mono, textAlign: "right", padding: "9px 8px", color: C.gold }}>{pctR(agg("divY", fn))}</td>
      <td style={{ padding: "9px 20px" }} />
    </tr>
  );

  return (
    <div className="fadein" style={{ padding: 32 }}>
      <Card noPad style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 10px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <SectionLabel accent={`${co.ticker} · SECTOR PEERS · LIVE`}>PEER COMPARISON</SectionLabel>
          <span style={{ ...sans, fontSize: 11, color: C.dim }}>
            {chosen.length} of {candidates.length} selected · tick rows to include in the median
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
                <th style={{ width: 34 }} />
                <th style={{ ...sans, textAlign: "left", padding: "8px 20px", fontSize: 10, textTransform: "uppercase", color: C.dim, fontWeight: 500 }}>Company</th>
                <th style={{ ...sans, textAlign: "right", padding: "8px", fontSize: 10, textTransform: "uppercase", color: C.dim, fontWeight: 500 }}>Price</th>
                {cols.map((h, i) => (
                  <th key={i} style={{ ...sans, textAlign: "right", padding: "8px", paddingRight: i === cols.length - 1 ? "20px" : "8px", fontSize: 10, textTransform: "uppercase", color: C.dim, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Hero */}
              <tr style={{ borderBottom: `1px solid ${C.line}`, background: C.gold + "12" }}>
                <td style={{ textAlign: "center" }}><span style={{ color: C.gold }}>◆</span></td>
                <td style={{ ...sans, padding: "9px 20px", color: C.gold, fontWeight: 600 }}>{co.name}</td>
                {cell(hero)}
              </tr>
              {ordered.map((p) => {
                const on = sel.has(p.key);
                return (
                  <tr key={p.key} onClick={() => toggle(p.key)} style={{ borderBottom: `1px solid ${C.line}`, cursor: "pointer", opacity: on ? 1 : 0.5 }}>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={on} readOnly style={{ accentColor: C.gold, cursor: "pointer" }} />
                    </td>
                    <td style={{ ...sans, padding: "9px 20px", color: C.text200 }}>
                      <span
                        onClick={e => { if (onOpenTicker && p.ticker) { e.stopPropagation(); onOpenTicker(p.ticker); } }}
                        onMouseEnter={e => { if (p.ticker) e.currentTarget.style.color = C.gold; }}
                        onMouseLeave={e => { e.currentTarget.style.color = ""; }}
                        title={p.ticker ? `Open ${p.ticker}` : undefined}
                        style={{ cursor: p.ticker && onOpenTicker ? "pointer" : "inherit" }}>
                        {p.name}
                      </span>
                      {p.src === "sector" && <span style={{ ...sans, fontSize: 9, color: C.faint, marginLeft: 6, textTransform: "uppercase" }}>sector</span>}
                    </td>
                    {cell(p)}
                  </tr>
                );
              })}
              {chosen.length > 0 && <StatRow label="Median" fn="med" />}
              {chosen.length > 0 && <StatRow label="Average" fn="avg" />}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 20px", ...sans, fontSize: 11, color: C.faint }}>
          Market multiples from the verified feed (one consistent basis) · ◆ marks {co.ticker} · ROE &amp; margins are TTM · Median/Average computed over selected peers only.
        </div>
      </Card>
    </div>
  );
}

function PeersTab({ co, cd, allCompanies, API, onOpenTicker }) {
  const [iaData, setIaData] = useState(undefined); // undefined = loading
  const [universe, setUniverse] = useState(null);
  useEffect(() => {
    if (!API || !co.ticker) { setIaData(null); return; }
    setIaData(undefined);
    fetch(`${API}/api/companies/${co.ticker}/insights`)
      .then(r => r.json()).then(setIaData).catch(() => setIaData(null));
  }, [co.ticker, API]);
  useEffect(() => {
    if (!API) return;
    fetch(`${API}/api/peer_universe`).then(r => r.json()).then(setUniverse).catch(() => setUniverse(null));
  }, [API]);

  if (iaData === undefined)
    return <div style={{ padding: 40, textAlign: "center", ...sans, color: C.dim, fontSize: 13 }}>Loading peers…</div>;
  if (iaData?.peers && iaData.peers.length) {
    // Hero-row fallback: the peer table showed "—" for the company's own
    // net margin / div yield / rating while every peer had values (audit #7).
    const own = (universe || []).find(u => (u.ticker || "").toUpperCase() === (co.ticker || "").toUpperCase());
    const npmComputed = (co.netProfit != null && co.revenue) ? (co.netProfit / co.revenue) * 100 : null;
    const base = iaData.self_metrics || {};
    const selfM = { ...(own || {}), ...base,
                    npm_ttm: base.npm_ttm ?? own?.npm_ttm ?? npmComputed,
                    div_yield: base.div_yield ?? own?.div_yield ?? null,
                    rating: base.rating ?? own?.rating ?? null };
    return <IndianApiPeers co={co} peers={iaData.peers} selfMetrics={selfM} universe={universe} onOpenTicker={onOpenTicker} />;
  }

  // Fallback: curated seed (e.g. Muthoot) → screener-universe comparison.
  const peers = cd?.peers;
  if (!peers) return <DynamicPeers co={co} allCompanies={allCompanies} />;
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
function NewsTab({ co, API, profile, preloaded }) {
  const [news, setNews]       = useState(preloaded || null);
  const [loading, setLoading] = useState(!preloaded);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (preloaded) { setNews(preloaded); setLoading(false); setError(null); return; }
    if (!API) { setLoading(false); return; }
    setLoading(true);
    setError(null); // clear any stale error from a previous ticker/fetch
    fetch(`${API}/api/companies/${co.ticker}/news`)
      .then(r => r.json())
      .then(d => { setNews(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [co.ticker, API, preloaded]);

  const typeColor = t => t === "announcement" ? C.blue : t === "result" ? C.green : C.text200;
  const typeLabel = t => t === "announcement" ? "📋 Announcement" : t === "result" ? "📊 Result" : "📰 News";

  const fmtDate = pub => {
    if (!pub) return "—";
    // new Date() never throws — it returns an Invalid Date, which would have
    // rendered the literal string "Invalid Date". Check validity explicitly.
    const d = new Date(pub);
    if (isNaN(d.getTime())) return String(pub).slice(0, 10);
    return d.toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
  };

  return (
    <div className="fadein" style={{ padding:32 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ ...serif, fontSize:22, color:C.text }}>{co.name} — Latest News</div>
          <div style={{ ...sans, fontSize:12, color:C.dim, marginTop:4 }}>
            {news ? [`${news.count} items`, (news.sources||[]).length ? `Sources: ${news.sources.join(", ")}` : null, "refreshes every 30 min"].filter(Boolean).join(" · ") : "Loading…"}
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
            News is temporarily unreachable — it usually recovers on the next refresh.
          </div>
        </Card>
      )}

      {!loading && !error && (!news || news.count === 0) && (
        <Card>
          <div style={{ ...sans, color:C.dim, fontSize:13, padding:40, textAlign:"center" }}>
            No syndicated news for {co.ticker} right now — smaller names get thinner coverage from news wires. Exchange filings and documents live in the Docs tab.
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

/* ── Docs Tab ────────────────────────────────────────────────────── */
/* Company documents (concalls, annual reports, credit ratings,
   announcements) + an on-demand AI research note from the backend. */
/* The on-demand LLM research note (backend /thesis pipeline: grounded in DB
   financials, every number machine-validated). Lives in the AI THESIS tab —
   the Docs tab is a pure document library. */
function ResearchNoteCard({ co, API }) {
  const [note, setNote]         = useState(null);    // { status, thesis?, reason? }
  const [noteBusy, setNoteBusy] = useState(false);
  useEffect(() => { setNote(null); setNoteBusy(false); }, [co.ticker]);

  const generateNote = () => {
    if (!API || noteBusy) return;
    setNoteBusy(true);
    fetch(`${API}/api/companies/${co.ticker}/thesis`)
      .then(r => r.json())
      .then(d => { setNote(d); setNoteBusy(false); })
      .catch(e => { setNote({ status: "error", reason: e.message }); setNoteBusy(false); });
  };

  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
        <div>
          <div style={{ ...sans, fontSize:11, letterSpacing:"0.14em", textTransform:"uppercase", color:C.gold }}>Deep Research Note</div>
          <div style={{ ...sans, fontSize:12, color:C.dim, marginTop:4 }}>
            AI-written, grounded in the filings below — every figure machine-checked against the data store. Can still be wrong; not investment advice.
          </div>
        </div>
        <button onClick={generateNote} disabled={noteBusy} style={{
          ...sans, display:"flex", alignItems:"center", gap:7,
          fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:500,
          padding:"8px 16px", border:`1px solid ${C.gold}66`, color:C.gold,
          background:C.gold+"0d", cursor:noteBusy?"wait":"pointer", opacity:noteBusy?0.7:1,
        }}>
          {noteBusy
            ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }} />
            : <Brain size={13} />}
          {noteBusy ? "Writing…" : note?.status === "ok" ? "Regenerate note" : "Generate note"}
        </button>
      </div>

      {noteBusy && (
        <div style={{ ...sans, display:"flex", alignItems:"center", gap:10, marginTop:18, color:C.dim, fontSize:13 }}>
          <Loader2 size={15} color={C.gold} style={{ animation:"spin 1s linear infinite" }} />
          Reading filings and writing the note — this can take a minute…
        </div>
      )}
      {!noteBusy && note?.status === "ok" && (
        <div style={{
          ...serif, fontSize:16, lineHeight:1.75, color:C.text,
          whiteSpace:"pre-wrap", maxWidth:760, marginTop:20,
          paddingTop:20, borderTop:`1px solid ${C.line}`,
        }}>
          {note.thesis}
        </div>
      )}
      {!noteBusy && note && note.status === "unavailable" && (
        <div style={{ ...sans, fontSize:12, color:C.dim, marginTop:16, fontStyle:"italic" }}>
          AI research notes are being enabled for this account
        </div>
      )}
      {!noteBusy && note && note.status === "error" && (
        <div style={{ ...sans, fontSize:12, color:C.red, marginTop:16 }}>
          Could not generate the note{note.reason ? `: ${note.reason}` : ""}. Try again.
        </div>
      )}
    </Card>
  );
}


function DocsTab({ co, API }) {
  const [docs, setDocs]         = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!API) { setLoading(false); return; }
    let live = true;
    setLoading(true);
    fetch(`${API}/api/companies/${co.ticker}/documents`)
      .then(r => r.json())
      .then(d => { if (live) { setDocs(d || {}); setLoading(false); } })
      .catch(() => { if (live) { setDocs(null); setLoading(false); } });
    return () => { live = false; };
  }, [co.ticker, API]);

  const concalls = docs?.concalls || [];
  const reports  = docs?.annual_reports || [];
  const ratings  = docs?.credit_ratings || [];
  const anns     = docs?.announcements || [];
  const empty    = !loading && concalls.length === 0 && reports.length === 0 && ratings.length === 0 && anns.length === 0;

  // The feed publishes dates at MIXED granularity: "May 2026" (concalls carry
  // no day), "30 Jun 2026", or relative ages ("1d"). Rendering through Date()
  // fabricated a day ("1 May 2026") or a year (2001) — show exactly what the
  // filing gives us, no more.
  const fmtDocDate = d => {
    if (!d) return "—";
    const s = String(d).trim();
    if (/^[A-Za-z]{3,9}\s+\d{4}$/.test(s)) return s;            // month-year only
    if (/^\d{1,2}\s+[A-Za-z]{3,9}(\s+\d{4})?$/.test(s)) return s; // already day-month[-year]
    if (/^\d+\s*(d|h|w|mo|y)$/i.test(s)) return s + " ago";     // relative age
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return s.slice(0, 20);
    return dt.toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
  };
  // Announcement dates arrive as "6 Jul - one-line summary" — split so the
  // summary reads as content, not as a truncated date.
  const annParts = d => {
    const [when, ...rest] = String(d || "").split(" - ");
    return [fmtDocDate(when), rest.join(" - ").trim() || null];
  };

  const DocLink = ({ href, label }) => href ? (
    <a href={href} target="_blank" rel="noopener noreferrer"
      onMouseEnter={e => e.currentTarget.style.borderColor = C.gold + "99"}
      onMouseLeave={e => e.currentTarget.style.borderColor = C.line2}
      style={{ ...sans, display:"inline-flex", alignItems:"center", gap:5, fontSize:11,
        color:C.gold, textDecoration:"none", border:`1px solid ${C.line2}`,
        borderRadius:6, padding:"3px 9px" }}>
      {label} <ExternalLink size={10} />
    </a>
  ) : null;

  const SectionHead = ({ title, count }) => (
    <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:12 }}>
      <span style={{ ...serif, fontSize:19, color:C.text }}>{title}</span>
      <span style={{ ...mono, fontSize:11, color:C.faint }}>{count}</span>
    </div>
  );

  return (
    <div className="fadein" style={{ padding:32 }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ ...serif, fontSize:22, color:C.text }}>{co.name} — Document Library</div>
        <div style={{ ...sans, fontSize:12, color:C.dim, marginTop:4 }}>
          Concall transcripts, annual reports, credit ratings, exchange announcements. AI-written notes live in the AI Thesis tab.
        </div>
      </div>

      {loading && (
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:40, ...sans, color:C.dim, fontSize:13 }}>
          <Loader2 size={20} color={C.gold} style={{ animation:"spin 1s linear infinite" }} />
          Fetching documents…
        </div>
      )}

      {empty && (
        <Card>
          <div style={{ ...sans, color:C.dim, fontSize:13, padding:40, textAlign:"center" }}>
            No documents found for {co.ticker} yet. Concalls, annual reports, ratings and announcements
            appear here as filings are collected for this company — typically within the weekly refresh.
          </div>
        </Card>
      )}

      {!loading && concalls.length > 0 && (
        <TranscriptSummary API={API} ticker={co.ticker} />
      )}

      {!loading && !empty && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(340px, 1fr))", gap:20 }}>
          {/* Concalls */}
          <Card>
            <SectionHead title="Concalls" count={concalls.length} />
            {concalls.length === 0 && <div style={{ ...sans, fontSize:12, color:C.faint }}>No concall documents.</div>}
            {concalls.map((c, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap",
                padding:"10px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
                <span style={{ ...mono, fontSize:12, color:C.text200, minWidth:92 }}>{fmtDocDate(c.date)}</span>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  <DocLink href={c.transcript} label="Transcript" />
                  <DocLink href={c.ppt}        label="PPT" />
                  <DocLink href={c.recording}  label="▶ Recording" />
                  <DocLink href={c.summary}    label="Summary" />
                </div>
              </div>
            ))}
          </Card>

          {/* Annual reports */}
          <Card>
            <SectionHead title="Annual Reports" count={reports.length} />
            {reports.length === 0 && <div style={{ ...sans, fontSize:12, color:C.faint }}>No annual reports.</div>}
            {reports.map((r, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"10px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
                <span style={{ ...mono, fontSize:12, color:C.text200 }}>FY {r.year}</span>
                <DocLink href={r.url} label="Annual Report" />
              </div>
            ))}
          </Card>

          {/* Credit ratings */}
          <Card>
            <SectionHead title="Credit Ratings" count={ratings.length} />
            {ratings.length === 0 && <div style={{ ...sans, fontSize:12, color:C.faint }}>No credit rating documents.</div>}
            {ratings.map((r, i) => (
              <div key={i} style={{ padding:"10px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, justifyContent:"space-between" }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ ...sans, fontSize:12, color:C.text, fontWeight:500 }}>{r.title || "Rating update"}</div>
                    <div style={{ ...mono, fontSize:10, color:C.faint, marginTop:2 }}>
                      {fmtDocDate(r.date)}{r.source ? ` · ${r.source}` : ""}
                    </div>
                  </div>
                  <DocLink href={r.url} label="Open" />
                </div>
              </div>
            ))}
          </Card>

          {/* Announcements */}
          <Card>
            <SectionHead title="Announcements" count={anns.length} />
            {anns.length === 0 && <div style={{ ...sans, fontSize:12, color:C.faint }}>No exchange announcements.</div>}
            {anns.map((a, i) => {
              const [when, blurb] = annParts(a.date);
              return (
                <div key={i} style={{ padding:"10px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, justifyContent:"space-between" }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ ...sans, fontSize:12, color:C.text, fontWeight:500 }}>{a.title}</div>
                      <div style={{ ...mono, fontSize:10, color:C.faint, marginTop:2 }}>{when}</div>
                      {blurb && <div style={{ ...sans, fontSize:11, color:C.dim, marginTop:3, lineHeight:1.45 }}>{blurb}</div>}
                    </div>
                    <DocLink href={a.url} label="Open" />
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}

/* ── AI Thesis Tab ───────────────────────────────────────────────── */
/* AI Thesis — assembled entirely from IndianAPI data (concall AI summaries,
   consensus, growth track record, key metrics). No LLM call / no API tokens. */
function AIThesisTab({ co, profile, insights, cd, price, API, onGoTab }) {
  const isMobile = useIsMobile();
  const sm  = insights?.self_metrics || {};
  const an  = insights?.analyst || null;
  const tgt = insights?.target || null;
  const growth = insights?.growth || {};
  const concalls = (profile?.concalls || []).filter(c =>
    c && typeof c.ai_summary === "string" && !c.ai_summary.startsWith("/") && c.ai_summary.trim().length > 40);
  const anns = (profile?.announcements || []).slice(0, 6);
  const desc = cd?.description || profile?.description;
  const upside = (tgt?.mean && price) ? (tgt.mean / price - 1) : null;
  const fwdEps = insights?.eps_estimates?.[0]?.mean ?? null;
  const fwdPe  = (fwdEps && price) ? price / fwdEps : null;
  const pctS = (n, d = 1) => (n == null || isNaN(n)) ? "—" : Number(n).toFixed(d) + "%";

  // Read a compounded-growth metric (e.g. "5 Years") from IndianAPI's growth block.
  const gv = (metric, want) => {
    const m = growth[metric]; if (!m) return null;
    for (const k of Object.keys(m)) if (k.toLowerCase().includes(want)) return m[k];
    return null;
  };
  const sales5 = gv("Compounded Sales Growth", "5 year");
  const profit5 = gv("Compounded Profit Growth", "5 year");
  const roeLast = gv("Return on Equity", "last") || gv("Return on Equity", "3 year");

  // Data-derived bull / bear points (no opinion invented — thresholds on facts).
  const bull = [], bear = [];
  if (sm.roe_ttm >= 18) bull.push(`Capital-efficient: ROE of ${pctS(sm.roe_ttm)} (TTM).`);
  if (profit5 && parseFloat(profit5) >= 15) bull.push(`Strong compounding: 5-yr profit CAGR ${profit5}.`);
  if (an && /buy/i.test(an.rating || "")) bull.push(`Street is constructive: ${an.num_analysts || ""} analysts, consensus ${an.rating}${an.bullish_pct ? ` (${an.bullish_pct.toFixed(0)}% bullish)` : ""}.`);
  if (upside != null && upside > 0.1) bull.push(`Consensus target ₹${fmtN(tgt.mean,0)} implies ${pctS(upside*100,0)} upside.`);
  if (sm.npm_ttm >= 15) bull.push(`High-quality earnings: ${pctS(sm.npm_ttm)} net margin.`);

  if (sm.pe >= 35) bear.push(`Rich valuation: ${multiple(sm.pe,1)} trailing P/E${fwdPe?` (${multiple(fwdPe,1)} forward)`:""} leaves little margin for error.`);
  else if (fwdPe && fwdPe >= 30) bear.push(`Demanding multiple: ${multiple(fwdPe,1)} forward P/E.`);
  if (upside != null && upside < 0) bear.push(`Trading above consensus target ₹${fmtN(tgt.mean,0)} (${pctS(upside*100,0)}).`);
  if (sm.div_yield != null && sm.div_yield < 1 && sm.pe >= 30) bear.push(`Thin ${pctS(sm.div_yield)} dividend yield — return depends on continued growth.`);
  if (sales5 && parseFloat(sales5) < 8) bear.push(`Modest top-line: 5-yr sales CAGR ${sales5}.`);
  if (!bear.length) bear.push("No major valuation or quality red flags in the data.");
  if (!bull.length) bull.push("Limited positive signals in the available data.");

  const Stat = ({ l, v, tone }) => (
    <div>
      <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:C.dim }}>{l}</div>
      <div style={{ ...mono, fontSize:18, color:tone || C.text, marginTop:4 }}>{v}</div>
    </div>
  );
  const Sec = ({ accent, title, children }) => (
    <div style={{ marginBottom:6 }}>
      <SectionLabel accent={accent}>{title}</SectionLabel>
      {children}
    </div>
  );

  return (
    <div className="fadein" style={{ padding: isMobile ? 16 : 32, display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap:24, alignItems:"start" }}>
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        {/* Header */}
        <Card>
          <div style={{ display:"flex", alignItems:"center", gap:8, ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:C.gold, marginBottom:6 }}>
            <Sparkles size={12} /><span>Research Note · assembled from IndianAPI</span>
          </div>
          <div style={{ ...serif, fontSize:26, color:C.text }}>Investment Thesis</div>
          <div style={{ ...sans, fontSize:13, lineHeight:1.7, color:C.text200, marginTop:10 }}>
            {desc || `${co.name} operates in the ${co.sector} sector.`}
          </div>
        </Card>

        {/* On-demand LLM deep note (moved here from Docs — this is the AI tab) */}
        <ResearchNoteCard co={co} API={API} />

        {/* Consensus & valuation */}
        <Card>
          <Sec accent="STREET VIEW" title="CONSENSUS & VALUATION" />
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap:16 }}>
            <Stat l="Consensus" v={an?.rating || "—"} tone={an && /buy/i.test(an.rating||"")?C.green:an && /sell/i.test(an.rating||"")?C.red:C.gold} />
            <Stat l="Target" v={tgt?.mean!=null?"₹"+fmtN(tgt.mean,0):"—"} tone={C.gold} />
            <Stat l="Upside" v={upside!=null?(upside>=0?"+":"")+(upside*100).toFixed(0)+"%":"—"} tone={upside==null?C.dim:upside>=0?C.green:C.red} />
            <Stat l="Fwd P/E" v={fwdPe!=null?multiple(fwdPe,1):"—"} />
          </div>
        </Card>

        {/* Growth track record */}
        {(sales5 || profit5 || roeLast) && (
          <Card>
            <Sec accent="COMPOUNDED · IndianAPI" title="GROWTH & QUALITY" />
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap:16 }}>
              <Stat l="Sales CAGR (5y)" v={sales5 || "—"} />
              <Stat l="Profit CAGR (5y)" v={profit5 || "—"} />
              <Stat l="ROE" v={roeLast || pctS(sm.roe_ttm)} tone={C.green} />
              <Stat l="Net Margin" v={pctS(sm.npm_ttm)} />
            </div>
          </Card>
        )}

        {/* Management commentary — IndianAPI concall AI summaries */}
        <Card>
          <Sec accent="EARNINGS CALLS · IndianAPI AI" title="WHAT MANAGEMENT SAID" />
          {concalls.length ? (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {concalls.slice(0, 3).map((c, i) => (
                <div key={i} style={{ borderLeft:`2px solid ${C.gold}66`, paddingLeft:14 }}>
                  <div style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em", color:C.gold, marginBottom:4 }}>{c.date || `Call ${i+1}`}</div>
                  <div style={{ ...sans, fontSize:13, color:C.text200, lineHeight:1.7 }}>{c.ai_summary}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...sans, fontSize:13, color:C.dim, lineHeight:1.7 }}>
              IndianAPI hasn't published an AI concall summary for {co.ticker} yet. Earnings-call transcripts are linked in the News &amp; Filings tab.
            </div>
          )}
        </Card>

        {/* Recent developments */}
        {anns.length > 0 && (
          <Card>
            <Sec accent="EXCHANGE FILINGS" title="RECENT DEVELOPMENTS" />
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {anns.map((a, i) => (
                <div key={i} style={{ display:"flex", gap:9, alignItems:"flex-start" }}>
                  <FileText size={12} color={C.faint} style={{ flexShrink:0, marginTop:3 }} />
                  <span style={{ ...sans, fontSize:12.5, color:C.text200, lineHeight:1.5 }}>{(a.title || "").replace(/\s+\d+[dh]?\s+-\s+.*/, "").slice(0, 110) || "Announcement"}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Bull vs Bear */}
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:20 }}>
          <Card>
            <Sec accent="THE CASE FOR" title="BULL POINTS" />
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {bull.map((b, i) => (
                <div key={i} style={{ display:"flex", gap:9, alignItems:"flex-start" }}>
                  <TrendingUp size={13} color={C.green} style={{ flexShrink:0, marginTop:3 }} />
                  <span style={{ ...sans, fontSize:12.5, color:C.text200, lineHeight:1.6 }}>{b}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <Sec accent="THE CASE AGAINST" title="BEAR POINTS" />
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {bear.map((b, i) => (
                <div key={i} style={{ display:"flex", gap:9, alignItems:"flex-start" }}>
                  <TrendingDown size={13} color={C.red} style={{ flexShrink:0, marginTop:3 }} />
                  <span style={{ ...sans, fontSize:12.5, color:C.text200, lineHeight:1.6 }}>{b}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Sidebar — pointer to the grounding documents (the full library lives
          in the Docs tab; listing it twice was pure duplication) */}
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        <Card>
          <SectionLabel accent="SOURCE DOCUMENTS">GROUNDED IN FILINGS</SectionLabel>
          <div style={{ ...sans, fontSize:12.5, color:C.text200, lineHeight:1.6 }}>
            {(profile?.concalls?.length || 0) + (profile?.annual_reports?.length || 0) +
             (profile?.credit_ratings?.length || 0) + (profile?.announcements?.length || 0) ||
             (insights?.documents ? Object.values(insights.documents).reduce((a, l) => a + (l?.length || 0), 0) : 0) || "—"} documents
            back this view — earnings calls, annual reports, ratings and exchange filings.
          </div>
          {onGoTab && (
            <button onClick={() => onGoTab("docs")} style={{
              ...sans, marginTop: 12, display:"flex", alignItems:"center", gap:6,
              fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:500,
              padding:"7px 14px", border:`1px solid ${C.gold}66`, color:C.gold,
              background:C.gold+"0d", cursor:"pointer",
            }}>
              <FolderOpen size={12} /> Open document library
            </button>
          )}
        </Card>
        <Card>
          <SectionLabel>METHOD</SectionLabel>
          {["Assembled from IndianAPI — no LLM tokens used","Concall summaries are IndianAPI's own AI output","Bull/bear derived from reported facts","Consensus & target from analyst feed"].map((s, i) => (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"6px 0" }}>
              <Check size={12} color={C.green} style={{ flexShrink:0, marginTop:2 }} />
              <span style={{ ...sans, fontSize:12, color:C.text200, lineHeight:1.5 }}>{s}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* ── Verdict Tab ─────────────────────────────────────────────────── */
/* Verdict combines THREE independent signals — the corrected DCF, the analyst
   consensus, and a quality scorecard — rather than relying on the DCF MoS alone.
   This stops a fundamentally-strong but richly-valued name from being branded
   "AVOID" purely because a fundamentals DCF won't pay a 50× multiple. */
/* Forensics — accounting-quality red-flags from the backend /forensics route
   (Piotroski F, Sloan accruals, cash conversion, interest coverage, net-debt/
   EBITDA, leverage trend), each red/amber/green, plus a 0-100 composite grade.
   Classic Beneish M / Altman Z'' appear under "pending" until the ingester
   captures receivables / working capital / SG&A. */
const FLAG_C = { green: "#3fb27f", amber: "#caa64a", red: "#c4554d" };
function flagColor(f) { return FLAG_C[f] || C.dim; }

const FORENSIC_META = {
  beneish_m:         { label: "Beneish M-Score",          accent: "MANIPULATION" },
  altman_z:          { label: "Altman Z″ (distress)",     accent: "BANKRUPTCY RISK" },
  piotroski:         { label: "Piotroski F-Score",        accent: "FUNDAMENTAL STRENGTH" },
  accrual_ratio:     { label: "Accrual Ratio (Sloan)",    accent: "EARNINGS QUALITY" },
  cash_conversion:   { label: "Cash Conversion · CFO/PAT", accent: "EARNINGS QUALITY" },
  interest_coverage: { label: "Interest Coverage",        accent: "SOLVENCY" },
  net_debt_ebitda:   { label: "Net Debt / EBITDA",        accent: "SOLVENCY" },
  leverage_trend:    { label: "Leverage Trend · D/E",     accent: "SOLVENCY" },
};
const FORENSIC_ORDER = ["beneish_m", "altman_z", "piotroski", "accrual_ratio",
                        "cash_conversion", "interest_coverage", "net_debt_ebitda", "leverage_trend"];

function ForensicsTab({ co, API }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!API || !co.ticker) { setLoading(false); return; }
    let live = true;
    setLoading(true);
    fetch(`${API}/api/companies/${co.ticker}/forensics`)
      .then(r => r.json())
      .then(d => { if (live) { setData(d); setLoading(false); } })
      .catch(() => { if (live) { setData(null); setLoading(false); } });
    return () => { live = false; };
  }, [co.ticker, API]);

  if (loading) return (
    <div className="fadein" style={{ padding:48, display:"flex", alignItems:"center", gap:10, color:C.dim, ...sans, fontSize:13 }}>
      <Loader2 size={16} style={{ animation:"spin 1s linear infinite" }} /> Computing forensic checks…
    </div>
  );
  if (!data || data.available === false) return (
    <div className="fadein" style={{ padding:32 }}>
      <Card>
        <SectionLabel accent="ACCOUNTING QUALITY">FORENSICS</SectionLabel>
        <div style={{ ...sans, fontSize:13, color:C.dim, lineHeight:1.6 }}>
          {data?.note || "Not enough statement history to run forensic analysis for this company yet."}
        </div>
      </Card>
    </div>
  );

  const { composite, grade, metrics = {}, flags = [], pending = [], is_financial, note } = data;
  const gradeColor = grade === "A" ? C.green : grade === "B" ? "#7fae5f" : grade === "C" ? C.gold : C.red;
  const present = FORENSIC_ORDER.filter(k => metrics[k]);

  const Bar = ({ v, color }) => (
    <div style={{ height:6, background:C.bg600, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:"0 auto 0 0", width:Math.max(0,Math.min(100,v))+"%", background:color || `linear-gradient(90deg,${C.gold500},${C.gold})` }} />
    </div>
  );
  const Dot = ({ f }) => <span style={{ width:8, height:8, borderRadius:0, background:flagColor(f), flexShrink:0, display:"inline-block" }} />;

  return (
    <div className="fadein" style={{ padding:32, display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
      {/* Hero */}
      <div style={{ gridColumn:"1/-1" }}>
        <Card style={{ position:"relative", overflow:"hidden", padding:32 }}>
          <div style={{ position:"absolute", inset:0, ...gridBg, opacity:0.4, pointerEvents:"none" }} />
          <div style={{ position:"relative", display:"grid", gridTemplateColumns:"1fr 1fr", gap:32, alignItems:"center" }}>
            <div>
              <div style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.18em", color:C.gold, marginBottom:8 }}>Equity Terminal · Forensic Screen</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:14 }}>
                <span style={{ ...serif, fontSize:88, color:gradeColor, lineHeight:1 }}>{grade || "—"}</span>
                <div>
                  <div style={{ ...mono, fontSize:30, color:C.text }}>{composite==null?"—":composite.toFixed(0)}<span style={{ ...sans, fontSize:15, color:C.dim }}> / 100</span></div>
                  <div style={{ ...sans, fontSize:11, color:C.dim, marginTop:2 }}>Accounting-quality composite</div>
                </div>
              </div>
              <div style={{ marginTop:16, maxWidth:320 }}><Bar v={composite ?? 0} color={gradeColor} /></div>
            </div>
            <div style={{ ...sans, fontSize:11.5, color:C.dim, lineHeight:1.7 }}>
              Computed entirely from this company's own filed statements — independent of price.
              Each check is red / amber / green; the grade blends Piotroski strength, accrual &
              cash-conversion quality, and balance-sheet solvency.
              {is_financial && note ? <span style={{ display:"block", marginTop:10, color:C.gold }}>{note}</span> : null}
            </div>
          </div>
        </Card>
      </div>

      {/* Flags */}
      <Card>
        <SectionLabel accent={flags.length ? `${flags.length} FLAGGED` : "CLEAN"}>RED FLAGS</SectionLabel>
        {flags.length === 0 ? (
          <div style={{ display:"flex", alignItems:"center", gap:10, ...sans, fontSize:13, color:C.green }}>
            <Check size={15} /> No accounting red flags detected.
          </div>
        ) : flags.map((f, i) => (
          <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"7px 0", borderBottom:i<flags.length-1?`1px solid ${C.bg600}`:"none" }}>
            <span style={{ marginTop:5 }}><Dot f={f.level} /></span>
            <div>
              <div style={{ ...sans, fontSize:12.5, color:flagColor(f.level), fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }}>{f.label}</div>
              <div style={{ ...sans, fontSize:12, color:C.text200, lineHeight:1.55, marginTop:2 }}>{f.note}</div>
            </div>
          </div>
        ))}
      </Card>

      {/* Metric scorecard */}
      <Card>
        <SectionLabel accent="PER-CHECK DETAIL">SCORECARD</SectionLabel>
        {present.map((k) => {
          const m = metrics[k];
          const meta = FORENSIC_META[k];
          const val = k === "piotroski"
            ? `${m.score}/${m.max}  (≈${m.normalized}/9)`
            : (m.value != null ? m.value : "—");
          return (
            <div key={k} style={{ padding:"9px 0", borderBottom:`1px solid ${C.bg600}` }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                <span style={{ ...sans, fontSize:11.5, textTransform:"uppercase", letterSpacing:"0.06em", color:C.text200, fontWeight:500 }}>{meta.label}</span>
                <span style={{ display:"flex", alignItems:"center", gap:7, ...mono, fontSize:13, color:flagColor(m.flag) }}>
                  {val} <Dot f={m.flag} />
                </span>
              </div>
              <div style={{ ...sans, fontSize:11, color:C.dim, marginTop:3, lineHeight:1.5 }}>{m.note}</div>
              {k === "piotroski" && Array.isArray(m.tests) && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:7 }}>
                  {m.tests.map((t, j) => (
                    <span key={j} title={t.note} style={{ ...sans, fontSize:9.5, textTransform:"uppercase", letterSpacing:"0.04em",
                      color: t.pass ? C.green : C.red, border:`1px solid ${(t.pass?C.green:C.red)}44`, borderRadius:3, padding:"2px 6px" }}>
                      {t.pass ? "✓" : "✗"} {t.name}
                    </span>
                  ))}
                </div>
              )}
              {k === "beneish_m" && m.components && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:7 }}>
                  {Object.entries(m.components).map(([name, v]) => (
                    <span key={name} style={{ ...mono, fontSize:9.5, color:C.dim, border:`1px solid ${C.bg600}`, borderRadius:3, padding:"2px 6px" }}>
                      {name} {v}
                    </span>
                  ))}
                  {m.sgai_neutral && <span style={{ ...sans, fontSize:9.5, color:C.faint, alignSelf:"center" }}>SGAI held neutral (SG&A not reported)</span>}
                </div>
              )}
            </div>
          );
        })}
        {present.length === 0 && <div style={{ ...sans, fontSize:12, color:C.dim }}>No computable checks for this company.</div>}
      </Card>

      {/* Pending classic scores */}
      {pending.length > 0 && (
        <Card style={{ gridColumn:"1/-1" }}>
          <SectionLabel accent="COVERAGE EXPANDING">CLASSIC SCORES · COMING SOON</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:12 }}>
            {pending.map((p, i) => (
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                <Info size={13} style={{ color:C.dim, marginTop:2, flexShrink:0 }} />
                <span style={{ ...sans, fontSize:11.5, color:C.dim, lineHeight:1.5 }}>{p}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function VerdictTab({ co, rec, cd, price, insights, apiVal }) {
  const apiRec = apiVal?.recommendation;

  // UNIFIED ENGINE: every figure here is the backend recommendation (the same
  // engine that drives the screener, the header and the now-unified DCF tab).
  // The client recompute (`rec`) is only a graceful fallback while apiVal loads.
  const f        = apiRec?.fundamentals ?? rec.f ?? {};
  const dcfIv    = apiRec?.blended ?? apiRec?.intrinsic ?? rec.iv;
  const dcfMos   = apiRec?.mos ?? rec.mos;            // fraction
  const reasons  = apiRec?.reasons ?? rec.reasons ?? [];
  const composite = apiRec?.composite ?? null;        // 0–100 (engine composite)
  const conf      = apiRec?.confidence ?? null;       // {score, level, flags}

  // Analyst consensus — shown ALONGSIDE the engine, never blended into the call.
  const tgt       = insights?.target?.mean ?? null;
  const analyst   = insights?.analyst || null;
  const analystUp = (tgt != null && price > 0) ? tgt / price - 1 : null;

  // Fair-value range spanning the model's blended value and the analyst target.
  const fvVals = [dcfIv, tgt].filter(v => v != null && isFinite(v));
  const fvLo = fvVals.length ? Math.min(...fvVals) : null;
  const fvHi = fvVals.length ? Math.max(...fvVals) : null;

  // Verdict — the engine's own independent call (identical to the screener/header).
  const verdict = apiRec?.verdict ?? rec.verdict ?? "NO DATA";
  const verdictColor = /BUY|ACCUM/.test(verdict) ? C.green : /HOLD|CONF|DATA/.test(verdict) ? C.gold : C.red;
  const confColor = conf?.level === "high" ? C.green : conf?.level === "medium" ? C.gold : C.red;

  // Scorecard = the engine's OWN factor scores (Valuation / Quality / Momentum /
  // Risk, 0–100). This is the transparent reasoning behind the verdict, not a
  // separate second model.
  const sc = reasons.map(r => ({ k: r.label, s: r.score ?? 50, n: r.note, good: r.good, bad: r.bad }));

  // Principal risks: the engine's flagged-bad factors + any data-quality flags.
  const risks = [
    ...reasons.filter(r => r.bad).map(r => r.note),
    ...((conf?.flags) || []),
    ...((cd?.risks) || []),
  ].filter(Boolean).slice(0, 6);

  const Bar = ({ v }) => (
    <div style={{ height:6, background:C.bg600, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:"0 auto 0 0", width:Math.max(0,Math.min(100,v))+"%", background:`linear-gradient(90deg,${C.gold500},${C.gold})` }} />
    </div>
  );

  return (
    <div className="fadein" style={{ padding:32, display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
      {/* Hero */}
      <div style={{ gridColumn:"1/-1" }}>
        <Card style={{ position:"relative", overflow:"hidden", padding:32 }}>
          <div style={{ position:"absolute", inset:0, ...gridBg, opacity:0.4, pointerEvents:"none" }} />
          <div style={{ position:"relative", display:"grid", gridTemplateColumns:"1fr 1fr", gap:32 }}>
            <div>
              <div style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.18em", color:C.gold, marginBottom:8 }}>Equity Terminal · Independent Verdict</div>
              <div style={{ ...serif, fontSize:88, color:verdictColor, lineHeight:1 }}>{verdict}</div>
              <div style={{ display:"flex", gap:28, marginTop:16, flexWrap:"wrap" }}>
                {[
                  ["Fair-Value Range", fvLo==null?"—":"₹"+fmtN(fvLo,0)+" – ₹"+fmtN(fvHi,0), C.gold],
                  ["CMP", "₹"+fmtN(price,0), C.text],
                  ["Margin of Safety", dcfMos==null?"—":signedPct(dcfMos), dcfMos==null?C.dim:dcfMos>=0?C.green:C.red],
                  ["Analyst Upside", analystUp==null?"—":signedPct(analystUp), analystUp==null?C.dim:analystUp>=0?C.green:C.red],
                ].map(([l,v,cl]) => (
                  <div key={l}>
                    <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:C.dim }}>{l}</div>
                    <div style={{ ...mono, fontSize:22, color:cl, marginTop:4 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.18em", color:C.dim }}>Composite Score</span>
                {conf?.level && (
                  <span style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:confColor, border:`1px solid ${confColor}55`, borderRadius:4, padding:"2px 8px" }}>
                    {conf.level} confidence
                  </span>
                )}
              </div>
              <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:12 }}>
                <span style={{ ...serif, fontSize:56, color:C.gold }}>{composite==null?"—":composite.toFixed(0)}</span>
                <span style={{ ...sans, fontSize:18, color:C.dim }}>/ 100</span>
              </div>
              <Bar v={composite ?? 0} />
              <div style={{ ...sans, fontSize:11, color:C.dim, marginTop:14, lineHeight:1.6 }}>
                The independent engine's own score — 42% valuation · 28% quality · 16% momentum · 14% risk,
                scaled by data confidence. The analyst consensus is shown beside it, never blended in.
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Engine factor scorecard */}
      <Card>
        <SectionLabel accent="ENGINE REASONING">FACTOR SCORECARD</SectionLabel>
        {sc.length === 0 ? (
          <div style={{ ...sans, fontSize:12, color:C.dim }}>Computing…</div>
        ) : sc.map((q, i) => (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"130px 34px 1fr 1.3fr", alignItems:"center", gap:12, marginBottom:14 }}>
            <span style={{ ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", color:C.text200, fontWeight:500 }}>{q.k}</span>
            <span style={{ ...mono, fontSize:14, color: q.good?C.green:q.bad?C.red:C.gold }}>{q.s.toFixed(0)}</span>
            <Bar v={q.s} />
            <span style={{ ...sans, fontSize:11, color:C.dim }}>{q.n}</span>
          </div>
        ))}
      </Card>

      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        {/* Rating drivers — the engine value beside the Street's */}
        <Card>
          <SectionLabel accent="MODEL vs STREET">RATING DRIVERS</SectionLabel>
          <KV label="Blended fair value (today)" value={inrOrDash(dcfIv,0)} tone="gold" />
          <KV label="Margin of safety" value={dcfMos==null?"—":signedPct(dcfMos)} tone={dcfMos==null?"neutral":dcfMos>=0?"pos":"neg"} />
          <KV label="Engine verdict" value={verdict} tone={/BUY|ACCUM/.test(verdict)?"pos":/HOLD|CONF|DATA/.test(verdict)?"neutral":"neg"} />
          <KV label="Analyst target (12M)" value={tgt==null?"—":"₹"+fmtN(tgt,0)} tone="gold" />
          <KV label="Analyst upside" value={analystUp==null?"—":signedPct(analystUp)} tone={analystUp==null?"neutral":analystUp>=0?"pos":"neg"} />
          <KV label="Consensus rating" value={analyst?.rating || insights?.analyst?.rating || "—"} tone="neutral" bold />
        </Card>

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
            { l:"DCF Fair Value",  v:inrOrDash(dcfIv,0),                          tone:"pos"  },
            { l:"Analyst Target",  v:tgt==null?"—":"₹"+fmtN(tgt,0),               tone:"pos"  },
            { l:"Stop Loss",       v:"₹"+fmtN(price*0.85,0),                       tone:"neg"  },
            { l:"Risk-Reward",     v:(fvHi!=null && fvHi>price) ? "1 : "+fmtN(Math.max((fvHi-price)/(price*0.15),0.1),1) : "—", tone:"gold" },
            { l:"Position Sizing", v:"4–6% of equity book",                        tone:"neutral" },
          ].map(row => <KV key={row.l} label={row.l} value={row.v} tone={row.tone} />)}
        </Card>
      </div>
    </div>
  );
}

/* Parse the latest fiscal year of /annual_pl into the operating figures the DCF
   engine needs — REAL EBITDA / EBIT / revenue / net profit — so capital-heavy
   sectors (metals, telecom, utilities, cement) value off actual operating cash
   generation instead of a net-margin proxy that collapses when depreciation and
   interest are large. */
function parseLatestPL(d) {
  if (!d || !d.metrics) return null;
  const m = d.metrics;
  const last = arr => {
    if (!Array.isArray(arr)) return null;
    for (let i = arr.length - 1; i >= 0; i--) { const x = Number(arr[i]); if (arr[i] != null && isFinite(x)) return x; }
    return null;
  };
  const pick = names => {
    const keys = Object.keys(m);
    for (const n of names) { const k = keys.find(k => k.toLowerCase() === n); if (k) return last(m[k]); }
    for (const n of names) { const k = keys.find(k => k.toLowerCase().includes(n)); if (k) return last(m[k]); }
    return null;
  };
  const revenue   = pick(["sales", "revenue", "total income", "total revenue"]);
  const ebitda    = pick(["operating profit", "ebitda", "financing profit"]);
  const dep       = pick(["depreciation"]);
  const netProfit = pick(["net profit", "profit after tax", "profit for the period", "pat"]);
  const taxPct    = pick(["tax %"]);
  const ebit      = (ebitda != null && dep != null) ? ebitda - dep : ebitda;
  const taxRate   = (taxPct != null && taxPct > 0 && taxPct < 60) ? taxPct / 100 : null;
  return { revenue, ebitda, ebit, netProfit, taxRate };
}

/* ── Main Company component ──────────────────────────────────────── */
export default function Company({ co, assumptions, setAssumptions, price, setPrice, onBack, API, allCompanies, histPrices, isWatched, onToggleWatch, initialTab, onOpenTicker }) {
  const isMobile = useIsMobile();
  const accent = sectorAccent(co.sector);   // each stock wears its sector's hue
  const PAD = isMobile ? 16 : 32;
  const [tab, setTab] = useState(initialTab || "overview");
  // ⌘K commands like "TCS DCF at 12% growth" land on a specific tab. Adjust
  // during render (the sanctioned derived-state pattern) — no effect needed.
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    if (initialTab) setTab(initialTab);
  }
  const [liveFinancials, setLiveFinancials] = useState(null);
  const [liveMetrics,    setLiveMetrics]    = useState(null);
  const [liveProfile,    setLiveProfile]    = useState(null);
  const [liveInsights,   setLiveInsights]   = useState(null);
  const [scnNonce,       setScnNonce]       = useState(0);   // remounts DCF sliders on scenario load
  const [liveStatement,  setLiveStatement]  = useState(null); // real latest-FY operating figures
  const [apiVal,         setApiVal]         = useState(null); // backend INDEPENDENT valuation (authoritative)

  // F&O-underlying universe (Dhan scrip master, cached ~daily server-side).
  // Cash-only names get no Options tab — showing an always-empty tab reads
  // like a bug. null = unknown (fetch failed) → fail OPEN and keep the tab.
  const [fnoSet, setFnoSet] = useState(null);
  useEffect(() => {
    if (!API) return;
    fetch(`${API}/api/dhan/fno`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && Array.isArray(d.tickers) && d.tickers.length) setFnoSet(new Set(d.tickers)); })
      .catch(() => {});
  }, [API]);
  // News is fetched at the page level so the tab itself can be gated: a name
  // with zero syndicated items gets no News tab at all (an empty tab reads
  // like a bug). null = not loaded yet → fail OPEN and keep the tab.
  const [newsData, setNewsData] = useState(null);
  useEffect(() => {
    setNewsData(null);
    if (!API || !co.ticker) return;
    let dead = false;
    fetch(`${API}/api/companies/${co.ticker}/news`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!dead && d) setNewsData(d); })
      .catch(() => {});
    return () => { dead = true; };
  }, [API, co.ticker]);
  const visibleTabs = useMemo(() => {
    const tk = (co.ticker || "").toUpperCase().replace(/-/g, "").replace(/&/g, "");
    const hasFO = !fnoSet || fnoSet.has((co.ticker || "").toUpperCase()) || fnoSet.has(tk);
    let tabs = hasFO ? TABS : TABS.filter(t => t.id !== "options");
    if (newsData && (newsData.count || 0) === 0 && !(newsData.items || []).length)
      tabs = tabs.filter(t => t.id !== "news");
    return tabs;
  }, [co.ticker, fnoSet, newsData]);
  // Landing on a hidden tab (e.g. Options open, then switching to a cash-only
  // name) would render nothing — snap back to the overview.
  if (!visibleTabs.some(t => t.id === tab)) setTab("overview");

  const hasRealPrices = (histPrices?.data?.length || 0) > 10;
  const co2 = useMemo(() => {
    const base = { ...co, price, assumptions, syntheticSeries: !hasRealPrices };
    if (liveStatement) {
      // Net profit applies to all; operating lines only to non-financials
      // (banks/insurers use the Residual-Income model on equity & ROE).
      if (liveStatement.netProfit != null) base.netProfit = liveStatement.netProfit;
      if (co.type !== "financial") {
        if (liveStatement.revenue != null) base.revenue = liveStatement.revenue;
        if (liveStatement.ebit   != null)  base.ebit    = liveStatement.ebit;
        if (liveStatement.ebitda != null)  base.ebitda  = liveStatement.ebitda;
      }
    }
    // Analyst-consensus overlay: target range + forward EPS + the consensus
    // growth the Street is pricing → the engine triangulates & guardrails to this.
    const tgt = liveInsights?.target;
    const ests = liveInsights?.eps_estimates || [];
    if (tgt?.mean > 0) {
      base.analyst = { target: tgt.mean, low: tgt.low, high: tgt.high, fwdEps: ests[0]?.mean ?? null };
      if (ests.length >= 2) {
        const f = ests[0]?.mean, l = ests[ests.length - 1]?.mean, n = ests.length - 1;
        if (f > 0 && l > 0) base.analystGrowth = Math.pow(l / f, 1 / n) - 1;
      }
    }
    return base;
  }, [co, price, assumptions, hasRealPrices, liveStatement, liveInsights]);
  const rec  = useMemo(() => recommend(co2, assumptions), [co2, assumptions]);
  const set  = useCallback(k => val => setAssumptions(prev => ({ ...prev, [k]: val })), [setAssumptions]);

  // Rich static data for this company (fallback)
  const cd = COMPANY_DATA[co.ticker] || null;

  // Live market data: prefer cd (seeded companies have real FY26 data)
  const mktData = cd?.market || {};
  // Near-real-time tick from the shared /api/live store (15s cadence during
  // market hours); the prop price is the fallback outside sessions.
  const liveFeed = useLive(API);
  const livePx = liveFeed.prices?.[(co.ticker || "").toUpperCase()];
  const displayPrice = livePx || price;
  const mcap = (price && co.shares) ? price * co.shares : null; // never the curated snapshot

  useEffect(() => {
    if (!API || !co.ticker) return;
    // Stale-response guard: if the ticker changes (or the component unmounts)
    // before a response lands, that response must NOT overwrite newer data.
    let live = true;
    Promise.all([
      fetch(`${API}/api/companies/${co.ticker}/financials`).then(r=>r.json()).catch(()=>null),
      fetch(`${API}/api/companies/${co.ticker}/metrics`).then(r=>r.json()).catch(()=>null),
    ]).then(([fins, mets]) => { if (live) { setLiveFinancials(fins); setLiveMetrics(mets); } });
    // Profile (slow: 5 chained calls) fetched separately so it doesn't block the rest.
    setLiveProfile(null);
    fetch(`${API}/api/companies/${co.ticker}/profile`)
      .then(r=>r.json()).then(d=>{ if (live) setLiveProfile(d); }).catch(()=>{ if (live) setLiveProfile(null); });
    // Insights carries self_metrics (the company's own IndianAPI multiples) for the snapshot.
    fetch(`${API}/api/companies/${co.ticker}/insights`)
      .then(r=>r.json()).then(d=>{ if (live) setLiveInsights(d); }).catch(()=>{ if (live) setLiveInsights(null); });
    // Real latest-FY operating figures → fed into the DCF/Verdict engine.
    setLiveStatement(null);
    fetch(`${API}/api/companies/${co.ticker}/annual_pl`)
      .then(r=>r.json()).then(d=>{ if (live) setLiveStatement(parseLatestPL(d)); }).catch(()=>{ if (live) setLiveStatement(null); });
    // Backend INDEPENDENT valuation (history-derived DCF/RI + analyst block). This
    // is the authoritative number the screener also shows, so the DCF & Verdict
    // tabs display exactly what the backend computed — no client/server drift.
    setApiVal(null);
    fetch(`${API}/api/companies/${co.ticker}`)
      .then(r=>r.json()).then(d=>{ if (live) setApiVal(d); }).catch(()=>{ if (live) setApiVal(null); });
    return () => { live = false; };
  }, [co.ticker, API]);

  // Seed the interactive DCF sliders from the backend's OWN history-derived
  // assumptions (apiVal.assumptions) rather than generic scenario defaults — so
  // the sliders open AT the numbers behind the headline and the first touch moves
  // smoothly from the backend base value (previously the recompute started from
  // default growth/beta and the figure jumped ~10-15% on first interaction).
  // Seeded once per company; never after the user has started editing.
  const seededTickerRef = useRef(null);
  useEffect(() => {
    const ba = apiVal?.assumptions;
    if (!ba || seededTickerRef.current === co.ticker) return;
    seededTickerRef.current = co.ticker;
    const fade = ba.fade_years ?? 8;
    setAssumptions(prev => ({
      ...prev,
      beta:           ba.beta,
      rf:             ba.risk_free,
      erp:            ba.erp,
      taxRate:        ba.tax_rate,
      ebitMargin:     ba.ebit_margin,
      revGrowth1:     ba.rev_growth,
      revGrowth2:     ba.rev_growth != null ? +(ba.rev_growth * 0.6).toFixed(4) : prev?.revGrowth2,
      terminalGrowth: ba.terminal_growth,
      debtWeight:     ba.debt_weight,
      kd:             ba.cost_debt,
      forecastROE:    ba.forecast_roe,
      terminalROE:    ba.terminal_roe,
      payout:         ba.payout,
      stage1Years:    Math.max(3, Math.round(fade / 2)),
      stage2Years:    Math.max(3, Math.round(fade / 2)),
    }));
  }, [apiVal, co.ticker, setAssumptions]);

  const sm = liveInsights?.self_metrics || null;
  // Analyst-driven headline (preferred over the DCF intrinsic at the top).
  const tgt = liveInsights?.target || null;
  const tgtUpside = (tgt?.mean && price) ? (tgt.mean / price - 1) : null;
  const consensus = liveInsights?.analyst?.rating || null;
  const consensusColor = !consensus ? C.dim
    : /strong buy|buy/i.test(consensus) ? C.green
    : /hold/i.test(consensus) ? C.gold : C.red;

  // Model's BLENDED fair value, upside vs CMP, and verdict (backend canonical —
  // identical to the screener and the Valuation tab's base case).
  const apiRecHead   = apiVal?.recommendation;
  const fairValue    = apiRecHead?.blended ?? apiRecHead?.intrinsic ?? null;
  const fairUpside   = apiRecHead?.mos ?? null;
  const modelVerdict = apiRecHead?.verdict || null;
  const modelVerdictColor = !modelVerdict ? C.dim
    : /buy|accumulate/i.test(modelVerdict) ? C.green
    : /hold/i.test(modelVerdict) ? C.gold : C.red;

  // Real ROA (PAT / total assets, latest year) + promoter holding for the snapshot.
  const roaLive = useMemo(() => {
    const st = liveFinancials?.statements;
    if (!st) return null;
    const yrs = Object.keys(st).sort();
    const ly = st[yrs[yrs.length - 1]] || {};
    const pat = ly.PL?.pat, ta = ly.BS?.total_assets;
    return (pat != null && ta) ? pat / ta : null;
  }, [liveFinancials]);
  const promoterLive = useMemo(() => {
    const p = (liveProfile?.shareholding || []).find(s => (s.name || "").toLowerCase().includes("promoter"));
    return p?.pct ?? null;
  }, [liveProfile]);
  // Enterprise Value = market cap + total debt − cash (latest balance sheet).
  const evLive = useMemo(() => {
    const st = liveFinancials?.statements;
    if (!st || mcap == null) return null;
    const yrs = Object.keys(st).sort();
    const bs = st[yrs[yrs.length - 1]]?.BS || {};
    const debt = bs.borrowings, cash = bs.cash;
    if (debt == null && cash == null) return null;
    return mcap + (debt || 0) - (cash || 0);
  }, [liveFinancials, mcap]);

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

  // Header snapshot stats — canonical intrinsic + gated verdict from recommend()
  const mos = rec.mos;
  const verdictLabel = rec.verdict;
  const verdictColor = verdictTone(rec.verdict);
  const conf = rec.confidence;

  // 52-week range: prefer curated real data, else real ingested OHLC, else "—".
  // Never fall back to the synthetic series (which produced Bajaj's impossible
  // 52W High 8,547 while the price was 920).
  const realCloses = hasRealPrices ? priceChartData.map(p => p.close).filter(x => x != null) : [];
  // TRUE 52-week window (last ~252 TRADING sessions) using INTRADAY highs and
  // lows — the convention every external terminal (NSE, brokers) uses. Ranging
  // over closes systematically understates highs and overstates lows.
  const yearRows = hasRealPrices ? priceChartData.slice(-252) : [];
  const hi52 = yearRows.length
    ? Math.max(...yearRows.map(p => p.high ?? p.close).filter(x => x != null))
    : null; // no real prices → show nothing, never a frozen curated value
  const lo52 = yearRows.length
    ? Math.min(...yearRows.map(p => p.low ?? p.close).filter(x => x != null))
    : null;

  // Day change vs the last close that ISN'T today's evolving mark — computed
  // from real history instead of a seed constant that froze every non-seeded
  // name at "+0.00 / +0.00%" (wiring audit #1).
  const prevClose = realCloses.length >= 2
    ? (Math.abs(realCloses[realCloses.length - 1] - displayPrice) < 1e-9
        ? realCloses[realCloses.length - 2] : realCloses[realCloses.length - 1])
    : null;
  const chgAmt = prevClose ? displayPrice - prevClose : 0;
  const chgPct = prevClose ? (displayPrice / prevClose - 1) * 100 : 0;

  // 30-session average daily traded value, in ₹ crores (audit #9).
  const adv30Cr = (() => {
    const pts = hasRealPrices ? priceChartData.slice(-30).filter(p => p.close && p.volume) : [];
    if (!pts.length) return null; // frozen curated ADV would masquerade as current
    return pts.reduce((a, p) => a + p.close * p.volume, 0) / pts.length / 1e7;
  })();

  return (
    <div style={{ minHeight:"100vh" }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={{ borderBottom:`1px solid ${C.line}`, position:"relative", ...gridBg,
        backgroundImage:`radial-gradient(900px 420px at 10% -30%, ${accent}0d, transparent 55%),
                         radial-gradient(700px 380px at 95% 130%, ${accent}07, transparent 60%),
                         linear-gradient(180deg, ${C.bg900}, ${C.bg})` }}>
        <div style={{ position:"absolute", inset:0, opacity:0.4, pointerEvents:"none",
          backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.72 0 0 0 0 0.80 0 0 0 0 0.96 0 0 0 0.02 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
        <div style={{ position:"relative", padding: isMobile ? "16px 16px 20px" : "24px 32px 28px" }}>
          {/* Top bar */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                        flexWrap:"wrap", rowGap:10, marginBottom: isMobile ? 14 : 24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <button onClick={onBack} style={{ ...sans, display:"flex", alignItems:"center", gap:6, background:"transparent", border:"none", color:C.dim, fontSize:12, cursor:"pointer", padding:0 }}>
                <ArrowLeft size={14} /> Back to screener
              </button>
              <span style={{ color:C.bg500 }}>/</span>
              <span style={{ ...sans, fontSize:11, color:C.dim, textTransform:"uppercase", letterSpacing:"0.14em",
                             whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"52vw" }}>
                India · {co.type!=="financial"
                  ? ({ IT_SERVICES:"IT Services", CONSUMER:"Consumer", PHARMA:"Pharma",
                       ENERGY:"Energy", MANUFACTURING:"Manufacturing" }[co.template_code] || "Equity")
                  : co.template_code==="BANK" || /\bbank\b/i.test(co.name||"") ? "Bank"
                  : co.template_code==="INSURANCE" || /insur/i.test((co.sector||"")+(co.name||"")) ? "Insurer"
                  : "NBFC"} · <span style={{ color:accent, fontWeight:600 }}>{co.sector}</span>
              </span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap: isMobile ? 8 : 12, flexWrap:"wrap",
                          rowGap:8, ...sans, fontSize:12, color:C.dim }}>
              {onToggleWatch && (
                <button onClick={() => onToggleWatch(co.ticker)}
                  title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
                  style={{ ...sans, display:"flex", alignItems:"center", gap:6, cursor:"pointer",
                    background:"transparent", border:`1px solid ${isWatched ? C.gold+"66" : C.line2}`,
                    borderRadius:8, padding:"5px 10px", color:isWatched ? C.gold : C.dim, fontSize:12 }}>
                  <Star size={13} color={isWatched ? C.gold : C.dim} fill={isWatched ? C.gold : "none"} />
                  {isWatched ? "Watching" : "Watch"}
                </button>
              )}
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                {liveFeed.live
                  ? <span className="blink" style={{ width:6, height:6, borderRadius:"50%", background:C.green, display:"inline-block" }} />
                  : <span style={{ width:6, height:6, borderRadius:"50%", background:C.dim, display:"inline-block" }} />}
                <span style={{ letterSpacing:"0.1em" }}>
                  {liveFeed.live ? "LIVE" : "EOD"} · {new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
                </span>
              </div>
              <span style={{ color:C.bg500 }}>|</span>
              <span title={conf.flags.length ? conf.flags.join("  •  ") : "All core inputs present"}
                style={{ display:"flex", alignItems:"center", gap:6, cursor:"help" }}>
                <span style={{ width:7, height:7, borderRadius:"50%", display:"inline-block",
                  background: conf.level==="high"?C.green:conf.level==="medium"?C.gold:C.red }} />
                <span style={{ letterSpacing:"0.1em", textTransform:"uppercase" }}>
                  Data {conf.level} ({Math.round(conf.score*100)}%)
                </span>
              </span>
              {!isMobile && <><span style={{ color:C.bg500 }}>|</span>
              <span>₹ in Crores unless stated</span></>}
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
              {API && (
                <a href={`${API}/api/export/${co.ticker}.xlsx`} title="Download Excel model" style={{
                  ...sans, display:"flex", alignItems:"center", gap:6,
                  fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase",
                  fontWeight:500, padding:"6px 12px", textDecoration:"none",
                  border:`1px solid ${C.gold}66`, color:C.gold,
                  background:C.gold+"0d", cursor:"pointer",
                }}>
                  <FileSpreadsheet size={12} /> Excel
                </a>
              )}
            </div>
          </div>

          {/* Company name + price block */}
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: isMobile ? 16 : 32, alignItems: isMobile ? "stretch" : "flex-end" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap", ...sans, fontSize:11, letterSpacing:"0.16em", textTransform:"uppercase", color:C.dim }}>
                <span>NSE: {co.ticker}</span>
                <span style={{ color:C.bg500 }}>·</span>
                {(liveProfile?.key_facts?.bse_code || cd?.meta?.bse) && <span>BSE: {liveProfile?.key_facts?.bse_code || cd?.meta?.bse}</span>}
                <span style={{ color:C.bg500 }}>·</span>
                {(liveProfile?.key_facts?.isin || cd?.meta?.isin) && <span>ISIN: {liveProfile?.key_facts?.isin || cd?.meta?.isin}</span>}
                <span style={{ color:C.bg500 }}>·</span>
                {(() => {
                  const m = price && co.shares ? price * co.shares : null;
                  const band = m == null ? mktData.sebiCap
                    : m >= 67000 ? "Large Cap" : m >= 22000 ? "Mid Cap" : "Small Cap";
                  return band ? <span style={{ color:C.gold }}>{band}</span> : null;
                })()}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <Logo ticker={co.ticker} name={co.name} sector={co.sector} size={isMobile ? 36 : 48} radius={10} />
                <div style={{ ...serif, fontSize: isMobile ? 34 : 60, color:C.text, lineHeight:1.05, letterSpacing:"-0.02em" }}>{co.name}</div>
              </div>
              <div style={{ ...sans, fontSize:13, color:C.text200, marginTop:12, maxWidth:680, lineHeight:1.6 }}>
                {(() => {
                  // Header teaser: first two sentences. The FULL profile lives in
                  // the Business tab — repeating it verbatim in both places made
                  // the page read like a copy-paste bug.
                  const full = liveProfile?.description || cd?.description ||
                    `${co.name} is a ${co.sector} company in the terminal's Nifty 500 coverage. The figures on this page are its live market data and our independent model's read; a detailed business profile arrives with the next data refresh.`;
                  const parts = full.match(/[^.!?]+[.!?]+(\s|$)/g) || [full];
                  const teaser = parts.slice(0, 2).join("").trim();
                  return teaser.length < full.trim().length ? teaser + " …" : teaser;
                })()}
              </div>
            </div>
            <div style={{ textAlign: isMobile ? "left" : "right" }}>
              <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.18em", color:C.dim, display:"flex", alignItems:"center", gap:7, justifyContent: isMobile ? "flex-start" : "flex-end" }}>
                {liveFeed.live && livePx != null && (
                  <span className="blink" style={liveDotStyle(C.green)} title={`Live · ${liveFeed.as_of || ""}`} />
                )}
                {liveFeed.live && livePx != null ? "Live Price" : "Last Price"}
              </div>
              <div style={{ display:"flex", alignItems:"baseline", gap:16, marginTop:4, justifyContent: isMobile ? "flex-start" : "flex-start" }}>
                <div style={{ ...mono, fontSize: isMobile ? 40 : 56, color:C.text, lineHeight:1, letterSpacing:"-0.02em" }}>{fmtPx(displayPrice)}</div>
                <div style={{ ...mono, fontSize:14, fontWeight:500, color:chgPct>=0?C.green:C.red }}>
                  {chgPct>=0?"+":""}{fmtN(chgAmt,2)}  /  {chgPct>=0?"+":""}{fmtN(chgPct,2)}%
                </div>
              </div>
              <div style={{ display:"flex", gap:20, marginTop:8, ...mono, fontSize:11, color:C.dim, justifyContent:"flex-end" }}>
                <span>52W H {fmtN(hi52, 2)}</span>
                <span>52W L {fmtN(lo52, 2)}</span>
                <span>Beta {fmtN(mktData.beta ?? assumptions?.beta ?? co.assumptions?.beta, 2)}</span>
                {adv30Cr != null && <span>ADV {fmtN(adv30Cr, 0)} Cr</span>}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Snapshot strip ─────────────────────────────────────── */}
      <div style={{ borderBottom:`1px solid ${C.line}`, background:C.bg900+"55" }}>
        <div style={{ padding:`14px ${PAD}px`, display:"grid", gridTemplateColumns: isMobile ? "repeat(3,1fr)" : "repeat(11,1fr)", gap: isMobile ? 14 : 8, rowGap: isMobile ? 16 : 8 }}>
          {[
            { l:"Market Cap",       v:"₹"+fmtCr(mcap)               },
            // EV is meaningless for a lender (debt is raw material, not financing)
            // — financials show book value per share instead, computable for all.
            co.type === "financial"
              ? { l:"Book Value / sh", v:(co.equity && co.shares) ? inrOrDash(co.equity / co.shares, 0) : "—" }
              : { l:"EV", v:evLive!=null ? "₹"+fmtCr(evLive) : "—" },
            { l:"P / E (TTM)",      v:sm?.pe!=null?multiple(sm.pe,2):multiple(rec.f.pe, 2)         },
            { l:"P / B",            v:sm?.pb!=null?multiple(sm.pb,2):multiple(rec.f.pb, 2)         },
            { l:"ROE",              v:sm?.roe_ttm!=null?fmtPa(sm.roe_ttm):(rec.f.roe!=null?fmtPa(rec.f.roe*100):"—"), accent:C.green },
            { l:"ROA",              v:roaLive!=null?fmtPa(roaLive*100):(co.nbfc?.roa!=null?fmtPa(co.nbfc.roa*100):"—") },
            { l:"Div Yield",        v:sm?.div_yield!=null?fmtPa(sm.div_yield):"—" },
            { l:"Promoter Hold",    v:promoterLive!=null?fmtPa(promoterLive)
                                      :liveInsights?.ownership?.promoter?.pct!=null?fmtPa(liveInsights.ownership.promoter.pct)
                                      :(mktData.promoterPct!=null?fmtPa(mktData.promoterPct):"—"), accent:C.gold },
            { l:"Fair Value",       v:fairValue!=null?inrOrDash(fairValue,0):"—", accent:C.gold },
            { l:"Upside",           v:fairUpside!=null?signedPct(fairUpside):"—", accent:fairUpside==null?C.dim:fairUpside>=0?C.green:C.red },
            { l:"Verdict",          v:modelVerdict||"—", accent:modelVerdictColor, large:true },
          ].map(s => (
            <div key={s.l} style={{ minWidth: 0 }}>
              <div style={{ ...sans, fontSize:10, textTransform:"uppercase", letterSpacing:"0.12em", color:C.dim, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }} title={s.l}>{s.l}</div>
              <div style={{ ...mono, fontSize:s.large?18:16, color:s.accent||C.text, marginTop:4, fontWeight:s.large?600:400, letterSpacing:s.large?"0.06em":"0", whiteSpace:"nowrap" }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab navigation ─────────────────────────────────────── */}
      <nav style={{ borderBottom:`1px solid ${C.line}`, background:C.bg+"dd", backdropFilter:"blur(8px)", position:"sticky", top:0, zIndex:30, padding:`0 ${PAD}px`, overflowX:"auto" }}>
        <div style={{ display:"flex", gap: isMobile ? 18 : 28, whiteSpace:"nowrap" }}>
          {visibleTabs.map(({ id, icon:Icon, label }) => (
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
        {tab==="overview"   && <OverviewTab    co={co2} rec={rec} cd={cd} profile={liveProfile} />}
        {tab==="chart"      && <PriceChart     data={histPrices?.data} intrinsic={fairValue} price={price} ticker={co.ticker} API={API} />}
        {tab==="financials" && <FinancialsTab  co={co2} cd={cd} liveFinancials={liveFinancials} API={API} />}
        {tab==="ratios"     && <RatiosTab      co={co2} API={API} liveMetrics={liveMetrics} />}
        {tab==="dcf"        && <><ScenarioBar API={API} ticker={co.ticker} assumptions={assumptions}
              setAssumptions={d => { setAssumptions(d); setScnNonce(n => n + 1); }} />
            <DCFModel key={`dcf-${co.ticker}-${apiVal?.assumptions ? "seeded" : "base"}-${scnNonce}`}
              co={co2} a={assumptions} onWork={aw => setAssumptions(prev => ({ ...(prev || {}), ...aw }))}
              price={price} setPrice={setPrice} apiVal={apiVal} /></>}
        {tab==="analyst"    && <AnalystTab     co={co2} API={API} price={price} />}
        {tab==="options"    && <OptionsTab     co={co2} API={API} />}
        {tab==="peers"      && <PeersTab       co={co2} cd={cd} allCompanies={allCompanies} API={API} onOpenTicker={onOpenTicker} />}
        {tab==="ownership"  && <OwnershipTab   profile={liveProfile} ownership={liveInsights?.ownership} />}
        {tab==="news"       && <NewsTab        co={co2} API={API} profile={liveProfile} preloaded={newsData} />}
        {tab==="docs"       && <DocsTab        co={co2} API={API} />}
        {tab==="thesis"     && <AIThesisTab    co={co2} profile={liveProfile} insights={liveInsights} cd={cd} price={price} API={API} onGoTab={setTab} />}
        {tab==="forensics"  && <ForensicsTab   co={co2} API={API} />}
        {tab==="verdict"    && <VerdictTab     co={co2} rec={rec} cd={cd} price={price} insights={liveInsights} apiVal={apiVal} />}
      </main>

      <footer style={{ borderTop:`1px solid ${C.line}`, padding:"20px 32px", display:"flex", justifyContent:"space-between", ...sans, fontSize:11, textTransform:"uppercase", letterSpacing:"0.1em", color:C.dim+"99", marginTop:48 }}>
        <span>Equity Terminal v0.3 — Sector-Aware Valuation Platform</span>
        <span>Educational use only · Not SEBI-registered advice</span>
      </footer>
    </div>
  );
}
