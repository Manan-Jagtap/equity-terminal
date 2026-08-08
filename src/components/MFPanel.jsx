/* MFPanel.jsx — the mutual-fund desk.

   Two surfaces:
   • FundList — the browsable universe as a sortable, filterable table: fund
     type (category) dropdown, sub-category filter, min-rating filter, search,
     and click-to-sort columns for AUM / rating / NAV / 1D / 1Y / 3Y.
   • FundPage — a dedicated full page per scheme (not a modal): hero header,
     a trailing-returns strip, an NAV chart with a 1M–MAX range toggle, the
     portfolio holdings with a concentration donut, and a fund-facts panel.

   All data comes from the licensed vendor feed. A browsing aid, not advice. */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import {
  AreaChart, Area, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell,
} from "recharts";
import { C, mono, sans, serif, gridBg, series } from "../lib/theme.js";
import { useIsMobile } from "../lib/useResponsive.js";
import { selStyle } from "../lib/listControls.jsx";
import PageHeader from "./ui/PageHeader.jsx";

const API = import.meta.env.VITE_API_URL;

/* ── formatters ─────────────────────────────────────────────── */
const nav = v => (v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 }));
const pct = v => (v == null || isNaN(v) ? "—" : (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%");
const pct1 = v => (v == null || isNaN(v) ? "—" : (v >= 0 ? "+" : "") + Number(v).toFixed(1) + "%");
const tone = v => (v == null || isNaN(v) ? C.dim : v >= 0 ? C.green : C.red);
const cr = v => (v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 }) + " cr");
const initials = s => (s || "").replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "MF";

function Stars({ n, size = 11 }) {
  if (n == null) return <span style={{ color: C.faint, fontSize: size }}>—</span>;
  const r = Math.round(n);
  return <span style={{ ...mono, fontSize: size, color: "#E8B054", letterSpacing: 1 }}
    title={`${r}★ vendor rating`}>{"★".repeat(r)}<span style={{ color: C.vfaint }}>{"★".repeat(5 - r)}</span></span>;
}

/* Avatar tile — mint gradient with the fund's initials (funds have no logo). */
function FundMark({ name, size = 46 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.24, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(135deg, ${C.gold}2b, ${C.blue}22)`,
      border: `1px solid ${C.gold}3a`, ...serif, fontSize: size * 0.34, color: C.gold,
      letterSpacing: "0.02em" }}>
      {initials(name)}
    </div>
  );
}

const DONUT = series;

/* ════════════════════════════════════════════════════════════════
   Root: owns the catalog + which fund (if any) is open.
   ════════════════════════════════════════════════════════════════ */
export default function MFPanel() {
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);   // the selected fund row → full page

  useEffect(() => {
    if (!API) return;
    let dead = false;
    fetch(`${API}/api/mutual-funds`).then(r => r.json())
      .then(d => { if (!dead) setData(d); })
      .catch(() => { if (!dead) setData({ available: false, categories: [] }); });
    return () => { dead = true; };
  }, []);

  // key= resets all page state (range, series, detail) when switching funds.
  if (open) return <FundPage key={open.name} fund={open} onBack={() => setOpen(null)} isMobile={isMobile} />;

  if (!data) return <div style={{ ...sans, padding: 48, color: C.dim, fontSize: 13 }}>Loading the fund desk…</div>;

  return <FundList data={data} onOpen={setOpen} isMobile={isMobile} />;
}

/* ════════════════════════════════════════════════════════════════
   FundList — the sortable, filterable universe table.
   ════════════════════════════════════════════════════════════════ */
const RATING_OPTS = [[0, "Any rating"], [3, "★★★ +"], [4, "★★★★ +"], [5, "★★★★★"]];

function FundList({ data, onOpen, isMobile }) {
  const cats = data.categories || [];
  const [cat, setCat] = useState(cats[0]?.name || null);
  const [sub, setSub] = useState("");
  const [minR, setMinR] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "asset_size", dir: "desc" });

  const active = useMemo(() => cats.find(c => c.name === cat) || cats[0], [cats, cat]);
  const subNames = useMemo(() => (active?.sub_categories || []).map(s => s.name), [active]);

  // Flatten the active category to a single row list carrying its sub-category.
  const flat = useMemo(() => {
    const out = [];
    for (const s of (active?.sub_categories || []))
      for (const f of (s.funds || [])) out.push({ ...f, sub_category: f.sub_category || s.name });
    return out;
  }, [active]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = flat.filter(f =>
      (!sub || f.sub_category === sub) &&
      (!minR || (f.rating || 0) >= minR) &&
      (!needle || (f.name || "").toLowerCase().includes(needle)));
    const { key, dir } = sort;
    const sign = dir === "asc" ? 1 : -1;
    r = [...r].sort((a, b) => {
      const va = a[key], vb = b[key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va - vb) * sign;
    });
    return r;
  }, [flat, sub, minR, q, sort]);

  const avg1y = useMemo(() => {
    const xs = rows.map(r => r.r1y).filter(v => v != null && !isNaN(v));
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  }, [rows]);

  const th = (label, key, w, alignR = true) => {
    const activeS = sort.key === key;
    return (
      <th onClick={() => setSort(s => s.key === key
        ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" })}
        style={{ ...sans, fontSize: 10.5, fontWeight: 500, textTransform: "uppercase",
          letterSpacing: "0.08em", color: activeS ? C.gold : C.dim, padding: "9px 12px",
          textAlign: alignR ? "right" : "left", cursor: "pointer", userSelect: "none",
          whiteSpace: "nowrap", width: w, position: "sticky", top: 0,
          background: C.bg900, borderBottom: `1px solid ${C.line2}`, zIndex: 1 }}>
        {label}{activeS ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
      </th>
    );
  };

  return (
    <div className="fadein" style={{ padding: isMobile ? "20px 14px 40px" : "24px 32px 48px", maxWidth: 1240 }}>
      <PageHeader title="Mutual Funds" meta={data.as_of ? `as of ${data.as_of}` : null}>
        The fund universe by category — NAV, trailing returns, AUM and rating from the verified feed.
        Sort any column, filter by sub-category or rating, and open a fund for its full desk. A browsing aid, not advice.
      </PageHeader>

      {!cats.length ? (
        <div style={{ ...sans, fontSize: 13, color: C.dim, border: `1px solid ${C.line}`,
          borderRadius: 12, padding: 32, textAlign: "center" }}>
          The fund feed is unreachable right now — it retries automatically.
        </div>
      ) : (
        <>
          {/* ── controls ─────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <select value={cat || ""} onChange={e => { setCat(e.target.value); setSub(""); }}
              style={{ ...selStyle, fontWeight: 600 }} title="Fund type">
              {cats.map(c => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
            </select>
            <select value={sub} onChange={e => setSub(e.target.value)} style={selStyle} title="Sub-category">
              <option value="">All sub-categories</option>
              {subNames.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={minR} onChange={e => setMinR(Number(e.target.value))} style={selStyle} title="Minimum rating">
              {RATING_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <Search size={13} color={C.faint} style={{ position: "absolute", left: 10 }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search funds…"
                style={{ ...sans, fontSize: 12, padding: "7px 11px 7px 30px", borderRadius: 8, minWidth: 190,
                  background: C.bg800, color: C.text, border: `1px solid ${C.line2}`, outline: "none" }} />
            </span>
            {(sub || minR || q) && (
              <button onClick={() => { setSub(""); setMinR(0); setQ(""); }}
                style={{ ...sans, fontSize: 11, padding: "6px 10px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${C.line2}`, background: "transparent", color: C.dim }}>Clear</button>
            )}
            <span style={{ ...mono, fontSize: 11, color: C.faint, marginLeft: "auto" }}>
              {rows.length} funds{avg1y != null && <> · avg 1Y <span style={{ color: tone(avg1y) }}>{pct1(avg1y)}</span></>}
            </span>
          </div>

          {/* ── table ────────────────────────────────────────── */}
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr>
                    {th("Fund", "name", "auto", false)}
                    {th("AUM", "asset_size", 96)}
                    {th("Rating", "rating", 78)}
                    {th("NAV", "nav", 92)}
                    {th("1D", "change", 66)}
                    {th("1Y", "r1y", 74)}
                    {th("3Y", "r3y", 74)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((f, i) => (
                    <tr key={(f.name || "") + i} onClick={() => onOpen(f)}
                      onMouseEnter={e => e.currentTarget.style.background = C.bg800}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      style={{ cursor: "pointer", borderTop: `1px solid ${C.line}` }}>
                      <td style={{ padding: "10px 12px", maxWidth: 340 }}>
                        <div style={{ ...sans, fontSize: 12.5, color: C.text200, lineHeight: 1.3 }}>{f.name}</div>
                        <div style={{ ...sans, fontSize: 10, color: C.faint, marginTop: 2 }}>{f.sub_category}</div>
                      </td>
                      <td style={{ ...mono, fontSize: 11.5, color: C.text200, textAlign: "right", padding: "10px 12px", whiteSpace: "nowrap" }}>{cr(f.asset_size)}</td>
                      <td style={{ textAlign: "right", padding: "10px 12px" }}><Stars n={f.rating} /></td>
                      <td style={{ ...mono, fontSize: 12, color: C.text, textAlign: "right", padding: "10px 12px" }}>{nav(f.nav)}</td>
                      <td style={{ ...mono, fontSize: 12, color: tone(f.change), textAlign: "right", padding: "10px 12px" }}>{pct(f.change)}</td>
                      <td style={{ ...mono, fontSize: 12, color: tone(f.r1y), textAlign: "right", padding: "10px 12px" }}>{pct1(f.r1y)}</td>
                      <td style={{ ...mono, fontSize: 12, color: tone(f.r3y), textAlign: "right", padding: "10px 12px" }}>{pct1(f.r3y)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && (
              <div style={{ ...sans, fontSize: 12, color: C.dim, padding: 28, textAlign: "center" }}>
                No funds match the current filters.
              </div>
            )}
          </div>
          <div style={{ ...sans, fontSize: 10.5, color: C.vfaint, marginTop: 10 }}>
            Returns are trailing and absolute as reported by the feed. Past performance is not indicative of future results.
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   FundPage — the dedicated per-scheme desk.
   ════════════════════════════════════════════════════════════════ */
// Vendor NAV buckets that actually return data (3M / 3Y come back empty).
const RANGES = ["1M", "6M", "1Y", "5Y", "MAX"];

function FundPage({ fund, onBack, isMobile }) {
  const [detail, setDetail] = useState(null);
  const [range, setRange] = useState("1Y");
  const [navSeries, setNavSeries] = useState(null);
  const [navLoading, setNavLoading] = useState(false);

  // Initial load — holdings, facts, and the default (1Y) NAV series.
  // (No reset dance needed: the parent keys this component on fund.name.)
  useEffect(() => {
    if (!API) return;
    let dead = false;
    fetch(`${API}/api/mutual-funds/detail?name=${encodeURIComponent(fund.name)}&range=1Y`)
      .then(r => r.json())
      .then(d => { if (!dead) { setDetail(d); setNavSeries(d?.nav_history || []); } })
      .catch(() => { if (!dead) setDetail({ available: false }); });
    return () => { dead = true; };
  }, [fund.name]);

  // Range toggle — swap just the NAV series once we know the scheme id.
  const pickRange = r => {
    setRange(r);
    if (!detail?.id) return;
    setNavLoading(true);
    fetch(`${API}/api/mutual-funds/nav?id=${encodeURIComponent(detail.id)}&range=${r}`)
      .then(res => res.json()).then(d => setNavSeries(d?.nav_history || []))
      .catch(() => setNavSeries([]))
      .finally(() => setNavLoading(false));
  };

  const series = navSeries || [];
  const first = series[0]?.nav, last = series[series.length - 1]?.nav;
  const winRet = (first && last) ? (last / first - 1) * 100 : null;
  const info = detail?.info || {};

  const returns = [["1M", fund.r1m], ["3M", fund.r3m], ["6M", fund.r6m], ["1Y", fund.r1y], ["3Y", fund.r3y]];
  const hasReturns = returns.some(([, v]) => v != null);

  const holdings = detail?.holdings || [];
  const donutData = useMemo(() => {
    const top = holdings.slice(0, 8).filter(h => h.allocation != null);
    const sumTop = top.reduce((a, h) => a + (h.allocation || 0), 0);
    const rest = Math.max(0, 100 - sumTop);
    const d = top.map(h => ({ name: h.name, value: h.allocation }));
    if (rest > 0.5) d.push({ name: "Others / cash", value: Number(rest.toFixed(1)), _rest: true });
    return d;
  }, [holdings]);

  return (
    <div className="fadein">
      {/* ── hero header ─────────────────────────────────────── */}
      <header style={{ borderBottom: `1px solid ${C.line}`, position: "relative", ...gridBg,
        backgroundImage: `radial-gradient(900px 420px at 12% -30%, ${C.gold}12, transparent 55%),
                          radial-gradient(700px 380px at 95% 130%, ${C.blue}0c, transparent 60%),
                          linear-gradient(180deg, ${C.bg900}, ${C.bg})` }}>
        <div style={{ position: "relative", padding: isMobile ? "16px 16px 20px" : "22px 32px 26px" }}>
          <button onClick={onBack} style={{ ...sans, display: "flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none", color: C.dim, fontSize: 12, cursor: "pointer",
            padding: 0, marginBottom: 16 }}>
            <ArrowLeft size={14} /> All funds
          </button>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
            gap: isMobile ? 16 : 32, alignItems: isMobile ? "stretch" : "flex-end" }}>
            <div>
              <div style={{ ...sans, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
                color: C.dim, marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: C.gold }}>{fund.category || "Mutual Fund"}</span>
                {fund.sub_category && <><span style={{ color: C.bg500 }}>·</span><span>{fund.sub_category}</span></>}
                {detail?.isin && <><span style={{ color: C.bg500 }}>·</span><span>ISIN {detail.isin}</span></>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <FundMark name={fund.name} size={isMobile ? 40 : 48} />
                <div style={{ ...serif, fontSize: isMobile ? 26 : 40, color: C.text, lineHeight: 1.08, letterSpacing: "-0.02em" }}>{fund.name}</div>
              </div>
              <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap", ...sans, fontSize: 12, color: C.dim, alignItems: "center" }}>
                <span>AUM <span style={{ ...mono, color: C.text200 }}>{cr(fund.asset_size)}</span></span>
                <span style={{ color: C.bg500 }}>|</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>Rating <Stars n={fund.rating} size={12} /></span>
                {detail?.scheme_type && <><span style={{ color: C.bg500 }}>|</span><span>{detail.scheme_type}</span></>}
                {detail?.holdings_count > 0 && <><span style={{ color: C.bg500 }}>|</span><span><span style={{ ...mono, color: C.text200 }}>{detail.holdings_count}</span> holdings</span></>}
              </div>
            </div>
            <div style={{ textAlign: isMobile ? "left" : "right" }}>
              <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: C.dim }}>Latest NAV</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4, justifyContent: isMobile ? "flex-start" : "flex-end" }}>
                <div style={{ ...mono, fontSize: isMobile ? 34 : 46, color: C.text, lineHeight: 1, letterSpacing: "-0.02em" }}>{nav(fund.nav)}</div>
                <div style={{ ...mono, fontSize: 14, fontWeight: 500, color: tone(fund.change) }}>{pct(fund.change)}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div style={{ padding: isMobile ? "18px 14px 44px" : "22px 32px 52px", maxWidth: 1240 }}>
        {/* ── returns strip ─────────────────────────────────── */}
        {hasReturns && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${isMobile ? 3 : 5}, 1fr)`, gap: 10, marginBottom: 20 }}>
            {returns.map(([label, v]) => (
              <div key={label} style={{ border: `1px solid ${C.line}`, borderRadius: 11, background: C.panel, padding: "12px 14px" }}>
                <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim }}>{label} return</div>
                <div style={{ ...mono, fontSize: 19, color: tone(v), marginTop: 5 }}>{pct1(v)}</div>
              </div>
            ))}
          </div>
        )}

        {!detail ? (
          <div style={{ ...sans, color: C.dim, fontSize: 13, padding: "40px 0" }}>Loading the fund desk…</div>
        ) : detail.available === false ? (
          <div style={{ ...sans, color: C.dim, fontSize: 13, border: `1px solid ${C.line}`, borderRadius: 12, padding: 28 }}>
            We couldn't resolve this scheme in the vendor feed for its full detail. The list-level figures above are current.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr", gap: 16, alignItems: "start" }}>
            {/* ── left column ─────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* NAV chart */}
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ ...serif, fontSize: 16, color: C.text }}>NAV history</span>
                    {winRet != null && <span style={{ ...mono, fontSize: 12, color: tone(winRet) }}>{pct1(winRet)} over {range}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {RANGES.map(r => (
                      <button key={r} onClick={() => pickRange(r)}
                        style={{ ...mono, fontSize: 11, padding: "4px 9px", borderRadius: 7, cursor: "pointer",
                          border: `1px solid ${range === r ? C.gold + "66" : C.line2}`,
                          background: range === r ? C.gold + "14" : "transparent",
                          color: range === r ? C.gold : C.dim }}>{r}</button>
                    ))}
                  </div>
                </div>
                <div style={{ height: 220, opacity: navLoading ? 0.4 : 1, transition: "opacity .2s" }}>
                  {series.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={series.map((p, i) => ({ i, nav: p.nav, date: p.date }))} margin={{ top: 6, right: 6, bottom: 0, left: -8 }}>
                        <defs><linearGradient id="mfg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.gold} stopOpacity={0.28} /><stop offset="100%" stopColor={C.gold} stopOpacity={0} />
                        </linearGradient></defs>
                        {first != null && <ReferenceLine y={first} stroke={C.faint} strokeDasharray="3 3" strokeOpacity={0.5} />}
                        <YAxis domain={["auto", "auto"]} tick={{ fill: C.dim, fontSize: 9 }} width={46} tickLine={false} axisLine={false} tickFormatter={v => "₹" + Math.round(v)} />
                        <Tooltip contentStyle={{ background: C.bg900, border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 11 }}
                          formatter={v => ["₹" + Number(v).toFixed(2), "NAV"]}
                          labelFormatter={(_, p) => (p && p[0] ? p[0].payload.date : "")} />
                        <Area type="monotone" dataKey="nav" stroke={C.gold} strokeWidth={1.8} fill="url(#mfg)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ ...sans, fontSize: 12, color: C.faint, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                      {navLoading ? "Loading…" : `No NAV data for ${range}.`}
                    </div>
                  )}
                </div>
              </div>

              {/* Holdings */}
              {holdings.length > 0 && (
                <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ ...serif, fontSize: 16, color: C.text }}>Top holdings</span>
                    <span style={{ ...mono, fontSize: 11, color: C.faint }}>{holdings.length} disclosed</span>
                  </div>
                  {holdings.slice(0, 15).map((h, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
                      <span style={{ ...mono, fontSize: 10, color: C.vfaint, width: 18 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...sans, fontSize: 12.5, color: C.text200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
                        {h.sector && <div style={{ ...sans, fontSize: 9.5, color: C.faint }}>{h.sector}</div>}
                      </div>
                      <div style={{ width: isMobile ? 70 : 120, height: 5, background: C.bg700, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: 5, width: `${Math.min(100, h.allocation || 0)}%`, background: DONUT[i % DONUT.length], borderRadius: 3 }} />
                      </div>
                      <span style={{ ...mono, fontSize: 12, color: C.text, minWidth: 50, textAlign: "right" }}>{h.allocation != null ? h.allocation.toFixed(1) + "%" : "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── right column ────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Concentration donut */}
              {donutData.length > 0 && (
                <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, padding: "16px 18px" }}>
                  <div style={{ ...serif, fontSize: 15, color: C.text, marginBottom: 4 }}>Portfolio concentration</div>
                  <div style={{ position: "relative", height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                          innerRadius={58} outerRadius={82} paddingAngle={1.5} stroke="none"
                          isAnimationActive={false}>
                          {donutData.map((d, i) => <Cell key={i} fill={d._rest ? C.bg500 : DONUT[i % DONUT.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: C.bg900, border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 11 }}
                          formatter={(v, n) => [Number(v).toFixed(1) + "%", n]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                      <div style={{ ...mono, fontSize: 22, color: C.text }}>{detail.top10_weight != null ? detail.top10_weight.toFixed(0) + "%" : "—"}</div>
                      <div style={{ ...sans, fontSize: 9.5, color: C.dim, textTransform: "uppercase", letterSpacing: "0.1em" }}>in top 10</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fund facts */}
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, padding: "16px 18px" }}>
                <div style={{ ...serif, fontSize: 15, color: C.text, marginBottom: 10 }}>Fund facts</div>
                <Facts rows={[
                  ["Category", fund.category],
                  ["Sub-category", fund.sub_category],
                  ["Scheme type", detail.scheme_type],
                  ["ISIN", detail.isin],
                  ["AUM", cr(fund.asset_size)],
                  ["Fund manager", info.fund_manager],
                  ["Benchmark", info.benchmark],
                  ["Expense ratio", info.expense_ratio != null ? (isNaN(info.expense_ratio) ? String(info.expense_ratio) : Number(info.expense_ratio).toFixed(2)) + "%" : null],
                  ["Launch date", info.launch_date],
                  ["Min investment", info.min_investment != null ? "₹" + info.min_investment : null],
                  ["Min SIP", info.min_sip != null ? "₹" + info.min_sip : null],
                  ["Exit load", info.exit_load],
                  ["Lock-in", info.lock_in],
                  ["Riskometer", info.risk],
                ]} />
              </div>
            </div>
          </div>
        )}
        <div style={{ ...sans, fontSize: 10.5, color: C.vfaint, marginTop: 18 }}>
          Data from the licensed vendor feed. Holdings are the latest disclosed portfolio and change over time.
          This is a browsing aid, not investment advice. Past performance is not indicative of future results.
        </div>
      </div>
    </div>
  );
}

function Facts({ rows }) {
  const shown = rows.filter(([, v]) => v != null && v !== "" && v !== "—");
  if (!shown.length) return <div style={{ ...sans, fontSize: 12, color: C.faint }}>No additional facts disclosed.</div>;
  return (
    <div>
      {shown.map(([k, v], i) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "baseline",
          padding: "7px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
          <span style={{ ...sans, fontSize: 12, color: C.dim, whiteSpace: "nowrap" }}>{k}</span>
          <span style={{ ...mono, fontSize: 12, color: C.text200, textAlign: "right", wordBreak: "break-word" }}>{String(v)}</span>
        </div>
      ))}
    </div>
  );
}
