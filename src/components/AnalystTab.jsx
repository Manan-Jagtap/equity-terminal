/* AnalystTab.jsx — Analyst consensus, price target, and forward estimates.
   Focused on data that lives ONLY here: analyst ratings, consensus target,
   and forward-looking EPS / revenue. Peers live in the Peer Universe tab;
   growth & ratios live in the Ratios & KPIs tab — no duplication. */

import { useEffect, useState } from "react";
import { Loader2, TrendingUp, Info } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { inr, fmt, multiple } from "../lib/formatters.js";
import { useIsMobile } from "../lib/useResponsive.js";

const RATING_COLORS = {
  "Strong Buy": "#2e8b57", "Buy": "#5a9367", "Hold": "#c89a39",
  "Sell": "#c46f65", "Strong Sell": "#a83a30",
};
const ratingFromMean = m =>
  m == null ? null :
  m < 1.8 ? "Strong Buy" : m < 2.6 ? "Buy" : m < 3.4 ? "Hold" :
  m < 4.2 ? "Sell" : "Strong Sell";

const pctRaw = (n, d = 1) => (n == null || isNaN(n)) ? "—" : Number(n).toFixed(d) + "%";
const fmtCr = n => n == null ? "—" : Math.abs(n) >= 1e5 ? "₹" + (n / 1e5).toFixed(2) + " L Cr" : "₹" + fmt(n) + " Cr";

function readTarget(target) {
  if (!target || typeof target !== "object") return null;
  if (target.mean != null || target.high != null || target.low != null) {
    return { mean: target.mean, median: target.median, high: target.high,
             low: target.low, n: target.n_estimates, std: target.std };
  }
  return null;
}

const Panel = ({ title, icon: Icon, children, note }) => (
  <section style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.bg900, marginTop: 18, overflow: "hidden" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 18px", borderBottom: `1px solid ${C.line}`, background: C.bg800 }}>
      {Icon && <Icon size={15} color={C.gold} strokeWidth={1.6} />}
      <span style={{ ...sans, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text200, fontWeight: 600 }}>{title}</span>
      {note && <span style={{ ...sans, fontSize: 11, color: C.dim, marginLeft: "auto" }}>{note}</span>}
    </header>
    <div style={{ padding: 18 }}>{children}</div>
  </section>
);

const Empty = ({ children }) => (
  <div style={{ ...sans, fontSize: 13, color: C.dim, display: "flex", alignItems: "center", gap: 8 }}>
    <Info size={14} color={C.faint} /> {children}
  </div>
);

export default function AnalystTab({ co, API, price }) {
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Without this, a missing API/ticker left `loading` true forever (spinner never cleared).
    if (!API || !co.ticker) { setData(null); setLoading(false); return; }
    let live = true;
    setLoading(true);
    fetch(`${API}/api/companies/${co.ticker}/insights`)
      .then(r => r.json()).then(d => { if (live) setData(d); }).catch(() => { if (live) setData(null); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [co.ticker, API]);

  const cmp = data?.price ?? price ?? co.price;

  if (loading) return (
    <div style={{ padding: 60, textAlign: "center", color: C.dim }}>
      <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
      <div style={{ ...sans, marginTop: 10, fontSize: 13 }}>Loading analyst data…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!data || !data.has_data) return (
    <div style={{ padding: `40px ${isMobile ? 16 : 32}px` }}>
      <Panel title="Analyst & Forward" icon={TrendingUp}>
        <Empty>Analyst estimates for {co.ticker} aren't in our data yet — coverage for this name arrives with the rolling weekly refresh. The independent model's view lives in the Valuation tab meanwhile.</Empty>
      </Panel>
    </div>
  );

  const a = data.analyst;
  const tgt = readTarget(data.target);
  const ratingName = a?.rating || ratingFromMean(a?.mean_value);
  const ratingColor = RATING_COLORS[ratingName] || C.gold;
  const upside = tgt?.mean && cmp ? (tgt.mean / cmp - 1) : null;

  const dist = (a?.distribution || []).filter(d => d.count != null);
  const distTotal = dist.reduce((s, d) => s + (d.count || 0), 0) || 1;

  // Merge forward EPS + revenue estimates by fiscal year.
  const estByYear = {};
  (data.eps_estimates || []).forEach(e => { estByYear[e.year] = { ...(estByYear[e.year] || {}), year: e.year, eps: e.mean, epsLow: e.low, epsHigh: e.high, n: e.n_estimates }; });
  (data.rev_estimates || []).forEach(r => { estByYear[r.year] = { ...(estByYear[r.year] || {}), year: r.year, rev: r.mean_cr }; });
  const estRows = Object.values(estByYear).sort((x, y) => x.year - y.year);

  // Consensus target as it stood at earlier points (aggregate, not per-broker).
  const AGE_ORDER = { ThreeMonthsAgo: 0, TwoMonthsAgo: 1, OneMonthAgo: 2, OneWeekAgo: 3 };
  const AGE_LABEL = { ThreeMonthsAgo: "3M ago", TwoMonthsAgo: "2M ago", OneMonthAgo: "1M ago", OneWeekAgo: "1W ago", Now: "Now" };
  const trend = [
    ...(data.target?.snapshots || []).filter(s => s.mean != null)
      .sort((p, q) => (AGE_ORDER[p.age] ?? 9) - (AGE_ORDER[q.age] ?? 9)),
    ...(tgt?.mean != null ? [{ age: "Now", mean: tgt.mean }] : []),
  ];

  return (
    <div style={{ padding: `28px ${isMobile ? 16 : 32}px 60px` }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Hero row: consensus + target + forward P/E */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr 1fr", gap: 14 }}>
        {/* Consensus */}
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.bg900, padding: 18 }}>
          <div style={{ ...sans, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.dim, marginBottom: 8 }}>Analyst Consensus</div>
          {a ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ ...serif, fontSize: 34, lineHeight: 1, color: ratingColor }}>{ratingName || "—"}</span>
                {a.num_analysts != null && <span style={{ ...mono, fontSize: 13, color: C.dim }}>· {fmt(a.num_analysts)} analysts</span>}
              </div>
              {a.bullish_pct != null && <div style={{ ...sans, fontSize: 12, color: C.text200, marginTop: 4 }}>{pctRaw(a.bullish_pct)} bullish</div>}
              {dist.length > 0 && (
                <>
                  <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", marginTop: 14, border: `1px solid ${C.line}` }}>
                    {dist.map((d, i) => (
                      <div key={i} title={`${d.rating}: ${d.count}`} style={{ width: `${(d.count / distTotal) * 100}%`, background: RATING_COLORS[d.rating] || C.faint }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10 }}>
                    {dist.map((d, i) => (
                      <span key={i} style={{ ...sans, fontSize: 11, color: C.dim, display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: RATING_COLORS[d.rating] || C.faint }} />
                        {d.rating} <span style={{ ...mono, color: C.text200 }}>{fmt(d.count)}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : <Empty>No consensus data.</Empty>}
        </div>

        {/* Price target */}
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.bg900, padding: 18 }}>
          <div style={{ ...sans, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.dim, marginBottom: 8 }}>Consensus Target</div>
          {tgt?.mean ? (
            <>
              <div style={{ ...serif, fontSize: 34, lineHeight: 1, color: C.text }}>{inr(tgt.mean)}</div>
              {upside != null && (
                <div style={{ ...mono, fontSize: 14, marginTop: 6, color: upside >= 0 ? C.green : C.red }}>
                  {upside >= 0 ? "▲" : "▼"} {(upside * 100).toFixed(1)}% vs {inr(cmp)}
                </div>
              )}
              {(tgt.low || tgt.high) && (
                <div style={{ ...sans, fontSize: 11, color: C.dim, marginTop: 8 }}>
                  Range {inr(tgt.low)} – {inr(tgt.high)}{tgt.n ? ` · ${fmt(tgt.n)} estimates` : ""}
                </div>
              )}
            </>
          ) : <Empty>Awaiting analyst targets.</Empty>}
        </div>

        {/* Forward P/E */}
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.bg900, padding: 18 }}>
          <div style={{ ...sans, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.dim, marginBottom: 8 }}>Forward P/E</div>
          {data.forward_pe ? (
            <>
              <div style={{ ...serif, fontSize: 34, lineHeight: 1, color: C.text }}>{multiple(data.forward_pe)}</div>
              {data.forward_eps && (
                <div style={{ ...sans, fontSize: 11, color: C.dim, marginTop: 6 }}>
                  on FY{String(data.forward_eps_year ?? "").slice(-2)} est. EPS {inr(data.forward_eps, 1)}
                </div>
              )}
            </>
          ) : <Empty>Awaiting forward estimates.</Empty>}
        </div>
      </div>

      {/* Consensus target trend over time (aggregate — not per-broker) */}
      {trend.length > 1 && (
        <Panel title="Consensus Target Trend" icon={TrendingUp} note="aggregate consensus">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {trend.map((s, i) => {
              const prev = i > 0 ? trend[i - 1].mean : null;
              const dir = prev != null ? s.mean - prev : 0;
              const isNow = s.age === "Now";
              return (
                <div key={i} style={{ flex: "1 1 96px", minWidth: 96, border: `1px solid ${isNow ? C.gold + "66" : C.line}`, borderRadius: 8, padding: "10px 12px", background: isNow ? C.gold + "14" : C.bg800 }}>
                  <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: C.dim }}>{AGE_LABEL[s.age] || s.age}</div>
                  <div style={{ ...serif, fontSize: 20, color: isNow ? C.gold : C.text, marginTop: 4 }}>{inr(s.mean)}</div>
                  {prev != null && dir !== 0 && (
                    <div style={{ ...mono, fontSize: 11, color: dir > 0 ? C.green : C.red, marginTop: 2 }}>
                      {dir > 0 ? "▲" : "▼"} {inr(Math.abs(dir), 0)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ ...sans, fontSize: 11, color: C.dim, marginTop: 12, display: "flex", alignItems: "center", gap: 7 }}>
            <Info size={12} color={C.faint} />
            How the Street's mean target has moved. This is aggregate consensus — IndianAPI doesn't expose individual broker names or their targets.
          </div>
        </Panel>
      )}

      {/* Valuation band — current P/E vs its own multi-year range */}
      {data.pe_band && (() => {
        const b = data.pe_band;
        const span = Math.max(b.max - b.min, 1e-6);
        const at = v => Math.max(0, Math.min(100, ((v - b.min) / span) * 100));
        const tone = b.percentile < 35 ? C.green : b.percentile > 65 ? C.red : C.gold;
        const label = b.percentile < 35 ? "cheap vs its own history"
                    : b.percentile > 65 ? "expensive vs its own history" : "mid-range vs its own history";
        return (
          <Panel title="Valuation vs Own History" icon={TrendingUp} note={`P/E · ${b.n} pts`}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
              <span style={{ ...serif, fontSize: 30, color: tone }}>{b.current}×</span>
              <span style={{ ...sans, fontSize: 13, color: tone }}>{b.percentile}th percentile — {label}</span>
            </div>
            <div style={{ position: "relative", height: 10, borderRadius: 5, background: `linear-gradient(90deg, ${C.green}55, ${C.gold}55, ${C.red}55)` }}>
              <div title={`median ${b.median}×`} style={{ position: "absolute", left: `${at(b.median)}%`, top: -4, width: 2, height: 18, background: C.dim }} />
              <div title={`current ${b.current}×`} style={{ position: "absolute", left: `${at(b.current)}%`, top: -6, transform: "translateX(-50%)", width: 12, height: 22, borderRadius: 3, background: tone, border: `2px solid ${C.bg900}` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9, ...mono, fontSize: 11, color: C.dim }}>
              <span>min {b.min}×</span><span>median {b.median}×</span><span>max {b.max}×</span>
            </div>
            <div style={{ ...sans, fontSize: 11, color: C.dim, marginTop: 12, display: "flex", alignItems: "center", gap: 7 }}>
              <Info size={12} color={C.faint} /> Current P/E within its multi-year range. Low percentile = cheap vs its own history; high = expensive. Not a sector comparison.
            </div>
          </Panel>
        );
      })()}

      {/* Forward estimates — unique forward-looking content */}
      {estRows.length > 0 && (
        <Panel title="Forward Estimates" icon={TrendingUp} note="analyst consensus">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 460, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Fiscal Year", "EPS (₹)", "EPS Range", "Revenue", "# Est."].map((h, i) => (
                    <th key={h} style={{ ...sans, fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", color: C.dim, fontWeight: 500, padding: "8px 12px", textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estRows.map((e, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ ...sans, fontSize: 13, color: C.text, padding: "10px 12px" }}>FY{String(e.year).slice(-2)}E</td>
                    <td style={{ ...mono, fontSize: 13, color: C.text, textAlign: "right", padding: "10px 12px" }}>{e.eps != null ? inr(e.eps, 1) : "—"}</td>
                    <td style={{ ...mono, fontSize: 12, color: C.dim, textAlign: "right", padding: "10px 12px" }}>{e.epsLow != null && e.epsHigh != null ? `${inr(e.epsLow, 0)}–${inr(e.epsHigh, 0)}` : "—"}</td>
                    <td style={{ ...mono, fontSize: 13, color: C.text200, textAlign: "right", padding: "10px 12px" }}>{e.rev != null ? fmtCr(e.rev) : "—"}</td>
                    <td style={{ ...mono, fontSize: 12, color: C.dim, textAlign: "right", padding: "10px 12px" }}>{e.n != null ? fmt(e.n) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div style={{ ...sans, fontSize: 11, color: C.dim, marginTop: 14, display: "flex", alignItems: "center", gap: 7 }}>
        <Info size={12} color={C.faint} />
        Analyst consensus & forward estimates via IndianAPI{data.updated_at ? ` · updated ${data.updated_at.slice(0, 10)}` : ""}. Peers are in the Peer Universe tab; ratios & growth in Ratios & KPIs. Educational use only.
      </div>
    </div>
  );
}
