/* Results.jsx — cross-company earnings scoreboard.
   Reads /api/results: latest reported quarter + sales/PAT YoY + EPS beat/miss. */
import { useMemo, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { C, sans, mono } from "../lib/theme.js";
import { th, td, tdNum, thName, tdStack, stackLine } from "../design/table.js";
import { ListToolbar, applyControls, selStyle } from "../lib/listControls.jsx";
import { VerdictBadge } from "./primitives.jsx";
import PageHeader from "./ui/PageHeader.jsx";
import ErrorState from "./ui/ErrorState.jsx";
import useResource from "../lib/useResource.js";
import { rowActivate, buttonReset } from "../lib/a11y.js";
import { growthOnBase } from "../lib/formatters.js";

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
  { id: "dividends", label: "Dividends" },
];

/* `v` is a YoY RATIO the backend already computed, so its base is not in the
   payload — but it is recoverable: prior = current / (1 + v).

   That matters because the ratio is sign-inverted whenever the base was
   negative. TATACHEM reported PAT -2,116 cr with pat_yoy 42.18, i.e. a -49 cr
   loss ballooning 43x — and this rendered "▲ +4,218.4%" in GREEN, ranked #6
   when the user sorted by "PAT growth". URBANCO (+5,267%) and DBREALTY
   (+2,850%) were the same. Someone scanning for the fastest-growing profits was
   handed three companies that lost money.

   `level` is the current absolute figure (r.pat / r.sales). When it is absent
   the old behaviour stands — this only ever ADDS a guard. */
function Delta({ v, level }) {
  if (v == null) return <span style={{ ...mono, fontSize: 11, color: C.dim }}>—</span>;
  if (level != null && isFinite(level) && (1 + v) !== 0) {
    const prior = level / (1 + v);
    const g = growthOnBase(level, prior);
    if (!g.sortable) {
      const tone = g.tone === "pos" ? C.green : g.tone === "neg" ? C.red : C.dim;
      return (
        <span title={g.title} style={{ ...mono, fontSize: 10, color: tone, whiteSpace: "nowrap" }}>
          {g.txt}
        </span>
      );
    }
  }
  const up = v >= 0;
  return (
    <span style={{ ...mono, fontSize: 11, color: up ? C.green : C.red, display: "inline-flex", alignItems: "center", gap: 3 }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{signed(v)}
    </span>
  );
}

/* Sort key for a growth column: a ratio off a negative base is not a growth
   rate, so it must not compete for the top of the leaderboard. Those rows sink
   rather than disappear — they are still real results. */
const growthSortKey = (ratio, level) => {
  if (ratio == null || !isFinite(ratio)) return -Infinity;
  if (level != null && isFinite(level) && (1 + ratio) !== 0) {
    const prior = level / (1 + ratio);
    if (!(prior > 0)) return -Infinity;
  }
  return ratio;
};

function UpcomingCalendar({ API, onOpen }) {
  /* This calendar is not a widget beside the table — when the "Upcoming" sort
     is selected it REPLACES the table and is the whole content of the tab, so
     it earns the full lifecycle rather than a quiet inline note.

     The old `.catch(() => setCal({ items: [] }))` was wrong twice over. It
     could not fire on an API 4xx/5xx, because the API answers errors with a
     JSON body (prod: GET /api/definitely-not-a-route → HTTP 404, content-type
     application/json) and so `r.json()` RESOLVES; and on the paths where it did
     fire it synthesised an empty dataset, which rendered "No upcoming board
     meetings on file yet — the calendar fills after the next weekly sweep of
     exchange board-meeting notices". That is an outage reported to the user as
     a fact about the exchange calendar, with a wait as the remedy. */
  const { data: cal, error, loading, retry } =
    useResource(API ? `${API}/api/results/upcoming` : null);
  const [controls, setControls] = useState({});
  const [when, setWhen] = useState("all"); // all | upcoming | done
  if (loading) return <div style={{ ...sans, padding: 32, color: C.dim, fontSize: 13 }}>Loading calendar…</div>;
  if (error) return <ErrorState error={error} onRetry={retry} what="the calendar" />;
  let items = applyControls(cal?.items || [], controls);
  if (when === "upcoming") items = items.filter(r => r.days_away >= 0);
  if (when === "done") items = items.filter(r => r.days_away < 0);
  if (!items.length) return (
    <div style={{ ...sans, padding: 32, color: C.dim, fontSize: 13, lineHeight: 1.6 }}>
      No upcoming board meetings on file yet — the calendar fills after the next weekly sweep of exchange
      board-meeting notices (Saturdays), and results season concentrates dates in Apr / Jul / Oct / Jan.
    </div>
  );
  return (
    <>
    <ListToolbar rows={cal?.items} controls={controls} setControls={setControls}
      extra={
        <select value={when} onChange={e => setWhen(e.target.value)} style={selStyle}
          title="Show meetings by status">
          <option value="all">All meetings</option>
          <option value="upcoming">Upcoming only</option>
          <option value="done">Already done</option>
        </select>
      } />
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
      {items.map((r, i) => (
        <button type="button" key={i} onClick={() => onOpen && onOpen(r.ticker)}
          onMouseEnter={e => e.currentTarget.style.background = C.bg800}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          style={{ ...buttonReset,  display: "flex", alignItems: "baseline", gap: 14, padding: "11px 16px",
                   borderTop: i ? `1px solid ${C.line}` : "none", cursor: "pointer"  }}>
          <span style={{ ...mono, fontSize: 12, color: r.days_away <= 3 ? C.gold : C.text200, flexShrink: 0, minWidth: 88 }}>
            {r.date}
          </span>
          <span style={{ ...sans, fontSize: 10, color: C.dim, flexShrink: 0, minWidth: 52 }}>
            {r.days_away === 0 ? "today" : r.days_away < 0 ? `${-r.days_away}d ago` : `in ${r.days_away}d`}
          </span>
          <span style={{ ...mono, fontSize: 12, color: C.gold, flexShrink: 0, minWidth: 100 }}>{r.ticker}</span>
          <span style={{ ...sans, fontSize: 12.5, color: C.text, flexShrink: 0 }}>{r.name}</span>
          {r.results_meeting && <span style={{ ...sans, fontSize: 9, fontWeight: 700, color: C.green,
            background: C.green + "1a", borderRadius: 6, padding: "2px 7px", flexShrink: 0 }}>RESULTS</span>}
          <span style={{ ...sans, fontSize: 11, color: C.faint, whiteSpace: "nowrap", overflow: "hidden",
                         textOverflow: "ellipsis" }}>{r.agenda}</span>
        </button>
      ))}
    </div>
    </>
  );
}

const ACT_TONE = { dividend: C.green, split: "#9d8fd4", bonus: C.gold };
function actLabel(a) {
  if (a.type === "dividend") return `₹${Number(a.value).toFixed(2)}/sh` + (a.yield_pct != null ? ` · ${a.yield_pct}%` : "");
  if (a.type === "split") return a.ratio ? `Split (×${(1 / a.ratio).toFixed(0)})` : "Split";
  if (a.type === "bonus") return a.ratio ? `Bonus (${Math.round(1 / a.ratio - 1)}:1)` : "Bonus";
  return a.type;
}

function DividendCalendar({ API, onOpen }) {
  // Same shape as UpcomingCalendar: this IS the "Dividends" tab, and its
  // fabricated `{ upcoming: [], recent: [] }` fallback rendered an outage as
  // "No dividend / split / bonus ex-dates on file yet". An ex-date the user
  // misses because we said there wasn't one is a real, dated loss.
  const { data: d, error, loading, retry } =
    useResource(API ? `${API}/api/results/corporate-actions` : null);
  if (loading) return <div style={{ ...sans, padding: 32, color: C.dim, fontSize: 13 }}>Loading calendar…</div>;
  if (error) return <ErrorState error={error} onRetry={retry} what="the calendar" />;
  const today = new Date().toISOString().slice(0, 10);
  const Row = (a, i) => (
    <button type="button" key={a.ticker + a.type + a.ex_date + i} onClick={() => onOpen && onOpen(a.ticker)}
      onMouseEnter={e => e.currentTarget.style.background = C.bg800}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      style={{ ...buttonReset, width: "100%", boxSizing: "border-box",   display: "flex", alignItems: "baseline", gap: 14, padding: "11px 16px",
               borderTop: i ? `1px solid ${C.line}` : "none", cursor: "pointer"  }}>
      <span style={{ ...mono, fontSize: 12, color: a.ex_date >= today ? C.gold : C.text200, flexShrink: 0, minWidth: 92 }}>{a.ex_date}</span>
      <span style={{ ...mono, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em",
                     color: ACT_TONE[a.type] || C.dim, flexShrink: 0, minWidth: 62 }}>ex · {a.type}</span>
      <span style={{ ...sans, fontSize: 13, color: C.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
      <span style={{ ...mono, fontSize: 11.5, color: ACT_TONE[a.type] || C.text200, flexShrink: 0 }}>{actLabel(a)}</span>
    </button>
  );
  const section = (title, arr) => (arr || []).length > 0 && (
    <div style={{ marginBottom: 18 }}>
      <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.dim, marginBottom: 8 }}>{title} · {arr.length}</div>
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>{arr.map(Row)}</div>
    </div>
  );
  if (!(d?.upcoming || []).length && !(d?.recent || []).length) return (
    <div style={{ ...sans, padding: 32, color: C.dim, fontSize: 13, lineHeight: 1.6 }}>
      No dividend / split / bonus ex-dates on file yet — the ledger fills from the corporate-actions feed on the next refresh.
    </div>
  );
  return <>{section("Upcoming ex-dates", d.upcoming)}{section("Recent (last 120 days)", d.recent)}</>;
}

export default function Results({ API, onOpen }) {
  // See useResource: the previous fetch().then(r=>r.json()).catch() never fired
  // its .catch on an API 4xx/5xx (FastAPI answers with JSON), so an outage
  // rendered as "No results data yet — run a refresh".
  const { data, error, loading, retry } = useResource(API ? `${API}/api/results` : null);
  const [sort, setSort] = useState("latest");
  const [controls, setControls] = useState({});


  const rows = useMemo(() => {
    const items = applyControls( (data?.items || []).slice(), controls);
    const num = (x, f = -Infinity) => (x == null ? f : x);
    if (sort === "pat")   items.sort((a, b) => growthSortKey(num(b.pat_yoy), num(b.pat)) - growthSortKey(num(a.pat_yoy), num(a.pat)));
    if (sort === "sales") items.sort((a, b) => num(b.sales_yoy) - num(a.sales_yoy));
    if (sort === "beat")  items.sort((a, b) => num(b.surprise?.surprise_pct) - num(a.surprise?.surprise_pct));
    return items;  // "latest" keeps API order (newest report first)
  }, [data, sort, controls]);

  if (loading) return (
    <div style={{ padding: 48, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} className="spin" /> Loading results…
    </div>
  );

  if (error) return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <PageHeader title="Results">
        Most recent quarter, sales &amp; profit growth (YoY), and the latest full-year EPS vs the Street's estimate.
      </PageHeader>
      <ErrorState error={error} onRetry={retry} what="results" />
    </div>
  );

  return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <PageHeader title="Results" meta={`${rows.length} names · latest reported quarter`}>
        Most recent quarter, sales &amp; profit growth (YoY), and the latest full-year EPS vs the Street's estimate.
      </PageHeader>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <ListToolbar rows={data?.items} controls={controls} setControls={setControls}
          metrics={[["sales_yoy", "Sales YoY"], ["pat_yoy", "PAT YoY"], ["opm", "OPM %"],
                    ["surprise.surprise_pct", "EPS surprise"]]} />
        {SORTS.map(s => (
          <button key={s.id} onClick={() => setSort(s.id)} style={{ ...sans, fontSize: 12,
            padding: "5px 12px", borderRadius: 8, cursor: "pointer",
            border: `1px solid ${sort === s.id ? C.line2 : "transparent"}`,
            background: sort === s.id ? C.bg800 : "transparent", color: sort === s.id ? C.gold : C.dim }}>
            {s.label}
          </button>
        ))}
      </div>

      {sort === "dividends" ? <DividendCalendar API={API} onOpen={onOpen} /> :
       sort === "upcoming" ? <UpcomingCalendar API={API} onOpen={onOpen} /> : (
      <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
          <thead>
            <tr>
              <th style={thName}>Company</th>
              <th style={{ ...th, textAlign: "left" }}>Quarter</th>
              <th style={th}>Sales (₹cr)</th>
              <th style={th}>Sales YoY</th>
              <th style={th}>PAT (₹cr)</th>
              <th style={th}>PAT YoY</th>
              <th style={th}>OPM</th>
              <th style={th}>FY EPS vs est.</th>
              <th style={th}>Verdict</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const s = r.surprise;
              return (
                <tr key={r.ticker} {...rowActivate(() => onOpen && onOpen(r.ticker))} style={{ cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg800}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                    {/* Each LINE clamps independently: clamping the cell would drop the
                      sub-line, and clamping neither let the row grow — Operations ran ten
                      distinct heights (52-111px) before this. */}
                  <td style={tdStack}>
                    <div title={r.name} style={{ ...sans, fontSize: 13, fontWeight: 500, color: C.text, ...stackLine }}>{r.name}</div>
                    <div style={{ ...mono, fontSize: 10, color: C.faint, ...stackLine }}>{r.ticker} · {r.sector}</div>
                  </td>
                  <td style={{ ...td, textAlign: "left", color: C.text200, whiteSpace: "nowrap" }}>{r.quarter || "—"}</td>
                  <td style={tdNum}>{cr(r.sales)}</td>
                  <td style={tdNum}><Delta v={r.sales_yoy} level={r.sales} /></td>
                  <td style={tdNum}>{cr(r.pat)}</td>
                  <td style={tdNum}><Delta v={r.pat_yoy} level={r.pat} /></td>
                  <td style={tdNum}>{pctRaw(r.opm)}</td>
                  <td style={tdNum}>
                    {s && s.surprise_pct != null ? (
                      <span title={`FY${s.fy ?? ""}: reported ${s.reported ?? "—"} vs est. ${s.estimate ?? "—"}`}
                        style={{ ...mono, fontSize: 12, color: s.beat ? C.green : C.red }}>
                        {sp(s.surprise_pct)} {s.beat ? "beat" : "miss"}
                      </span>
                    ) : <span style={{ color: C.dim }}>—</span>}
                    {r.beat_rate != null && (
                      <div style={{ ...mono, fontSize: 9, color: C.faint, marginTop: 2 }}>
                        {r.streak ? (r.streak > 0 ? `${r.streak}Q beat · ` : `${-r.streak}Q miss · `) : ""}
                        beat {Math.round(r.beat_rate * 100)}%
                        {r.estimate_momentum && r.estimate_momentum !== "steady"
                          ? ` · est ${r.estimate_momentum === "improving" ? "↑" : "↓"}` : ""}
                      </div>
                    )}
                  </td>
                  <td style={td}><VerdictBadge verdict={r.verdict} /></td>
                  <td style={{ ...td, textAlign: "center" }}><ChevronRight size={14} color={C.faint} /></td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ ...sans, textAlign: "center", padding: 40, color: C.faint }}>
                No quarterly results are published for this universe yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>)}
    </div>
  );
}
