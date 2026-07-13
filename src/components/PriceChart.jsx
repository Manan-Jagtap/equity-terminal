/* PriceChart.jsx — the interactive price chart (dedicated Chart tab).

   Split/bonus-adjusted daily closes from /history: range selector (1M→5Y/Max),
   linear/log scale, toggleable moving-average overlays, a horizontal FAIR-VALUE
   line at the model's intrinsic, volume bars, an RSI(14) pane, and 52-week
   high/low markers. Recharts + inline theme, mobile-aware. */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
const CandleChart = lazy(() => import("./CandleChart.jsx"));
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { C, mono, sans } from "../lib/theme.js";
import { useIsMobile } from "../lib/useResponsive.js";

const RANGES = [["1M", 22], ["6M", 126], ["1Y", 252], ["3Y", 756], ["5Y", 1260], ["Max", Infinity]];

function sma(vals, n) {
  const out = Array(vals.length).fill(null);
  let sum = 0;
  for (let i = 0; i < vals.length; i++) {
    sum += vals[i];
    if (i >= n) sum -= vals[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

/* Wilder-smoothed RSI(14) — the textbook definition, so it matches what users
   see on their broker's chart. */
function rsi(vals, n = 14) {
  const out = Array(vals.length).fill(null);
  if (vals.length <= n) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = vals[i] - vals[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgG = gain / n, avgL = loss / n;
  out[n] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = n + 1; i < vals.length; i++) {
    const d = vals[i] - vals[i - 1];
    avgG = (avgG * (n - 1) + Math.max(d, 0)) / n;
    avgL = (avgL * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}

const inr = v => v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: v >= 100 ? 0 : 2 });

const Toggle = ({ on, set, color, label }) => (
  <button onClick={() => set(v => !v)} style={{
    ...sans, fontSize: 11, padding: "3px 9px", borderRadius: 6, cursor: "pointer",
    border: `1px solid ${on ? color : C.line2}`, background: on ? color + "1a" : "transparent",
    color: on ? color : C.dim,
  }}>{label}</button>
);

export default function PriceChart({ data, intrinsic, price, ticker, API }) {
  const isMobile = useIsMobile();
  const [style, setStyle] = useState("candles");   // broker-terminal default
  const [range, setRange] = useState(252);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showSMA200, setShowSMA200] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [showRSI, setShowRSI] = useState(false);

  const full = useMemo(() => {
    const pts = (data || []).filter(p => p && p.close != null);
    const closes = pts.map(p => p.close);
    const s50 = sma(closes, 50), s200 = sma(closes, 200), r14 = rsi(closes);
    return pts.map((p, i) => ({
      date: p.date, label: p.date ? p.date.slice(2) : String(i),
      close: p.close, volume: p.volume || 0, sma50: s50[i], sma200: s200[i], rsi: r14[i],
    }));
  }, [data]);

  const series = useMemo(() => (range === Infinity ? full : full.slice(-range)), [full, range]);

  // 52-week high/low from the trailing year (intraday extremes when the feed
  // carries them — the external-terminal convention), regardless of range.
  const [hi52, lo52] = useMemo(() => {
    const yr = (data || []).filter(p => p && p.close != null).slice(-252);
    if (!yr.length) return [null, null];
    return [Math.max(...yr.map(p => p.high ?? p.close)),
            Math.min(...yr.map(p => p.low ?? p.close))];
  }, [data]);

  if (!full.length) return (
    <div style={{ ...sans, padding: 40, color: C.dim, fontSize: 13 }}>
      No price history available for {ticker} yet.
    </div>
  );

  const first = series[0]?.close, last = series[series.length - 1]?.close;
  const chg = (first && last) ? last / first - 1 : null;
  const up = (chg ?? 0) >= 0;
  const showFV = intrinsic != null && intrinsic > 0;
  const peak = Math.max(...series.map(p => p.close));
  const ddNow = peak > 0 && last != null ? last / peak - 1 : null;

  const [intraday, setIntraday] = useState(null);
  useEffect(() => {
    if (style !== "intraday" || !API || !ticker) return;
    let dead = false;
    setIntraday(null);
    fetch(`${API}/api/companies/${ticker}/intraday`)
      .then(r => r.json()).then(d => { if (!dead) setIntraday(d); })
      .catch(() => { if (!dead) setIntraday({ available: false, values: [] }); });
    return () => { dead = true; };
  }, [style, API, ticker]);

  const StyleToggle = (
    <div style={{ display: "inline-flex", gap: 4, marginRight: 8 }}>
      {[["candles", "Candles"], ["line", "Line"], ["intraday", "1D"]].map(([id, lbl]) => (
        <button key={id} onClick={() => setStyle(id)} style={{
          ...sans, fontSize: 11, padding: "4px 11px", borderRadius: 7, cursor: "pointer",
          border: `1px solid ${style === id ? C.gold + "66" : C.line2}`,
          background: style === id ? C.gold + "0d" : "transparent",
          color: style === id ? C.gold : C.dim }}>{lbl}</button>
      ))}
    </div>
  );

  if (style === "intraday") {
    const iv = (intraday?.values || []).map((v, i) => ({
      i, label: (v.t || "").slice(11, 16), price: v.price }));
    const up = intraday?.change == null ? true : intraday.change >= 0;
    const col = up ? C.green : C.red;
    return (
      <div style={{ padding: isMobile ? "8px 2px" : "8px 4px" }}>
        <div style={{ marginBottom: 8, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          {StyleToggle}
          {intraday?.price != null && (
            <span style={{ ...mono, fontSize: 13, color: C.text }}>{inr(intraday.price)}
              <span style={{ color: col, marginLeft: 8 }}>
                {up ? "+" : ""}{intraday.change != null ? inr(Math.abs(intraday.change)) : ""}
                {intraday.pct != null ? ` (${intraday.pct >= 0 ? "+" : ""}${Number(intraday.pct).toFixed(2)}%)` : ""}
              </span>
            </span>
          )}
          <span style={{ ...sans, fontSize: 10.5, color: C.faint }}>today · 1-minute ticks</span>
        </div>
        {!iv.length ? (
          <div style={{ ...sans, padding: 30, color: C.dim, fontSize: 12 }}>
            {intraday == null ? "Loading intraday…"
              : "No intraday ticks right now — the market is closed or this name has no live feed."}
          </div>
        ) : (
          <div style={{ height: isMobile ? 260 : 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={iv} margin={{ top: 8, right: 6, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="idg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={col} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={col} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 10 }} minTickGap={48} tickLine={false} axisLine={{ stroke: C.line }} />
                <YAxis domain={["auto", "auto"]} tick={{ fill: C.dim, fontSize: 10 }} width={52} tickLine={false} axisLine={false}
                       tickFormatter={v => "₹" + Math.round(v)} />
                {intraday?.prev != null && <ReferenceLine y={intraday.prev} stroke={C.dim} strokeDasharray="4 4"
                  label={{ value: "prev close", fill: C.dim, fontSize: 9, position: "insideTopRight" }} />}
                <Tooltip contentStyle={{ background: C.bg900, border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: C.dim }} formatter={v => [inr(v), "Price"]} />
                <Area type="monotone" dataKey="price" stroke={col} strokeWidth={1.7} fill="url(#idg)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  if (style === "candles") return (
    <div style={{ padding: isMobile ? "8px 2px" : "8px 4px" }}>
      <div style={{ marginBottom: 8 }}>{StyleToggle}</div>
      <Suspense fallback={<div style={{ ...sans, padding: 30, color: C.dim, fontSize: 12 }}>Loading chart engine…</div>}>
        <CandleChart data={data} height={isMobile ? 300 : 430} />
      </Suspense>
    </div>
  );

  return (
    <div style={{ padding: isMobile ? "8px 2px" : "8px 4px" }}>
      <div style={{ marginBottom: 8 }}>{StyleToggle}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ ...mono, fontSize: 22, color: C.text }}>{inr(last)}</span>
        {chg != null && (
          <span style={{ ...mono, fontSize: 14, color: up ? C.green : C.red }}>
            {(up ? "+" : "") + (chg * 100).toFixed(1)}% <span style={{ ...sans, fontSize: 11, color: C.dim }}>over {RANGES.find(r => r[1] === range)?.[0] || "range"}</span>
          </span>
        )}
        {ddNow != null && ddNow < -0.005 && (
          <span style={{ ...mono, fontSize: 11, color: C.dim }} title="Distance below the selected range's peak close">
            {(ddNow * 100).toFixed(1)}% off range high
          </span>
        )}
        <div style={{ display: "flex", gap: 5, marginLeft: "auto", flexWrap: "wrap" }}>
          {RANGES.map(([lbl, n]) => (
            <button key={lbl} onClick={() => setRange(n)} style={{
              ...sans, fontSize: 11, padding: "4px 11px", borderRadius: 7, cursor: "pointer",
              border: `1px solid ${range === n ? C.line2 : "transparent"}`,
              background: range === n ? C.bg800 : "transparent", color: range === n ? C.gold : C.dim,
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 7, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Toggle on={showSMA50} set={setShowSMA50} color={C.gold} label="50-DMA" />
        <Toggle on={showSMA200} set={setShowSMA200} color="#8FB4D8" label="200-DMA" />
        <Toggle on={showRSI} set={setShowRSI} color="#C792EA" label="RSI 14" />
        <Toggle on={logScale} set={setLogScale} color={C.green} label="Log" />
        {hi52 != null && (
          <span style={{ ...mono, fontSize: 10.5, color: C.dim, marginLeft: 4 }}>
            52w {inr(lo52)} – {inr(hi52)}
          </span>
        )}
        {showFV && <span style={{ ...sans, fontSize: 11, color: C.dim }}>· dashed line = model fair value {inr(intrinsic)}</span>}
      </div>

      <div style={{ height: isMobile ? 250 : showRSI ? 330 : 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 6, bottom: 0, left: -8 }} syncId="pc">
            <defs>
              <linearGradient id="pcArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.gold} stopOpacity={0.28} />
                <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 10 }} minTickGap={44} tickLine={false} axisLine={{ stroke: C.line }} />
            <YAxis yAxisId="P" domain={["auto", "auto"]} scale={logScale ? "log" : "auto"} allowDataOverflow
                   tick={{ fill: C.dim, fontSize: 10 }} width={52} tickLine={false} axisLine={false}
                   tickFormatter={v => "₹" + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : Math.round(v))} />
            <YAxis yAxisId="V" orientation="right" hide domain={[0, dataMax => dataMax * 4]} />
            <Tooltip
              contentStyle={{ background: C.bg900, border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: C.dim }} itemStyle={{ color: C.text }}
              formatter={(v, n) => [n === "volume" ? Number(v).toLocaleString("en-IN") : inr(v), n]} />
            <Bar yAxisId="V" dataKey="volume" fill={C.line2} opacity={0.5} />
            <Area yAxisId="P" type="monotone" dataKey="close" stroke={C.gold} strokeWidth={1.7} fill="url(#pcArea)" dot={false} name="close" />
            {showSMA50 && <Line yAxisId="P" type="monotone" dataKey="sma50" stroke={C.gold} strokeWidth={1} dot={false} strokeDasharray="5 3" name="50-DMA" />}
            {showSMA200 && <Line yAxisId="P" type="monotone" dataKey="sma200" stroke="#8FB4D8" strokeWidth={1} dot={false} strokeDasharray="5 3" name="200-DMA" />}
            {showFV && <ReferenceLine yAxisId="P" y={intrinsic} stroke={C.green} strokeDasharray="6 4"
                        label={{ value: "Fair value", fill: C.green, fontSize: 10, position: "insideTopLeft" }} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {showRSI && (
        <div style={{ height: 90, marginTop: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 4, right: 6, bottom: 0, left: -8 }} syncId="pc">
              <XAxis dataKey="label" hide />
              <YAxis domain={[0, 100]} ticks={[30, 70]} tick={{ fill: C.dim, fontSize: 9 }} width={52} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: C.bg900, border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: C.dim }} itemStyle={{ color: C.text }}
                formatter={v => [v == null ? "—" : Number(v).toFixed(1), "RSI 14"]} />
              <ReferenceLine y={70} stroke={C.red} strokeDasharray="3 4" strokeOpacity={0.5} />
              <ReferenceLine y={30} stroke={C.green} strokeDasharray="3 4" strokeOpacity={0.5} />
              <Line type="monotone" dataKey="rsi" stroke="#C792EA" strokeWidth={1.2} dot={false} name="RSI 14" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ ...sans, fontSize: 10, color: C.faint, marginTop: 6 }}>
        Split/bonus-adjusted closes. Fair value is the independent model's intrinsic — above the line looks cheap, below looks rich (on the model's view).
        {showRSI && " RSI above 70 = overbought zone, below 30 = oversold (Wilder's 14-day)."}
      </div>
    </div>
  );
}
