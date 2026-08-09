/* Ideas.jsx — multi-factor Alpha Score ranking.

   Reads /api/factors: a transparent value/quality/momentum/low-vol/growth
   composite (plus the catalyst estimate-revision and EPS-surprise overlays,
   which participate as their data accrues) that ranks the visible universe
   into a short idea list, with a factor breakdown per name. A research/
   ranking aid — NOT investment advice. */
import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { C, sans, mono } from "../lib/theme.js";
import { th, td, tdNum, thName, tdStack, stackLine } from "../design/table.js";
import PageSkeleton from "./Skeleton.jsx";
import { selStyle } from "../lib/listControls.jsx";
import { VerdictBadge } from "./primitives.jsx";
import PageHeader from "./ui/PageHeader.jsx";
import ErrorState from "./ui/ErrorState.jsx";
import useResource from "../lib/useResource.js";
import { rowActivate, buttonReset } from "../lib/a11y.js";

const FACTORS = [
  ["value", "Value"], ["quality", "Quality"], ["momentum", "Momentum"],
  ["low_vol", "Low Vol"], ["growth", "Growth"], ["catalyst", "Catalyst"],
  ["surprise", "Surprise"],
];

// Plain-English "why is this ranked here": the two strongest factor
// percentiles carry the rank; the weakest is named so the trade-off is
// visible — no black box.
function whyRanked(r) {
  const fs = FACTORS
    .map(([k, label]) => [label, r.factors?.[k]])
    .filter(([, v]) => v != null);
  if (fs.length < 2) return null;
  const sorted = [...fs].sort((a, b) => b[1] - a[1]);
  const [t1, t2] = sorted;
  const worst = sorted[sorted.length - 1];
  let out = `Carried by ${t1[0]} (${t1[1]}th pct) and ${t2[0]} (${t2[1]}th)`;
  if (worst[1] < 40) out += `; watch ${worst[0]} (${worst[1]}th)`;
  return out + ".";
}

const scoreColor = (v) =>
  v == null ? C.dim : v >= 70 ? C.green : v >= 45 ? C.gold : C.red;

function Cell({ v }) {
  // 0-100 factor cell: number + a thin proportional bar.
  return (
    <td style={{ ...tdNum, minWidth: 62 }}>
      <div style={{ ...mono, fontSize: 11, color: scoreColor(v) }}>{v == null ? "—" : Math.round(v)}</div>
      <div style={{ height: 3, background: C.bg600, borderRadius: 2, marginTop: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${v == null ? 0 : v}%`, background: scoreColor(v), opacity: 0.7 }} />
      </div>
    </td>
  );
}

export default function Ideas({ API, onOpen }) {
  /* /api/factors IS this screen, so it gets the full honest lifecycle.
     The old code was `fetch(url).then(r => r.json()).catch(...)`, which
     RESOLVES on a 4xx/5xx because the API answers errors with a JSON body
     (verified on prod: GET /api/definitely-not-a-route → HTTP 404,
     content-type application/json). The .catch therefore never fired, `data`
     became the error envelope, `data?.ideas` was undefined, and the screen
     rendered "No ranked ideas yet — the factor pass runs after the daily
     valuation recompute": a confident statement about the user's data that we
     had no evidence for, followed by a remedy that could not have helped. */
  const { data, error, loading, retry } = useResource(API ? `${API}/api/factors` : null);
  const [sector, setSector] = useState("All");
  const [sortKey, setSortKey] = useState("alpha_score");
  const [sortDir, setSortDir] = useState("desc");

  /* The backtest is a SECONDARY card beside sector strength — the ranked table
     below stands on its own without it, so a failure here degrades quietly
     (one dim line inside the card) rather than replacing a working screen with
     a full-width error panel.

     btErr is tracked separately from `bt` because the card has two very
     different stories to tell and the old code collapsed them into one: "we
     could not reach the backtest" vs "we reached it and it has fewer than 5
     snapshot days so far". Only the second one justifies the "Accruing…" copy.
     Same r.ok bug as above — without the check a 500 fell into the bt-is-truthy
     branch with bt.n undefined, so `bt.n >= 5` was false and the outage read as
     "Accruing". */
  const [bt, setBt] = useState(null);
  const [btErr, setBtErr] = useState(false);
  useEffect(() => {
    if (!API) return;
    let live = true;
    fetch(`${API}/api/factors/backtest`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { if (live) { setBt(d); setBtErr(false); } })
      .catch(() => { if (live) { setBt(null); setBtErr(true); } });
    return () => { live = false; };
  }, [API]);

  const ideas = data?.ideas || [];
  const sectors = useMemo(
    () => ["All", ...Array.from(new Set(ideas.map(i => i.sector).filter(Boolean))).sort()],
    [ideas]
  );
  const shown = useMemo(() => {
    let out = sector === "All" ? ideas : ideas.filter(i => i.sector === sector);
    const get = i => (sortKey === "alpha_score" ? i.alpha_score : i.factors?.[sortKey]);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...out].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; if (vb == null) return -1;
      return (va - vb) * dir;
    });
  }, [ideas, sector, sortKey, sortDir]);

  if (loading) return <PageSkeleton label="Ranking the universe…" cards={3} />;

  // A failed request is not an empty ranking. useResource keeps the two apart;
  // this is where that distinction reaches the user.
  if (error) return (
    <div className="fadein" style={{ padding: "22px 26px 60px" }}>
      <PageHeader title="Ideas">
        A transparent 7-factor Alpha Score — quality, momentum, value, low-vol, growth,
        estimate revisions and earnings surprise, each shown so you can disagree with it.
      </PageHeader>
      <ErrorState error={error} onRetry={retry} what="the ranking" />
    </div>
  );

  return (
    <div className="fadein" style={{ padding: "22px 26px 60px" }}>
      <PageHeader title="Ideas" meta={`${ideas.length} names ranked`}>
        A transparent 7-factor Alpha Score — quality, momentum, value, low-vol, growth,
        estimate revisions and earnings surprise, each shown so you can disagree with it.
      </PageHeader>
      <div style={{ ...sans, fontSize: 11.5, color: C.faint, lineHeight: 1.6, maxWidth: 780, marginBottom: 14, display: "flex", gap: 6 }}>
        <Info size={13} color={C.dim} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          A transparent multi-factor composite — <b style={{ color: C.text200 }}>Quality &amp; Momentum</b> (the
          strongest factors in Indian equities), tempered by <b style={{ color: C.text200 }}>Low-Volatility</b>, with
          Value and Growth as diversifiers. Each factor is a cross-sectional percentile (0–100); Alpha blends them by
          the weights below. This ranks where the odds tilt — it is a research aid, <b style={{ color: C.text200 }}>not
          investment advice or a guarantee of returns</b>. Pair it with the valuation verdict and your own risk rules.
        </span>
      </div>
      {data?.weights && (
        <div style={{ ...mono, fontSize: 10.5, color: C.dim, marginBottom: 16 }}>
          weights: {Object.entries(data.weights).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join("  ·  ")}
        </div>
      )}

      {/* Factor backtest + sector strength */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: "1 1 320px", border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", background: "rgba(16,14,10,0.5)" }}>
          <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim, marginBottom: 10 }}>
            Factor backtest · forward return by Alpha bucket
          </div>
          {btErr ? (
            /* Quiet, in-card, and scoped to what actually failed: this is a
               supplementary panel in a sidebar-width card, so a full-width
               ErrorState here would announce an outage the rest of the screen
               is not having. No auto-retry is claimed because this fetch has
               no online/visibility listener — the effect is keyed on API, so
               it genuinely re-runs on the next mount and nothing sooner. */
            <div style={{ ...sans, fontSize: 11, color: C.faint, lineHeight: 1.6 }}>
              The factor track record didn't load — this card only. The ranking below is
              unaffected and comes from a separate request. It reloads next time you open Ideas.
            </div>
          ) : bt && bt.n >= 5 ? (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                {bt.buckets.map(b => {
                  const r = b.avg_return || 0;
                  const h = Math.min(52, Math.abs(r) * 420);
                  return (
                    <div key={b.label} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ height: 54, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                        <div style={{ height: h, background: r >= 0 ? C.green : C.red, borderRadius: 2, opacity: 0.85 }} />
                      </div>
                      <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 3 }}>{b.label}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ ...sans, fontSize: 10, color: C.dim, marginTop: 8 }}>
                Q1−Q5 spread:{" "}
                <span style={{ ...mono, color: (bt.top_minus_bottom || 0) >= 0 ? C.green : C.red }}>
                  {bt.top_minus_bottom != null ? (bt.top_minus_bottom * 100).toFixed(1) + "%" : "—"}
                </span>{" "}· since {bt.tracking_since || "—"} ({bt.snapshot_days || 0}d)
              </div>
            </>
          ) : (
            <div style={{ ...sans, fontSize: 11, color: C.faint, lineHeight: 1.6 }}>
              Accruing — the factor track record needs a few snapshot days to be meaningful. Capture began {bt?.tracking_since || "today"}; Q1 (highest Alpha) should out-earn Q5 over time.
            </div>
          )}
        </div>
        <div style={{ flex: "1 1 320px", border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", background: "rgba(16,14,10,0.5)" }}>
          <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim, marginBottom: 10 }}>
            Sector strength · avg Alpha (click to filter)
          </div>
          {(data?.sectors || []).slice(0, 6).map(s => (
            <button type="button" key={s.sector} onClick={() => setSector(s.sector)}
                 style={{ ...buttonReset,  display: "flex", alignItems: "center", gap: 8, padding: "3px 0", cursor: "pointer"  }}>
              <div style={{ ...sans, fontSize: 11, color: C.text200, width: 130, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.sector}</div>
              <div style={{ flex: 1, height: 5, background: C.bg600, borderRadius: 6 }}>
                <div style={{ height: "100%", width: `${s.avg_alpha || 0}%`, background: scoreColor(s.avg_alpha), borderRadius: 6 }} />
              </div>
              <div style={{ ...mono, fontSize: 11, color: scoreColor(s.avg_alpha), width: 26, textAlign: "right" }}>{s.avg_alpha != null ? Math.round(s.avg_alpha) : "—"}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Sector + sort controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <select value={sector} onChange={e => setSector(e.target.value)} style={selStyle}
          title="Filter by sector">
          {sectors.map(s => <option key={s} value={s}>{s === "All" ? "All sectors" : s}</option>)}
        </select>
        <span style={{ ...sans, fontSize: 11, color: C.faint }}>sort</span>
        <select value={sortKey} onChange={e => setSortKey(e.target.value)} style={selStyle}
          title="Rank by this factor">
          {[["alpha_score", "Alpha"], ["value", "Value"], ["quality", "Quality"],
            ["momentum", "Momentum"], ["low_vol", "Low Vol"], ["growth", "Growth"],
            ["catalyst", "Catalyst"], ["surprise", "Surprise"]].map(([k, l]) =>
            <option key={k} value={k}>{l}</option>)}
        </select>
        <button onClick={() => setSortDir(d => (d === "desc" ? "asc" : "desc"))} style={selStyle}
          title="Toggle direction">{sortDir === "desc" ? "High → Low ↓" : "Low → High ↑"}</button>
        <span style={{ ...sans, fontSize: 11, color: C.dim }}>{shown.length} names</span>
      </div>

      {!shown.length ? (
        <div style={{ ...sans, fontSize: 12, color: C.dim, padding: "28px 0" }}>
          No ranked ideas yet — the factor pass runs after the daily valuation recompute.
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "rgba(16,14,10,0.6)", minWidth: 860 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.line}` }}>
                <th style={{ ...th, textAlign: "left" }}>#</th>
                <th style={thName}>Company</th>
                <th style={th}>Alpha</th>
                {FACTORS.map(([, label]) => <th key={label} style={th}>{label}</th>)}
                <th style={th}>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.ticker}
                    {...rowActivate(() => onOpen && onOpen(r.ticker))}
                    style={{ borderBottom: `1px solid ${C.line}`, cursor: onOpen ? "pointer" : "default" }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.panel2; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdNum, textAlign: "left", color: C.faint }}>{r.rank}</td>
                  {/* Ticker and sector clamp to one line each; the whyRanked
                      sentence clamps to TWO. A single-line clamp would cut the
                      explanation, and no clamp let the row track the sentence's
                      length — measured at four distinct heights, 99-126px, a
                      27px spread across 40 rows. Two lines fits the sentence in
                      the common case and pins the row in every case; the full
                      text stays on hover. */}
                  <td style={tdStack}>
                    <div style={{ ...sans, fontSize: 12.5, fontWeight: 500, color: C.gold, ...stackLine }}>{r.ticker}</div>
                    <div style={{ ...sans, fontSize: 10, color: C.faint, ...stackLine }}>{r.sector || ""}</div>
                    {whyRanked(r) && (
                      <div title={whyRanked(r)}
                        style={{ ...sans, fontSize: 10.5, color: C.dim, marginTop: 3, lineHeight: 1.45,
                                 overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                                 WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {whyRanked(r)}
                      </div>
                    )}
                  </td>
                  <td style={tdNum}>
                    <span style={{ ...mono, fontSize: 15, fontWeight: 600, color: scoreColor(r.alpha_score) }}>
                      {r.alpha_score == null ? "—" : r.alpha_score}
                    </span>
                  </td>
                  {FACTORS.map(([k]) => <Cell key={k} v={r.factors?.[k]} />)}
                  <td style={td}>
                    <VerdictBadge verdict={r.verdict || "—"} />
                    {r.engines_disagree && (
                      /* FIX-15: the two engines tell opposite stories — say so
                         where both numbers sit, with the one-line why on hover. */
                      <div
                        title={r.disagree_note || ""}
                        style={{ ...sans, fontSize: 9.5, marginTop: 3, color: C.gold,
                                 border: `1px solid ${C.gold}44`, borderRadius: 6,
                                 padding: "1px 5px", display: "inline-block", cursor: "help" }}>
                        ⚖ engines disagree
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
