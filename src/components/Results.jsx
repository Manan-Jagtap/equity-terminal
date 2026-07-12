/* Results.jsx — cross-company earnings scoreboard.
   Reads /api/results: latest reported quarter + sales/PAT YoY + EPS beat/miss. */
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";
import { VerdictBadge } from "./primitives.jsx";

const cr   = v => v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const signed = v => v == null ? "—" : (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";   // fraction → %
const sp   = v => v == null ? "—" : (v >= 0 ? "+" : "") + Number(v).toFixed(1) + "%";       // already %
const pctRaw = v => v == null ? "—" : Number(v).toFixed(1) + "%";

const SORTS = [
  { id: "latest",   label: "Latest" },
  { id: "pat",      label: "PAT growth" },
  { id: "sales",    label: "Sales growth" },
  { id: "beat",     label: "Biggest beat" },
  { id: "upcoming", label: "Upcoming" },
];

function Delta({ v }) {
  if (v == null) return <span style={{ ...mono, fontSize: 11, color: C.dim }}>—</span>;
  const up = v >= 0;
  return (
    <span style={{ ...mono, fontSize: 11, color: up ? C.green : C.red, display: "inline-flex", alignItems: "center", gap: 3 }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{signed(v)}
    </span>
  );
}

function UpcomingCalendar({ API, onOpen }) {
  const [cal, setCal] = useState(null);
  useEffect(() => {
    if (!API) return;
    let live = true;
    fetch(`${API}/api/results/upcoming`).then(r => r.json())
      .then(d => { if (live) setCal(d); }).catch(() => { if (live) setCal({ items: [] }); });
    return () => { live = false; };
  }, [API]);
  if (!cal) return <div style={{ ...sans, padding: 32, color: C.dim, fontSize: 13 }}>Loading calendar…</div>;
  const items = cal.items || [];
  if (!items.length) return (
    <div style={{ ...sans, padding: 32, color: C.dim, fontSize: 13, lineHeight: 1.6 }}>
      No upcoming board meetings on file yet — the calendar fills after the next weekly sweep of exchange
      board-meeting notices (Saturdays), and results season concentrates dates in Apr / Jul / Oct / Jan.
    </div>
  );
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
      {items.map((r, i) => (
        <div key={i} onClick={() => onOpen && onOpen(r.ticker)}
          onMouseEnter={e => e.currentTarget.style.background = C.bg800}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          style={{ display: "flex", alignItems: "baseline", gap: 14, padding: "11px 16px",
                   borderTop: i ? `1px solid ${C.line}` : "none", cursor: "pointer" }}>
          <span style={{ ...mono, fontSize: 12, color: r.days_away <= 3 ? C.gold : C.text200, flexShrink: 0, minWidth: 88 }}>
            {r.date}
          </span>
          <span style={{ ...sans, fontSize: 10, color: C.dim, flexShrink: 0, minWidth: 52 }}>
            {r.days_away === 0 ? "today" : r.days_away < 0 ? `${-r.days_away}d ago` : `in ${r.days_away}d`}
          </span>
          <span style={{ ...mono, fontSize: 12, color: C.gold, flexShrink: 0, minWidth: 100 }}>{r.ticker}</span>
          <span style={{ ...sans, fontSize: 12.5, color: C.text, flexShrink: 0 }}>{r.name}</span>
          {r.results_meeting && <span style={{ ...sans, fontSize: 9, fontWeight: 700, color: C.green,
            background: C.green + "1a", borderRadius: 4, padding: "2px 7px", flexShrink: 0 }}>RESULTS</span>}
          <span style={{ ...sans, fontSize: 11, color: C.faint, whiteSpace: "nowrap", overflow: "hidden",
                         textOverflow: "ellipsis" }}>{r.agenda}</span>
        </div>
      ))}
    </div>
  );
}

export default function Results({ API, onOpen }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("latest");

  useEffect(() => {
    if (!API) { setLoading(false); return; }
    let live = true;
    setLoading(true);
    fetch(`${API}/api/results`).then(r => r.json())
      .then(d => { if (live) { setData(d); setLoading(false); } })
      .catch(() => { if (live) { setData(null); setLoading(false); } });
    return () => { live = false; };
  }, [API]);

  const rows = useMemo(() => {
    const items = (data?.items || []).slice();
    const num = (x, f = -Infinity) => (x == null ? f : x);
    if (sort === "pat")   items.sort((a, b) => num(b.pat_yoy) - num(a.pat_yoy));
    if (sort === "sales") items.sort((a, b) => num(b.sales_yoy) - num(a.sales_yoy));
    if (sort === "beat")  items.sort((a, b) => num(b.surprise?.surprise_pct) - num(a.surprise?.surprise_pct));
    return items;  // "latest" keeps API order (newest report first)
  }, [data, sort]);

  if (loading) return (
    <div style={{ padding: 48, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading results…
    </div>
  );

  const th = { ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
    color: C.dim, padding: "10px 12px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" };
  const td = { ...mono, fontSize: 12, padding: "11px 12px", borderTop: `1px solid ${C.line}` };

  return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <CalendarClock size={20} color={C.gold} />
        <span style={{ ...serif, fontSize: 30, color: C.text }}>Results</span>
        <span style={{ ...sans, fontSize: 13, color: C.dim }}>{rows.length} names · latest reported quarter</span>
      </div>
      <div style={{ ...sans, fontSize: 12, color: C.faint, marginBottom: 16 }}>
        Most recent quarter, sales &amp; profit growth (YoY), and the latest full-year EPS vs the Street's estimate.
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {SORTS.map(s => (
          <button key={s.id} onClick={() => setSort(s.id)} style={{ ...sans, fontSize: 12,
            padding: "5px 12px", borderRadius: 8, cursor: "pointer",
            border: `1px solid ${sort === s.id ? C.line2 : "transparent"}`,
            background: sort === s.id ? C.bg800 : "transparent", color: sort === s.id ? C.gold : C.dim }}>
            {s.label}
          </button>
        ))}
      </div>

      {sort === "upcoming" ? <UpcomingCalendar API={API} onOpen={onOpen} /> : (
      <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Company</th>
              <th style={{ ...th, textAlign: "left" }}>Quarter</th>
              <th style={{ ...th, textAlign: "right" }}>Sales (₹cr)</th>
              <th style={{ ...th, textAlign: "right" }}>Sales YoY</th>
              <th style={{ ...th, textAlign: "right" }}>PAT (₹cr)</th>
              <th style={{ ...th, textAlign: "right" }}>PAT YoY</th>
              <th style={{ ...th, textAlign: "right" }}>OPM</th>
              <th style={{ ...th, textAlign: "right" }}>FY EPS vs est.</th>
              <th style={{ ...th, textAlign: "right" }}>Verdict</th>
              <th style={{ ...th }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const s = r.surprise;
              return (
                <tr key={r.ticker} onClick={() => onOpen && onOpen(r.ticker)} style={{ cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg800}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ ...td }}>
                    <div style={{ ...sans, fontSize: 13, fontWeight: 500, color: C.text }}>{r.name}</div>
                    <div style={{ ...mono, fontSize: 10, color: C.faint }}>{r.ticker} · {r.sector}</div>
                  </td>
                  <td style={{ ...td, ...sans, color: C.text200, whiteSpace: "nowrap" }}>{r.quarter || "—"}</td>
                  <td style={{ ...td, textAlign: "right", color: C.text }}>{cr(r.sales)}</td>
                  <td style={{ ...td, textAlign: "right" }}><Delta v={r.sales_yoy} /></td>
                  <td style={{ ...td, textAlign: "right", color: C.text }}>{cr(r.pat)}</td>
                  <td style={{ ...td, textAlign: "right" }}><Delta v={r.pat_yoy} /></td>
                  <td style={{ ...td, textAlign: "right", color: C.text }}>{pctRaw(r.opm)}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    {s && s.surprise_pct != null ? (
                      <span title={`FY${s.fy ?? ""}: reported ${s.reported ?? "—"} vs est. ${s.estimate ?? "—"}`}
                        style={{ ...mono, fontSize: 12, color: s.beat ? C.green : C.red }}>
                        {sp(s.surprise_pct)} {s.beat ? "beat" : "miss"}
                      </span>
                    ) : <span style={{ color: C.dim }}>—</span>}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}><VerdictBadge verdict={r.verdict} /></td>
                  <td style={{ ...td, textAlign: "center" }}><ChevronRight size={14} color={C.faint} /></td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ ...sans, textAlign: "center", padding: 40, color: C.faint }}>
                No results data yet — run a refresh to populate the quarter snapshots.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>)}
    </div>
  );
}
