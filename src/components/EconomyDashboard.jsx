/* EconomyDashboard.jsx — India macro at a glance.

   The high-frequency indicator set a macro desk watches — growth, inflation,
   rates, external sector, money & credit — every figure from a primary
   official source (RBI DBIE, MoSPI, GSTN, NPCI, Grid India), each carrying its
   own as-of date. A read-only reference, not investment advice. */
import { useEffect, useMemo, useState } from "react";
import { Globe2, Scale, ExternalLink } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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

/* Full-history view for one indicator — opens when its card is clicked. For
   YoY indicators (CPI, WPI, IIP…) it charts the RATE, not the index level. */
function SeriesModal({ slug, label, unit, kind, onClose }) {
  const [data, setData] = useState(null);
  const [range, setRange] = useState("5Y");
  const isYoy = kind === "yoy";
  const chartUnit = isYoy ? "%" : unit;

  useEffect(() => {
    if (!API || !slug) return;
    let dead = false;
    fetch(`${API}/api/macro/series/${slug}${isYoy ? "?yoy=true" : ""}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!dead) setData(d || { points: [] }); })
      .catch(() => { if (!dead) setData({ points: [] }); });
    return () => { dead = true; };
  }, [slug]);

  const pts = useMemo(() => {
    const all = (data?.points || []).map(p => ({ ...p, t: p.date }));
    if (range === "MAX" || !all.length) return all;
    const yrs = { "1Y": 1, "3Y": 3, "5Y": 5 }[range] || 5;
    const cut = new Date(); cut.setFullYear(cut.getFullYear() - yrs);
    const iso = cut.toISOString().slice(0, 10);
    const sliced = all.filter(p => p.date >= iso);
    return sliced.length > 1 ? sliced : all;
  }, [data, range]);

  const stats = useMemo(() => {
    if (pts.length < 2) return null;
    const vs = pts.map(p => p.value);
    return { last: vs[vs.length - 1], min: Math.min(...vs), max: Math.max(...vs),
             chg: vs[vs.length - 1] - vs[0] };
  }, [pts]);

  const up = stats ? stats.chg >= 0 : true;
  const col = up ? C.green : C.red;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(4,8,16,0.65)", display: "flex", alignItems: "flex-start",
      justifyContent: "center", padding: "8vh 16px", overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 720,
        background: C.bg900, border: `1px solid ${C.line2}`, borderRadius: 14, padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
          <span style={{ ...serif, fontSize: 19, color: C.text, flex: 1 }}>{label}</span>
          {["1Y", "3Y", "5Y", "MAX"].map(rg => (
            <button key={rg} onClick={() => setRange(rg)} style={{ ...mono, fontSize: 10.5,
              padding: "3px 9px", borderRadius: 6, cursor: "pointer",
              border: `1px solid ${range === rg ? C.gold + "66" : C.line2}`,
              background: range === rg ? C.gold + "14" : "transparent",
              color: range === rg ? C.gold : C.dim }}>{rg}</button>
          ))}
          <button onClick={onClose} style={{ ...sans, fontSize: 12, color: C.dim, background: "transparent",
            border: `1px solid ${C.line2}`, borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>Close</button>
        </div>
        <div style={{ ...mono, fontSize: 10.5, color: C.faint, marginBottom: 12 }}>
          {data?.name || slug}{data?.freq ? ` · ${{ D: "daily", W: "weekly", F: "fortnightly", M: "monthly", Q: "quarterly" }[data.freq] || data.freq}` : ""}
        </div>
        {!data ? (
          <div style={{ ...sans, color: C.dim, fontSize: 13, padding: "28px 0" }}>Loading series…</div>
        ) : pts.length < 2 ? (
          <div style={{ ...sans, color: C.dim, fontSize: 13, padding: "28px 0" }}>Not enough history to chart.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 22, marginBottom: 10, ...mono, fontSize: 12 }}>
              <span style={{ color: C.text }}>latest <b>{fmtVal(stats.last, chartUnit)}</b></span>
              <span style={{ color: col }}>{up ? "▲" : "▼"} {fmtVal(Math.abs(stats.chg), chartUnit)} over {range}</span>
              <span style={{ color: C.dim }}>range {fmtVal(stats.min, chartUnit)} – {fmtVal(stats.max, chartUnit)}</span>
            </div>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pts} margin={{ top: 6, right: 6, bottom: 0, left: -8 }}>
                  <defs>
                    <linearGradient id="mgrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={col} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={col} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{ fill: C.dim, fontSize: 9.5 }} tickLine={false}
                    axisLine={{ stroke: C.line }} minTickGap={70}
                    tickFormatter={d => new Date(d).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })} />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: C.dim, fontSize: 9.5 }}
                    width={54} tickLine={false} axisLine={false}
                    tickFormatter={v => Math.abs(v) >= 1e5 ? (v / 1e5).toFixed(1) + "L" : v} />
                  <Tooltip contentStyle={{ background: C.bg900, border: `1px solid ${C.line2}`,
                    borderRadius: 8, fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace" }}
                    formatter={v => [fmtVal(v, chartUnit), label]}
                    labelFormatter={d => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
                  <Area type="monotone" dataKey="value" stroke={col} strokeWidth={1.7}
                    fill="url(#mgrad)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ ...sans, fontSize: 10, color: C.faint, marginTop: 10 }}>
              Primary official source · {pts.length} observations · click outside to close
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function IndicatorCard({ r, onOpen }) {
  // Direction of the latest print vs the prior one; for a chart it's just the
  // slope of the trailing sparkline.
  const up = (r.value != null && r.prev != null) ? r.value >= r.prev
    : (r.spark && r.spark.length > 1 ? r.spark[r.spark.length - 1] >= r.spark[0] : null);
  const chg = (r.value != null && r.prev != null) ? r.value - r.prev : null;
  const clickable = !r.awaiting;
  return (
    <div onClick={clickable ? () => onOpen(r) : undefined}
      onMouseEnter={e => { if (clickable) e.currentTarget.style.borderColor = C.gold + "55"; }}
      onMouseLeave={e => { if (clickable) e.currentTarget.style.borderColor = C.line; }}
      title={clickable ? "Click for the full history" : undefined}
      style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel,
               padding: "13px 15px", minWidth: 0, cursor: clickable ? "pointer" : "default",
               transition: "border-color 120ms" }}>
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
  const [reg, setReg] = useState(null);       // regulatory feed
  const [open, setOpen] = useState(null);     // {slug, label, unit} of expanded chart

  useEffect(() => {
    if (!API) return;
    let dead = false;
    fetch(`${API}/api/macro`).then(r => r.json())
      .then(d => { if (!dead) setData(d); })
      .catch(() => { if (!dead) setData({ sections: [], summary: {} }); });
    fetch(`${API}/api/macro/regulatory`).then(r => r.json())
      .then(d => { if (!dead) setReg(d); })
      .catch(() => { if (!dead) setReg({ items: [] }); });
    return () => { dead = true; };
  }, []);

  const s = data?.summary || {};
  const stance = REGIME[s.stance] || null;

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
        {stance && (
          <span style={{ ...mono, fontSize: 11, padding: "3px 10px", borderRadius: 6,
                         color: stance.color, border: `1px solid ${stance.color}55`, background: stance.color + "12" }}>
            RATE STANCE · {stance.label}
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
            {sec.series.map(r => <IndicatorCard key={r.slug} r={r} onOpen={x => setOpen(x)} />)}
          </div>
        </div>
      ))}

      {/* Regulatory radar — official RBI + SEBI feeds, tagged by market surface */}
      {reg && (reg.items || []).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Scale size={13} color={C.dim} />
            <span style={{ ...sans, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.12em", color: C.dim }}>
              Regulatory radar · RBI &amp; SEBI
            </span>
            {reg.updated_at && (
              <span style={{ ...mono, fontSize: 9.5, color: C.faint }}>
                updated {new Date(reg.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, overflow: "hidden" }}>
            {(reg.items || []).slice(0, 12).map((it, i) => (
              <a key={it.link || i} href={it.link} target="_blank" rel="noreferrer"
                onMouseEnter={e => e.currentTarget.style.background = C.bg800}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "9px 16px",
                         borderTop: i ? `1px solid ${C.line}` : "none", textDecoration: "none" }}>
                <span style={{ ...mono, fontSize: 9.5, fontWeight: 700, flexShrink: 0, width: 38,
                               color: it.source === "RBI" ? "#818CF8" : "#22D3EE" }}>{it.source}</span>
                <span style={{ ...mono, fontSize: 10, color: C.faint, flexShrink: 0, width: 74 }}>
                  {it.date || it.first_seen || ""}
                </span>
                <span style={{ ...sans, fontSize: 12, color: C.text200, flex: 1, minWidth: 0, lineHeight: 1.45 }}>
                  {it.title}
                </span>
                {(it.tags || []).slice(0, 2).map(t => (
                  <span key={t} style={{ ...mono, fontSize: 8.5, padding: "2px 7px", borderRadius: 5,
                                         border: `1px solid ${C.line2}`, color: C.dim, whiteSpace: "nowrap",
                                         flexShrink: 0 }}>{t}</span>
                ))}
                <ExternalLink size={11} color={C.faint} style={{ flexShrink: 0 }} />
              </a>
            ))}
          </div>
          <div style={{ ...sans, fontSize: 10, color: C.faint, marginTop: 8 }}>
            Titles link to the regulator's own page — read the circular at the source. Tagged
            automatically by the market surface it touches; refreshed daily before market open.
          </div>
        </div>
      )}

      <div style={{ ...sans, fontSize: 10, color: C.faint, lineHeight: 1.5, marginTop: 8, maxWidth: 820 }}>
        {data.note} {data.series_count ? `${data.series_count} series tracked.` : ""}
      </div>

      {open && <SeriesModal slug={open.slug} label={open.label} unit={open.unit}
                            kind={open.kind} onClose={() => setOpen(null)} />}
    </div>
  );
}
