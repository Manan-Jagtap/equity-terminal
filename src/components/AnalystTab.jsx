/* AnalystTab.jsx — Analyst consensus, price target, forward P/E, peer comps,
   and Screener-style growth/ratio panels. Self-contained: fetches /insights.
   Every section degrades gracefully when its slice of data is missing. */

import { useEffect, useState } from "react";
import { Loader2, Users, Target, TrendingUp, BarChart3, Gauge, Info } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { inr, fmt, multiple } from "../lib/formatters.js";
import { useIsMobile } from "../lib/useResponsive.js";

/* Vivid rating colours (independent of the muted terminal palette). */
const RATING_COLORS = {
  "Strong Buy": "#2e8b57", "Buy": "#5a9367", "Hold": "#c89a39",
  "Sell": "#c46f65", "Strong Sell": "#a83a30",
};
const ratingFromMean = m =>
  m == null ? null :
  m < 1.8 ? "Strong Buy" : m < 2.6 ? "Buy" : m < 3.4 ? "Hold" :
  m < 4.2 ? "Sell" : "Strong Sell";

/* Percent values that are ALREADY in percent units (ROE 16.6 → "16.6%"). */
const pctRaw = (n, d = 1) => (n == null || isNaN(n)) ? "—" : Number(n).toFixed(d) + "%";

/* Consensus target — clean shape from the ingester {mean, median, high, low,
   n_estimates, std}. Tolerates the older best-effort {parsed:{…}} shape too. */
function readTarget(target) {
  if (!target || typeof target !== "object") return null;
  if (target.mean != null || target.high != null || target.low != null) {
    return { mean: target.mean, median: target.median, high: target.high,
             low: target.low, n: target.n_estimates, std: target.std };
  }
  const p = target.parsed;
  if (!p || typeof p !== "object") return null;
  const ent = Object.entries(p);
  const pick = test => { const e = ent.find(([k]) => test(k)); return e ? e[1] : null; };
  const high = pick(k => k.includes("high")), low = pick(k => k.includes("low"));
  const mean = pick(k => k.includes("mean") || (k.includes("target") && !k.includes("high") && !k.includes("low")))
            ?? pick(k => k.includes("median")) ?? (high && low ? (high + low) / 2 : null);
  return (mean || high || low) ? { mean, high, low } : null;
}

const Panel = ({ title, icon: Icon, children, note }) => (
  <section style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.bg900, marginBottom: 18, overflow: "hidden" }}>
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
    if (!API || !co.ticker) return;
    setLoading(true);
    fetch(`${API}/api/companies/${co.ticker}/insights`)
      .then(r => r.json()).then(setData).catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [co.ticker, API]);

  const cmp = data?.price ?? price ?? co.price;

  if (loading) return (
    <div style={{ padding: 60, textAlign: "center", color: C.dim }}>
      <Loader2 size={22} className="spin" style={{ animation: "spin 1s linear infinite" }} />
      <div style={{ ...sans, marginTop: 10, fontSize: 13 }}>Loading analyst data…</div>
    </div>
  );

  if (!data || !data.has_data) return (
    <div style={{ padding: `40px ${isMobile ? 16 : 32}px` }}>
      <Panel title="Analyst & Forward" icon={Users}>
        <Empty>
          No analyst data ingested yet for {co.ticker}. Run the IndianAPI ingester
          (it captures consensus, targets, peers and ratios) and this lights up.
        </Empty>
      </Panel>
    </div>
  );

  const a = data.analyst, peers = data.peers, growth = data.growth, ratios = data.ratios;
  const tgt = readTarget(data.target);
  const ratingName = a?.rating || ratingFromMean(a?.mean_value);
  const ratingColor = RATING_COLORS[ratingName] || C.gold;
  const upside = tgt?.mean && cmp ? (tgt.mean / cmp - 1) : null;

  // Distribution total for the stacked bar.
  const dist = (a?.distribution || []).filter(d => d.count != null);
  const distTotal = dist.reduce((s, d) => s + (d.count || 0), 0) || 1;

  return (
    <div style={{ padding: `28px ${isMobile ? 16 : 32}px 60px` }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Hero row: consensus + target + forward P/E */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr 1fr", gap: 14, marginBottom: 18 }}>
        {/* Consensus */}
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.bg900, padding: 18 }}>
          <div style={{ ...sans, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.dim, marginBottom: 8 }}>Analyst Consensus</div>
          {a ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ ...serif, fontSize: 34, lineHeight: 1, color: ratingColor }}>{ratingName || "—"}</span>
                {a.num_analysts != null && <span style={{ ...mono, fontSize: 13, color: C.dim }}>· {fmt(a.num_analysts)} analysts</span>}
              </div>
              {a.bullish_pct != null && (
                <div style={{ ...sans, fontSize: 12, color: C.text200, marginTop: 4 }}>{pctRaw(a.bullish_pct)} bullish</div>
              )}
              {/* Stacked distribution bar */}
              {dist.length > 0 && (
                <>
                  <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", marginTop: 14, border: `1px solid ${C.line}` }}>
                    {dist.map((d, i) => (
                      <div key={i} title={`${d.rating}: ${d.count}`}
                        style={{ width: `${(d.count / distTotal) * 100}%`, background: RATING_COLORS[d.rating] || C.faint }} />
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
              {data.eps_estimates?.length > 0 && (
                <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
                  {data.eps_estimates.slice(0, 3).map((e, i) => (
                    <div key={i}>
                      <div style={{ ...sans, fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.05em" }}>FY{String(e.year).slice(-2)}E</div>
                      <div style={{ ...mono, fontSize: 13, color: C.text200 }}>{inr(e.mean, 0)}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : <Empty>Awaiting forward estimates.</Empty>}
        </div>
      </div>

      {/* Peer comparison */}
      <Panel title="Peer Comparison" icon={Users} note={peers ? `${peers.length} peers` : null}>
        {peers && peers.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Company", "Price", "P/E", "P/B", "ROE (TTM)", "NPM", "Div Yld", "Rating"].map((h, i) => (
                    <th key={h} style={{ ...sans, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: C.dim, fontWeight: 500, padding: "8px 10px", textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {peers.map((p, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ ...sans, fontSize: 12.5, color: C.text, padding: "9px 10px" }}>{p.name}</td>
                    <td style={{ ...mono, fontSize: 12, color: C.text200, textAlign: "right", padding: "9px 10px" }}>{inr(p.price)}</td>
                    <td style={{ ...mono, fontSize: 12, color: C.text200, textAlign: "right", padding: "9px 10px" }}>{multiple(p.pe)}</td>
                    <td style={{ ...mono, fontSize: 12, color: C.text200, textAlign: "right", padding: "9px 10px" }}>{multiple(p.pb)}</td>
                    <td style={{ ...mono, fontSize: 12, color: C.text200, textAlign: "right", padding: "9px 10px" }}>{pctRaw(p.roe_ttm)}</td>
                    <td style={{ ...mono, fontSize: 12, color: C.text200, textAlign: "right", padding: "9px 10px" }}>{pctRaw(p.npm_ttm)}</td>
                    <td style={{ ...mono, fontSize: 12, color: C.text200, textAlign: "right", padding: "9px 10px" }}>{pctRaw(p.div_yield)}</td>
                    <td style={{ ...sans, fontSize: 11, textAlign: "right", padding: "9px 10px", color: C.dim }}>{p.rating || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No peer data.</Empty>}
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 18 }}>
        {/* Growth panel */}
        <Panel title="Compounded Growth" icon={TrendingUp}>
          {growth ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: "8px 14px", alignItems: "center" }}>
              <div />
              {["10Y", "5Y", "3Y", "TTM"].map(h => <div key={h} style={{ ...sans, fontSize: 10.5, color: C.dim, textAlign: "right", textTransform: "uppercase" }}>{h}</div>)}
              {Object.entries(growth).map(([metric, vals]) => {
                const get = (...keys) => { for (const k of Object.keys(vals)) if (keys.some(t => k.toLowerCase().includes(t))) return vals[k]; return "—"; };
                return (
                  <Row key={metric} label={metric}
                    cells={[get("10"), get("5 ", "5y", "5 year"), get("3"), get("ttm", "1 year", "last")]} />
                );
              })}
            </div>
          ) : <Empty>No growth data.</Empty>}
        </Panel>

        {/* Operating ratios (latest of each series) */}
        <Panel title="Operating Ratios" icon={Gauge}>
          {ratios ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "8px 14px", alignItems: "center" }}>
              <div />
              <div style={{ ...sans, fontSize: 10.5, color: C.dim, textAlign: "right", textTransform: "uppercase" }}>Latest</div>
              <div style={{ ...sans, fontSize: 10.5, color: C.dim, textAlign: "right", textTransform: "uppercase" }}>5Y avg</div>
              {Object.entries(ratios).map(([metric, series]) => {
                const ys = Object.keys(series).sort();
                const latest = series[ys[ys.length - 1]];
                const last5 = ys.slice(-5).map(y => series[y]).filter(v => v != null);
                const avg5 = last5.length ? last5.reduce((s, v) => s + v, 0) / last5.length : null;
                const suffix = metric.includes("%") ? "%" : "";
                return (
                  <Row key={metric} label={metric}
                    cells={[latest != null ? fmt(latest) + suffix : "—", avg5 != null ? fmt(avg5) + suffix : "—"]} />
                );
              })}
            </div>
          ) : <Empty>No ratio data.</Empty>}
        </Panel>
      </div>

      <div style={{ ...sans, fontSize: 11, color: C.dim, marginTop: 12, display: "flex", alignItems: "center", gap: 7 }}>
        <Info size={12} color={C.faint} />
        Analyst consensus & peer data via IndianAPI{data.updated_at ? ` · updated ${data.updated_at.slice(0, 10)}` : ""}. Educational use only.
      </div>
    </div>
  );
}

const Row = ({ label, cells }) => (
  <>
    <div style={{ ...sans, fontSize: 12.5, color: C.text200 }}>{label}</div>
    {cells.map((c, i) => (
      <div key={i} style={{ ...mono, fontSize: 12.5, color: C.text, textAlign: "right" }}>{c}</div>
    ))}
  </>
);
