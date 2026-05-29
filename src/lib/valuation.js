/* Valuation engines.

   - ke(a):               CAPM cost of equity = rf + β × ERP
   - buildRIRows(co, a):  Residual Income model (financials / NBFCs)
   - buildFCFFRows(co,a): FCFF DCF (non-financials)
   - valuate(co, a):      router → RI or FCFF based on co.type
   - sensitivity(co, a):  5×5 grid varying Δrf and ΔterminalGrowth
   - fundamentals(co):    BVPS, EPS, P/B, P/E, ROE snapshot

   All functions are pure — no React, no fetch. Safe to test in isolation. */

import { safe } from "./formatters.js";

export function ke(a) {
  return a.riskFree + a.beta * a.erp;
}

export function buildRIRows(co, a) {
  const Ke = ke(a);
  const bvps0 = co.equity / co.shares;
  const ret = 1 - a.payout;
  const N = Math.max(3, Math.round(a.fadeYears));

  let bv = bvps0;
  let pvSum = 0;
  const rows = [];

  for (let t = 1; t <= N; t++) {
    const roe = a.forecastRoe + (a.terminalRoe - a.forecastRoe) * (t / N);
    const eps = roe * bv;
    const dps = eps * a.payout;
    const ri  = (roe - Ke) * bv;
    const disc = Math.pow(1 + Ke, t);
    const pvRi = ri / disc;
    pvSum += pvRi;
    rows.push({ t, bv, roe, eps, dps, ri, disc, pvRi, cumPv: pvSum });
    bv = bv * (1 + roe * ret);
  }

  const riN = (a.terminalRoe - Ke) * bv;
  const tvRaw = a.terminalGrowth < Ke ? riN / (Ke - a.terminalGrowth) : 0;
  const tvPv  = tvRaw / Math.pow(1 + Ke, N);

  return {
    rows, bvps0,
    pvExplicit: pvSum,
    tvRaw, tvPv,
    intrinsic: bvps0 + pvSum + tvPv,
    Ke,
    method: "Residual Income",
    N,
  };
}

export function buildFCFFRows(co, a) {
  const Ke = ke(a);
  const dw = safe(a.debtWeight || co.fcff?.debtWeight, 0.20);
  const cd = safe(co.fcff?.costDebt, 0.085);
  const ew = 1 - dw;
  const WACC = ew * Ke + dw * cd * (1 - a.taxRate);
  const N = Math.max(3, Math.round(a.fadeYears));

  let rev = co.revenue || co.fcff?.revenue || co.equity * 2;
  let pvSum = 0;
  const rows = [];

  for (let t = 1; t <= N; t++) {
    const g = a.revGrowth + (a.terminalGrowth - a.revGrowth) * (t / N);
    rev = rev * (1 + g);
    const ebit  = rev * a.ebitMargin;
    const tax   = ebit * a.taxRate;
    const nopat = ebit - tax;
    const reinv = nopat * a.reinvestRate;
    const fcff  = nopat - reinv;
    const disc = Math.pow(1 + WACC, t);
    const pvFcff = fcff / disc;
    pvSum += pvFcff;
    rows.push({ t, rev, g, ebit, tax, nopat, reinv, fcff, disc, pvFcff, cumPv: pvSum });
  }

  const fcffN = rows[N - 1].fcff * (1 + a.terminalGrowth);
  const tvRaw = a.terminalGrowth < WACC ? fcffN / (WACC - a.terminalGrowth) : 0;
  const tvPv  = tvRaw / Math.pow(1 + WACC, N);
  const ev    = pvSum + tvPv;
  const netDebt = co.netDebt || co.fcff?.netDebt || 0;
  const equityVal = ev - netDebt;
  const intrinsic = equityVal / co.shares;

  return {
    rows, pvExplicit: pvSum,
    tvRaw, tvPv, ev, netDebt, equityVal, intrinsic,
    Ke, WACC,
    method: "FCFF DCF",
    N,
    rev0: co.revenue || co.fcff?.revenue,
  };
}

export function valuate(co, a) {
  return co.type === "financial" ? buildRIRows(co, a) : buildFCFFRows(co, a);
}

export function sensitivity(co, a) {
  const rd = [-0.01, -0.005, 0, 0.005, 0.01];
  const gd = [-0.01, -0.005, 0, 0.005, 0.01];
  return {
    rd, gd,
    grid: rd.map(r => gd.map(g =>
      valuate(co, { ...a, terminalGrowth: a.terminalGrowth + g, riskFree: a.riskFree + r }).intrinsic
    )),
  };
}

export function fundamentals(co) {
  const bvps = co.equity / co.shares;
  const eps  = co.netProfit ? co.netProfit / co.shares : null;
  return {
    bvps, eps,
    pb:  co.price / bvps,
    pe:  eps ? co.price / eps : null,
    roe: co.netProfit ? co.netProfit / co.equity : null,
  };
}
