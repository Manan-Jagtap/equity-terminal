/**
 * valuation.js — Institutional-grade equity valuation engine.
 *
 * Methodology:
 *  Non-financial companies  → 3-stage FCFF DCF (WACC-based, ROIC-driven reinvestment)
 *  Financial firms (NBFC/Bank/Insurance) → Residual Income Model (Ke-based, ROE-driven)
 *
 * Key calibration (Damodaran India, January 2025):
 *  Rf   = 7.1%  (10Y G-Sec yield)
 *  ERP  = 8.5%  (India ERP incl. country risk premium of ~1.5%)
 *  Cap terminal growth at min(6%, nominal GDP proxy)
 *
 * References:
 *  Damodaran, A. (2025). Equity Risk Premiums (ERP) — 2025 Update.
 *  Damodaran India sector betas (January 2025, leveraged, by industry).
 *  Virtual Auditor: DCF Valuation for Indian Companies (2026).
 */

// ── India constants ─────────────────────────────────────────────────────────
export const RF          = 0.071;   // 10Y G-Sec
export const ERP         = 0.085;   // India Equity Risk Premium (Damodaran 2025)
export const MAX_G       = 0.06;    // Cap terminal growth at 6% (below nominal GDP)
export const DEFAULT_TAX = 0.2517;  // India corporate tax (new regime)

/**
 * Single, central definition of "is this a financial firm?".
 * Every panel (screener, header, DCF tab, recommendation) must agree on which
 * model is used (Residual Income vs FCFF DCF). Previously this check was
 * duplicated inline in several places and could disagree with itself — which
 * is why an NBFC could show ROE-based scenarios in one panel and revenue-growth
 * FCFF scenarios in another.
 */
export function isFinancial(co) {
  if (!co) return false;
  if (co.type === "financial") return true;
  return ["NBFC", "BANK", "INSURANCE"].includes(co.template_code);
}

/**
 * Damodaran sector unlevered betas (India, Jan 2025).
 * We relevered them for each company using its actual D/E.
 * Source: pages.stern.nyu.edu/~adamodar/
 */
export const SECTOR_UNLEVERED_BETAS = {
  NBFC:          0.86,
  BANK:          0.68,
  INSURANCE:     0.73,
  IT_SERVICES:   0.93,
  MANUFACTURING: 0.90,
  CONSUMER:      0.78,
  PHARMA:        0.76,
  ENERGY:        0.72,
};

/**
 * Damodaran sector ROIC medians (India, Jan 2025).
 * Used as the terminal ROIC — the point at which excess returns fade.
 */
export const SECTOR_TERMINAL_ROIC = {
  NBFC:          0.155,
  BANK:          0.130,
  INSURANCE:     0.120,
  IT_SERVICES:   0.280,
  MANUFACTURING: 0.120,
  CONSUMER:      0.200,
  PHARMA:        0.155,
  ENERGY:        0.090,
};

/**
 * Damodaran sector EV/EBITDA multiples (India, Jan 2025).
 * Used for exit-multiple cross-check.
 */
export const SECTOR_EV_EBITDA = {
  NBFC:          12,
  BANK:          10,
  INSURANCE:     14,
  IT_SERVICES:   22,
  MANUFACTURING: 10,
  CONSUMER:      26,
  PHARMA:        18,
  ENERGY:        8,
};

// ── Cost of capital ─────────────────────────────────────────────────────────

/**
 * Relever an unlevered beta for the company's actual capital structure.
 * Hamada equation: βL = βU × [1 + (1-t) × (D/E)]
 */
export function releveredBeta(betaU, debtEquity, taxRate = DEFAULT_TAX) {
  return betaU * (1 + (1 - taxRate) * debtEquity);
}

/**
 * CAPM cost of equity.
 * Ke = Rf + β × ERP
 */
export function calcKe(beta, rf = RF, erp = ERP) {
  return rf + beta * erp;
}

/**
 * WACC for non-financial companies.
 * WACC = Ke × (E/V) + Kd × (1-t) × (D/V)
 */
export function calcWACC({ ke, kd, taxRate, debtWeight }) {
  const equityWeight = 1 - debtWeight;
  return ke * equityWeight + kd * (1 - taxRate) * debtWeight;
}

/**
 * Pre-tax cost of debt from financial data.
 * Kd = Interest Expense / Total Debt
 * Falls back to a sector-calibrated default.
 */
export function costOfDebt(interestExpense, totalDebt) {
  if (interestExpense && totalDebt && totalDebt > 0) {
    const raw = interestExpense / totalDebt;
    return Math.min(Math.max(raw, 0.06), 0.18); // sanity clamp 6–18%
  }
  return 0.09; // India corporate bond default
}

// ── Box-Muller normal sampler (for Monte Carlo) ─────────────────────────────

function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ── Safe arithmetic ─────────────────────────────────────────────────────────

export function safeDiv(a, b, fallback = null) {
  if (a == null || b == null || b === 0 || !isFinite(a) || !isFinite(b)) return fallback;
  return a / b;
}

// ── 3-Stage FCFF DCF (non-financials) ──────────────────────────────────────

/**
 * Build the full WACC from company data.
 * Returns { ke, kd, wacc, beta, debtWeight, equityWeight, debtEquityRatio }
 */
export function buildWACC(co, a) {
  const template = co.template_code || "MANUFACTURING";
  const betaU = SECTOR_UNLEVERED_BETAS[template] ?? 0.90;

  // Capital structure
  const equity   = co.equity || (co.price * co.shares * 0.5);
  const debt     = co.netDebt != null ? co.netDebt + (co.price * co.shares * 0.1) : equity * 0.3;
  const deRatio  = debt > 0 ? debt / equity : 0.3;
  const debtWeight   = Math.min(deRatio / (1 + deRatio), 0.75);
  const equityWeight = 1 - debtWeight;

  const beta = releveredBeta(betaU, deRatio, a.taxRate ?? DEFAULT_TAX);
  const ke   = calcKe(beta, a.rf ?? RF, a.erp ?? ERP);
  const kd   = a.kd ?? costOfDebt(co.interestExpense, debt);
  const waccRate = calcWACC({ ke, kd, taxRate: a.taxRate ?? DEFAULT_TAX, debtWeight });

  return { ke, kd, wacc: waccRate, beta, betaU, debtWeight, equityWeight, deRatio, equity, debt };
}

/**
 * 3-Stage FCFF DCF — institutional methodology.
 *
 * Stage 1: Explicit high-growth (years 1–N1, analyst/guidance rate)
 * Stage 2: Linear fade to long-run (years N1+1 to N1+N2)
 * Terminal: Gordon Growth, capped at MAX_G
 *
 * FCFF = NOPAT × (1 − Reinvestment Rate)
 * Reinvestment Rate = g / ROIC
 * ROIC converges from current to sector median in terminal period
 *
 * Returns full schedule + summary.
 */
export function fcffDCF(co, a) {
  const { ke, kd, wacc, beta, betaU, debtWeight, equityWeight, deRatio, equity, debt } = buildWACC(co, a);

  const template  = co.template_code || "MANUFACTURING";
  const taxRate   = a.taxRate ?? DEFAULT_TAX;
  const shares    = co.shares || 50;

  // Base NOPAT (EBIT net of tax) — from actual data where available
  const baseEBIT  = co.ebit || (co.revenue || co.equity * 2) * (a.ebitMargin ?? 0.12);
  const baseNOPAT = baseEBIT * (1 - taxRate);

  // Invested Capital (equity + debt - excess cash)
  const cash         = co.cash ?? (equity * 0.1);
  const investedCap  = equity + debt - cash;
  const currentROIC  = safeDiv(baseNOPAT, investedCap) ?? 0.12;
  const terminalROIC = a.terminalROIC ?? SECTOR_TERMINAL_ROIC[template] ?? 0.12;

  const g1    = a.revGrowth1 ?? a.revGrowth ?? 0.15;
  const g2    = a.revGrowth2 ?? (g1 * 0.6);
  const gT    = Math.min(a.terminalGrowth ?? 0.05, MAX_G);
  const N1    = Math.round(a.stage1Years ?? 5);
  const N2    = Math.round(a.stage2Years ?? 5);

  let nopat = baseNOPAT;
  let pvSum  = 0;
  const rows = [];

  // Stage 1
  for (let t = 1; t <= N1; t++) {
    nopat *= (1 + g1);
    const roic  = currentROIC + (terminalROIC - currentROIC) * (t / (N1 + N2));
    const rr    = Math.max(0, Math.min(g1 / roic, 0.85)); // cap reinvestment at 85%
    const fcff  = nopat * (1 - rr);
    const df    = 1 / Math.pow(1 + wacc, t);
    const pv    = fcff * df;
    pvSum      += pv;
    rows.push({ year: t, stage: 1, g: g1, nopat, roic, rr, fcff, df, pv, cumPv: pvSum });
  }

  // Stage 2 (fade)
  for (let j = 1; j <= N2; j++) {
    const t   = N1 + j;
    const g   = g1 + (gT - g1) * (j / N2);
    nopat    *= (1 + g);
    const roic = currentROIC + (terminalROIC - currentROIC) * (t / (N1 + N2));
    const rr   = Math.max(0, Math.min(g / Math.max(roic, 0.01), 0.85));
    const fcff = nopat * (1 - rr);
    const df   = 1 / Math.pow(1 + wacc, t);
    const pv   = fcff * df;
    pvSum     += pv;
    rows.push({ year: t, stage: 2, g, nopat, roic, rr, fcff, df, pv, cumPv: pvSum });
  }

  // Terminal value — growth capped, ROIC = sector median (excess return fades to 0)
  const terminalRR   = Math.max(0, Math.min(gT / terminalROIC, 0.85));
  const terminalFCFF = nopat * (1 + gT) * (1 - terminalRR);
  const tvGap        = wacc - gT;
  const tvRaw        = tvGap > 0.005 ? terminalFCFF / tvGap : terminalFCFF / 0.005;
  const tvPv         = tvRaw / Math.pow(1 + wacc, N1 + N2);
  const tvPct        = safeDiv(tvPv, pvSum + tvPv) * 100;

  const ev         = pvSum + tvPv;
  const netDebt    = (co.netDebt ?? debt - cash);
  const equityVal  = ev - netDebt;
  const perShare   = equityVal / shares;

  return {
    rows, pvExplicit: pvSum, tvRaw, tvPv, tvPct,
    ev, netDebt, equityVal, perShare,
    wacc, ke, kd, beta, betaU, debtWeight, equityWeight, deRatio,
    currentROIC, terminalROIC,
    g1, g2, gT, N1, N2,
    baseNOPAT, investedCap,
    method: "FCFF DCF",
  };
}

// ── Residual Income Model (financials — NBFC / Bank) ────────────────────────

/**
 * Residual Income (Excess Return) Model — appropriate for financial firms.
 * RI_t = (ROE_t − Ke) × BV_{t-1}
 * ROE fades linearly from current to terminal over forecast horizon.
 * Terminal: RI perpetuity capped when ROE = Ke (no excess return).
 */
export function residualIncomeDCF(co, a) {
  const template  = co.template_code || "NBFC";
  const betaU     = SECTOR_UNLEVERED_BETAS[template] ?? 0.86;
  const beta      = betaU; // financial firms: use unlevered beta (leverage is operational)
  const ke        = calcKe(beta, a.rf ?? RF, a.erp ?? ERP);

  const equity    = co.equity || 10000;
  const shares    = co.shares || 40;
  const bvps0     = equity / shares;

  // Use forecastROE from assumptions (slider) as the STARTING ROE.
  // This is the key fix — curROE from stale seed data was causing wrong baseline.
  const pat       = co.netProfit || equity * (a.forecastROE ?? 0.15);
  const dataROE   = safeDiv(pat, equity) ?? (a.forecastROE ?? 0.15);
  const startROE  = a.forecastROE ?? dataROE; // SLIDER takes precedence
  const termROE   = a.terminalROE ?? Math.max(ke + 0.02, startROE * 0.6);
  const payout    = a.payout ?? 0.25;
  const N1        = Math.round(a.stage1Years ?? 5);
  const N2        = Math.round(a.stage2Years ?? 5);
  const N         = N1 + N2;

  let bv    = bvps0;
  let pvSum = 0;
  const rows = [];

  for (let t = 1; t <= N; t++) {
    const isStage1 = t <= N1;
    const stage    = isStage1 ? 1 : 2;

    // Stage 1: constant high-ROE phase (startROE held constant)
    // Stage 2: linear fade from startROE → termROE
    const roe = isStage1
      ? startROE
      : startROE + (termROE - startROE) * ((t - N1) / N2);

    const eps  = roe * bv;
    const dps  = eps * payout;
    const ri   = (roe - ke) * bv;
    const df   = 1 / Math.pow(1 + ke, t);
    const pvRI = ri * df;
    pvSum     += pvRI;
    rows.push({ year: t, stage, bv, roe, eps, dps, ri, df, pvRI, cumPv: pvSum });
    bv = bv * (1 + roe * (1 - payout));
  }

  // Terminal RI — perpetuity at terminal ROE with terminal growth
  const termG  = Math.min(a.terminalGrowth ?? 0.05, MAX_G);
  const lastRI = (termROE - ke) * bv;
  const tvGap  = ke - termG;
  const termRI = (termROE > ke + 0.003 && tvGap > 0.003)
    ? lastRI / tvGap
    : 0;
  const tvPv   = termRI > 0 ? termRI / Math.pow(1 + ke, N) : 0;
  const tvPct  = safeDiv(tvPv, pvSum + tvPv) * 100;

  const intrinsic = bvps0 + pvSum + tvPv;

  // Justified (steady-state) P/B via Gordon Growth:
  //     P/B = (ROE_sustainable − g) / (Ke − g)
  // IMPORTANT: use the TERMINAL/sustainable ROE and terminal growth, not the
  // (often very high) starting ROE. Using startROE here double-counted the
  // excess-return phase and badly inflated fair P/B (a key over-valuation bug).
  const gordonPB    = (ke > termG + 0.005)
    ? Math.max(0.2, (termROE - termG) / (ke - termG))
    : (termROE - termG) / 0.05;
  const justifiedPB = Math.max(0.4, Math.min(gordonPB, 12)); // sanity clamp
  const eps_latest  = safeDiv(pat, shares);
  const impliedPE   = safeDiv(intrinsic, eps_latest);

  return {
    rows, bvps0, pvExplicit: pvSum,
    tvRaw: termRI, tvPv, tvPct,
    intrinsic: Math.max(intrinsic, 0),
    justifiedPB, gordonPB, impliedPE,
    ke, beta, betaU,
    curROE: dataROE, startROE, termROE, payout,
    N1, N2, N, equity, shares,
    method: "Residual Income (Excess Return)",
  };
}

// ── Exit Multiple (cross-check, non-financials) ─────────────────────────────

/**
 * Exit multiple valuation cross-check.
 * Uses sector median EV/EBITDA from Damodaran India (Jan 2025).
 * EV = EBITDA × multiple → equity = EV − net debt
 */
export function exitMultiple(co, a) {
  const template  = co.template_code || "MANUFACTURING";
  const multiple  = a.evEbitdaMultiple ?? SECTOR_EV_EBITDA[template] ?? 12;
  const ebitda    = co.ebitda || (co.revenue || co.equity * 2) * ((a.ebitMargin ?? 0.12) + 0.03);
  const ev        = ebitda * multiple;
  const netDebt   = co.netDebt ?? 0;
  const equityVal = ev - netDebt;
  return {
    multiple, ebitda, ev, netDebt,
    perShare: equityVal / (co.shares || 50),
    method: "Exit Multiple (EV/EBITDA)",
  };
}

// ── P/E cross-check ─────────────────────────────────────────────────────────

export function peValuation(co, a) {
  // Use actual PAT from company data (not model-derived)
  const pat    = co.netProfit || (co.equity * (a.forecastROE ?? 0.15));
  const shares = co.shares || 50;
  const eps    = pat / shares;
  const peMultiple = a.peMultiple ?? 15;
  return {
    multiple: peMultiple, eps,
    perShare: eps * peMultiple,
    method: `P/E (${peMultiple}x)`,
  };
}

// ── Router ──────────────────────────────────────────────────────────────────

/**
 * Main valuation router — returns the primary model output.
 * Financial firms → Residual Income
 * Non-financial   → FCFF DCF
 */
export function valuate(co, a) {
  const isF = co.type === "financial" || ["NBFC","BANK","INSURANCE"].includes(co.template_code);
  if (isF) return residualIncomeDCF(co, a);
  return fcffDCF(co, a);
}

// ── Weighted blend ──────────────────────────────────────────────────────────

/**
 * Blend all methods with configurable weights.
 * For financials: RI (65%) + Justified P/B (20%) + P/E (15%)
 * For non-financial: DCF (55%) + Exit Multiple (30%) + P/E (15%)
 */
export function blendedValuation(co, a) {
  const isF = co.type === "financial" || ["NBFC","BANK","INSURANCE"].includes(co.template_code);
  const v   = valuate(co, a);

  if (isF) {
    const riVal   = v.intrinsic;
    // Gordon Growth Model P/B = forecastROE / (Ke − g) — proper cross-check, not circular
    const gordonPB = v.gordonPB ?? v.justifiedPB ?? 1;
    const pbVal    = v.bvps0 * gordonPB;
    // P/E using latest EPS (from actual PAT, not stale)
    const eps      = safeDiv(co.netProfit || co.equity * (a.forecastROE ?? 0.20), co.shares || 40);
    const peVal    = eps ? eps * (a.peMultiple ?? 15) : riVal;
    const blended  = riVal * 0.65 + pbVal * 0.20 + peVal * 0.15;
    return { v, blended: Math.max(blended, 0), components: [
      { method:"Residual Income",   value:riVal, weight:0.65 },
      { method:"Gordon Growth P/B", value:pbVal, weight:0.20 },
      { method:"P/E",               value:peVal, weight:0.15 },
    ]};
  } else {
    const dcfVal  = v.perShare;
    const emVal   = exitMultiple(co, a).perShare;
    const peVal   = peValuation(co, a).perShare;
    const blended = dcfVal * 0.55 + emVal * 0.30 + peVal * 0.15;
    return { v, blended, components: [
      { method:"FCFF DCF",            value:dcfVal, weight:0.55 },
      { method:"Exit Multiple",       value:emVal,  weight:0.30 },
      { method:"P/E",                 value:peVal,  weight:0.15 },
    ]};
  }
}

// ── Monte Carlo simulation ──────────────────────────────────────────────────

/**
 * Monte Carlo simulation — 500 scenarios.
 *
 * Stochastic inputs (all independent, normal distribution):
 *   Revenue/NOPAT growth:  σ = 30% of mean
 *   EBIT/profit margin:    σ = 15% of mean
 *   WACC / Ke:             σ = 0.75%
 *   Terminal growth:       σ = 0.5%
 *
 * Returns sorted array of intrinsic values + percentile breakdown.
 */
export function monteCarlo(co, a, N = 500) {
  const isF     = co.type === "financial" || ["NBFC","BANK","INSURANCE"].includes(co.template_code);
  const results = [];

  const g1Base   = a.revGrowth1  ?? a.revGrowth  ?? 0.15;
  const gTBase   = a.terminalGrowth ?? 0.05;
  const wBase    = isF ? calcKe(SECTOR_UNLEVERED_BETAS[co.template_code ?? "NBFC"] ?? 0.86) : null;

  for (let i = 0; i < N; i++) {
    try {
      const aMC = {
        ...a,
        revGrowth1:      Math.max(0.02, g1Base + randn() * g1Base * 0.30),
        revGrowth2:      Math.max(0.01, (g1Base * 0.6) + randn() * g1Base * 0.25),
        ebitMargin:      isF ? a.ebitMargin : Math.max(0.02, (a.ebitMargin ?? 0.12) * (1 + randn() * 0.15)),
        terminalGrowth:  Math.min(MAX_G, Math.max(0.02, gTBase + randn() * 0.005)),
        forecastROE:     isF ? Math.max(0.08, (a.forecastROE ?? 0.20) * (1 + randn() * 0.15)) : a.forecastROE,
        terminalROE:     isF ? Math.max(0.09, (a.terminalROE ?? 0.14) * (1 + randn() * 0.10)) : a.terminalROE,
        // Ke / WACC shocked by ±75bps
        rf:              (a.rf ?? RF) + randn() * 0.0075,
        erp:             (a.erp ?? ERP) + randn() * 0.005,
      };
      const result = isF ? residualIncomeDCF(co, aMC) : fcffDCF(co, aMC);
      const val    = isF ? result.intrinsic : result.perShare;
      // Keep every finite, positive draw. Previously draws above 20× price were
      // discarded, which truncated the right tail and biased the mean/percentiles
      // downward — an honest distribution must not filter its own outliers.
      // We only drop non-finite / non-positive results and obvious blow-ups.
      if (isFinite(val) && val > 0 && val < co.price * 200) results.push(val);
    } catch { /* skip bad scenarios */ }
  }

  results.sort((a, b) => a - b);
  const pct = (p) => results[Math.floor(p * results.length / 100)] ?? null;

  return {
    simulations: results.length,
    p10:  pct(10), p25:  pct(25), p50:  pct(50),
    p75:  pct(75), p90:  pct(90),
    mean: results.reduce((s, v) => s + v, 0) / results.length,
    probUpside: results.filter(v => v > (co.price ?? 0)).length / results.length,
    histogram: buildHistogram(results, 20),
  };
}

function buildHistogram(values, bins) {
  if (!values.length) return [];
  const lo = values[0], hi = values[values.length - 1];
  const width = (hi - lo) / bins || 1;
  const counts = Array(bins).fill(0);
  for (const v of values) {
    const i = Math.min(bins - 1, Math.floor((v - lo) / width));
    counts[i]++;
  }
  return counts.map((count, i) => ({
    x: lo + (i + 0.5) * width,
    count,
    pct: (count / values.length) * 100,
  }));
}

// ── Sensitivity grid ─────────────────────────────────────────────────────────

/**
 * 5×5 sensitivity grid.
 * Rows: discount rate delta (±100bps)
 * Cols: terminal growth delta (±1%)
 */
export function sensitivityGrid(co, a) {
  const isF  = co.type === "financial" || ["NBFC","BANK","INSURANCE"].includes(co.template_code);
  const dR   = [-0.01, -0.005, 0, 0.005, 0.01];
  const dG   = [-0.01, -0.005, 0, 0.005, 0.01];

  return {
    dR, dG,
    grid: dR.map(dr => dG.map(dg => {
      const aMod = {
        ...a,
        rf:             (a.rf ?? RF) + dr,
        terminalGrowth: Math.min(MAX_G, Math.max(0.02, (a.terminalGrowth ?? 0.05) + dg)),
      };
      const result = isF ? residualIncomeDCF(co, aMod) : fcffDCF(co, aMod);
      const val    = isF ? result.intrinsic : result.perShare;
      return isFinite(val) ? Math.round(val) : null;
    })),
  };
}

// ── Snapshot fundamentals ───────────────────────────────────────────────────

export function fundamentals(co) {
  const equity = co.equity;
  const shares = co.shares;
  const pat    = co.netProfit;
  const haveBook = equity != null && shares > 0;
  const bvps   = haveBook ? equity / shares : null;
  const eps    = pat != null && shares > 0 ? pat / shares : null;
  // P/E and P/B are "not meaningful" when the denominator is ≤ 0 (loss-making
  // or negative book value). Return null in those cases so the UI shows N/M
  // instead of a misleading negative or near-zero multiple.
  const pe  = eps != null && eps > 0 ? co.price / eps : null;
  const pb  = bvps != null && bvps > 0 ? co.price / bvps : null;
  const roe = pat != null && equity > 0 ? pat / equity : null;
  return { bvps, eps, pb, pe, roe };
}

// ── Canonical intrinsic value (single source of truth) ──────────────────────

/**
 * The ONE intrinsic value the whole app should display.
 * Screener, company header and the DCF tab must all derive their number from
 * this function so they can never disagree. Returns null when it can't be
 * computed cleanly (so callers show "—" rather than a fabricated figure).
 */
export function intrinsicOf(co, a) {
  try {
    const b = blendedValuation(co, a);
    const v = b?.blended;
    return isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

// ── Reverse DCF (market-implied expectations) ───────────────────────────────

/**
 * Reverse DCF — solves for the single growth/return assumption that makes the
 * blended intrinsic value equal today's price. This answers the most
 * decision-useful question in fundamental investing:
 *   "What does the market already expect this business to do?"
 * If the implied number is far above what the company can plausibly deliver,
 * the stock is priced for perfection; far below, expectations are depressed.
 *
 * Non-financials → solves Stage-1 revenue growth.
 * Financials     → solves Stage-1 (forecast) ROE.
 */
export function reverseDCF(co, a) {
  const fin = isFinancial(co);
  const key = fin ? "forecastROE" : "revGrowth1";
  const lo0 = fin ? 0.0 : -0.05;
  const hi0 = fin ? 0.60 : 0.80;
  const price = co.price;
  if (!(price > 0)) return null;

  const f = (x) => {
    const aa = fin
      ? { ...a, forecastROE: x }
      : { ...a, revGrowth1: x, revGrowth2: x * 0.6 };
    const iv = intrinsicOf(co, aa);
    return iv == null ? null : iv - price;
  };

  let lo = lo0, hi = hi0;
  let flo = f(lo), fhi = f(hi);
  if (flo == null || fhi == null) return null;

  if (flo > 0) return { key, label: fin ? "Implied forecast ROE" : "Implied Stage-1 growth",
    value: lo, bounded: "below",
    note: "Market is pricing in less than the floor assumption — depressed expectations." };
  if (fhi < 0) return { key, label: fin ? "Implied forecast ROE" : "Implied Stage-1 growth",
    value: hi, bounded: "above",
    note: "Even an aggressive assumption doesn't reach today's price — priced for perfection." };

  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (fm == null) break;
    if (Math.abs(fm) < price * 0.0005) { lo = hi = mid; break; }
    if ((fm > 0) === (fhi > 0)) { hi = mid; fhi = fm; }
    else { lo = mid; flo = fm; }
  }
  return { key, label: fin ? "Implied forecast ROE" : "Implied Stage-1 growth",
    value: (lo + hi) / 2, bounded: null };
}
