/* Seed companies (used as fallback when API is unavailable) and the adapter
   that turns an API row into the internal company shape.
   makeSeries / rng generate a deterministic synthetic price series for tickers
   that don't have one yet — replaced with real OHLC once backend serves it. */

import { sectorParams } from "./sector.js";

function rng(seed) {
  let s = Math.abs(seed) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function makeSeries(seed, start, drift, vol, n = 250) {
  const r = rng(seed);
  const out = [];
  let p = Math.max(start, 1);
  for (let i = 0; i < n; i++) {
    p = p * (1 + drift / n + (r() - 0.5) * vol);
    out.push({ i, close: +p.toFixed(1) });
  }
  return out;
}

export const SEED = [
  // FY26 actuals — PAT, equity, AUM updated from Q4FY26 results & BSE filings
  { id: 1, name: "Muthoot Finance",    ticker: "MUTHOOTFIN", type: "financial",    sector: "Gold Loan NBFC",
    price: 3246, shares: 40.13, equity: 35600, netProfit: 10590, revenue: null, netDebt: null,
    nbfc: { aum: 181916, gnpa: 0.020, nnpa: 0.016, crar: 0.234, nim: 0.104, roa: 0.064, pledge: 0 },
    assumptions: {
      beta: 0.86, rf: 0.071, erp: 0.085,
      forecastROE: 0.339, terminalROE: 0.155, payout: 0.25,
      stage1Years: 5, stage2Years: 5, fadeYears: 10,
      terminalGrowth: 0.050, taxRate: 0.2517,
    },
    series: makeSeries(11, 2200, 0.22, 0.022) },

  { id: 2, name: "Manappuram Finance", ticker: "MANAPPURAM", type: "financial",    sector: "Gold Loan NBFC",
    price: 229, shares: 84.6, equity: 12800, netProfit: 2350, revenue: null, netDebt: null,
    nbfc: { aum: 44000, gnpa: 0.016, nnpa: 0.012, crar: 0.302, nim: 0.135, roa: 0.048, pledge: 0 },
    assumptions: {
      beta: 1.10, rf: 0.071, erp: 0.085,
      forecastROE: 0.184, terminalROE: 0.140, payout: 0.25,
      stage1Years: 5, stage2Years: 5, fadeYears: 10,
      terminalGrowth: 0.045, taxRate: 0.2517,
    },
    series: makeSeries(23, 180, 0.12, 0.028) },

  { id: 3, name: "Fedbank Financial",  ticker: "FEDFINA",    type: "financial",    sector: "Diversified NBFC",
    price: 148, shares: 37.0, equity: 2600, netProfit: 320, revenue: null, netDebt: null,
    nbfc: { aum: 15200, gnpa: 0.018, nnpa: 0.013, crar: 0.205, nim: 0.082, roa: 0.024, pledge: 0 },
    assumptions: {
      beta: 1.05, rf: 0.071, erp: 0.085,
      forecastROE: 0.130, terminalROE: 0.130, payout: 0.10,
      stage1Years: 5, stage2Years: 5, fadeYears: 10,
      terminalGrowth: 0.055, taxRate: 0.2517,
    },
    series: makeSeries(37, 120, 0.18, 0.030) },

  { id: 4, name: "Bajaj Finance",      ticker: "BAJFINANCE", type: "financial",    sector: "Diversified NBFC",
    price: 9820, shares: 62.0, equity: 78000, netProfit: 16700, revenue: null, netDebt: null,
    nbfc: { aum: 410000, gnpa: 0.010, nnpa: 0.004, crar: 0.219, nim: 0.105, roa: 0.045, pledge: 0 },
    assumptions: {
      beta: 1.05, rf: 0.071, erp: 0.085,
      forecastROE: 0.221, terminalROE: 0.160, payout: 0.15,
      stage1Years: 5, stage2Years: 5, fadeYears: 10,
      terminalGrowth: 0.060, taxRate: 0.2517,
    },
    series: makeSeries(71, 7000, 0.12, 0.020) },

  { id: 5, name: "Titan Company",      ticker: "TITAN",      type: "nonfinancial", sector: "Consumer Durables",
    price: 3380, shares: 88.8, equity: 13500, netProfit: 4180, revenue: 58000, netDebt: -4000,
    ebit: 6000, ebitda: 6800, cash: 4500,
    template_code: "CONSUMER",
    assumptions: {
      beta: 0.78, rf: 0.071, erp: 0.085,
      ebitMargin: 0.105, taxRate: 0.25, revGrowth1: 0.13, revGrowth2: 0.09,
      stage1Years: 5, stage2Years: 5,
      terminalGrowth: 0.055, evEbitdaMultiple: 26, peMultiple: 18,
    },
    series: makeSeries(91, 2800, 0.10, 0.021) },
];

/* Convert one API row into the internal company shape.
   If the ticker is in SEED, preserve seed values and just refresh price.
   Otherwise reconstruct from API fields, falling back to sector defaults. */
export function buildFromApi(r) {
  const seed = SEED.find(s => s.ticker === r.ticker);
  if (seed) return { ...seed, price: r.price };

  const ts = r.ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const series = makeSeries(ts, r.price * 0.85, 0.10, 0.025);

  const shares = r.shares || 50;
  const equity = r.equity || (r.pb ? (r.price * shares) / r.pb : shares * 200);
  const netProfit = r.net_profit || (r.roe && equity ? equity * r.roe : null);
  const sp = sectorParams(r.sector);

  if (r.type === "financial") {
    return {
      id: r.ticker, name: r.name, ticker: r.ticker,
      type: "financial", sector: r.sector,
      price: r.price, shares, equity, netProfit,
      revenue: null, netDebt: null,
      nbfc: {
        aum:    r.aum   || equity * 4,
        gnpa:   r.gnpa  || 0.025,
        nnpa:   r.nnpa  || 0.015,
        crar:   r.crar  || 0.18,
        nim:    r.nim   || 0.09,
        roa:    r.roa   || 0.02,
        pledge: 0,
      },
      assumptions: {
        beta: 1.1, riskFree: 0.069, erp: 0.065,
        forecastRoe: r.roe || 0.14,
        terminalRoe: Math.max((r.roe || 0.14) * 0.75, 0.11),
        payout: 0.20, fadeYears: 8, terminalGrowth: 0.05,
      },
      series,
    };
  }

  const revenue = r.revenue ||
    (netProfit ? netProfit / sp.ebitMargin / (1 - sp.taxRate) : r.price * shares * 0.3);
  const netDebt = r.net_debt != null ? r.net_debt : revenue * 0.08;
  const debtWeight = revenue > 0
    ? Math.min(Math.max(netDebt / (equity + netDebt), 0.05), 0.50)
    : 0.20;

  return {
    id: r.ticker, name: r.name, ticker: r.ticker,
    type: "nonfinancial", sector: r.sector,
    price: r.price, shares, equity, netProfit,
    revenue, netDebt,
    fcff: { revenue, netDebt, costDebt: 0.085, debtWeight },
    assumptions: {
      beta: 1.0, riskFree: 0.069, erp: 0.065,
      ebitMargin:   sp.ebitMargin,
      taxRate:      sp.taxRate,
      reinvestRate: sp.reinvestRate,
      revGrowth:    sp.revGrowth,
      fadeYears: 8,
      terminalGrowth: Math.min(sp.revGrowth * 0.4, 0.06),
    },
    series,
  };
}
