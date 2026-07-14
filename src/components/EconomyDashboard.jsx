/* EconomyDashboard.jsx — India macro at a glance.

   The high-frequency indicator set a macro desk watches — growth, inflation,
   rates, external sector, money & credit — every figure from a primary
   official source (RBI DBIE, MoSPI, GSTN, NPCI, Grid India), each carrying its
   own as-of date. A read-only reference, not investment advice. */
import { useEffect, useMemo, useState } from "react";
import { Globe2 } from "lucide-react";
import { AreaChart, Area, YAxis, ResponsiveContainer } from "recharts";
import { C, mono, sans, serif } from "../lib/theme.js";
import { useIsMobile } from "../lib/useResponsive.js";

const API = import.meta.env.VITE_API_URL;

const REGIME = {
  easing:      { label: "EASING", color: C.green },
  tightening:  { label: "TIGHTENING", color: C.red },
  on_hold:     { label: "ON HOLD", color: "#E8B054" },
};

const fmtDate = d => d ? new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—";
const fmtVal = (v, unit) => {
  if (v == null) return "—";
  const n = Number(v);
  if (unit === "% YoY" || unit === "%") return (n >= 0 ? "" : "") + n.toFixed(2) + "%";
  if (unit === "₹") return "₹" + n.toFixed(2);
  if (unit === "$ bn") return "$" + n.toFixed(1) + "B";
  if (Math.abs(n) >= 1e5) return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

function Spark({ data, up }) {
  if (!data || data.length < 2) return <div style={{ height: 34 }} />;
  const rows = data.map((v, i) => ({ i, v }));
  const col = up == null ? C.dim : up ? C.green : C.red;
  return (
    <div style={{ height: 34, marginTop: 6 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`sg${col}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={col} stopOpacity={0.28} />
              <stop offset="100%" stopColor={col} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area type="monotone" dataKey="v" stroke={col} strokeWidth={1.4}
                fill={`url(#sg${col})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function IndicatorCard({ r }) {
  // Direction of the latest print vs the prior one; for a chart it's just the
  // slope of the trailing sparkline.
  const up = (r.value != null && r.prev != null) ? r.value >= r.prev
    : (r.spark && r.spark.length > 1 ? r.spark[r.spark.length - 1] >= r.spark[0] : null);
  const chg = (r.value != null && r.prev != null) ? r.value - r.prev : null;
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel,
                  padding: "13px 15px", minWidth: 0 }}>
      <div style={{ ...sans, fontSize: 11.5, color: C.text200, marginBottom: 3,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        title={r.label}>{r.label}</div>
      {r.awaiting ? (
        <>
          <div style={{ ...mono, fontSize: 18, color: C.vfaint, marginTop: 6 }}>—</div>
          <div style={{ ...sans, fontSize: 9.5, color: C.faint, marginTop: 8, lineHeight: 1.4 }}>
            awaiting feed{r.source ? ` · ${r.source}` : ""}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ ...mono, fontSize: 21, color: C.text, letterSpacing: "-0.01em" }}>
              {fmtVal(r.value, r.unit)}
            </span>
            {chg != null && Math.abs(chg) > 1e-9 && (
              <span style={{ ...mono, fontSize: 10.5, color: up ? C.green : C.red }}>
                {up ? "▲" : "▼"} {Math.abs(chg) >= 100 ? Math.round(Math.abs(chg)).toLocaleString("en-IN") : Math.abs(chg).toFixed(2)}
              </span>
            )}
          </div>
          <Spark data={r.spark} up={up} />
          <div style={{ ...mono, fontSize: 9, color: C.faint, marginTop: 4 }}>
            {r.unit !== "% YoY" && r.unit !== "%" ? r.unit + " · " : ""}as of {fmtDate(r.as_of)}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone, sub }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...sans, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.1em", color: C.faint }}>{label}</div>
      <div style={{ ...mono, fontSize: 20, color: tone || C.text, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ ...mono, fontSize: 9.5, color: C.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function EconomyDashboard() {
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!API) return;
    let dead = false;
    fetch(`${API}/api/macro`).then(r => r.json())
      .then(d => { if (!dead) setData(d); })
      .catch(() => { if (!dead) setData({ sections: [], summary: {} }); });
    return () => { dead = true; };
  }, []);

  const s = data?.summary || {};
  const reg = REGIME[s.stance] || null;

  const heroStats = useMemo(() => {
    if (!data) return [];
    return [
      s.cpi_yoy && ["CPI inflation", s.cpi_yoy.pct.toFixed(2) + "%",
        s.cpi_yoy.pct <= 4 ? C.green : s.cpi_yoy.pct >= 6 ? C.red : "#E8B054", "as of " + fmtDate(s.cpi_yoy.as_of)],
      s.gsec_10y && ["10-yr G-sec", s.gsec_10y.last.toFixed(2) + "%",
        C.text, (s.gsec_10y.chg_3m_bps != null ? (s.gsec_10y.chg_3m_bps >= 0 ? "+" : "") + s.gsec_10y.chg_3m_bps + "bps / 3m" : "")],
      s.repo && ["Policy repo", s.repo.last.toFixed(2) + "%", C.text, s.repo.last_move ? "last move: " + s.repo.last_move : ""],
      s.usdinr && ["USD / INR", "₹" + s.usdinr.last.toFixed(2),
        s.usdinr.chg_3m_pct <= 0 ? C.green : C.red, (s.usdinr.chg_3m_pct != null ? (s.usdinr.chg_3m_pct >= 0 ? "+" : "") + s.usdinr.chg_3m_pct + "% / 3m" : "")],
      s.fx_reserves_usd_bn && ["FX reserves", "$" + s.fx_reserves_usd_bn.last + "B",
        C.text, (s.fx_reserves_usd_bn.chg_3m_bn != null ? (s.fx_reserves_usd_bn.chg_3m_bn >= 0 ? "+" : "") + s.fx_reserves_usd_bn.chg_3m_bn + "B / 3m" : "")],
      s.gdp_nominal_yoy && ["GDP (nominal)", s.gdp_nominal_yoy.pct.toFixed(1) + "%", C.text, "as of " + fmtDate(s.gdp_nominal_yoy.as_of)],
    ].filter(Boolean);
  }, [data]);

  if (!data) return <div style={{ ...sans, padding: 48, color: C.dim, fontSize: 13 }}>Loading the macro desk…</div>;

  return (
    <div className="fadein" style={{ padding: isMobile ? "20px 14px 40px" : "24px 32px 48px", maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <Globe2 size={20} color={C.gold} />
        <span style={{ ...serif, fontSize: 30, color: C.text }}>Economy</span>
        {reg && (
          <span style={{ ...mono, fontSize: 11, padding: "3px 10px", borderRadius: 6,
                         color: reg.color, border: `1px solid ${reg.color}55`, background: reg.color + "12" }}>
            RATE STANCE · {reg.label}
          </span>
        )}
      </div>
      <div style={{ ...sans, fontSize: 12, color: C.faint, marginBottom: 18, lineHeight: 1.6, maxWidth: 820 }}>
        India's high-frequency macro indicators — every figure sourced from a primary official publisher
        (RBI, MoSPI, GSTN, NPCI, Grid India), each with its own reporting date. A reference, not advice.
      </div>

      {/* Hero band */}
      {heroStats.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? 130 : 160}px, 1fr))`,
                      gap: 16, border: `1px solid ${C.gold}26`, borderRadius: 14,
                      background: C.panel, padding: "18px 20px", marginBottom: 22 }}>
          {heroStats.map(([l, v, t, sub]) => <Stat key={l} label={l} value={v} tone={t} sub={sub} />)}
        </div>
      )}

      {/* Sections */}
      {(data.sections || []).map(sec => (
        <div key={sec.title} style={{ marginBottom: 24 }}>
          <div style={{ ...sans, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.12em",
                        color: C.dim, marginBottom: 10 }}>{sec.title}</div>
          <div style={{ display: "grid", gap: 12,
                        gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 150 : 210}px, 1fr))` }}>
            {sec.series.map(r => <IndicatorCard key={r.slug} r={r} />)}
          </div>
        </div>
      ))}

      <div style={{ ...sans, fontSize: 10, color: C.faint, lineHeight: 1.5, marginTop: 8, maxWidth: 820 }}>
        {data.note} {data.series_count ? `${data.series_count} series tracked.` : ""}
      </div>
    </div>
  );
}
