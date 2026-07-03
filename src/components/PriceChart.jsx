/* PriceChart.jsx — the interactive price chart (dedicated Chart tab).

   Split/bonus-adjusted daily closes from /history, with a range selector,
   toggleable moving-average overlays, a horizontal FAIR-VALUE line at the
   model's intrinsic, and volume bars. Recharts + inline theme, mobile-aware. */
import { useMemo, useState } from "react";
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { C, mono, sans } from "../lib/theme.js";
import { useIsMobile } from "../lib/useResponsive.js";

const RANGES = [["1M", 22], ["6M", 126], ["1Y", 252], ["Max", Infinity]];

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

const inr = v => v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: v >= 100 ? 0 : 2 });

export default function PriceChart({ data, intrinsic, price, ticker }) {
  const isMobile = useIsMobile();
  const [range, setRange] = useState(252);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showSMA200, setShowSMA200] = useState(false);

  const full = useMemo(() => {
    const pts = (data || []).filter(p => p && p.close != null);
    const closes = pts.map(p => p.close);
    const s50 = sma(closes, 50), s200 = sma(closes, 200);
    return pts.map((p, i) => ({
      date: p.date, label: p.date ? p.date.slice(2) : String(i),
      close: p.close, volume: p.volume || 0, sma50: s50[i], sma200: s200[i],
    }));
  }, [data]);

  const series = useMemo(() => (range === Infinity ? full : full.slice(-range)), [full, range]);

  if (!full.length) return (
    <div style={{ ...sans, padding: 40, color: C.dim, fontSize: 13 }}>
      No price history available for {ticker} yet.
    </div>
  );

  const first = series[0]?.close, last = series[series.length - 1]?.close;
  const chg = (first && last) ? last / first - 1 : null;
  const up = (chg ?? 0) >= 0;
  const showFV = intrinsic != null && intrinsic > 0;

  const Toggle = ({ on, set, color, label }) => (
    <button onClick={() => set(v => !v)} style={{
      ...sans, fontSize: 11, padding: "3px 9px", borderRadius: 6, cursor: "pointer",
      border: `1px solid ${on ? color : C.line2}`, background: on ? color + "1a" : "transparent",
      color: on ? color : C.dim,
    }}>{label}</button>
  );

  return (
    <div style={{ padding: isMobile ? "8px 2px" : "8px 4px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ ...mono, fontSize: 22, color: C.text }}>{inr(last)}</span>
        {chg != null && (
          <span style={{ ...mono, fontSize: 14, color: up ? C.green : C.red }}>
            {(up ? "+" : "") + (chg * 100).toFixed(1)}% <span style={{ ...sans, fontSize: 11, color: C.dim }}>over {RANGES.find(r => r[1] === range)?.[0] || "range"}</span>
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

      <div style={{ display: "flex", gap: 7, marginBottom: 8, flexWrap: "wrap" }}>
        <Toggle on={showSMA50} set={setShowSMA50} color={C.gold} label="50-DMA" />
        <Toggle on={showSMA200} set={setShowSMA200} color="#8FB4D8" label="200-DMA" />
        {showFV && <span style={{ ...sans, fontSize: 11, color: C.dim, alignSelf: "center" }}>· dashed line = model fair value {inr(intrinsic)}</span>}
      </div>

      <div style={{ height: isMobile ? 260 : 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 6, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="pcArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.gold} stopOpacity={0.28} />
                <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.line} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 10 }} minTickGap={44} tickLine={false} axisLine={{ stroke: C.line }} />
            <YAxis yAxisId="P" domain={["auto", "auto"]} tick={{ fill: C.dim, fontSize: 10 }} width={52} tickLine={false} axisLine={false}
                   tickFormatter={v => "₹" + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v)} />
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
      <div style={{ ...sans, fontSize: 10, color: C.faint, marginTop: 6 }}>
        Split/bonus-adjusted closes. Fair value is the independent model's intrinsic — above the line looks cheap, below looks rich (on the model's view).
      </div>
    </div>
  );
}
