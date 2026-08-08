/* Sectors.jsx — sector dashboard.
   Client-side aggregation of the same /api/companies?nifty50=true rows the
   other tabs use: groups by valuation_sector, shows per-sector medians,
   median MoS, verdict mix, and the cheapest / richest name. */

import { useMemo, useState } from "react";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";
import { verdictColor } from "../design/tokens.js";
import { multiple, signedPct } from "../lib/formatters.js";
import PageHeader from "./ui/PageHeader.jsx";
import ErrorState from "./ui/ErrorState.jsx";
import Card from "./ui/Card.jsx";
import StatTile from "./ui/StatTile.jsx";
import useResource from "../lib/useResource.js";

// UX-13: human-readable sector labels — the raw valuation_sector enum
// ("CONSUMER_DISC", "IT_SERVICES") must never leak into the UI.
const SECTOR_LABELS = {
  CONSUMER_DISC: "Consumer Discretionary", CONSUMER: "Consumer",
  IT_SERVICES: "IT Services", CAPITAL_GOODS: "Capital Goods",
  FMCG: "FMCG", NBFC: "NBFC", INDIGO: "Aviation", FEDFINA: "NBFC",
};
const prettySector = s => SECTOR_LABELS[s]
  || (s || "Other").replace(/_/g, " ").toLowerCase()
       .replace(/\b\w/g, c => c.toUpperCase());

/* `positiveOnly` is the default because this helper was written for MULTIPLES:
   a negative or zero P/E is not a cheap stock, it is a loss-making one, and
   averaging it in is meaningless.
   Margin of safety is the opposite case — negative MoS ("trades above fair
   value") is both meaningful and, on this universe, the MAJORITY: 471 of 1013
   names are AVOID. Running MoS through the positive-only filter silently drops
   every overvalued name and can only ever return a positive median, which is
   why the sector page reported +38.6% for a book whose true median is -50.5%.
   Callers summarising a signed quantity must pass positiveOnly=false. */
const median = (arr, positiveOnly = true) => {
  const a = arr
    .filter(v => v != null && isFinite(v) && (!positiveOnly || v > 0))
    .sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/* Verdict → colour, in BUY..AVOID display order for the distribution bar. */
/* Straight off the documented ladder via verdictColor(), the same source
   ui/Badge uses. This bar previously drew HOLD as C.gold — the brand ACCENT,
   not the HOLD token — and ACCUMULATE/REDUCE from C.green500/C.red500, two
   values that were never ladder steps at all. So the same verdict rendered one
   colour here and a different one in the badge two columns away. */
const VERDICT_ORDER = [
  { id: "BUY",        col: verdictColor("BUY")        },
  { id: "ACCUMULATE", col: verdictColor("ACCUMULATE") },
  { id: "HOLD",       col: verdictColor("HOLD")       },
  { id: "REDUCE",     col: verdictColor("REDUCE")     },
  { id: "AVOID",      col: verdictColor("AVOID")      },
];

function VerdictBar({ counts, total }) {
  if (!total) return null;
  return (
    <div style={{ display: "flex", height: 6, borderRadius: 99, overflow: "hidden", background: C.bg700 }}>
      {VERDICT_ORDER.map(({ id, col }) => {
        const n = counts[id] || 0;
        if (!n) return null;
        return <div key={id} title={`${id}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: col }} />;
      })}
    </div>
  );
}

export default function Sectors({ API, onOpen }) {
  // useResource: the old fetch().then(r=>r.json()).catch() never fired its
  // .catch on an API 4xx/5xx (FastAPI answers with a JSON body), so an
  // outage rendered as an empty dataset rather than a failure.
  const { data: rows, error, loading, retry } = useResource(
    API ? `${API}/api/companies` : null,
    { transform: d => (Array.isArray(d) ? d : (d.items || [])) });
  const [openSector, setOpenSector] = useState(null); // expanded card


  const sectors = useMemo(() => {
    const groups = new Map();
    (rows || []).forEach(r => {
      const key = r.valuation_sector || r.sector || "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });
    return Array.from(groups.entries()).map(([name, cos]) => {
      const counts = {};
      cos.forEach(c => {
        const v = c.verdict === "TRIM" ? "REDUCE" : c.verdict;  // normalize legacy name
        if (v) counts[v] = (counts[v] || 0) + 1;
      });
      const withMos = cos.filter(c => c.mos != null && isFinite(c.mos));
      // Argmax over every name reliably surfaces the WORST data point, not the
      // best opportunity: the widest MoS in a sector is usually a split/stale
      // artefact the engine already flagged (RAJESHEXPO printed "cheapest in
      // Consumer Discretionary" at +112,872% off a 0.14x P/B the confidence
      // check calls implausible). Rank among names the engine marks reliable;
      // fall back only if a sector has none.
      const pool = withMos.filter(c => c.reliable).length ? withMos.filter(c => c.reliable) : withMos;
      const cheapest = pool.length ? pool.reduce((a, b) => (b.mos > a.mos ? b : a)) : null;
      const richest  = pool.length ? pool.reduce((a, b) => (b.mos < a.mos ? b : a)) : null;
      return {
        name, n: cos.length,
        medPe: median(cos.map(c => c.pe)),
        medPb: median(cos.map(c => c.pb)),
        medMos: median(cos.map(c => c.mos), false),
        counts, cheapest, richest,
        cos: [...cos].sort((a, b) => (b.mos ?? -Infinity) - (a.mos ?? -Infinity)),
      };
    }).sort((a, b) => (b.medMos ?? -Infinity) - (a.medMos ?? -Infinity));
  }, [rows]);

  const totals = useMemo(() => ({
    n: (rows || []).length,
    sectors: sectors.length,
    medPe: median((rows || []).map(c => c.pe)),
    medPb: median((rows || []).map(c => c.pb)),
    medMos: median((rows || []).map(c => c.mos), false),
  }), [rows, sectors]);

  if (loading) return (
    <div style={{ padding: 48, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} className="spin" /> Loading sectors…
    </div>
  );

  // A failed request is not an empty dataset. useResource separates them;
  // this is where that distinction reaches the user.
  if (error) return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <PageHeader title="Sectors">
        Valuation by sector — median multiples and median margin of safety.
      </PageHeader>
      <ErrorState error={error} onRetry={retry} what="sectors" />
    </div>
  );

  /* Two consumers, two shapes. mosColor still paints raw spans (the drilldown
     rows and the cheapest/richest lines); mosTone hands StatTile a MEANING and
     lets the tile own the colour. Same three-way split — null is its own case,
     never a zero — so the two cannot disagree. */
  const mosColor = m => m == null ? C.dim : m >= 0 ? C.green : C.red;
  const mosTone  = m => m == null ? "muted" : m >= 0 ? "up" : "down";

  const NameLink = ({ co, label, icon: Icon, tone }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
      <Icon size={12} color={tone} style={{ flexShrink: 0 }} />
      <span style={{ ...sans, fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>{label}</span>
      {co ? (
        <span
          onClick={() => onOpen && onOpen(co.ticker)}
          onMouseEnter={e => e.currentTarget.style.color = C.gold}
          onMouseLeave={e => e.currentTarget.style.color = C.text}
          style={{ ...sans, fontSize: 12, fontWeight: 500, color: C.text, cursor: "pointer",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {co.name}
        </span>
      ) : <span style={{ ...sans, fontSize: 12, color: C.faint }}>—</span>}
      {co && <span style={{ ...mono, fontSize: 11, color: mosColor(co.mos), marginLeft: "auto", flexShrink: 0 }}>{signedPct(co.mos)}</span>}
    </div>
  );

  return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <PageHeader title="Sectors" meta={`${totals.sectors} sectors · ${totals.n} companies`}>
        Valuation by sector — median multiples, median margin of safety, and where the cheapest &amp; richest names sit. Medians, not means: a handful of
        split-affected names carry margins in the thousands of percent and would otherwise set the tone for a whole sector.
      </PageHeader>

      {/* Totals header row */}
      <Card pad="sm" style={{
        display: "flex", flexWrap: "wrap", gap: 28, alignItems: "baseline", marginBottom: 18,
      }}>
        {[
          ["Companies", String(totals.n), undefined],
          ["Sectors", String(totals.sectors), undefined],
          ["Median P/E", multiple(totals.medPe, 1), undefined],
          ["Median P/B", multiple(totals.medPb, 2), undefined],
          ["Median MoS", signedPct(totals.medMos), mosTone(totals.medMos)],
        ].map(([l, v, tone]) => (
          <StatTile key={l} size="md" label={l} value={v} tone={tone} />
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          {VERDICT_ORDER.map(({ id, col }) => (
            <span key={id} style={{ ...sans, fontSize: 10, color: C.dim, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: col, display: "inline-block" }} />{id}
            </span>
          ))}
        </div>
      </Card>

      {/* Sector cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 14 }}>
        {sectors.map(s => (
          <Card key={s.name} pad="sm"
            tone={openSector === s.name ? "active" : "default"}
            style={{ gridColumn: openSector === s.name ? "1 / -1" : undefined }}>
            <div onClick={() => setOpenSector(v => (v === s.name ? null : s.name))}
              title={openSector === s.name ? "Collapse" : `Show all ${s.n} ${prettySector(s.name)} names`}
              style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, cursor: "pointer" }}>
              <span style={{ ...serif, fontSize: 19, color: C.text }}>{prettySector(s.name)}</span>
              <span style={{ ...sans, fontSize: 11, color: openSector === s.name ? C.gold : C.faint }}>
                {s.n} {s.n === 1 ? "company" : "companies"} {openSector === s.name ? "▾" : "▸"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 22, marginBottom: 12 }}>
              {[
                ["Med P/E", multiple(s.medPe, 1), undefined],
                ["Med P/B", multiple(s.medPb, 2), undefined],
                ["Median MoS", signedPct(s.medMos), mosTone(s.medMos)],
              ].map(([l, v, tone]) => (
                <StatTile key={l} size="sm" label={l} value={v} tone={tone} />
              ))}
            </div>

            <VerdictBar counts={s.counts} total={s.n} />

            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 13, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
              <NameLink co={s.cheapest} label="Cheapest" icon={TrendingUp} tone={C.green} />
              <NameLink co={s.richest}  label="Richest"  icon={TrendingDown} tone={C.red} />
            </div>

            {/* Drilldown: every covered name in the sector, sorted by MoS */}
            {openSector === s.name && (
              <div style={{ marginTop: 13, borderTop: `1px solid ${C.line}`, maxHeight: 420, overflowY: "auto" }}>
                {s.cos.map(c => (
                  <div key={c.ticker}
                    onClick={e => { e.stopPropagation(); onOpen && onOpen(c.ticker); }}
                    onMouseEnter={e => e.currentTarget.style.background = C.bg800}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "8px 6px",
                             borderBottom: `1px solid ${C.line}`, cursor: "pointer" }}>
                    <span style={{ ...mono, fontSize: 11, color: C.gold, flexShrink: 0, minWidth: 92 }}>{c.ticker}</span>
                    <span style={{ ...sans, fontSize: 12.5, color: C.text200, whiteSpace: "nowrap",
                                   overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{c.name}</span>
                    <span style={{ ...mono, fontSize: 11.5, color: C.dim, flexShrink: 0 }}>{multiple(c.pe, 1)}</span>
                    <span style={{ ...mono, fontSize: 11.5, color: mosColor(c.mos), flexShrink: 0, minWidth: 64, textAlign: "right" }}>{signedPct(c.mos)}</span>
                    {c.verdict && <span style={{ ...sans, fontSize: 10, color: C.dim, flexShrink: 0, minWidth: 66, textAlign: "right" }}>{c.verdict === "TRIM" ? "REDUCE" : c.verdict}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
        {sectors.length === 0 && (
          <div style={{ ...sans, gridColumn: "1 / -1", textAlign: "center", padding: 48, color: C.faint, fontSize: 13,
            border: `1px solid ${C.line}`, borderRadius: 12 }}>
            No sector data — ensure the backend is running and /api/companies returns rows.
          </div>
        )}
      </div>
    </div>
  );
}
