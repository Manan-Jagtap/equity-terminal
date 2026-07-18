/* Ideas.jsx — multi-factor Alpha Score ranking.

   Reads /api/factors: a transparent value/quality/momentum/low-vol/growth
   composite (plus the catalyst estimate-revision and EPS-surprise overlays,
   which participate as their data accrues) that ranks the visible universe
   into a short idea list, with a factor breakdown per name. A research/
   ranking aid — NOT investment advice. */
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Loader2, Info } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";
import PageSkeleton from "./Skeleton.jsx";
import { selStyle } from "../lib/listControls.jsx";
import { VerdictBadge } from "./primitives.jsx";

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
    <td style={{ padding: "8px 10px", textAlign: "right", minWidth: 62 }}>
      <div style={{ ...mono, fontSize: 11, color: scoreColor(v) }}>{v == null ? "—" : Math.round(v)}</div>
      <div style={{ height: 3, background: C.bg600, borderRadius: 2, marginTop: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${v == null ? 0 : v}%`, background: scoreColor(v), opacity: 0.7 }} />
      </div>
    </td>
  );
}

export default function Ideas({ API, onOpen }) {
  const [data, setData] = useState(null);
  const [bt, setBt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState("All");
  const [sortKey, setSortKey] = useState("alpha_score");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    if (!API) { setLoading(false); return; }
    let live = true;
    setLoading(true);
    fetch(`${API}/api/factors`).then(r => r.json())
      .then(d => { if (live) { setData(d); setLoading(false); } })
      .catch(() => { if (live) { setData(null); setLoading(false); } });
    fetch(`${API}/api/factors/backtest`).then(r => r.json())
      .then(d => { if (live) setBt(d); }).catch(() => { if (live) setBt(null); });
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

  const th = { ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em",
               color: C.dim, textAlign: "right", padding: "9px 10px", whiteSpace: "nowrap" };
  const td = { ...mono, fontSize: 12, color: C.text, textAlign: "right", padding: "8px 10px", whiteSpace: "nowrap" };

  return (
    <div className="fadein" style={{ padding: "22px 26px 60px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h2 style={{ ...serif, fontSize: 26, color: C.text, margin: 0, display: "flex", alignItems: "center", gap: 9 }}>
          <Sparkles size={19} color={C.gold} /> Ideas · Alpha Score
        </h2>
        <span style={{ ...sans, fontSize: 12, color: C.dim }}>{ideas.length} names ranked</span>
      </div>
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
          {bt && bt.n >= 5 ? (
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
            <div key={s.sector} onClick={() => setSector(s.sector)}
                 style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", cursor: "pointer" }}>
              <div style={{ ...sans, fontSize: 11, color: C.text200, width: 130, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.sector}</div>
              <div style={{ flex: 1, height: 5, background: C.bg600, borderRadius: 3 }}>
                <div style={{ height: "100%", width: `${s.avg_alpha || 0}%`, background: scoreColor(s.avg_alpha), borderRadius: 3 }} />
              </div>
              <div style={{ ...mono, fontSize: 11, color: scoreColor(s.avg_alpha), width: 26, textAlign: "right" }}>{s.avg_alpha != null ? Math.round(s.avg_alpha) : "—"}</div>
            </div>
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
                <th style={{ ...th, textAlign: "left" }}>Company</th>
                <th style={th}>Alpha</th>
                {FACTORS.map(([, label]) => <th key={label} style={th}>{label}</th>)}
                <th style={th}>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.ticker}
                    onClick={() => onOpen && onOpen(r.ticker)}
                    style={{ borderBottom: `1px solid ${C.line}`, cursor: onOpen ? "pointer" : "default" }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.panel2; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...td, textAlign: "left", color: C.faint }}>{r.rank}</td>
                  <td style={{ padding: "8px 10px", textAlign: "left", maxWidth: 260 }}>
                    <div style={{ ...sans, fontSize: 12.5, fontWeight: 500, color: C.gold }}>{r.ticker}</div>
                    <div style={{ ...sans, fontSize: 10, color: C.faint }}>{r.sector || ""}</div>
                    {whyRanked(r) && (
                      <div style={{ ...sans, fontSize: 10.5, color: C.dim, marginTop: 3, lineHeight: 1.45 }}>
                        {whyRanked(r)}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    <span style={{ ...mono, fontSize: 15, fontWeight: 600, color: scoreColor(r.alpha_score) }}>
                      {r.alpha_score == null ? "—" : r.alpha_score}
                    </span>
                  </td>
                  {FACTORS.map(([k]) => <Cell key={k} v={r.factors?.[k]} />)}
                  <td style={{ padding: "8px 10px", textAlign: "right" }}><VerdictBadge verdict={r.verdict || "—"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
