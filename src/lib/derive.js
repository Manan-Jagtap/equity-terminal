/**
 * derive.js — faithful JS port of the BACKEND assumption-derivation layer
 * (app/derive.py). Given a company's own statement history it derives the full
 * assumption block engine.js consumes — growth, margins, tax, reinvestment,
 * ROE, capital structure, fade horizon — exactly as the backend does.
 *
 * ⚠️  PARITY CONTRACT: this file must stay bit-for-bit identical in behaviour
 *     to app/derive.py. When you change one, change the other, and re-run the
 *     node-vs-python parity test:
 *       python tests/gen_derive_cases.py <frontend>/tests/deriveCases.json
 *       node tests/deriveParity.mjs
 *     (`_drivers` provenance strings are NOT under the contract — numbers are.)
 *
 * `statements` is { year:int -> { PL:{...}, BS:{...}, CF:{...} } } — the exact
 * shape the backend's build_financials_response produces and the /financials
 * endpoint serves, so live statements can be fed straight in.
 */
import { SECTOR_PARAMS, DEFAULT_SECTOR, RISK_FREE, ERP, ERP_FIN, params } from "./engine.js";

// ── small numeric helpers (match Python semantics) ──────────────────────────
const _clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** statistics.median — sorted middle, or mean of the two middles. */
function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length, m = n >> 1;
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Python round(x, nd) — round-half-to-even at nd decimals. */
function roundPy(x, nd = 4) {
  if (x == null || !isFinite(x)) return x;
  const m = Math.pow(10, nd);
  const v = x * m;
  const f = Math.floor(v);
  const diff = v - f;
  let r;
  if (diff > 0.5) r = f + 1;
  else if (diff < 0.5) r = f;
  else r = f % 2 === 0 ? f : f + 1;
  return r / m;
}

// ── series extraction ────────────────────────────────────────────────────────
/** Year-ascending [year, value] pairs for a line item, skipping null. Year keys
 *  may arrive as strings (JSON) — normalised to numbers. */
function _series(statements, stmt, item) {
  const out = [];
  const years = Object.keys(statements || {}).map(Number).sort((a, b) => a - b);
  for (const yr of years) {
    const v = ((statements[yr] || statements[String(yr)] || {})[stmt] || {})[item];
    if (v !== null && v !== undefined) out.push([yr, Number(v)]);
  }
  return out;
}

function _cagr(series, maxN = 4) {
  if (series.length < 2) return null;
  const pts = series.slice(-(maxN + 1));
  const v0 = pts[0][1], v1 = pts[pts.length - 1][1];
  const n = pts[pts.length - 1][0] - pts[0][0];
  if (v0 == null || v1 == null || v0 <= 0 || v1 <= 0 || n <= 0) return null;
  return Math.pow(v1 / v0, 1 / n) - 1;
}

function _ratioMedian(numSeries, denSeries, lo = null, hi = null, n = 3) {
  const dn = new Map(denSeries);
  const vals = [];
  for (const [yr, num] of numSeries.slice(-n)) {
    const den = dn.get(yr);
    if (den) vals.push(num / den);          // mirrors `if den and den != 0`
  }
  if (!vals.length) return null;
  let m = median(vals);
  if (lo !== null || hi !== null)
    m = _clamp(m, lo !== null ? lo : -1e9, hi !== null ? hi : 1e9);
  return m;
}

/** Net worth by year: reported net_worth, else share capital + reserves (>0). */
function _networthSeries(statements) {
  const nw = _series(statements, "BS", "net_worth");
  if (nw.length) return nw;
  const eq = new Map(_series(statements, "BS", "equity"));
  const rs = new Map(_series(statements, "BS", "reserves"));
  const years = [...new Set([...eq.keys(), ...rs.keys()])].sort((a, b) => a - b);
  return years.map((y) => [y, (eq.get(y) || 0) + (rs.get(y) || 0)])
              .filter(([, v]) => v > 0);
}

/** Realised operating ROIC = NOPAT / (net worth + borrowings − cash − goodwill),
 *  median over the recent overlapping years. */
function _companyRoic(ebitSeries, networthSeries, borrowingsSeries, taxRate,
                      cashSeries = null, goodwillSeries = null) {
  const nw = new Map(networthSeries);
  const bw = new Map(borrowingsSeries || []);
  const cs = new Map(cashSeries || []);
  const gw = new Map(goodwillSeries || []);
  const vals = [];
  for (const [yr, ebit] of ebitSeries.slice(-3)) {
    const ic = (nw.get(yr) || 0) + (bw.get(yr) || 0) - (cs.get(yr) || 0) - (gw.get(yr) || 0);
    if (ebit !== null && ebit !== undefined && ic && ic > 0)
      vals.push((ebit * (1 - taxRate)) / ic);
  }
  return vals.length ? median(vals) : null;
}

/** Measured net-reinvestment rate = (|capex| − D&A + ΔNWC) / NOPAT, median. */
function _actualReinvestment(capex, dep, receivables, inventory, payables, ebit, taxRate) {
  const cap = new Map(capex || []), d = new Map(dep || []), e = new Map(ebit || []);
  const nwc = new Map();
  for (const [src, sign] of [[receivables, 1], [inventory, 1], [payables, -1]]) {
    for (const [y, v] of src || []) {
      if (v !== null && v !== undefined) nwc.set(y, (nwc.get(y) || 0) + sign * v);
    }
  }
  const nwcYears = [...nwc.keys()].sort((a, b) => a - b);
  const dnwc = new Map();
  for (let i = 1; i < nwcYears.length; i++)
    dnwc.set(nwcYears[i], nwc.get(nwcYears[i]) - nwc.get(nwcYears[i - 1]));
  const rates = [];
  const years = [...cap.keys()].filter((y) => e.has(y)).sort((a, b) => a - b);
  for (const y of years) {
    const nopat = (e.get(y) || 0) * (1 - taxRate);
    if (nopat <= 0) continue;
    const netReinv = Math.abs(cap.get(y) || 0) - (d.get(y) || 0) + (dnwc.get(y) ?? 0);
    rates.push(_clamp(netReinv / nopat, -0.30, 1.20));
  }
  return rates.length >= 2 ? median(rates) : null;
}

const _pct = (x) => (typeof x === "number" && isFinite(x) ? `${(x * 100).toFixed(1)}%` : "n/a");

// ── Non-financial driver derivation (FCFF) ───────────────────────────────────
function _deriveNonfinancial(statements, vs) {
  const p = params(vs);
  const drivers = {};

  const rev = _series(statements, "PL", "revenue");
  const ebit = _series(statements, "PL", "ebit");
  const ebitda = _series(statements, "PL", "ebitda");
  const dep = _series(statements, "PL", "depreciation");
  const tax = _series(statements, "PL", "tax");
  const pbt = _series(statements, "PL", "pbt");
  const borrowings = _series(statements, "BS", "borrowings");
  const networth = _networthSeries(statements);
  const interest = _series(statements, "PL", "interest_expense");
  // Excess cash + treasury investments + goodwill netted out of the ROIC base.
  const cashAcc = new Map();
  for (const line of ["cash", "cash_equivalents", "short_term_investments", "investments"]) {
    for (const [yr, v] of _series(statements, "BS", line))
      cashAcc.set(yr, (cashAcc.get(yr) || 0) + v);
  }
  const cashSeries = [...cashAcc.entries()].sort((a, b) => a[0] - b[0]);
  const goodwillSeries = _series(statements, "BS", "goodwill");
  const capex = _series(statements, "CF", "capex");
  const receivables = _series(statements, "BS", "receivables");
  const inventory = _series(statements, "BS", "inventory");
  const payables = _series(statements, "BS", "payables");

  const cyclical = ["METAL", "ENERGY", "PAPER", "SUGAR", "TEXTILES"].includes(vs);
  const semiCyclical = ["AUTO", "CEMENT", "AVIATION"].includes(vs);
  const throughCycle = cyclical || ["CHEMICALS", "CEMENT", "AVIATION", "CABLES", "CONSTRUCTION"].includes(vs);

  // Near-term revenue growth: 0.65·CAGR + 0.35·YoY, capped by cycle profile.
  const cagr = _cagr(rev, 4);
  let yoy = null;
  if (rev.length >= 2 && rev[rev.length - 2][1] > 0)
    yoy = rev[rev.length - 1][1] / rev[rev.length - 2][1] - 1;
  let revGrowth;
  if (cagr !== null && yoy !== null) revGrowth = 0.65 * cagr + 0.35 * yoy;
  else if (cagr !== null) revGrowth = cagr;
  else if (yoy !== null) revGrowth = yoy;
  else revGrowth = p.terminal_growth + 0.03;
  // DISTRIBUTION joins the 12% tier (DAT-02) — mirrors derive.py growth_hi.
  const growthHi = cyclical ? 0.08 : (semiCyclical || vs === "DISTRIBUTION") ? 0.12 : 0.18;
  revGrowth = _clamp(revGrowth, 0.02, growthHi);
  drivers.rev_growth = `0.65·CAGR(${_pct(cagr)})+0.35·YoY(${_pct(yoy)}) capped` +
    (cyclical ? " (cyclical)" : semiCyclical ? " (mid-cycle)" : "");

  // EBIT margin: median over 5y through-cycle, else 3y. CEMENT rebuilds from EBITDA.
  const marginN = throughCycle ? 5 : 3;
  let ebitMargin = _ratioMedian(ebit, rev, 0.02, 0.45, marginN);
  if (vs === "CEMENT") {
    const em = _ratioMedian(ebitda, rev, 0.08, 0.45, 5);
    const dm = _ratioMedian(dep, rev, 0.0, 0.15, 5);
    if (em !== null) {
      ebitMargin = _clamp(em - (dm !== null ? dm : 0.07), 0.02, 0.45);
      drivers.ebit_margin = `EBITDA/Rev(5y ${_pct(em)}) − D&A/Rev(${_pct(dm)})`;
    }
  }
  if (ebitMargin === null) {
    const em = _ratioMedian(ebitda, rev, 0.04, 0.55, marginN);
    ebitMargin = em ? em * 0.8 : 0.14;
  }
  if (!("ebit_margin" in drivers))
    drivers.ebit_margin = ebit.length ? `median(EBIT/Rev, ${marginN}y)` : `0.8×median(EBITDA/Rev, ${marginN}y)`;

  // Terminal margin — glide 40% toward the 7y through-cycle level, bounded ±3.5pp.
  let terminalEbitMargin = ebitMargin;
  const longrun = ebit.length ? _ratioMedian(ebit, rev, 0.02, 0.45, 7) : null;
  if (longrun !== null && ebitMargin !== null) {
    const target = ebitMargin + 0.4 * (longrun - ebitMargin);
    terminalEbitMargin = _clamp(target, ebitMargin - 0.035, ebitMargin + 0.035);
    if (Math.abs(terminalEbitMargin - ebitMargin) >= 0.003)
      drivers.ebit_margin += ` → glides to ${_pct(terminalEbitMargin)} (mean-revert to through-cycle ${_pct(longrun)})`;
  }

  // Effective tax rate from PBT (India statutory band).
  const taxRate = _ratioMedian(tax, pbt, 0.12, 0.32, 3) || 0.25;
  drivers.tax_rate = "median(Tax/PBT, 3y)";

  // Reinvestment = g / ROIC (own realised ROIC blended toward sector).
  const companyRoic = _companyRoic(ebit, networth, borrowings, taxRate, cashSeries, goodwillSeries);
  const baseRoic = companyRoic ? companyRoic : p.mature_roic;
  const roicUsed = _clamp(0.6 * baseRoic + 0.4 * p.mature_roic, p.mature_roic, 0.50);
  if (!cyclical && roicUsed >= 1.2 * p.mature_roic && revGrowth < 0.08) {
    revGrowth = 0.08;
    drivers.rev_growth += " → floored 8% (durable high-ROIC franchise)";
  }
  // CORR-1: near-term growth is earned from return-on-capital quality — mirrors
  // derive.py `_growth_ceiling`. A business that does not out-earn its sector's
  // mature ROIC has shown no return advantage to defend growth with, so it is
  // not assumed to outgrow the economy it operates in. One-directional: this
  // only ever LOWERS an unearned rate, never raises anyone's growth.
  const qHi = _growthCeiling(companyRoic, p.mature_roic);
  if (revGrowth > qHi) {
    revGrowth = qHi;
    drivers.rev_growth += ` → capped ${_pct(qHi)} (ROIC-earned growth)`;
  }
  const identity = roicUsed ? revGrowth / roicUsed : 0.40;
  const actualReinv = _actualReinvestment(capex, dep, receivables, inventory, payables, ebit, taxRate);
  let reinvestRate;
  if (actualReinv !== null && actualReinv > identity + 0.05) {
    reinvestRate = _clamp(0.5 * identity + 0.5 * actualReinv, 0.10, 0.75);
    drivers.reinvest_rate = `g/ROIC ${_pct(identity)} raised toward measured net-capex intensity ${_pct(actualReinv)} (capital-heavy build-out)`;
  } else {
    reinvestRate = _clamp(identity, 0.10, 0.65);
    drivers.reinvest_rate = `g/ROIC (g=${_pct(revGrowth)}, ROIC=${_pct(roicUsed)} — own ${_pct(companyRoic)} blended to sector ${_pct(p.mature_roic)})` +
      (actualReinv !== null ? `; actual net-capex ${_pct(actualReinv)}` : "");
  }

  // Capital structure from the latest balance sheet.
  let debtWeight = 0.15;
  if (borrowings.length && networth.length) {
    const b = borrowings[borrowings.length - 1][1];
    const e = networth[networth.length - 1][1];
    if (b !== null && b !== undefined && e && b + e > 0)
      debtWeight = _clamp(b / (b + e), 0.0, 0.60);
  }
  drivers.debt_weight = "borrowings/(borrowings+net worth), latest";

  let costDebt = 0.085;
  if (interest.length && borrowings.length) {
    const cd = _ratioMedian(interest, borrowings, 0.06, 0.12, 2);
    if (cd) costDebt = cd;
  }

  // Competitive-advantage period — quality-earned fade horizon.
  let fadeYears = 8;
  if (!cyclical) {
    const roicQ = p.mature_roic ? roicUsed / p.mature_roic : 1.0;
    if (roicQ >= 1.5) fadeYears = 15;
    else if (roicQ >= 1.25) fadeYears = 12;
    else if (roicQ >= 1.1) fadeYears = 10;
    else if (["CEMENT", "AUTO", "CHEMICALS"].includes(vs)) fadeYears = 10;
  }
  drivers.fade_years = `CAP ${fadeYears}y (ROIC ${_pct(roicUsed)} vs sector ${_pct(p.mature_roic)}${cyclical ? ", cyclical-capped" : ""})`;

  // VAL-02 (nonfin analog of FIX-17): evidence-earned compounder terminal ROIC.
  // A proven durable franchise fades only HALFWAY to the sector mature ROIC in
  // the terminal, instead of surrendering its whole return advantage. Strictly
  // gated (non-cyclical, ≥6y history, roic ≥1.4× sector, margins not in
  // structural decline), one-sided, capped 1.5×sector / 40%. Mirrors derive.py.
  let terminalRoic = null;
  if (!cyclical && ebit.length >= 6
      && p.mature_roic && roicUsed >= 1.4 * p.mature_roic
      && terminalEbitMargin >= 0.9 * ebitMargin) {
    const cand = Math.min(0.5 * roicUsed + 0.5 * p.mature_roic,
                          1.5 * p.mature_roic, 0.40);
    if (cand > p.mature_roic) {
      terminalRoic = roundPy(cand, 4);
      drivers.terminal_roic =
        `earned compounder terminal ${_pct(terminalRoic)} — fades halfway ` +
        `to sector ${_pct(p.mature_roic)} (own ${_pct(roicUsed)} ≥1.4×, ` +
        `${ebit.length}y history, stable margins); capped 1.5×sector / 40%`;
    }
  }

  return {
    beta: p.beta, risk_free: RISK_FREE, erp: ERP,
    rev_growth: roundPy(revGrowth, 4),
    ebit_margin: roundPy(ebitMargin, 4),
    terminal_ebit_margin: roundPy(terminalEbitMargin, 4),
    tax_rate: roundPy(taxRate, 4),
    reinvest_rate: roundPy(reinvestRate, 4),
    debt_weight: roundPy(debtWeight, 4),
    cost_debt: roundPy(costDebt, 4),
    fade_years: fadeYears,
    terminal_growth: p.terminal_growth,
    terminal_roic: terminalRoic,   // VAL-02: earned compounder terminal (null = sector default)
    forecast_roe: 0.15, terminal_roe: p.mature_roe, payout: 0.25,
    _drivers: drivers, _valuation_sector: vs,
  };
}

// ── Financial driver derivation (Residual Income) ────────────────────────────
function _deriveFinancial(statements, vs) {
  const p = params(vs);
  const drivers = {};

  const pat = _series(statements, "PL", "pat");
  const networth = _networthSeries(statements);
  const dividends = _series(statements, "CF", "dividends");

  // 3-year median ROE, grounded near the latest realized year.
  let forecastRoe = _ratioMedian(pat, networth, 0.06, 0.30, 3);
  if (forecastRoe === null) forecastRoe = p.mature_roe;
  let latestRoe = null;
  if (pat.length && networth.length &&
      pat[pat.length - 1][0] === networth[networth.length - 1][0] &&
      networth[networth.length - 1][1])
    latestRoe = pat[pat.length - 1][1] / networth[networth.length - 1][1];
  if (latestRoe !== null && latestRoe > 0.03 && latestRoe < 0.35 && forecastRoe > latestRoe * 1.10)
    forecastRoe = latestRoe * 1.10;
  drivers.forecast_roe = "median(PAT/NetWorth, 3y), capped near latest realized";

  // Terminal ROE: fade DOWN toward sector mature, never up.
  let terminalRoe = _clamp(Math.min(forecastRoe, 0.70 * forecastRoe + 0.30 * p.mature_roe), 0.08, 0.26);
  drivers.terminal_roe = "min(forecast, 0.70×realized + 0.30×sector mature)";

  // FIX-17: evidence-earned compounder terminal ROE (mirror of derive.py). A
  // STABLE franchise (median ROE ≥ 1.2×Ke, latest ≥ 0.80× its proven upper-half
  // median → a durable level in a mild dip, not a boom-bust peak) whose forecast
  // is temporarily depressed reverts a BOUNDED step (≤ +3 pts, cap 18%) toward
  // that proven level. Earned & one-sided: never lowers the terminal.
  const roeHist = [];
  {
    const nwMap = new Map(networth);
    for (const [yr, pv] of pat) {
      const nv = nwMap.get(yr);
      if (nv && nv > 0 && pv != null) roeHist.push(pv / nv);
    }
  }
  if (roeHist.length >= 4) {
    // CORR-8b: financial gate uses the financial ERP (mirrors derive.py).
    const keF = RISK_FREE + p.beta * ERP_FIN;
    const sortedRoe = [...roeHist].sort((a, b) => a - b);
    const franchise0 = median(sortedRoe.slice(Math.floor(sortedRoe.length / 2)));
    const stable = latestRoe !== null && franchise0 > 0 && latestRoe >= 0.80 * franchise0;
    if (median(roeHist) >= 1.2 * keF && stable) {
      const earned = _clamp(Math.min(franchise0, forecastRoe + 0.03, 0.18), 0.08, 0.26);
      if (earned > terminalRoe) {
        terminalRoe = earned;
        drivers.terminal_roe =
          `evidence-earned franchise ROE ${_pct(terminalRoe)} — proven ≥1.2×Ke ` +
          `persistence; terminal reverts to the demonstrated franchise, not the ` +
          `depressed forecast (FIX-17)`;
      }
    }
  }

  // Payout from |dividends| / PAT (CF dividends stored negative).
  let payout = 0.20;
  if (dividends.length && pat.length) {
    const dp = new Map(pat);
    const vals = [];
    for (const [yr, dv] of dividends.slice(-3)) {
      const pp = dp.get(yr);
      if (pp && pp > 0) vals.push(Math.min(Math.abs(dv) / pp, 0.95));
    }
    if (vals.length) payout = _clamp(median(vals), 0.0, 0.70);
  }
  drivers.payout = "median(|Dividends|/PAT, 3y)";

  // Competitive-advantage period for financials.
  let fadeYears = 8;
  if (forecastRoe >= 0.18 && payout <= 0.30) fadeYears = 15;
  else if (forecastRoe >= 0.15 && payout <= 0.35) fadeYears = 12;
  else if (forecastRoe >= 0.13) fadeYears = 10;
  drivers.fade_years = `CAP ${fadeYears}y (ROE ${_pct(forecastRoe)}, payout ${_pct(payout)})`;

  return {
    // CORR-8b: financials use the financial ERP (mirrors derive.py).
    beta: p.beta, risk_free: RISK_FREE, erp: ERP_FIN,
    forecast_roe: roundPy(forecastRoe, 4),
    terminal_roe: roundPy(terminalRoe, 4),
    payout: roundPy(payout, 4),
    fade_years: fadeYears,
    terminal_growth: p.terminal_growth,
    rev_growth: 0.10, ebit_margin: 0.12, tax_rate: 0.25,
    reinvest_rate: 0.35, debt_weight: 0.20, cost_debt: 0.085,
    _drivers: drivers, _valuation_sector: vs,
  };
}

/** Derive the full assumption block from statement history + sector params —
 *  the exact backend derive_assumptions. */
// CORR-1 growth ceiling — mirrors derive.py. 1.1 is the same roic_q threshold at
// which fadeYears grants its first horizon step-up, so the growth RATE and the
// growth RUNWAY key off one consistent piece of evidence about the business.
const _GROWTH_ROIC_Q = 1.1;
const _GROWTH_HI_EARNED = 0.18;  // out-earns its sector's mature ROIC → unchanged
const _GROWTH_HI_BASE = 0.10;    // ≈ India's long-run NOMINAL GDP growth

// Keys off the MEASURED company ROIC, never roicUsed. roicUsed is floored at
// the sector value by _clamp, so roicUsed / matureRoic cannot read below 1.0;
// feeding it here capped names that had shown no return shortfall at all —
// unmeasured ROIC scored exactly 1.00 and was punished as a failure, and the
// 0.6/0.4 blend demanded 1.167x sector to clear a 1.1x threshold. See the
// derive.py docstring for the measured scope (62 of 264 capped names).
function _growthCeiling(companyRoic, matureRoic) {
  if (!matureRoic || !companyRoic) return _GROWTH_HI_EARNED;
  return companyRoic / matureRoic >= _GROWTH_ROIC_Q ? _GROWTH_HI_EARNED : _GROWTH_HI_BASE;
}

export function deriveAssumptions(statements, valuationSector, isFinancial) {
  statements = statements || {};
  if (isFinancial) return _deriveFinancial(statements, valuationSector);
  return _deriveNonfinancial(statements, valuationSector);
}

// ── Client bridge (NOT under the parity contract — adapters only) ────────────

/** Engine valuation-sector for a client company object. */
export function valuationSectorOf(co) {
  if (co?.valuation_sector && SECTOR_PARAMS[co.valuation_sector]) return co.valuation_sector;
  if (co?.template_code && SECTOR_PARAMS[co.template_code]) return co.template_code;
  if (co?.type === "financial") return "NBFC";
  return DEFAULT_SECTOR;
}

/** Synthesize a minimal single-year statements dict from the snapshot fields —
 *  derive then grounds in the company's REAL margin/ROE exactly as the backend
 *  would for a name with one year of ingested history. */
export function snapshotStatements(co) {
  const y = 2026;
  const PL = {}, BS = {};
  if (co?.netProfit != null) PL.pat = co.netProfit;
  if (co?.equity != null && co.equity > 0) BS.net_worth = co.equity;
  if (co?.type !== "financial") {
    if (co?.revenue != null) PL.revenue = co.revenue;
    if (co?.ebit != null) PL.ebit = co.ebit;
    if (co?.ebitda != null) PL.ebitda = co.ebitda;
  }
  if (!Object.keys(PL).length && !Object.keys(BS).length) return {};
  return { [y]: { PL, BS, CF: {} } };
}

const OVERRIDE_KEYS = [
  "risk_free", "erp", "beta", "tax_rate", "terminal_growth", "fade_years",
  "rev_growth", "ebit_margin", "reinvest_rate", "debt_weight", "cost_debt",
  "forecast_roe", "terminal_roe", "payout",
];
// Keys that ONLY exist in the engine dialect — their presence proves the block
// is a backend-seeded / engine-native assumption set. `beta`, `erp`, `payout`
// alone don't qualify: the legacy camelCase seed assumptions share those names,
// and letting a stale seed's erp=0.085 leak in silently skewed the base case.
const ENGINE_DIALECT_MARKERS = [
  "risk_free", "rev_growth", "ebit_margin", "forecast_roe", "terminal_roe",
  "tax_rate", "fade_years", "reinvest_rate", "debt_weight", "cost_debt",
  "terminal_growth", "_valuation_sector",
];

/** True when an assumption block is unambiguously engine-dialect (snake_case) —
 *  i.e. safe to overlay on the derived base case. Shared consumers (DCF tab,
 *  blendedValuation) must use the SAME gate or the beta/erp/payout name
 *  collision lets legacy camelCase seeds skew the engine. */
export function isEngineDialect(a) {
  return !!a && ENGINE_DIALECT_MARKERS.some((k) => a[k] !== null && a[k] !== undefined);
}

/** The client fallback assumption block: derived from real statements when the
 *  page has them, else from the snapshot — the backend's own derivation, run
 *  locally. Overrides from `a` apply only when the block is unambiguously
 *  ENGINE-dialect (snake_case, e.g. a backend-seeded scenario); legacy
 *  camelCase seed assumptions never skew the base case. */
export function deriveClientAssumptions(co, a) {
  const fin = co?.type === "financial" || ["NBFC", "BANK", "INSURANCE"].includes(co?.template_code);
  const vs = valuationSectorOf(co);
  const statements = (co?.statements && Object.keys(co.statements).length)
    ? co.statements : snapshotStatements(co);
  const derived = deriveAssumptions(statements, vs, fin);
  if (isEngineDialect(a)) {
    for (const k of OVERRIDE_KEYS) {
      if (a[k] !== null && a[k] !== undefined) derived[k] = a[k];
    }
  }
  return derived;
}
