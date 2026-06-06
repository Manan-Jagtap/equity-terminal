/* MarketDashboard.jsx — live home screen.
   Index strip, top gainers/losers, most active, 52-week highs/lows.
   Pulls /api/market/snapshot (one round-trip, server-side cached). */

import { useEffect, useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight, Loader2, RefreshCw } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { useIsMobile } from "../lib/useResponsive.js";

const fmtN = (n, d = 2) => n == null || isNaN(n) ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtP = (n, d = 2) => n == null || isNaN(n) ? "—" : (n >= 0 ? "+" : "") + n.toFixed(d) + "%";
const toneOf = n => n == null ? C.dim : n >= 0 ? C.green : C.red;
const fmtVol = n => n == null ? "—" : n >= 1e7 ? (n / 1e7).toFixed(1) + " Cr" : n >= 1e5 ? (n / 1e5).toFixed(1) + " L" : Number(n).toLocaleString("en-IN");

export default function MarketDashboard({ API, companies, onOpen }) {
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Tickers in our universe → clickable through to the company page.
  const known = useMemo(() => new Set((companies || []).map(c => (c.ticker || "").toUpperCase())), [companies]);

  useEffect(() => {
    if (!API) { setLoading(false); return; }
    setLoading(true);
    fetch(`${API}/api/market/snapshot`)
      .then(r => r.json()).then(setData).catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [API, tick]);

  const PAD = isMobile ? 16 : 32;

  if (loading && !data) return (
    <div style={{ padding: 80, textAlign: "center", color: C.dim }}>
      <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      <div style={{ ...sans, marginTop: 12, fontSize: 13 }}>Loading market…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const indices = data?.indices || [];
  const gainers = data?.movers?.gainers || [];
  const losers  = data?.movers?.losers || [];
  const active  = data?.active || [];
  const highs   = data?.high_low?.highs || [];
  const lows    = data?.high_low?.lows || [];
  const empty = indices.length === 0 && gainers.length === 0 && active.length === 0;

  const openIf = ticker => { const t = (ticker || "").toUpperCase(); if (known.has(t)) onOpen(t); };

  return (
    <div style={{ padding: `22px ${PAD}px 60px` }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <h1 style={{ ...serif, fontSize: isMobile ? 26 : 32, color: C.text, margin: 0, fontWeight: 400 }}>Market Overview</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {data?.as_of && <span style={{ ...mono, fontSize: 11, color: C.dim }}>as of {data.as_of}</span>}
          <button onClick={() => setTick(t => t + 1)} title="Refresh"
            style={{ ...sans, display: "flex", alignItems: "center", gap: 6, background: C.bg800, border: `1px solid ${C.line}`, color: C.dim, borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
            <RefreshCw size={12} style={loading ? { animation: "spin 1s linear infinite" } : undefined} /> Refresh
          </button>
        </div>
      </div>

      {empty && (
        <div style={{ ...sans, fontSize: 13, color: C.dim, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 18 }}>
          Live market lists are empty right now — this is normal when the market is closed (weekends/holidays). Index levels below reflect the last session.
        </div>
      )}

      {/* Index strip */}
      {indices.length > 0 && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, marginBottom: 22 }}>
          {indices.map((ix, i) => (
            <div key={i} style={{ flex: "0 0 auto", minWidth: 150, border: `1px solid ${C.line}`, borderRadius: 10, background: C.bg900, padding: "12px 14px" }}>
              <div style={{ ...sans, fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{ix.name}</div>
              <div style={{ ...mono, fontSize: 18, color: C.text, marginTop: 4 }}>{fmtN(ix.price)}</div>
              <div style={{ ...mono, fontSize: 12, color: toneOf(ix.pct), marginTop: 2 }}>{fmtP(ix.pct)} <span style={{ color: C.faint }}>·</span> {ix.net >= 0 ? "+" : ""}{fmtN(ix.net)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Movers */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <MoverList title="Top Gainers" icon={TrendingUp} tone={C.green} rows={gainers} openIf={openIf} known={known} />
        <MoverList title="Top Losers"  icon={TrendingDown} tone={C.red} rows={losers} openIf={openIf} known={known} />
      </div>

      {/* Most active + 52w */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card title="Most Active (NSE)" icon={Activity}>
          {active.length ? active.map((x, i) => (
            <Row key={i} clickable={known.has((x.ticker || "").toUpperCase())} onClick={() => openIf(x.ticker)}
              left={x.name} sub={fmtVol(x.volume) + " vol"} right={fmtN(x.price)} rightTone={C.text} pct={x.pct} />
          )) : <Empty />}
        </Card>
        <Card title="52-Week Highs / Lows (NSE)" icon={ArrowUpRight}>
          {highs.length || lows.length ? (
            <>
              {highs.slice(0, 5).map((x, i) => (
                <Row key={"h" + i} clickable={known.has((x.ticker || "").toUpperCase())} onClick={() => openIf(x.ticker)}
                  left={x.name} sub="52w high" right={fmtN(x.price)} rightTone={C.green} icon={<ArrowUpRight size={13} color={C.green} />} />
              ))}
              {lows.slice(0, 3).map((x, i) => (
                <Row key={"l" + i} clickable={known.has((x.ticker || "").toUpperCase())} onClick={() => openIf(x.ticker)}
                  left={x.name} sub="52w low" right={fmtN(x.price)} rightTone={C.red} icon={<ArrowDownRight size={13} color={C.red} />} />
              ))}
            </>
          ) : <Empty />}
        </Card>
      </div>
    </div>
  );
}

const Card = ({ title, icon: Icon, children }) => (
  <section style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.bg900, overflow: "hidden" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${C.line}`, background: C.bg800 }}>
      {Icon && <Icon size={14} color={C.gold} strokeWidth={1.6} />}
      <span style={{ ...sans, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text200, fontWeight: 600 }}>{title}</span>
    </header>
    <div style={{ padding: "6px 0" }}>{children}</div>
  </section>
);

const MoverList = ({ title, icon, tone, rows, openIf, known }) => (
  <Card title={title} icon={icon}>
    {rows.length ? rows.map((x, i) => (
      <Row key={i} clickable={known.has((x.ticker || "").toUpperCase())} onClick={() => openIf(x.ticker)}
        left={x.name} sub={x.rating} right={fmtN(x.price)} rightTone={C.text} pct={x.pct} />
    )) : <Empty />}
  </Card>
);

const Row = ({ left, sub, right, rightTone, pct, icon, clickable, onClick }) => (
  <div onClick={clickable ? onClick : undefined}
    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", cursor: clickable ? "pointer" : "default" }}
    onMouseEnter={e => clickable && (e.currentTarget.style.background = C.bg800)}
    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
    {icon}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ ...sans, fontSize: 13, color: clickable ? C.text : C.text200, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{left}</div>
      {sub && <div style={{ ...sans, fontSize: 10.5, color: C.dim }}>{sub}</div>}
    </div>
    <div style={{ textAlign: "right" }}>
      <div style={{ ...mono, fontSize: 13, color: rightTone || C.text }}>{right}</div>
      {pct != null && <div style={{ ...mono, fontSize: 11, color: toneOf(pct) }}>{fmtP(pct)}</div>}
    </div>
  </div>
);

const Empty = () => (
  <div style={{ ...sans, fontSize: 12, color: C.dim, padding: "14px 16px" }}>No data right now (market may be closed).</div>
);
