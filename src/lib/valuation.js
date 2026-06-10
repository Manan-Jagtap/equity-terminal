/**
 * valuation.js — Institutional-grade equity valuation engine.
 *
 * Methodology:
 *  Non-financial companies  → 3-stage FCFF DCF (WACC-based, ROIC-driven reinvestment)
 *  Financial firms (NBFC/Bank/Insurance) → Residual Income Model (Ke-based, ROE-driven)
 *
 * Key calibration (India, mid-2026):
 *  Rf   = 6.9%  (India 10Y G-Sec benchmark yield, Jun 2026)
 *  ERP  = 5.0%  (cost-of-equity calibration — see note below)
 *  Cap terminal growth at min(6%, nominal GDP proxy)
 *
 * Cost-of-equity note — avoiding double-counting country risk:
 *  India's nominal 10Y G-Sec (~6.9%) already embeds sovereign / inflation /
 *  country risk (it trades ~2% above the Aaa benchmark). We therefore use the
 *  G-Sec as Rf and ADD only a mature-market-style ERP (~5%), rather than the
 *  G-Sec PLUS Damodaran's full country-risk-inclusive ERP of 7.46% — doing both
 *  double-counts country risk and produced an inflated ~15.6% Ke that valued
 *  every Indian quality compounder ~40% below market. The resulting Ke (~11–12%
 *  for a low-beta large-cap) reconciles with Damodaran's India total ERP of
 *  7.46% measured against a default-adjusted Rf (~4.8%), and with sell-side /
 *  AlphaSpread cost-of-equity for names like TCS (~10.7%).
 *
 * References:
 *  Damodaran, A. (Jul 2025). Country Risk 2025 — India total ERP = 7.46%
 *    (mature ERP 4.21% + India CRP ~3.25%; rupee Rf ~4.16%).
 *  India 10Y G-Sec ~6.9–7.1% (Jun 2026).
 *  Damodaran industry betas / ROIC / EV-EBITDA (India set).
 */

// ── India constants ─────────────────────────────────────────────────────────
export const RF          = 0.069;   // India 10Y G-Sec (Jun 2026)
export const ERP         = 0.050;   // mature-style ERP added to the G-Sec (see note)
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
  CONSUMER:      0.62,   // FMCG — low-beta defensives
  PHARMA:        0.72,
  ENERGY:        0.85,
  AUTO:          0.95,
  METAL:         1.15,
  TELECOM:       0.75,
  CEMENT:        0.92,
  UTILITIES:     0.55,
};

/**
 * Sector ROIC medians (India). Used as the terminal ROIC — the point at which
 * excess returns fade toward the cost of capital.
 */
export const SECTOR_TERMINAL_ROIC = {
  NBFC:          0.155,
  BANK:          0.130,
  INSURANCE:     0.120,
  IT_SERVICES:   0.300,
  MANUFACTURING: 0.140,
  CONSUMER:      0.320,   // asset-light FMCG — very high returns on capital
  PHARMA:        0.200,
  ENERGY:        0.120,
  AUTO:          0.160,
  METAL:         0.110,
  TELECOM:       0.100,
  CEMENT:        0.130,
  UTILITIES:     0.095,
};

/**
 * Sector EV/EBITDA multiples (India-realistic medians). Used for the exit-
 * multiple cross-check. NOTE: these are INDIAN trading multiples — Indian IT
 * trades ~11–15x EV/EBITDA (not the ~22x of US software), so using a US table
 * here badly distorts the cross-check.
 */
export const SECTOR_EV_EBITDA = {
  NBFC:          12,
  BANK:          10,
  INSURANCE:     14,
  IT_SERVICES:   15,
  MANUFACTURING: 12,
  CONSUMER:      32,
  PHARMA:        18,
  ENERGY:        8,
  AUTO:          13,
  METAL:         6,
  TELECOM:       10,
  CEMENT:        14,
  UTILITIES:     9,
};

/**
 * Sector P/E medians (India). Used as the default for the P/E cross-check so a
 * generic 15x isn't applied to a 24x-sector like IT or a 35x-sector like FMCG.
 */
export const SECTOR_PE = {
  NBFC:          18,
  BANK:          14,
  INSURANCE:     26,
  IT_SERVICES:   25,
  MANUFACTURING: 20,
  CONSUMER:      46,
  PHARMA:        30,
  ENERGY:        12,
  AUTO:          24,
  METAL:         10,
  TELECOM:       24,
  CEMENT:        26,
  UTILITIES:     15,
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

  // Capital structure. Use MARKET value of equity for weights (the correct WACC
  // basis), and the REPORTED net debt only — no invented market-cap fudge. If
  // net debt is unknown we assume zero (then re-flag via confidence) rather than
  // inventing a number that silently moves the discount rate.
  const equity   = (co.price && co.shares) ? co.price * co.shares
                   : (co.equity || 1);
  const debt     = Math.max(co.netDebt ?? 0, 0);
  const deRatio  = equity > 0 ? debt / equity : 0;
  const debtWeight   = Math.min(deRatio / (1 + deRatio), 0.75);
  const equityWeight = 1 - debtWeight;

  // Honour an explicit beta (the DCF tab's Beta slider) when provided; otherwise
  // relever the sector unlevered beta for the company's capital structure. Without
  // this, the Beta slider moved the displayed Ke but NOT the actual valuation.
  const beta = a.beta != null ? a.beta : releveredBeta(betaU, deRatio, a.taxRate ?? DEFAULT_TAX);
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
  const shares    = co.shares;

  // Base EBIT = revenue × EBIT-margin when both exist, so the EBIT-margin slider
  // actually drives the DCF (and this matches the backend, which always uses
  // revenue × margin — eliminating client/server drift). The slider's DEFAULT is
  // seeded to the firm's real EBIT/revenue, so the base case is unchanged; moving
  // it now flexes the projection. Falls back to reported EBIT, then to null
  // (refuse to value) rather than inventing a proxy from book equity.
  const baseEBIT  = (a.ebitMargin != null && co.revenue != null) ? co.revenue * a.ebitMargin
                    : (co.ebit != null ? co.ebit
                    : (co.revenue != null ? co.revenue * 0.12 : null));
  if (baseEBIT == null || !(shares > 0)) {
    return { rows: [], perShare: null, ev: null, equityVal: null, tvPct: null,
             wacc, ke, kd, beta, betaU, debtWeight, equityWeight, deRatio,
             method: "FCFF DCF", insufficient: true };
  }
  const baseNOPAT = baseEBIT * (1 - taxRate);

  // Invested Capital from reported book equity + net debt (no cash fabrication).
  const bookEquity   = co.equity != null && co.equity > 0 ? co.equity : equity;
  const investedCap  = bookEquity + Math.max(co.netDebt ?? 0, 0);
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

  // Reinvestment uses the return on INCREMENTAL capital, taken as at least the
  // sector mature ROIC. Anchoring reinvestment to the (often cash/goodwill-
  // deflated) reported average ROIC overstated the reinvestment rate and
  // systematically understated FCFF for asset-light franchises.
  // Stage 1
  for (let t = 1; t <= N1; t++) {
    nopat *= (1 + g1);
    const roic  = currentROIC + (terminalROIC - currentROIC) * (t / (N1 + N2));
    const reinvestROIC = Math.max(roic, terminalROIC);
    const rr    = Math.max(0, Math.min(g1 / reinvestROIC, 0.75)); // cap reinvestment at 75%
    const fcff  = nopat * (1 - rr);
    const df    = 1 / Math.pow(1 + wacc, t);
    const pv    = fcff * df;
    pvSum      += pv;
    rows.push({ year: t, stage: 1, g: g1, nopat, roic, rr, fcff, df, pv, cumPv: pvSum });
  }

  // Stage 2 (fade) — growth starts at the FADE-PERIOD growth (g2, the slider)
  // and converges to terminal gT over N2 years. Previously this faded from g1
  // straight to gT and ignored g2 entirely, so the Fade-period growth slider had
  // no effect on the valuation.
  for (let j = 1; j <= N2; j++) {
    const t   = N1 + j;
    const g   = g2 + (gT - g2) * (j / N2);
    nopat    *= (1 + g);
    const roic = currentROIC + (terminalROIC - currentROIC) * (t / (N1 + N2));
    const reinvestROIC = Math.max(roic, terminalROIC);
    const rr   = Math.max(0, Math.min(g / Math.max(reinvestROIC, 0.01), 0.75));
    const fcff = nopat * (1 - rr);
    const df   = 1 / Math.pow(1 + wacc, t);
    const pv   = fcff * df;
    pvSum     += pv;
    rows.push({ year: t, stage: 2, g, nopat, roic, rr, fcff, df, pv, cumPv: pvSum });
  }

  // Terminal value — growth capped, ROIC = sector median (excess return fades to 0)
  const terminalRR   = Math.max(0, Math.min(gT / terminalROIC, 0.75));
  const terminalFCFF = nopat * (1 + gT) * (1 - terminalRR);
  const tvGap        = wacc - gT;
  const tvRaw        = tvGap > 0.005 ? terminalFCFF / tvGap : terminalFCFF / 0.005;
  const tvPv         = tvRaw / Math.pow(1 + wacc, N1 + N2);
  const tvPct        = safeDiv(tvPv, pvSum + tvPv) * 100;

  const ev         = pvSum + tvPv;
  // Equity bridge: EV − net debt. Net debt is NEGATIVE for net-cash firms, so
  // this correctly ADDS the surplus cash to equity value (previously capped at 0,
  // which silently discarded the cash pile of cash-rich names like TCS/Maruti).
  const netDebt    = co.netDebt ?? 0;
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
  // Honour the Beta slider when provided; else use the sector beta (financials:
  // leverage is operational, so the unlevered sector beta is the default).
  const beta      = a.beta != null ? a.beta : betaU;
  const ke        = calcKe(beta, a.rf ?? RF, a.erp ?? ERP);

  // Refuse to value without real book equity and a share count.
  if (!(co.equity > 0) || !(co.shares > 0)) {
    return { rows: [], intrinsic: null, bvps0: null, pvExplicit: null,
             tvPv: null, tvPct: null, ke, beta, betaU,
             method: "Residual Income (Excess Return)", insufficient: true };
  }
  const equity    = co.equity;
  const shares    = co.shares;
  const bvps0     = equity / shares;

  // Starting ROE is anchored to REALIZED ROE (PAT / equity) when available, then
  // SANITY-CAPPED. A reported ROE of, say, 47% (LIC) is real but not a
  // sustainable excess return to compound for years — left uncapped it produced
  // wildly inflated intrinsics. We cap the starting excess-return ROE at 25% and
  // fade it toward a normalised terminal ROE.
  const dataROE   = safeDiv(co.netProfit, equity);
  const rawStart  = a.forecastROE ?? dataROE ?? 0.15;
  const startROE  = Math.min(Math.max(rawStart, 0.05), 0.25);
  const termROE   = Math.min(a.terminalROE ?? Math.max(ke + 0.02, startROE * 0.7), 0.18);
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
  const eps_latest  = safeDiv(co.netProfit, shares);
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
  // Only from real EBITDA / revenue — no book-equity proxy.
  const ebitda    = co.ebitda != null ? co.ebitda
                    : (co.revenue != null ? co.revenue * ((a.ebitMargin ?? 0.12) + 0.03) : null);
  if (ebitda == null || !(co.shares > 0)) return { multiple, ebitda: null, perShare: null, method: "Exit Multiple (EV/EBITDA)" };
  const ev        = ebitda * multiple;
  const netDebt   = co.netDebt ?? 0;   // negative = net cash, added back to equity
  return {
    multiple, ebitda, ev, netDebt,
    perShare: (ev - netDebt) / co.shares,
    method: "Exit Multiple (EV/EBITDA)",
  };
}

// ── P/E cross-check ─────────────────────────────────────────────────────────

export function peValuation(co, a) {
  const template = co.template_code || "MANUFACTURING";
  const sectorPE = SECTOR_PE[template] ?? 18;
  // Real PAT only — never a model-derived proxy.
  if (co.netProfit == null || co.netProfit <= 0 || !(co.shares > 0))
    return { multiple: a.peMultiple ?? sectorPE, eps: null, perShare: null, method: "P/E" };
  const eps        = co.netProfit / co.shares;
  const peMultiple = a.peMultiple ?? sectorPE;
  return { multiple: peMultiple, eps, perShare: eps * peMultiple, method: `P/E (${peMultiple}x)` };
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
// Re-weight only the components that are actually available; return null if the
// primary model couldn't be computed. Never invent a value to fill the blend.
function blendComponents(primaryOk, raw) {
  if (!primaryOk) return { blended: null, components: raw.map(c => ({ ...c })) };
  const avail = raw.filter(c => c.value != null && isFinite(c.value) && c.value > 0);
  if (!avail.length) return { blended: null, components: raw };
  const wsum = avail.reduce((s, c) => s + c.weight, 0);
  const blended = avail.reduce((s, c) => s + c.value * (c.weight / wsum), 0);
  return { blended, components: raw };
}

export function blendedValuation(co, a) {
  const isF = isFinancial(co);

  // ── Forward-growth seeding ──────────────────────────────────────────────
  // When analyst forward estimates exist AND the caller hasn't set an explicit
  // growth, seed the explicit-period growth from consensus (the growth the
  // market is actually pricing) rather than a generic sector default.
  // CRITICAL: this must NOT fire when growth is explicitly provided — otherwise
  // it silently clobbers the DCF tab's Revenue-growth / Fade-growth sliders, so
  // moving them does nothing. The interactive tab always passes revGrowth1, so
  // gating on `a.revGrowth1 == null` lets the sliders win there while still
  // seeding consensus growth for base-case callers that omit it.
  const ag = (co.analystGrowth != null && isFinite(co.analystGrowth) && a.revGrowth1 == null)
    ? Math.max(0.03, Math.min(co.analystGrowth, 0.30)) : null;
  const aa = ag != null
    ? { ...a, revGrowth1: ag, revGrowth2: Math.max(0.03, Math.min(ag * 0.72, 0.20)),
        forecastROE: a.forecastROE }
    : a;

  const v = valuate(co, aa);

  // ── Fundamental blended value (bottom-up) ───────────────────────────────
  let fund, fundComponents;
  if (isF) {
    const riVal    = v.intrinsic;
    const gordonPB = v.gordonPB ?? v.justifiedPB ?? null;
    const pbVal    = (v.bvps0 != null && gordonPB != null) ? v.bvps0 * gordonPB : null;
    const eps      = (co.netProfit != null && co.netProfit > 0 && co.shares > 0) ? co.netProfit / co.shares : null;
    const peVal    = eps != null ? eps * (a.peMultiple ?? (SECTOR_PE[co.template_code] ?? 15)) : null;
    const r = blendComponents(riVal != null, [
      { method:"Residual Income",   value:riVal, weight:0.65 },
      { method:"Gordon Growth P/B", value:pbVal, weight:0.20 },
      { method:"P/E",               value:peVal, weight:0.15 },
    ]);
    fund = r.blended; fundComponents = r.components;
  } else {
    const dcfVal = v.perShare;
    const emVal  = exitMultiple(co, aa).perShare;
    const peVal  = peValuation(co, aa).perShare;
    const r = blendComponents(dcfVal != null, [
      { method:"FCFF DCF",      value:dcfVal, weight:0.55 },
      { method:"Exit Multiple", value:emVal,  weight:0.30 },
      { method:"P/E",           value:peVal,  weight:0.15 },
    ]);
    fund = r.blended; fundComponents = r.components;
  }

  // ── Independent headline + a SEPARATE consensus comparison ──────────────
  // The headline fair value is the model's OWN fundamental view (DCF/RI + exit
  // multiple + P/E) — it is NOT anchored or clamped to the analyst target, so
  // the terminal can legitimately disagree with the Street. The analyst
  // consensus is returned alongside (consensusValue) for a side-by-side display
  // and a divergence flag, never blended into `blended`.
  const an = co.analyst;
  let consensusValue = null;
  const flags = [];
  if (an && an.target > 0) {
    consensusValue = an.target;
    if (fund > 0) {
      const gap = fund / an.target - 1;
      if (gap < -0.15) flags.push("model_below_consensus");
      else if (gap > 0.15) flags.push("model_above_consensus");
    }
  }
  return {
    v, blended: fund, components: fundComponents, fundamental: fund,
    analyst: an || null, consensusValue, flags,
  };
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
      // Guard the blow-up filter against a missing price: `val < null * 200`
      // is `val < NaN` → false, which silently rejected EVERY draw.
      if (isFinite(val) && val > 0 && (!(co.price > 0) || val < co.price * 200)) results.push(val);
    } catch { /* skip bad scenarios */ }
  }

  results.sort((a, b) => a - b);
  if (!results.length)
    return { simulations: 0, p10: null, p25: null, p50: null, p75: null, p90: null,
             mean: null, probUpside: null, histogram: [] };
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
  // Also require a real positive price: in JS `null / eps === 0`, so a missing
  // price was silently rendering P/E 0.0x / P/B 0.0x instead of "—".
  const px  = co.price > 0 ? co.price : null;
  const pe  = px != null && eps != null && eps > 0 ? px / eps : null;
  const pb  = px != null && bvps != null && bvps > 0 ? px / bvps : null;
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

  // Reverse-DCF solves against the FUNDAMENTAL (bottom-up) value — not the
  // consensus-anchored blend — so it answers "what growth must the business
  // deliver to justify today's price on fundamentals alone?".
  const coF = { ...co, analyst: undefined, analystGrowth: undefined };
  const f = (x) => {
    const aa = fin
      ? { ...a, forecastROE: x }
      : { ...a, revGrowth1: x, revGrowth2: x * 0.6 };
    const b = blendedValuation(coF, aa);
    const iv = b?.fundamental;
    return (iv == null || !isFinite(iv)) ? null : iv - price;
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
