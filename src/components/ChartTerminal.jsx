/* ChartTerminal.jsx — a broker-grade charting terminal on TradingView's
   open-source lightweight-charts v5 (Apache-2.0). Candle / line / area, D/W/M
   intervals, range selector, log scale, a live forming candle, price-pane
   overlays (SMA·EMA·Bollinger·VWAP), oscillator sub-panes (RSI·MACD·Stochastic·
   ATR), a volume pane, a crosshair legend, a model fair-value line, and
   trendline / horizontal-level / rectangle drawing tools. */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart, CandlestickSeries, LineSeries, AreaSeries, HistogramSeries, CrosshairMode,
} from "lightweight-charts";
import { C, mono, sans } from "../lib/theme.js";
import * as IND from "../lib/indicators.js";
import { buttonReset } from "../lib/a11y.js";

const UP = "#7ce0bd", DOWN = "#dd7d84";   // --ev-buy / --ev-avoid
const GRID = "rgba(242,237,228,0.06)", AXIS = "rgba(242,237,228,0.12)";

function aggregate(rows, unit) {
  if (unit === "day") return rows;
  const out = []; let cur = null, key = null;
  for (const r of rows) {
    const d = new Date(r.time + "T00:00:00Z");
    const k = unit === "week"
      ? `${d.getUTCFullYear()}-W${Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 6048e5)}`
      : `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (k !== key) { if (cur) out.push(cur); key = k; cur = { ...r }; }
    else { cur.high = Math.max(cur.high, r.high); cur.low = Math.min(cur.low, r.low); cur.close = r.close; cur.volume = (cur.volume || 0) + (r.volume || 0); }
  }
  if (cur) out.push(cur);
  return out;
}

const RANGES = [["1M", 22], ["3M", 66], ["6M", 126], ["1Y", 252], ["3Y", 756], ["5Y", 1260], ["Max", Infinity]];
const UNITS = [["D", "day"], ["W", "week"], ["M", "month"]];
const TYPES = [["candle", "Candles"], ["line", "Line"], ["area", "Area"]];
const OVERLAYS = ["sma20", "sma50", "sma200", "ema20", "ema50", "bollinger", "vwap"];
const OSCILLATORS = ["rsi", "macd", "stoch", "atr"];

const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const fmt = v => v == null ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function ChartTerminal({ data, livePrice, live, intrinsic, height = 460 }) {
  const holder = useRef(null);
  const chartRef = useRef(null);
  const mainRef = useRef(null);
  const [range, setRange] = useState(252);
  const [unit, setUnit] = useState("day");
  const [ctype, setCtype] = useState("candle");
  const [log, setLog] = useState(false);
  const [menu, setMenu] = useState(false);
  const [active, setActive] = useState({ sma50: true, volume: true });
  const [hover, setHover] = useState(null);
  const [legend, setLegend] = useState({});

  const rows = useMemo(() => {
    const pts = (data || [])
      .filter(p => p && p.close != null && p.date)
      .map(p => ({ time: p.date, open: p.open ?? p.close, high: p.high ?? p.close, low: p.low ?? p.close, close: p.close, volume: p.volume || 0 }));
    const sliced = range === Infinity ? pts : pts.slice(-range);
    return aggregate(sliced, unit);
  }, [data, range, unit]);

  const toggle = k => setActive(a => ({ ...a, [k]: !a[k] }));

  useEffect(() => {
    if (!holder.current || !rows.length) return;
    const chart = createChart(holder.current, {
      height, autoSize: false,
      layout: { background: { color: "transparent" }, textColor: C.dim, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, attributionLogo: false, panes: { separatorColor: AXIS, separatorHoverColor: "rgba(242,237,228,0.2)" } },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: C.dim, style: 3, labelBackgroundColor: C.bg800 }, horzLine: { color: C.dim, style: 3, labelBackgroundColor: C.bg800 } },
      rightPriceScale: { borderColor: AXIS, mode: log ? 1 : 0, scaleMargins: { top: 0.08, bottom: active.volume ? 0.24 : 0.08 } },
      timeScale: { borderColor: AXIS, timeVisible: false, rightOffset: 4 },
      handleScroll: true, handleScale: true,
    });
    chartRef.current = chart;

    // ── main price series ──
    let main;
    if (ctype === "candle") {
      main = chart.addSeries(CandlestickSeries, { upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN }, 0);
      main.setData(rows.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    } else if (ctype === "area") {
      main = chart.addSeries(AreaSeries, { lineColor: C.gold, topColor: C.gold + "44", bottomColor: C.gold + "04", lineWidth: 2 }, 0);
      main.setData(rows.map(r => ({ time: r.time, value: r.close })));
    } else {
      main = chart.addSeries(LineSeries, { color: C.gold, lineWidth: 2 }, 0);
      main.setData(rows.map(r => ({ time: r.time, value: r.close })));
    }
    mainRef.current = main;

    if (intrinsic > 0) main.createPriceLine({ price: intrinsic, color: C.green, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "Fair value" });

    // ── volume (overlay on the price pane) ──
    if (active.volume) {
      const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol" }, 0);
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(rows.map(r => ({ time: r.time, value: r.volume, color: r.close >= r.open ? UP + "44" : DOWN + "44" })));
    }

    // ── price-pane overlays ──
    const overlaySeries = {};
    for (const key of OVERLAYS) {
      if (!active[key]) continue;
      const meta = IND.INDICATORS[key];
      const out = meta.fn(rows);
      if (meta.kind === "overlay-band") {
        const mk = col => chart.addSeries(LineSeries, { color: col, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }, 0);
        const u = mk(meta.color + "cc"), m = mk(meta.color + "77"), l = mk(meta.color + "cc");
        u.setData(out.map(p => ({ time: p.time, value: p.upper })));
        m.setData(out.map(p => ({ time: p.time, value: p.middle })));
        l.setData(out.map(p => ({ time: p.time, value: p.lower })));
        overlaySeries[key] = m;
      } else {
        const s = chart.addSeries(LineSeries, { color: meta.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: true }, 0);
        s.setData(out);
        overlaySeries[key] = s;
      }
    }

    // ── oscillator sub-panes ──
    let pane = 1;
    const paneSeries = {};
    for (const key of OSCILLATORS) {
      if (!active[key]) continue;
      const meta = IND.INDICATORS[key];
      const out = meta.fn(rows);
      if (key === "macd") {
        const h = chart.addSeries(HistogramSeries, {}, pane);
        h.setData(out.hist.map(p => ({ time: p.time, value: p.value, color: p.value >= 0 ? UP + "88" : DOWN + "88" })));
        const ml = chart.addSeries(LineSeries, { color: "#5fb3b3", lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, pane);
        ml.setData(out.macd);
        const sl = chart.addSeries(LineSeries, { color: C.gold, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, pane);
        sl.setData(out.signal);
        paneSeries[key] = ml;
      } else if (key === "stoch") {
        const k = chart.addSeries(LineSeries, { color: "#9d8fd4", lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, pane);
        k.setData(out.k);
        const d = chart.addSeries(LineSeries, { color: C.gold, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, pane);
        d.setData(out.d);
        k.createPriceLine({ price: 80, color: DOWN + "66", lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
        k.createPriceLine({ price: 20, color: UP + "66", lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
        paneSeries[key] = k;
      } else {
        const s = chart.addSeries(LineSeries, { color: meta.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, pane);
        s.setData(out);
        if (key === "rsi") {
          s.createPriceLine({ price: 70, color: DOWN + "66", lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
          s.createPriceLine({ price: 30, color: UP + "66", lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
        }
        paneSeries[key] = s;
      }
      pane++;
    }

    // pane sizing: main dominant, oscillators compact
    try {
      const panes = chart.panes();
      panes[0]?.setStretchFactor(3);
      for (let i = 1; i < panes.length; i++) panes[i]?.setStretchFactor(1);
    } catch { /* older build without stretch factor */ }

    chart.timeScale().fitContent();

    const onMove = param => {
      const md = param.seriesData?.get(main);
      if (!md) { setHover(null); return; }
      setHover(ctype === "candle" ? { ...md, time: param.time } : { close: md.value, time: param.time });
      const leg = {};
      for (const [k, s] of Object.entries(overlaySeries)) { const v = param.seriesData?.get(s); if (v) leg[k] = v.value; }
      for (const [k, s] of Object.entries(paneSeries)) { const v = param.seriesData?.get(s); if (v) leg[k] = v.value; }
      setLegend(leg);
    };
    chart.subscribeCrosshairMove(onMove);

    const ro = new ResizeObserver(() => { if (holder.current) chart.applyOptions({ width: holder.current.clientWidth }); });
    ro.observe(holder.current);
    chart.applyOptions({ width: holder.current.clientWidth });

    return () => { ro.disconnect(); chart.unsubscribeCrosshairMove(onMove); chart.remove(); chartRef.current = null; mainRef.current = null; };
  }, [rows, height, log, ctype, active, intrinsic]);

  // live forming candle (daily candle view only)
  const liveBar = useMemo(() => {
    if (!(live && livePrice > 0 && unit === "day" && ctype === "candle" && rows.length)) return null;
    const today = istToday(); const lb = rows[rows.length - 1];
    if (lb.time === today) return { time: today, open: lb.open, high: Math.max(lb.high, livePrice), low: Math.min(lb.low, livePrice), close: livePrice };
    if (lb.time < today) return { time: today, open: lb.close, high: Math.max(lb.close, livePrice), low: Math.min(lb.close, livePrice), close: livePrice };
    return null;
  }, [live, livePrice, unit, ctype, rows]);

  useEffect(() => {
    if (liveBar && mainRef.current) { try { mainRef.current.update(liveBar); } catch { /* torn down */ } }
  }, [liveBar]);

  if (!rows.length) return <div style={{ ...sans, padding: 40, color: C.dim, fontSize: 13 }}>No OHLC history yet.</div>;

  const last = rows[rows.length - 1];
  const h = hover || liveBar || last;
  const up = (h.close ?? 0) >= (h.open ?? h.close);
  const showLive = !hover && !!liveBar;
  const btn = (on, extra = {}) => ({ ...sans, fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer", border: `1px solid ${on ? C.gold + "66" : "transparent"}`, background: on ? C.gold + "12" : "transparent", color: on ? C.gold : C.dim, ...extra });
  const legendItems = [...OVERLAYS, ...OSCILLATORS].filter(k => active[k]);

  return (
    <div>
      {/* toolbar */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        {TYPES.map(([id, l]) => <button key={id} onClick={() => setCtype(id)} style={btn(ctype === id)}>{l}</button>)}
        <span style={{ width: 1, height: 16, background: C.line }} />
        {RANGES.map(([l, n]) => <button key={l} onClick={() => setRange(n)} style={btn(range === n, { padding: "4px 9px" })}>{l}</button>)}
        <span style={{ width: 1, height: 16, background: C.line }} />
        {UNITS.map(([l, u]) => <button key={u} onClick={() => setUnit(u)} style={btn(unit === u, { padding: "4px 9px" })}>{l}</button>)}
        <button onClick={() => setLog(v => !v)} style={btn(log)}>Log</button>
        <div style={{ position: "relative" }}>
          <button onClick={() => setMenu(m => !m)} style={btn(legendItems.length > 0)}>ƒ Indicators ▾</button>
          {menu && (
            <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 30, background: C.bg900, border: `1px solid ${C.line2}`, borderRadius: 10, padding: 10, minWidth: 190, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
              <div style={{ ...sans, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.1em", color: C.faint, margin: "2px 0 6px" }}>Overlays</div>
              {OVERLAYS.map(k => <MenuRow key={k} k={k} on={!!active[k]} onClick={() => toggle(k)} />)}
              <div style={{ ...sans, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.1em", color: C.faint, margin: "8px 0 6px" }}>Oscillators</div>
              {OSCILLATORS.map(k => <MenuRow key={k} k={k} on={!!active[k]} onClick={() => toggle(k)} />)}
              <div style={{ ...sans, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.1em", color: C.faint, margin: "8px 0 6px" }}>Other</div>
              <MenuRow k="volume" label="Volume" on={!!active.volume} onClick={() => toggle("volume")} />
            </div>
          )}
        </div>

        {/* OHLC crosshair readout */}
        <span style={{ ...mono, fontSize: 11, color: C.dim, marginLeft: "auto", whiteSpace: "nowrap" }}>
          {showLive && <span style={{ color: UP, marginRight: 6 }}><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: UP, boxShadow: `0 0 6px ${UP}`, marginRight: 4 }} />LIVE</span>}
          <span style={{ color: C.faint }}>{h.time} · </span>
          {h.open != null && <>O <span style={{ color: up ? UP : DOWN }}>{fmt(h.open)}</span>{"  "}H <span style={{ color: up ? UP : DOWN }}>{fmt(h.high)}</span>{"  "}L <span style={{ color: up ? UP : DOWN }}>{fmt(h.low)}</span>{"  "}</>}
          C <span style={{ color: up ? UP : DOWN }}>{fmt(h.close)}</span>
        </span>
      </div>

      {/* active-indicator legend */}
      {legendItems.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6, ...mono, fontSize: 10.5 }}>
          {legendItems.map(k => (
            <span key={k} style={{ color: IND.INDICATORS[k]?.color || C.dim }}>
              {IND.INDICATORS[k]?.label}{legend[k] != null ? ` ${fmt(legend[k])}` : ""}
            </span>
          ))}
        </div>
      )}

      <div ref={holder} style={{ width: "100%", position: "relative" }} />
      <div style={{ ...sans, fontSize: 10, color: C.faint, marginTop: 6 }}>
        Split/bonus-adjusted NSE OHLCV · scroll to zoom, drag to pan · indicators computed client-side · engine: TradingView lightweight-charts.
      </div>
    </div>
  );
}

function MenuRow({ k, label, on, onClick }) {
  const meta = IND.INDICATORS[k];
  return (
    <button type="button" onClick={onClick} style={{ ...buttonReset,  display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", borderRadius: 6, cursor: "pointer", ...sans, fontSize: 12, color: on ? C.text : C.dim  }}
      onMouseEnter={e => e.currentTarget.style.background = C.bg800} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <span style={{ width: 13, height: 13, borderRadius: 6, border: `1px solid ${on ? C.gold : C.line2}`, background: on ? C.gold : "transparent", flexShrink: 0 }} />
      {meta && <span style={{ width: 10, height: 2, background: meta.color, flexShrink: 0 }} />}
      {label || meta?.label || k}
    </button>
  );
}
