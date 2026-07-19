/* indicators.js — pure technical-indicator math for the trading-terminal chart.
   Every function takes candle rows [{time, open, high, low, close, volume}] and
   returns time-aligned points, emitting a point only once enough history exists
   (no fabricated warm-up values). Shared, testable, framework-free. */

const _closes = rows => rows.map(r => r.close);

export function sma(rows, period = 20, src = _closes) {
  const xs = src(rows), out = [];
  let sum = 0;
  for (let i = 0; i < xs.length; i++) {
    sum += xs[i];
    if (i >= period) sum -= xs[i - period];
    if (i >= period - 1) out.push({ time: rows[i].time, value: sum / period });
  }
  return out;
}

export function ema(rows, period = 20, src = _closes) {
  const xs = src(rows), out = [];
  const k = 2 / (period + 1);
  let prev = null, seed = 0;
  for (let i = 0; i < xs.length; i++) {
    if (i < period - 1) { seed += xs[i]; continue; }
    if (i === period - 1) { seed += xs[i]; prev = seed / period; }
    else prev = xs[i] * k + prev * (1 - k);
    out.push({ time: rows[i].time, value: prev });
  }
  return out;
}

export function bollinger(rows, period = 20, mult = 2) {
  const xs = _closes(rows), out = [];
  for (let i = period - 1; i < xs.length; i++) {
    const win = xs.slice(i - period + 1, i + 1);
    const mean = win.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(win.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    out.push({ time: rows[i].time, middle: mean, upper: mean + mult * sd, lower: mean - mult * sd });
  }
  return out;
}

/* Anchored VWAP from the first visible bar — Σ(typical·vol)/Σvol. */
export function vwap(rows) {
  const out = [];
  let pv = 0, vv = 0;
  for (const r of rows) {
    const tp = (r.high + r.low + r.close) / 3;
    const v = r.volume || 0;
    pv += tp * v; vv += v;
    if (vv > 0) out.push({ time: r.time, value: pv / vv });
  }
  return out;
}

export function rsi(rows, period = 14) {
  const xs = _closes(rows), out = [];
  let avgG = 0, avgL = 0;
  for (let i = 1; i < xs.length; i++) {
    const ch = xs[i] - xs[i - 1];
    const g = ch > 0 ? ch : 0, l = ch < 0 ? -ch : 0;
    if (i <= period) { avgG += g; avgL += l; if (i === period) { avgG /= period; avgL /= period; } }
    else { avgG = (avgG * (period - 1) + g) / period; avgL = (avgL * (period - 1) + l) / period; }
    if (i >= period) {
      const rs = avgL === 0 ? Infinity : avgG / avgL;
      out.push({ time: rows[i].time, value: avgL === 0 ? 100 : 100 - 100 / (1 + rs) });
    }
  }
  return out;
}

function _emaSeries(values, period) {
  const k = 2 / (period + 1), out = [];
  let prev = null, seed = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { seed += values[i]; out.push(null); continue; }
    if (i === period - 1) { seed += values[i]; prev = seed / period; }
    else prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function macd(rows, fast = 12, slow = 26, signal = 9) {
  const xs = _closes(rows);
  const ef = _emaSeries(xs, fast), es = _emaSeries(xs, slow);
  const line = xs.map((_, i) => (ef[i] != null && es[i] != null) ? ef[i] - es[i] : null);
  const defined = line.map(v => (v == null ? 0 : v));
  const firstIdx = line.findIndex(v => v != null);
  const sig = _emaSeries(defined.slice(firstIdx), signal);
  const out = { macd: [], signal: [], hist: [] };
  for (let i = 0; i < line.length; i++) {
    if (line[i] == null) continue;
    out.macd.push({ time: rows[i].time, value: line[i] });
    const s = sig[i - firstIdx];
    if (s != null && i - firstIdx >= signal - 1) {
      out.signal.push({ time: rows[i].time, value: s });
      out.hist.push({ time: rows[i].time, value: line[i] - s });
    }
  }
  return out;
}

export function stochastic(rows, kPeriod = 14, dPeriod = 3) {
  const kRaw = [];
  for (let i = kPeriod - 1; i < rows.length; i++) {
    const win = rows.slice(i - kPeriod + 1, i + 1);
    const hi = Math.max(...win.map(r => r.high));
    const lo = Math.min(...win.map(r => r.low));
    const k = hi === lo ? 50 : (rows[i].close - lo) / (hi - lo) * 100;
    kRaw.push({ time: rows[i].time, value: k });
  }
  const d = [];
  for (let i = dPeriod - 1; i < kRaw.length; i++) {
    const avg = kRaw.slice(i - dPeriod + 1, i + 1).reduce((a, b) => a + b.value, 0) / dPeriod;
    d.push({ time: kRaw[i].time, value: avg });
  }
  return { k: kRaw, d };
}

export function atr(rows, period = 14) {
  const tr = [];
  for (let i = 0; i < rows.length; i++) {
    if (i === 0) { tr.push(rows[i].high - rows[i].low); continue; }
    const p = rows[i - 1].close;
    tr.push(Math.max(rows[i].high - rows[i].low, Math.abs(rows[i].high - p), Math.abs(rows[i].low - p)));
  }
  const out = [];
  let prev = null;
  for (let i = 0; i < tr.length; i++) {
    if (i < period - 1) continue;
    if (i === period - 1) prev = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
    else prev = (prev * (period - 1) + tr[i]) / period;
    out.push({ time: rows[i].time, value: prev });
  }
  return out;
}

/* Registry the chart UI drives — kind: "overlay" (price pane) or "pane" (own sub-pane). */
export const INDICATORS = {
  sma20:  { label: "SMA 20",  kind: "overlay", color: "#F59E0B", fn: r => sma(r, 20) },
  sma50:  { label: "SMA 50",  kind: "overlay", color: "#9d8fd4", fn: r => sma(r, 50) },
  sma200: { label: "SMA 200", kind: "overlay", color: "#EF5350", fn: r => sma(r, 200) },
  ema20:  { label: "EMA 20",  kind: "overlay", color: "#5fb3b3", fn: r => ema(r, 20) },
  ema50:  { label: "EMA 50",  kind: "overlay", color: "#A78BFA", fn: r => ema(r, 50) },
  bollinger: { label: "Bollinger 20,2", kind: "overlay-band", color: "#94A3B8", fn: r => bollinger(r, 20, 2) },
  vwap:   { label: "VWAP",    kind: "overlay", color: "#10B981", fn: r => vwap(r) },
  rsi:    { label: "RSI 14",  kind: "pane", color: "#F59E0B", fn: r => rsi(r, 14) },
  macd:   { label: "MACD 12,26,9", kind: "pane-macd", color: "#5fb3b3", fn: r => macd(r) },
  stoch:  { label: "Stochastic 14,3", kind: "pane-stoch", color: "#9d8fd4", fn: r => stochastic(r) },
  atr:    { label: "ATR 14",  kind: "pane", color: "#A78BFA", fn: r => atr(r, 14) },
};
