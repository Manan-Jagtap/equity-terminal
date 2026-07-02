/* Ideas.jsx — multi-factor Alpha Score ranking.

   Reads /api/factors: a transparent value/quality/momentum/low-vol/growth
   composite that ranks the visible universe into a short idea list, with a
   factor breakdown per name. A research/ranking aid — NOT investment advice. */
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Loader2, Info } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";
import { VerdictBadge } from "./primitives.jsx";

const FACTORS = [
  ["value", "Value"], ["quality", "Quality"], ["momentum", "Momentum"],
  ["low_vol", "Low Vol"], ["growth", "Growth"],
];

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
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState("All");

  useEffect(() => {
    if (!API) { setLoading(false); return; }
    let live = true;
    setLoading(true);
    fetch(`${API}/api/factors`).then(r => r.json())
      .then(d => { if (live) { setData(d); setLoading(false); } })
      .catch(() => { if (live) { setData(null); setLoading(false); } });
    return () => { live = false; };
  }, [API]);

  const ideas = data?.ideas || [];
  const sectors = useMemo(
    () => ["All", ...Array.from(new Set(ideas.map(i => i.sector).filter(Boolean))).sort()],
    [ideas]
  );
  const shown = sector === "All" ? ideas : ideas.filter(i => i.sector === sector);

  if (loading) return (
    <div style={{ padding: 48, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Ranking the universe…
    </div>
  );

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

      {/* Sector filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {sectors.map(s => (
          <button key={s} onClick={() => setSector(s)} style={{
            ...sans, fontSize: 11, padding: "4px 11px", cursor: "pointer", borderRadius: 7,
            border: `1px solid ${sector === s ? C.line2 : "transparent"}`,
            background: sector === s ? C.bg800 : "transparent",
            color: sector === s ? C.gold : C.dim }}>
            {s}
          </button>
        ))}
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
                  <td style={{ padding: "8px 10px", textAlign: "left" }}>
                    <div style={{ ...sans, fontSize: 12.5, fontWeight: 500, color: C.gold }}>{r.ticker}</div>
                    <div style={{ ...sans, fontSize: 10, color: C.faint }}>{r.sector || ""}</div>
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
