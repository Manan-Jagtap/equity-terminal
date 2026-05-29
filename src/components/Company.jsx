/* Company detail view — header + snapshot stats + 5-tab navigation.
   This is the page that Step 5 of the roadmap will replace with the new design. */

import { useMemo, useState } from "react";
import {
  ArrowLeft, Calculator, FileText, BookOpen, BarChart2, Gauge,
} from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { fmt, inr, pct } from "../lib/formatters.js";
import { recommend } from "../lib/recommend.js";
import { Stat, VerdictBadge } from "./primitives.jsx";
import DCFModel from "./DCFModel.jsx";
import FinancialStatements from "./FinancialStatements.jsx";
import Fundamentals from "./Fundamentals.jsx";
import Technical from "./Technical.jsx";
import Verdict from "./Verdict.jsx";

export default function Company({ co, assumptions, setAssumptions, price, setPrice, onBack, API }) {
  const [tab, setTab] = useState("dcf");
  const co2 = { ...co, price, assumptions };
  const rec = useMemo(() => recommend(co2, assumptions), [co2, assumptions]);
  const f = rec.f;
  const set = k => val => setAssumptions({ ...assumptions, [k]: val });

  const Tab = ({ id, icon: Icon, label }) => (
    <button onClick={() => setTab(id)} style={{
      ...sans,
      display: "flex", alignItems: "center", gap: 6,
      background: tab === id ? C.panel2 : "transparent",
      border: `1px solid ${tab === id ? C.line : "transparent"}`,
      color: tab === id ? C.gold : C.dim,
      padding: "7px 13px",
      borderRadius: 7,
      fontSize: 12.5,
      fontWeight: 500,
      cursor: "pointer",
    }}>
      <Icon size={14} />{label}
    </button>
  );

  return (
    <div>
      <button
        onClick={onBack}
        style={{ ...sans, display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: C.dim, fontSize: 13, cursor: "pointer", marginBottom: 14 }}
      >
        <ArrowLeft size={15} /> Back to screener
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 18 }}>
        <div>
          <div style={{ ...serif, color: C.text, fontSize: 28, fontWeight: 600, lineHeight: 1.1 }}>{co.name}</div>
          <div style={{ ...mono, color: C.faint, fontSize: 12, marginTop: 4 }}>
            {co.ticker} · {co.sector} · {co.type === "financial" ? "Residual Income Model" : "FCFF DCF"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ ...sans, color: C.dim, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>Composite Score</div>
            <div style={{ ...mono, color: C.text, fontSize: 24 }}>
              {fmt(rec.composite)}<span style={{ color: C.faint, fontSize: 13 }}>/100</span>
            </div>
          </div>
          <VerdictBadge verdict={rec.verdict} big />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 18 }}>
        <Stat label="CMP" value={inr(price)} />
        <Stat label="Intrinsic Value" value={inr(rec.v.intrinsic)} color={C.gold} />
        <Stat
          label="Margin of Safety"
          value={pct(rec.mos)}
          color={rec.mos >= 0 ? C.green : C.red}
          sub={rec.mos >= 0 ? "Undervalued" : "Overvalued"}
        />
        <Stat label="ROE" value={pct(f.roe)} />
        <Stat
          label={co.type === "financial" ? "P/B" : "P/E"}
          value={co.type === "financial" ? fmt(f.pb, 2) : (f.pe ? fmt(f.pe, 1) : "—")}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <Tab id="dcf"          icon={Calculator} label="DCF Model" />
        <Tab id="statements"   icon={FileText}   label="Financial Statements" />
        <Tab id="fundamentals" icon={BookOpen}   label="Fundamentals" />
        <Tab id="technical"    icon={BarChart2}  label="Technicals" />
        <Tab id="verdict"      icon={Gauge}      label="Verdict" />
      </div>

      {tab === "dcf"          && <DCFModel             co={co2} a={assumptions} set={set} price={price} setPrice={setPrice} />}
      {tab === "statements"   && <FinancialStatements  co={co2} a={assumptions} API={API} />}
      {tab === "fundamentals" && <Fundamentals         co={co2} f={f} />}
      {tab === "technical"    && <Technical            rec={rec} />}
      {tab === "verdict"      && <Verdict              rec={rec} />}
    </div>
  );
}
