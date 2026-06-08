/**
 * engine.js — faithful JS port of the BACKEND valuation engine
 * (app/engines.py + app/sector_params.py).
 *
 * This is the SINGLE source of valuation math on the client. The interactive
 * DCF tab, Monte Carlo and sensitivity grid all run through it, so every number
 * the user can produce by moving a slider reconciles EXACTLY with the headline
 * the backend computed — there is no second model and no client/server drift.
 *
 * ⚠️  PARITY CONTRACT: this file must stay bit-for-bit identical in behaviour to
 *     app/engines.py. When you change one, change the other, and re-run the
 *     node-vs-python parity test (tests/engineParity). Inputs use the backend's
 *     snake_case shape:
 *       co: { type, equity, shares, revenue, net_debt, net_profit, price }
 *       a : { risk_free, beta, erp, payout, fade_years, forecast_roe,
 *             terminal_roe, terminal_growth, debt_weight, cost_debt, tax_rate,
 *             rev_growth, ebit_margin, reinvest_rate, _valuation_sector }
 */

// ── sector_params.py ────────────────────────────────────────────────────────
export const RISK_FREE = 0.069;
export const ERP = 0.050;

export const SECTOR_PARAMS = {
  // Non-financials
  IT_SERVICES:   { beta: 0.85, terminal_growth: 0.055, mature_roic: 0.30, mature_roe: 0.30, exit_pe: 25, exit_ev_ebitda: 16, exit_pb: null },
  CONSUMER:      { beta: 0.72, terminal_growth: 0.055, mature_roic: 0.22, mature_roe: 0.30, exit_pe: 42, exit_ev_ebitda: 28, exit_pb: null },
  CONSUMER_DISC: { beta: 0.95, terminal_growth: 0.055, mature_roic: 0.18, mature_roe: 0.22, exit_pe: 38, exit_ev_ebitda: 22, exit_pb: null },
  PHARMA:        { beta: 0.78, terminal_growth: 0.050, mature_roic: 0.18, mature_roe: 0.20, exit_pe: 30, exit_ev_ebitda: 18, exit_pb: null },
  AUTO:          { beta: 1.10, terminal_growth: 0.050, mature_roic: 0.16, mature_roe: 0.18, exit_pe: 24, exit_ev_ebitda: 13, exit_pb: null },
  METAL:         { beta: 1.30, terminal_growth: 0.040, mature_roic: 0.12, mature_roe: 0.13, exit_pe: 11, exit_ev_ebitda: 6,  exit_pb: null },
  CEMENT:        { beta: 1.05, terminal_growth: 0.050, mature_roic: 0.14, mature_roe: 0.15, exit_pe: 24, exit_ev_ebitda: 13, exit_pb: null },
  ENERGY:        { beta: 1.00, terminal_growth: 0.040, mature_roic: 0.12, mature_roe: 0.14, exit_pe: 12, exit_ev_ebitda: 7,  exit_pb: null },
  UTILITIES:     { beta: 0.75, terminal_growth: 0.045, mature_roic: 0.11, mature_roe: 0.13, exit_pe: 15, exit_ev_ebitda: 9,  exit_pb: null },
  TELECOM:       { beta: 0.90, terminal_growth: 0.050, mature_roic: 0.13, mature_roe: 0.15, exit_pe: 32, exit_ev_ebitda: 9,  exit_pb: null },
  MANUFACTURING: { beta: 1.00, terminal_growth: 0.050, mature_roic: 0.15, mature_roe: 0.16, exit_pe: 28, exit_ev_ebitda: 15, exit_pb: null },
  // Financials
  BANK:          { beta: 0.95, terminal_growth: 0.055, mature_roic: 0.15, mature_roe: 0.155, exit_pe: 16, exit_ev_ebitda: null, exit_pb: 2.4 },
  NBFC:          { beta: 1.10, terminal_growth: 0.055, mature_roic: 0.16, mature_roe: 0.165, exit_pe: 18, exit_ev_ebitda: null, exit_pb: 3.0 },
  INSURANCE:     { beta: 0.90, terminal_growth: 0.055, mature_roic: 0.15, mature_roe: 0.16,  exit_pe: 24, exit_ev_ebitda: null, exit_pb: 2.2 },
};

export const DEFAULT_SECTOR = "MANUFACTURING";

export function params(valuationSector) {
  return SECTOR_PARAMS[valuationSector || ""] || SECTOR_PARAMS[DEFAULT_SECTOR];
}

// ── engines.py ──────────────────────────────────────────────────────────────
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Python round() is banker's rounding; for the integer fade_years we use here it
// matches Math.round. Keep fade_years integral (it is, from derive.py).
const pyRound = (x) => Math.round(x);

function costOfEquity(a) {
  return a.risk_free + a.beta * a.erp;
}

const _NULL_VAL = (method) => ({
  intrinsic: null, method, rows: [], ke: null, wacc: null, bvps0: null,
  ev: null, pv_explicit: null, tv_pv: null,
});

export function residualIncome(co, a) {
  const ke = costOfEquity(a);
  const bvps0 = co.equity / co.shares;
  const retention = 1 - a.payout;
  const N = Math.max(3, pyRound(a.fade_years));
  const N1 = Math.max(1, Math.floor(N / 2));
  const fRoe = a.forecast_roe, tRoe = a.terminal_roe;
  let bv = bvps0, pv = 0;
  const rows = [];
  for (let t = 1; t <= N; t++) {
    const roe = t <= N1 ? fRoe : fRoe + (tRoe - fRoe) * ((t - N1) / (N - N1));
    const ri = (roe - ke) * bv;
    const disc = Math.pow(1 + ke, t);
    pv += ri / disc;
    rows.push({ t, roe, bv_begin: bv, ri, pv: ri / disc });
    bv = bv * (1 + roe * retention);
  }
  const riNext = (tRoe - ke) * bv;
  const tv = a.terminal_growth < ke ? riNext / (ke - a.terminal_growth) : 0.0;
  const tvPv = tv / Math.pow(1 + ke, N);
  const intrinsic = bvps0 + pv + tvPv;
  return { ke, wacc: null, bvps0, intrinsic, ev: null, pv_explicit: pv,
           tv_pv: tvPv, rows, method: "Residual Income" };
}

export function fcffDcf(co, a) {
  const ke = costOfEquity(a);
  const ew = 1 - a.debt_weight;
  const wacc = ew * ke + a.debt_weight * a.cost_debt * (1 - a.tax_rate);
  const N = Math.max(3, pyRound(a.fade_years));
  const gT = a.terminal_growth;
  let rev = co.revenue, pv = 0, nopat = 0;
  const rows = [];
  for (let t = 1; t <= N; t++) {
    const g = a.rev_growth + (gT - a.rev_growth) * (t / N);
    rev = rev * (1 + g);
    const ebit = rev * a.ebit_margin;
    nopat = ebit * (1 - a.tax_rate);
    const fcff = nopat * (1 - a.reinvest_rate);
    const disc = Math.pow(1 + wacc, t);
    pv += fcff / disc;
    rows.push({ t, rev, fcff, pv: fcff / disc });
  }
  const matureRoic = params(a._valuation_sector).mature_roic || 0.12;
  const termRr = matureRoic ? clamp(gT / matureRoic, 0.0, 0.75) : a.reinvest_rate;
  const fcffTerminal = nopat * (1 + gT) * (1 - termRr);
  const tv = gT < wacc ? fcffTerminal / (wacc - gT) : 0.0;
  const tvPv = tv / Math.pow(1 + wacc, N);
  const ev = pv + tvPv;
  const equityVal = ev - co.net_debt;
  const intrinsic = equityVal / co.shares;
  return { ke, wacc, bvps0: null, intrinsic, ev, equity_val: equityVal,
           pv_explicit: pv, tv_pv: tvPv, rows, method: "FCFF DCF" };
}

const has = (...vals) => vals.every((v) => v !== null && v !== undefined);

export function valuate(co, a) {
  try {
    if (co.type === "financial") {
      if (!(has(co.equity, co.shares) && co.equity > 0 && co.shares > 0))
        return _NULL_VAL("Residual Income");
      return residualIncome(co, a);
    }
    if (!(has(co.revenue, co.net_debt, co.shares) && co.shares > 0))
      return _NULL_VAL("FCFF DCF");
    return fcffDcf(co, a);
  } catch {
    return _NULL_VAL("n/a");
  }
}

const vsector = (a) => a._valuation_sector || DEFAULT_SECTOR;

export function exitMultipleValue(co, a) {
  const p = params(vsector(a));
  const mult = p.exit_ev_ebitda;
  const rev = co.revenue, shares = co.shares;
  if (mult == null || rev == null || !shares || shares <= 0) return null;
  const margin = a.ebit_margin || 0.12;
  const ebitda = rev * (margin + 0.03);
  if (ebitda <= 0) return null;
  const ev = ebitda * mult;
  const netDebt = co.net_debt || 0;
  const val = (ev - netDebt) / shares;
  return val > 0 ? val : null;
}

export function peValue(co, a) {
  const p = params(vsector(a));
  const pe = p.exit_pe;
  const pat = co.net_profit, shares = co.shares;
  if (pe == null || pat == null || pat <= 0 || !shares || shares <= 0) return null;
  return (pat * pe) / shares;
}

export function gordonPbValue(co, a, v) {
  const ke = v.ke, bvps0 = v.bvps0;
  const termRoe = a.terminal_roe;
  const g = a.terminal_growth || 0.05;
  if (!(ke && bvps0 && termRoe) || ke <= g) return null;
  let pb = (termRoe - g) / (ke - g);
  pb = clamp(pb, 0.4, 12);
  const val = bvps0 * pb;
  return val > 0 ? val : null;
}

const BLEND_WEIGHTS = {
  fin:    [["Residual Income", 0.65], ["Gordon Growth P/B", 0.20], ["P/E (sector)", 0.15]],
  nonfin: [["FCFF DCF", 0.55], ["Exit Multiple", 0.30], ["P/E (sector)", 0.15]],
};

export function blended(co, a) {
  const v = valuate(co, a);
  const primary = v.intrinsic;
  const isFin = co.type === "financial";

  let vals, spec;
  if (isFin) {
    vals = { "Residual Income": primary, "Gordon Growth P/B": gordonPbValue(co, a, v),
             "P/E (sector)": peValue(co, a) };
    spec = BLEND_WEIGHTS.fin;
  } else {
    vals = { "FCFF DCF": primary, "Exit Multiple": exitMultipleValue(co, a),
             "P/E (sector)": peValue(co, a) };
    spec = BLEND_WEIGHTS.nonfin;
  }

  const components = spec.map(([name, w]) => ({ method: name, value: vals[name] ?? null, weight: w }));

  if (primary == null || primary <= 0)
    return { blended: null, components, primary, primary_method: v.method, valuation: v };

  const avail = components.filter((c) => c.value != null && c.value > 0);
  const wsum = avail.reduce((s, c) => s + c.weight, 0) || 1.0;
  const blend = avail.reduce((s, c) => s + c.value * (c.weight / wsum), 0);
  return { blended: blend, components, primary, primary_method: v.method, valuation: v };
}

// ── Interactive helpers (client-only, built on the SAME core) ────────────────
// These power the DCF tab's Monte Carlo, sensitivity grid and reverse DCF. They
// call blended()/valuate() — the proven core — so every interactive number is
// the backend model, just re-run with perturbed inputs.

function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** Sensitivity of the PRIMARY model intrinsic to ±100bps on Rf and terminal
 *  growth — a direct port of engines.sensitivity (which uses valuate, not the
 *  blend, so the grid centre equals the primary-model value). */
export function sensitivity(co, a) {
  const dR = [-0.01, -0.005, 0, 0.005, 0.01];
  const dG = [-0.01, -0.005, 0, 0.005, 0.01];
  return {
    rate_deltas: dR, g_deltas: dG,
    grid: dR.map((rd) => dG.map((gd) =>
      valuate(co, { ...a, terminal_growth: a.terminal_growth + gd, risk_free: a.risk_free + rd }).intrinsic)),
  };
}

/** Monte Carlo over the blended fair value — shocks the same drivers the backend
 *  derives, recomputing blended() each draw. Returns percentile breakdown. */
export function monteCarlo(co, a, N = 500) {
  const isFin = co.type === "financial";
  const results = [];
  for (let i = 0; i < N; i++) {
    const aMC = {
      ...a,
      rev_growth:      Math.max(0.0, a.rev_growth + randn() * a.rev_growth * 0.30),
      ebit_margin:     isFin ? a.ebit_margin : Math.max(0.02, a.ebit_margin * (1 + randn() * 0.15)),
      forecast_roe:    isFin ? Math.max(0.05, a.forecast_roe * (1 + randn() * 0.15)) : a.forecast_roe,
      terminal_roe:    isFin ? Math.max(0.08, a.terminal_roe * (1 + randn() * 0.10)) : a.terminal_roe,
      terminal_growth: Math.min(0.07, Math.max(0.02, a.terminal_growth + randn() * 0.005)),
      risk_free:       a.risk_free + randn() * 0.0075,
      erp:             a.erp + randn() * 0.005,
    };
    const val = blended(co, aMC).blended;
    if (val != null && isFinite(val) && val > 0 && (!co.price || val < co.price * 200)) results.push(val);
  }
  results.sort((x, y) => x - y);
  if (!results.length) return { simulations: 0, p10: null, p25: null, p50: null, p75: null, p90: null, mean: null, probUpside: null, histogram: [] };
  const pct = (p) => results[Math.floor((p * results.length) / 100)] ?? null;
  return {
    simulations: results.length,
    p10: pct(10), p25: pct(25), p50: pct(50), p75: pct(75), p90: pct(90),
    mean: results.reduce((s, v) => s + v, 0) / results.length,
    probUpside: results.filter((v) => v > (co.price ?? 0)).length / results.length,
    histogram: buildHistogram(results, 20),
  };
}

function buildHistogram(values, bins) {
  if (!values.length) return [];
  const lo = values[0], hi = values[values.length - 1];
  const width = (hi - lo) / bins || 1;
  const counts = Array(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.floor((v - lo) / width))]++;
  return counts.map((count, i) => ({ x: lo + (i + 0.5) * width, count, pct: (count / values.length) * 100 }));
}

/** Reverse DCF — solve for the single driver (Stage-1 growth, or forecast ROE
 *  for financials) that makes the BLENDED fair value equal today's price. */
export function reverseDCF(co, a) {
  const fin = co.type === "financial";
  const key = fin ? "forecast_roe" : "rev_growth";
  const lo0 = fin ? 0.0 : -0.05;
  const hi0 = fin ? 0.60 : 0.80;
  const price = co.price;
  if (!(price > 0)) return null;
  const f = (x) => {
    const iv = blended(co, { ...a, [key]: x }).blended;
    return iv == null || !isFinite(iv) ? null : iv - price;
  };
  let lo = lo0, hi = hi0;
  let flo = f(lo), fhi = f(hi);
  if (flo == null || fhi == null) return null;
  const label = fin ? "Implied forecast ROE" : "Implied Stage-1 growth";
  if (flo > 0) return { key, label, value: lo, bounded: "below",
    note: "Market is pricing in less than the floor assumption — depressed expectations." };
  if (fhi < 0) return { key, label, value: hi, bounded: "above",
    note: "Even an aggressive assumption doesn't reach today's price — priced for perfection." };
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (fm == null) break;
    if (Math.abs(fm) < price * 0.0005) { lo = hi = mid; break; }
    if ((fm > 0) === (fhi > 0)) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return { key, label, value: (lo + hi) / 2, bounded: null };
}

// ── camelCase (frontend co) → snake_case (engine co) adapter ─────────────────
/** Map the app's camelCase company object to the engine's snake_case shape. */
export function toEngineCo(co, price) {
  const isFin = co.type === "financial" || ["NBFC", "BANK", "INSURANCE"].includes(co.template_code);
  return {
    type: isFin ? "financial" : "nonfinancial",
    equity: co.equity ?? null,
    shares: co.shares ?? null,
    revenue: co.revenue ?? null,
    net_debt: co.netDebt ?? null,
    net_profit: co.netProfit ?? null,
    price: price ?? co.price ?? null,
  };
}
