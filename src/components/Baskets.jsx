/* Baskets.jsx — thematic & smart-beta baskets.

   Reads /api/baskets. Two families:
     • Smart-beta — factor-tilted (Value / Quality / Momentum / Low-Vol / Growth
       / QARP): the top slice of the visible universe on one transparent 0–100
       factor rank.
     • Thematic — every name matching a published valuation-sector rule
       (Financials, Digital & IT, Consumption, Capex & Infra, Commodities,
       Healthcare, Auto, Materials).

   Each card shows its selection rule, basket-level aggregates, factor exposures,
   and its constituents (click a name to open it). A research aid — NOT
   investment advice and NOT a backtest. */
import { useMemo, useState } from "react";
import { Info, ChevronRight } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";
import PageSkeleton from "./Skeleton.jsx";
import { VerdictBadge } from "./primitives.jsx";
import StrategyLab from "./StrategyLab.jsx";
import PageHeader from "./ui/PageHeader.jsx";
import ErrorState from "./ui/ErrorState.jsx";
import useResource from "../lib/useResource.js";
import { buttonReset } from "../lib/a11y.js";

const scoreColor = (v) => v == null ? C.dim : v >= 70 ? C.green : v >= 45 ? C.gold : C.red;
const EXPO = [["value", "Val"], ["quality", "Qual"], ["momentum", "Mom"], ["low_vol", "LoVol"], ["growth", "Grow"]];

const pctFrac = (x) => x == null ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(0)}%`;
const num = (x, d = 1) => x == null ? "—" : Number(x).toFixed(d);
const inr = (x) => x == null ? "—" : "₹" + Number(x).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function AggStat({ label, value, color }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...sans, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.09em", color: C.dim, whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ ...mono, fontSize: 13, color: color || C.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function BasketCard({ b, onOpen }) {
  const [open, setOpen] = useState(false);
  const ag = b.aggregates || {};
  const cons = b.constituents || [];
  const shown = open ? cons : cons.slice(0, 5);
  const factorLabel = b.factor;          // smart-beta selecting factor
  const exposures = ag.exposures || {};

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: "rgba(16,14,10,0.55)", padding: "15px 16px", display: "flex", flexDirection: "column" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...serif, fontSize: 17, color: C.text, lineHeight: 1.2 }}>{b.name}</div>
          <div style={{ ...sans, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em", color: C.gold, marginTop: 3 }}>
            {b.kind === "smart_beta" ? `Smart-beta · ${factorLabel}` : "Thematic"}
          </div>
        </div>
        <div style={{ ...mono, fontSize: 11, color: scoreColor(ag.avg_alpha), border: `1px solid ${scoreColor(ag.avg_alpha)}44`, borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>
          α {num(ag.avg_alpha, 0)}
        </div>
      </div>

      {/* rule */}
      <div style={{ ...sans, fontSize: 11.5, color: C.faint, lineHeight: 1.5, marginTop: 8 }}>{b.rule}</div>

      {/* aggregates */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
        <AggStat label="Names" value={ag.count ?? "—"} />
        <AggStat label="Med P/E" value={num(ag.median_pe, 1)} />
        <AggStat label="Avg ROE" value={ag.avg_roe == null ? "—" : ag.avg_roe.toFixed(0) + "%"} color={C.green} />
        <AggStat label="Med MoS" value={pctFrac(ag.median_mos)} color={ag.median_mos == null ? C.dim : ag.median_mos >= 0 ? C.green : C.red} />
        <AggStat label="Med P/B" value={num(ag.median_pb, 2)} />
      </div>

      {/* factor exposures */}
      {Object.keys(exposures).length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {EXPO.map(([k, lbl]) => {
            const v = exposures[k];
            return (
              <div key={k} style={{ flex: 1, textAlign: "center" }} title={`${lbl} exposure: ${v == null ? "—" : Math.round(v)}th pct`}>
                <div style={{ height: 34, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <div style={{ height: `${v == null ? 0 : Math.max(3, v * 0.34)}px`, background: scoreColor(v), opacity: 0.8, borderRadius: 2 }} />
                </div>
                <div style={{ ...sans, fontSize: 8.5, color: C.dim, marginTop: 3 }}>{lbl}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* constituents */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
        {shown.map((m) => (
          <button type="button" key={m.ticker} onClick={() => onOpen && onOpen(m.ticker)}
               style={{ ...buttonReset, width: "100%", boxSizing: "border-box",   display: "flex", alignItems: "center", gap: 8, padding: "5px 4px", cursor: onOpen ? "pointer" : "default", borderRadius: 6  }}
               onMouseEnter={e => (e.currentTarget.style.background = C.panel2)}
               onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
            <div style={{ ...sans, fontSize: 12, fontWeight: 500, color: C.gold, width: 90, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.ticker}</div>
            <div style={{ ...mono, fontSize: 11, color: scoreColor(m.factor_score ?? m.alpha_score), width: 30, textAlign: "right" }}>
              {Math.round(m.factor_score ?? m.alpha_score ?? 0)}
            </div>
            <div style={{ ...mono, fontSize: 11, color: m.mos == null ? C.dim : m.mos >= 0 ? C.green : C.red, width: 48, textAlign: "right" }}>{pctFrac(m.mos)}</div>
            <div style={{ ...mono, fontSize: 10.5, color: C.faint, width: 58, textAlign: "right" }}>{inr(m.price)}</div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
              <VerdictBadge verdict={m.verdict || "—"} />
              <ChevronRight size={13} color={C.faint} />
            </div>
          </button>
        ))}
        {cons.length > 5 && (
          <button onClick={() => setOpen(o => !o)}
                  style={{ ...sans, fontSize: 11, color: C.gold, background: "transparent", border: "none", cursor: "pointer", padding: "7px 4px 0", textAlign: "left" }}>
            {open ? "Show less" : `Show all ${cons.length} names →`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Baskets({ API, onOpen }) {
  // useResource: the old fetch().then(r=>r.json()).catch() never fired its
  // .catch on an API 4xx/5xx (FastAPI answers with a JSON body), so an
  // outage rendered as an empty dataset rather than a failure.
  const { data: data, error, loading, retry } = useResource(API ? `${API}/api/baskets` : null);
  const [tab, setTab] = useState("smart_beta");


  const baskets = useMemo(() => (data ? (data[tab] || []) : []), [data, tab]);

  if (loading) return <PageSkeleton label="Building baskets…" cards={4} />;

  // A failed request is not an empty dataset. useResource separates them;
  // this is where that distinction reaches the user.
  if (error) return (
    <div className="fadein" style={{ padding: "22px 26px 60px" }}>
      <PageHeader title="Baskets">
        Rules-based groupings of the covered universe.
      </PageHeader>
      <ErrorState error={error} onRetry={retry} what="baskets" />
    </div>
  );

  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{
      ...sans, fontSize: 12.5, fontWeight: 500, padding: "7px 15px", borderRadius: 8, cursor: "pointer",
      border: `1px solid ${tab === id ? C.gold : C.line}`,
      background: tab === id ? C.gold + "14" : "transparent",
      color: tab === id ? C.gold : C.dim,
    }}>{label}</button>
  );

  return (
    <div className="fadein" style={{ padding: "22px 26px 60px" }}>
      {/* PageHeader, not the old hand-rolled <h2>+<span>: this screen imported
          PageHeader but mounted it ONLY in the `if (error)` branch, so the
          healthy path — the one every user actually sees — shipped with no <h1>
          at all. The import made it look done. Rendered and checked: the healthy
          Baskets page now emits exactly one <h1> ("Baskets"), matching the shape
          Operations was fixed into. WCAG 2.4.6 / 1.3.1: a document with no
          heading gives a screen-reader user nothing to navigate by. */}
      <PageHeader title="Baskets" meta={`${data?.universe || 0} names · updated live`}>
        Rules-based groupings of the covered universe.
      </PageHeader>
      <div style={{ ...sans, fontSize: 11.5, color: C.faint, lineHeight: 1.6, maxWidth: 820, marginBottom: 16, display: "flex", gap: 6 }}>
        <Info size={13} color={C.dim} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          <b style={{ color: C.text200 }}>Smart-beta</b> baskets hold the top slice of the universe on a single
          transparent factor; <b style={{ color: C.text200 }}>thematic</b> baskets hold every name matching a
          published valuation-sector rule. Each carries its rule, its constituents (ranked by Alpha) and its
          factor exposures — descriptive current snapshots, a research aid, <b style={{ color: C.text200 }}>not
          investment advice and not a backtest</b>.
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {tabBtn("smart_beta", "Smart-Beta")}
        {tabBtn("thematic", "Thematic")}
        {tabBtn("lab", "Strategy Lab")}
      </div>

      {tab === "lab" ? (
        <StrategyLab API={API} onOpen={onOpen} />
      ) : !baskets.length ? (
        <div style={{ ...sans, fontSize: 12, color: C.dim, padding: "28px 0" }}>
          No baskets yet — they build after the daily valuation + factor recompute.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {baskets.map(b => <BasketCard key={b.id} b={b} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}
