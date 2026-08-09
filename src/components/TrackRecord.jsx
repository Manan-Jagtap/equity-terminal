/* TrackRecord.jsx — the model's verifiable track record.

   Reads /api/backtest: every verdict the engine has issued is snapshotted
   daily and compressed into discrete CALLS (a call opens when the verdict
   changes, closes when it changes again). Forward returns are measured per
   cohort; the headline is the BUY−AVOID spread. No backfilled history, no
   survivorship editing — the ledger starts the day tracking began. */
import { useMemo, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, ShieldCheck } from "lucide-react";
import { C, sans, mono } from "../lib/theme.js";
import { th, td, tdNum, thName, tdName } from "../design/table.js";
import { VerdictBadge } from "./primitives.jsx";
import PageHeader from "./ui/PageHeader.jsx";
import ErrorState from "./ui/ErrorState.jsx";
import Card from "./ui/Card.jsx";
import Button from "./ui/Button.jsx";
import StatTile from "./ui/StatTile.jsx";
import useResource from "../lib/useResource.js";
import { rowActivate } from "../lib/a11y.js";

const inr = v => v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: v >= 100 ? 0 : 2 });
const pct = v => v == null ? "—" : (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
/* Unsigned sibling for LEVELS (hit rate, share of book). pct() prefixes "+",
   which is correct for a return or an alpha and wrong for a rate — "+61.3% hit
   rate" reads as a 61-point improvement rather than a level. */
const rate = v => v == null ? "—" : (v * 100).toFixed(1) + "%";
const fmtDate = d => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
};

const COHORT_ORDER = ["BUY", "ACCUMULATE", "HOLD", "REDUCE", "AVOID"];
/* The ledger is append-only and already 2,457 calls; rendering every row
   produced a ~100,000px document (about 25,000 DOM nodes) that buried every
   section below it. The sort controls above make the interesting ends —
   best, worst, longest held — reachable without dumping the whole table. */
const ROWS_SHOWN = 200;
const SORTS = [
  { id: "latest", label: "Latest" },
  { id: "best",   label: "Best" },
  { id: "worst",  label: "Worst" },
  { id: "oldest", label: "Longest held" },
];

function Ret({ v, size = 12 }) {
  if (v == null) return <span style={{ ...mono, fontSize: size, color: C.dim }}>—</span>;
  const up = v >= 0;
  return (
    <span style={{ ...mono, fontSize: size, color: up ? C.green : C.red, display: "inline-flex", alignItems: "center", gap: 3 }}>
      {up ? <TrendingUp size={size - 1} /> : <TrendingDown size={size - 1} />}{pct(v)}
    </span>
  );
}

/* Signed return -> StatTile tone. A cohort with no calls is "muted", not a
   grey-painted zero — the distinction this whole page is about. */
const retTone = v => v == null ? "muted" : v >= 0 ? "up" : "down";

function CohortCard({ name, c }) {
  const hasData = c && c.n > 0;
  return (
    /* Card + StatTile, composed: the frame is the primitive's, and the
       badge-plus-sample-size row is the tile's `meta` slot rather than a
       hand-built flex header. */
    <Card pad="sm" style={{ minWidth: 150, flex: 1 }}>
      <StatTile
        size="md"
        label={<VerdictBadge verdict={name} />}
        meta={hasData ? `${c.n} call${c.n > 1 ? "s" : ""}` : "no calls"}
        value={hasData ? pct(c.avg_return) : "—"}
        tone={hasData ? retTone(c.avg_return) : "muted"}
        note={`avg price return${hasData && c.median_return != null ? ` · med ${pct(c.median_return)}` : ""}`}
      />
      {hasData && c.avg_total_return != null && (
        <div style={{ ...mono, fontSize: 11, marginTop: 3, color: c.avg_total_return >= 0 ? C.green : C.red }}>
          {pct(c.avg_total_return)} <span style={{ ...sans, color: C.dim }}>incl. dividends</span>
        </div>
      )}
      <div className="evc-stat-note" style={{ marginTop: 2 }}>
        {hasData && c.win_rate != null ? `${Math.round(c.win_rate * 100)}% correct` : name === "HOLD" ? "no direction" : ""}
        {hasData && c.avg_days != null ? ` · ~${Math.round(c.avg_days)}d held` : ""}
      </div>
    </Card>
  );
}

export default function TrackRecord({ API, onOpen }) {
  // useResource: the old fetch().then(r=>r.json()).catch() never fired its
  // .catch on an API 4xx/5xx (FastAPI answers with a JSON body), so an
  // outage rendered as an empty dataset rather than a failure.
  const { data, error, loading, retry } = useResource(API ? `${API}/api/backtest` : null);
  /* The engine ledger is a SECOND, richer public record — 191 graded calls
     benchmarked against NIFTY 50 over the same windows, plus the gap log and
     the dated methodology change-log. It has been live and reachable without
     auth the whole time and had no screen anywhere in the app. Its own note
     states the doctrine this page claims: "Recorded nightly, never backfilled
     — and, symmetrically, never scrubbed." That belongs in front of the user,
     not in a JSON payload.
     Non-blocking: if it fails, the backtest sections above still render. */
  const ledger = useResource(API ? `${API}/api/portfolio/engine-ledger` : null);
  const [sort, setSort] = useState("latest");


  const calls = useMemo(() => {
    const items = (data?.calls || []).slice();
    const num = (x, f = -Infinity) => (x == null ? f : x);
    if (sort === "best")   items.sort((a, b) => num(b.ret) - num(a.ret));
    if (sort === "worst")  items.sort((a, b) => num(a.ret, Infinity) - num(b.ret, Infinity));
    if (sort === "oldest") items.sort((a, b) => num(b.days) - num(a.days));
    return items;  // "latest" keeps API order (newest first)
  }, [data, sort]);

  if (loading) return (
    <div style={{ padding: 48, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} className="spin" /> Loading track record…
    </div>
  );

  // A failed request is not an empty dataset. useResource separates them;
  // this is where that distinction reaches the user.
  if (error) return (
    <div className="fadein" style={{ padding: "20px 24px 60px" }}>
      <PageHeader title="Track Record">
        Every verdict is snapshotted daily and graded in public — nothing backfilled.
      </PageHeader>
      <ErrorState error={error} onRetry={retry} what="the track record" />
    </div>
  );

  const cohorts = data?.cohorts || {};
  const spread = data?.buy_avoid_spread;
  const buyTR = cohorts?.BUY?.avg_total_return;
  const bench = data?.benchmark?.total_return;
  const excess = (buyTR != null && bench != null) ? buyTR - bench : null;
  return (
    <div style={{ padding: "20px 24px 60px" }}>
      <PageHeader
        title="Track Record"
        meta={data?.tracking_since
          ? `since ${fmtDate(data.tracking_since)} · ${data.total_calls} calls`
          : "no snapshots yet"}
      >
        {data?.tracking_since
          ? `${data.companies_tracked} companies · ${data.snapshot_days} snapshot day${data.snapshot_days > 1 ? "s" : ""}`
          : "The ledger starts with the next scheduler run."}
      </PageHeader>
      <div style={{ ...sans, fontSize: 11, color: C.dim, marginBottom: 18, display: "flex", alignItems: "center", gap: 6 }}>
        <ShieldCheck size={12} color={C.gold} />
        Every verdict is recorded the day it is issued and marked to market daily. Nothing is backfilled, edited or removed —
        this page is the model grading its own work in public.
      </div>

      {/* DAT-05: sample-size honesty — until the ledger is long enough, the spread
          is noise, not evidence of skill. Never let this page read as proven edge. */}
      {data?.snapshot_days != null && data.snapshot_days < 180 && (
        <div style={{ ...sans, fontSize: 11.5, lineHeight: 1.55, color: C.text200,
          background: C.gold + "12", border: `1px solid ${C.gold}33`, borderRadius: 8,
          padding: "10px 14px", marginBottom: 18 }}>
          <b style={{ color: C.gold }}>Early sample — not yet statistically meaningful.</b>{" "}
          The record spans only {data.snapshot_days} trading day{data.snapshot_days === 1 ? "" : "s"}; a few months
          of data cannot distinguish skill from luck, and returns shown are gross of costs, taxes and slippage.
          Treat this as a live experiment being run in the open, not a proven edge. Judge it over years, not weeks.
        </div>
      )}

      {/* Headline spread. tone="strong" is the --ev-line-2 hairline these two
          already carried — it is what separates the headline panels from the
          five cohort panels beside them. */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <Card pad="sm" tone="strong" style={{ minWidth: 230 }}>
          <StatTile
            size="xl"
            label="BUY − AVOID spread"
            value={spread == null ? "—" : pct(spread)}
            tone={retTone(spread)}
            note={spread == null
              ? "Needs at least one BUY and one AVOID call with history"
              : "If the model has signal, its BUYs should beat its AVOIDs. This is that test."}
          />
        </Card>
        {data?.benchmark && (
          <Card pad="sm" tone="strong" style={{ minWidth: 230 }}>
            <StatTile
              size="xl"
              label="BUY vs universe · total return"
              value={excess == null ? "—" : pct(excess)}
              tone={retTone(excess)}
              note={excess == null
                ? "Needs BUY calls with history"
                : `BUY ${pct(buyTR)} vs owning everything tracked ${pct(bench)} — dividends included`}
            />
          </Card>
        )}
        {COHORT_ORDER.map(v => <CohortCard key={v} name={v} c={cohorts[v]} />)}
      </div>

      {/* ── Engine ledger ──────────────────────────────────────────────────
          A second public record that had no screen: 191 graded calls marked
          against NIFTY 50 over the SAME windows, plus the gap log and the
          dated methodology change-log.

          Alpha leads, not the hit rate. The engine hits 61.3% and returns
          2.13% while NIFTY returned 1.98% over the same windows — so the
          honest number is +0.15pp, and a 61% hit rate quoted on its own would
          read as an edge that the benchmark says is not there. This page
          exists to grade the model in public; leading with the flattering
          figure would defeat it. */}
      {ledger.data?.summary && (() => {
        const s = ledger.data.summary;
        const alpha = s.alpha;
        /* Was a locally-declared `Stat` duplicating the headline panels above
           it, three sections apart in one file. Both are now the same two
           primitives, so they cannot drift. */
        const Stat = ({ label, value, tone, note }) => (
          <Card pad="sm" tone="strong" style={{ minWidth: 210 }}>
            <StatTile size="xl" label={label} value={value} tone={tone} note={note} />
          </Card>
        );
        return (
          <div style={{ marginTop: 34 }}>
            <div style={{ ...sans, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em",
                          color: C.gold, marginBottom: 4 }}>Engine ledger</div>
            <div style={{ ...sans, fontSize: 11.5, color: C.dim, marginBottom: 14, maxWidth: "72ch",
                          lineHeight: 1.6 }}>
              {ledger.data.note}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <Stat label={`Alpha vs ${s.benchmark || "benchmark"}`}
                    value={alpha == null ? "—" : pct(alpha)}
                    tone={retTone(alpha)}
                    note={`engine ${pct(s.avg_return)} · benchmark ${pct(s.benchmark_return)}`} />
              <Stat label="Hit rate" value={rate(s.hit_rate)}
                    note={`${s.n_graded} calls graded, 7+ days old`} />
            </div>
            {alpha != null && Math.abs(alpha) < 0.02 && (
              <div style={{ ...sans, fontSize: 11.5, lineHeight: 1.55, color: C.text200,
                background: C.gold + "12", border: `1px solid ${C.gold}33`, borderRadius: 8,
                padding: "10px 14px", marginBottom: 16, maxWidth: "78ch" }}>
                <b style={{ color: C.gold }}>No demonstrated edge yet.</b>{" "}
                A {rate(s.hit_rate)} hit rate sounds like skill, but against the benchmark over the
                same windows the difference is {(alpha * 100).toFixed(2)}pp — inside the noise. The hit rate is shown
                second on purpose.
              </div>
            )}

            {/* The gap log. A missing stretch is disclosed rather than quietly
                interpolated — that is the whole claim this page makes. */}
            {ledger.data.gaps?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ ...sans, fontSize: 10, textTransform: "uppercase",
                              letterSpacing: "0.1em", color: C.dim, marginBottom: 6 }}>
                  Recorded gaps — not backfilled
                </div>
                {ledger.data.gaps.map((g, i) => (
                  <div key={i} style={{ ...sans, fontSize: 11.5, lineHeight: 1.6, color: C.text200,
                    border: `1px solid ${C.line}`, borderLeft: `2px solid ${C.gold}`,
                    borderRadius: 6, padding: "9px 13px", marginBottom: 6, maxWidth: "82ch" }}>
                    <span style={{ ...mono, color: C.gold }}>{fmtDate(g.from)} → {fmtDate(g.to)}</span>
                    {" — "}{g.reason}
                  </div>
                ))}
              </div>
            )}

            {ledger.data.methodology_notes?.length > 0 && (
              <div>
                <div style={{ ...sans, fontSize: 10, textTransform: "uppercase",
                              letterSpacing: "0.1em", color: C.dim, marginBottom: 6 }}>
                  Methodology changes — disclosed, never applied backwards
                </div>
                {ledger.data.methodology_notes.map((n, i) => (
                  <details key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 6,
                    padding: "9px 13px", marginBottom: 6, maxWidth: "82ch" }}>
                    <summary style={{ ...sans, fontSize: 11.5, color: C.text200, cursor: "pointer" }}>
                      <span style={{ ...mono, color: C.gold }}>{fmtDate(n.effective)}</span>
                      {" — "}{String(n.change).split(".")[0]}.
                    </summary>
                    <div style={{ ...sans, fontSize: 11.5, lineHeight: 1.65, color: C.dim, marginTop: 8 }}>
                      {n.change}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Calls ledger */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 10px" }}>
        <span style={{ ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim }}>Call ledger</span>
        {/* Say what is being withheld. A truncated table that does not admit
            it is truncated reads as the complete record, which on THIS page
            of all pages would be the wrong impression. */}
        {calls.length > ROWS_SHOWN && (
          <span style={{ ...mono, fontSize: 10, color: C.faint }}>
            showing {ROWS_SHOWN} of {calls.length.toLocaleString("en-IN")} — re-sort to see the other ends
          </span>
        )}
        <div style={{ flex: 1 }} />
        {/* A segmented control, so it is built as one: `pressed` emits
            aria-pressed, which the hand-rolled version never did — the active
            sort was conveyed by amber text alone and a screen reader was told
            nothing at all. */}
        {SORTS.map(s => (
          <Button key={s.id} size="xs" variant="ghost" tone="muted"
            pressed={sort === s.id} onClick={() => setSort(s.id)}>
            {s.label}
          </Button>
        ))}
      </div>

      {!calls.length ? (
        <div style={{ ...sans, fontSize: 12, color: C.dim, padding: "28px 0" }}>
          No calls recorded yet. The scheduler snapshots every verdict after each
          daily price refresh — the first entries appear within a day of deploy.
        </div>
      ) : (
        /* pad="none" — the table supplies its own cell rhythm from
           design/table.js; the Card is only the frame. overflow-x:auto also
           does the clipping the rounded corners need. */
        <Card pad="none" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.line}` }}>
                <th style={thName}>Company</th>
                <th style={{ ...th, textAlign: "left" }}>Call</th>
                <th style={th}>Opened</th>
                <th style={th}>Entry</th>
                <th style={th}>MoS at call</th>
                <th style={th}>Status</th>
                <th style={th}>Mark</th>
                <th style={th}>Return</th>
                <th style={th}>Total</th>
                <th style={th}>Days</th>
              </tr>
            </thead>
            <tbody>
              {calls.slice(0, ROWS_SHOWN).map((c, i) => (
                <tr key={`${c.ticker}-${c.start_date}-${i}`}
                    {...rowActivate(() => onOpen && c.ticker && onOpen(c.ticker))}
                    style={{ borderBottom: `1px solid ${C.line}`, cursor: onOpen ? "pointer" : "default" }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.panel2; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  {/* One line of ticker, so this column can take tdName whole —
                      clamp included. */}
                  <td style={{ ...tdName, ...mono, color: C.gold }}>{c.ticker || "—"}</td>
                  <td style={{ ...td, textAlign: "left" }}><VerdictBadge verdict={c.verdict} /></td>
                  <td style={tdNum}>{fmtDate(c.start_date)}</td>
                  <td style={tdNum}>{inr(c.start_price)}</td>
                  <td style={tdNum}>{pct(c.mos_at_call)}</td>
                  <td style={{ ...tdNum, color: c.open ? C.green : C.dim }}>{c.open ? "OPEN" : `closed ${fmtDate(c.end_date)}`}</td>
                  <td style={tdNum}>{inr(c.end_price)}</td>
                  <td style={td}><Ret v={c.ret} /></td>
                  <td style={td}
                      title={c.div_ret ? `incl. ${pct(c.div_ret)} from dividends` : "no dividends in window"}>
                    <Ret v={c.total_ret != null ? c.total_ret : c.ret} />
                  </td>
                  <td style={tdNum}>{c.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

    </div>
  );
}
