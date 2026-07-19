/* Sectors.jsx — sector dashboard.
   Client-side aggregation of the same /api/companies?nifty50=true rows the
   other tabs use: groups by valuation_sector, shows per-sector medians,
   average MoS, verdict mix, and the cheapest / richest name. */

import { useEffect, useMemo, useState } from "react";
import { Layers, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";
import { multiple, signedPct } from "../lib/formatters.js";

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

const median = arr => {
  const a = arr.filter(v => v != null && isFinite(v) && v > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const avg = arr => {
  const a = arr.filter(v => v != null && isFinite(v));
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
};

/* Verdict → colour, in BUY..AVOID display order for the distribution bar. */
const VERDICT_ORDER = [
  { id: "BUY",        col: C.green    },
  { id: "ACCUMULATE", col: C.green500 },
  { id: "HOLD",       col: C.gold     },
  { id: "REDUCE",     col: C.red500   },
  { id: "AVOID",      col: C.red      },
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
  const [rows, setRows]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [openSector, setOpenSector] = useState(null); // expanded card

  useEffect(() => {
    if (!API) { setLoading(false); return; }
    let live = true;
    setLoading(true);
    // FULL visible universe — this tab aggregated only the Nifty-50 slice
    // before, silently ignoring 450 covered names.
    fetch(`${API}/api/companies`).then(r => r.json())
      .then(d => { if (live) { setRows(Array.isArray(d) ? d : (d.items || [])); setLoading(false); } })
      .catch(() => { if (live) { setRows(null); setLoading(false); } });
    return () => { live = false; };
  }, [API]);

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
      const cheapest = withMos.length ? withMos.reduce((a, b) => (b.mos > a.mos ? b : a)) : null;
      const richest  = withMos.length ? withMos.reduce((a, b) => (b.mos < a.mos ? b : a)) : null;
      return {
        name, n: cos.length,
        medPe: median(cos.map(c => c.pe)),
        medPb: median(cos.map(c => c.pb)),
        avgMos: avg(cos.map(c => c.mos)),
        counts, cheapest, richest,
        cos: [...cos].sort((a, b) => (b.mos ?? -Infinity) - (a.mos ?? -Infinity)),
      };
    }).sort((a, b) => (b.avgMos ?? -Infinity) - (a.avgMos ?? -Infinity));
  }, [rows]);

  const totals = useMemo(() => ({
    n: (rows || []).length,
    sectors: sectors.length,
    medPe: median((rows || []).map(c => c.pe)),
    medPb: median((rows || []).map(c => c.pb)),
    avgMos: avg((rows || []).map(c => c.mos)),
  }), [rows, sectors]);

  if (loading) return (
    <div style={{ padding: 48, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading sectors…
    </div>
  );

  const mosColor = m => m == null ? C.dim : m >= 0 ? C.green : C.red;

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
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <Layers size={20} color={C.gold} />
        <span style={{ ...serif, fontSize: 30, color: C.text }}>Sectors</span>
        <span style={{ ...sans, fontSize: 13, color: C.dim }}>{totals.sectors} sectors · {totals.n} companies</span>
      </div>
      <div style={{ ...sans, fontSize: 12, color: C.faint, marginBottom: 18 }}>
        Valuation by sector — median multiples, average margin of safety, and where the cheapest &amp; richest names sit. Sorted by average MoS.
      </div>

      {/* Totals header row */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 28, alignItems: "baseline",
        border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel,
        padding: "14px 20px", marginBottom: 18,
      }}>
        {[
          ["Companies", String(totals.n), C.text],
          ["Sectors", String(totals.sectors), C.text],
          ["Median P/E", multiple(totals.medPe, 1), C.text],
          ["Median P/B", multiple(totals.medPb, 2), C.text],
          ["Avg MoS", signedPct(totals.avgMos), mosColor(totals.avgMos)],
        ].map(([l, v, col]) => (
          <div key={l}>
            <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim }}>{l}</div>
            <div style={{ ...mono, fontSize: 18, color: col, marginTop: 3 }}>{v}</div>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          {VERDICT_ORDER.map(({ id, col }) => (
            <span key={id} style={{ ...sans, fontSize: 10, color: C.dim, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: col, display: "inline-block" }} />{id}
            </span>
          ))}
        </div>
      </div>

      {/* Sector cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 14 }}>
        {sectors.map(s => (
          <div key={s.name}
            style={{ border: `1px solid ${openSector === s.name ? C.gold + "55" : C.line}`, borderRadius: 12,
                     background: C.panel, padding: "16px 18px",
                     gridColumn: openSector === s.name ? "1 / -1" : undefined }}>
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
                ["Med P/E", multiple(s.medPe, 1), C.text],
                ["Med P/B", multiple(s.medPb, 2), C.text],
                ["Avg MoS", signedPct(s.avgMos), mosColor(s.avgMos)],
              ].map(([l, v, col]) => (
                <div key={l}>
                  <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: C.dim }}>{l}</div>
                  <div style={{ ...mono, fontSize: 15, color: col, marginTop: 2 }}>{v}</div>
                </div>
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
          </div>
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
