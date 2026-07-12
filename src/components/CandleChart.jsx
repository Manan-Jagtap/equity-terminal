/* CandleChart.jsx — broker-terminal candlesticks on TradingView's open-source
   lightweight-charts engine (Apache-2.0). Daily candles from the split-adjusted
   /history feed, with weekly/monthly aggregation, volume histogram, crosshair
   OHLC readout and a log-scale toggle. */
import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CandlestickSeries, HistogramSeries, CrosshairMode } from "lightweight-charts";
import { C, mono, sans } from "../lib/theme.js";

const UP = "#26A69A", DOWN = "#EF5350";

function aggregate(rows, unit) {
  if (unit === "day") return rows;
  const out = [];
  let cur = null, key = null;
  for (const r of rows) {
    const d = new Date(r.time + "T00:00:00Z");
    const k = unit === "week"
      ? `${d.getUTCFullYear()}-${Math.floor(((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 864e5 + new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getUTCDay()) / 7)}`
      : `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (k !== key) {
      if (cur) out.push(cur);
      key = k;
      cur = { ...r };
    } else {
      cur.high = Math.max(cur.high, r.high);
      cur.low = Math.min(cur.low, r.low);
      cur.close = r.close;
      cur.volume = (cur.volume || 0) + (r.volume || 0);
      // period stays keyed to its first session's date
    }
  }
  if (cur) out.push(cur);
  return out;
}

const RANGES = [["3M", 66], ["6M", 126], ["1Y", 252], ["3Y", 756], ["5Y", Infinity]];
const UNITS = [["D", "day"], ["W", "week"], ["M", "month"]];

export default function CandleChart({ data, height = 420 }) {
  const holder = useRef(null);
  const chartRef = useRef(null);
  const [range, setRange] = useState(252);
  const [unit, setUnit] = useState("day");
  const [logScale, setLogScale] = useState(false);
  const [hover, setHover] = useState(null);

  const rows = useMemo(() => {
    const pts = (data || [])
      .filter(p => p && p.close != null && p.date)
      .map(p => ({ time: p.date, open: p.open ?? p.close, high: p.high ?? p.close,
                   low: p.low ?? p.close, close: p.close, volume: p.volume || 0 }));
    const sliced = range === Infinity ? pts : pts.slice(-range);
    return aggregate(sliced, unit);
  }, [data, range, unit]);

  useEffect(() => {
    if (!holder.current || !rows.length) return;
    const chart = createChart(holder.current, {
      height,
      layout: { background: { color: "transparent" }, textColor: C.dim,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                attributionLogo: false },
      grid: { vertLines: { color: "rgba(147,171,255,0.05)" },
              horzLines: { color: "rgba(147,171,255,0.05)" } },
      crosshair: { mode: CrosshairMode.Normal,
                   vertLine: { color: C.dim, style: 3 }, horzLine: { color: C.dim, style: 3 } },
      rightPriceScale: { borderColor: "rgba(147,171,255,0.12)",
                         mode: logScale ? 1 : 0,
                         scaleMargins: { top: 0.06, bottom: 0.22 } },
      timeScale: { borderColor: "rgba(147,171,255,0.12)", timeVisible: false },
      handleScroll: true, handleScale: true,
    });
    chartRef.current = chart;

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN,
      wickUpColor: UP, wickDownColor: DOWN,
    });
    candles.setData(rows.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));

    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" }, priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    vol.setData(rows.map(r => ({ time: r.time, value: r.volume,
      color: r.close >= r.open ? UP + "55" : DOWN + "55" })));

    chart.timeScale().fitContent();
    const onMove = param => {
      const c = param.seriesData?.get(candles);
      setHover(c ? { ...c, time: param.time } : null);
    };
    chart.subscribeCrosshairMove(onMove);

    const ro = new ResizeObserver(() => {
      if (holder.current) chart.applyOptions({ width: holder.current.clientWidth });
    });
    ro.observe(holder.current);
    return () => { ro.disconnect(); chart.unsubscribeCrosshairMove(onMove); chart.remove(); chartRef.current = null; };
  }, [rows, height, logScale]);

  if (!rows.length) return (
    <div style={{ ...sans, padding: 40, color: C.dim, fontSize: 13 }}>No OHLC history yet.</div>
  );
  const last = rows[rows.length - 1];
  const h = hover || last;
  const up = h.close >= h.open;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        {RANGES.map(([lbl, n]) => (
          <button key={lbl} onClick={() => setRange(n)} style={{
            ...sans, fontSize: 11, padding: "4px 11px", borderRadius: 7, cursor: "pointer",
            border: `1px solid ${range === n ? C.line2 : "transparent"}`,
            background: range === n ? C.bg800 : "transparent", color: range === n ? C.gold : C.dim }}>{lbl}</button>
        ))}
        <span style={{ width: 1, height: 18, background: C.line }} />
        {UNITS.map(([lbl, u]) => (
          <button key={u} onClick={() => setUnit(u)} style={{
            ...sans, fontSize: 11, padding: "4px 10px", borderRadius: 7, cursor: "pointer",
            border: `1px solid ${unit === u ? C.line2 : "transparent"}`,
            background: unit === u ? C.bg800 : "transparent", color: unit === u ? C.gold : C.dim }}>{lbl}</button>
        ))}
        <button onClick={() => setLogScale(v => !v)} style={{
          ...sans, fontSize: 11, padding: "4px 10px", borderRadius: 7, cursor: "pointer",
          border: `1px solid ${logScale ? C.green : C.line2}`,
          background: logScale ? C.green + "1a" : "transparent", color: logScale ? C.green : C.dim }}>Log</button>
        <span style={{ ...mono, fontSize: 11, color: C.dim, marginLeft: "auto", whiteSpace: "nowrap" }}>
          <span style={{ color: C.faint }}>{h.time} · </span>
          O <span style={{ color: up ? UP : DOWN }}>{h.open?.toLocaleString("en-IN")}</span>{"  "}
          H <span style={{ color: up ? UP : DOWN }}>{h.high?.toLocaleString("en-IN")}</span>{"  "}
          L <span style={{ color: up ? UP : DOWN }}>{h.low?.toLocaleString("en-IN")}</span>{"  "}
          C <span style={{ color: up ? UP : DOWN }}>{h.close?.toLocaleString("en-IN")}</span>
        </span>
      </div>
      <div ref={holder} style={{ width: "100%" }} />
      <div style={{ ...sans, fontSize: 10, color: C.faint, marginTop: 6 }}>
        Split/bonus-adjusted NSE daily OHLCV · scroll to zoom, drag to pan · candles by TradingView's open-source engine.
      </div>
    </div>
  );
}
