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
  if (seed) {
    // Take the live price, but ALSO refresh the per-share fundamentals from the
    // API when present so price and book/earnings stay on the SAME basis. The
    // old code kept stale seed shares/equity/PAT alongside a split-adjusted live
    // price — which is exactly what produced Bajaj Finance's impossible P/E 3.4x
    // / P/B 0.73x and a fake "undervalued" signal.
    const merged = { ...seed, price: r.price, syntheticSeries: true };
    if (r.shares > 0)       merged.shares    = r.shares;
    if (r.equity != null)   merged.equity    = r.equity;
    if (r.net_profit != null) merged.netProfit = r.net_profit;
    if (r.net_debt != null) merged.netDebt   = r.net_debt;
    // If the live price diverges sharply from the seeded basis and the API did
    // not supply a fresh share count, the per-share data is probably stale
    // (corporate action). Flag it so the confidence layer can down-weight it.
    if (seed.price && r.price && !(r.shares > 0) &&
        (r.price < seed.price * 0.6 || r.price > seed.price * 1.6)) {
      merged.dataWarning =
        "Live price differs sharply from seeded basis; per-share fundamentals may be pre-split/stale.";
    }
    return merged;
  }

  const ts = r.ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const series = makeSeries(ts, r.price * 0.85, 0.10, 0.025);

  // Only use real shares; do NOT fabricate a share count — a wrong denominator
  // silently corrupts every per-share ratio and the DCF. null flows through to
  // the confidence layer, which lowers the score and shows the gaps.
  const shares = r.shares > 0 ? r.shares : null;
  const equity = r.equity != null ? r.equity : null;
  const netProfit = r.net_profit != null ? r.net_profit
    : (r.roe != null && equity != null ? equity * r.roe : null);
  const sp = sectorParams(r.sector);

  // NOTE: assumption keys MUST match what valuation.js reads
  // (rf / erp / forecastROE / terminalROE / revGrowth1 / revGrowth2 /
  //  stage1Years / stage2Years / ebitMargin / taxRate / terminalGrowth).
  // The previous adapter wrote riskFree / forecastRoe / revGrowth, which the
  // engine ignored — so every API company silently used DEFAULT growth, a major
  // cause of uniform, inflated intrinsic values across the screener.

  if (r.type === "financial") {
    return {
      id: r.ticker, name: r.name, ticker: r.ticker,
      type: "financial", sector: r.sector,
      price: r.price, shares, equity, netProfit,
      revenue: null, netDebt: null,
      syntheticSeries: true,
      nbfc: {
        aum:    r.aum  != null ? r.aum  : null,
        gnpa:   r.gnpa != null ? r.gnpa : null,
        nnpa:   r.nnpa != null ? r.nnpa : null,
        crar:   r.crar != null ? r.crar : null,
        nim:    r.nim  != null ? r.nim  : null,
        roa:    r.roa  != null ? r.roa  : null,
        pledge: 0,
      },
      assumptions: {
        beta: 1.1, rf: 0.071, erp: 0.085,
        forecastROE: r.roe != null ? r.roe : 0.14,
        terminalROE: Math.max((r.roe != null ? r.roe : 0.14) * 0.75, 0.11),
        payout: 0.20, stage1Years: 5, stage2Years: 5, terminalGrowth: 0.05,
      },
      series,
    };
  }

  const revenue = r.revenue != null ? r.revenue : null;
  const netDebt = r.net_debt != null ? r.net_debt : null;

  return {
    id: r.ticker, name: r.name, ticker: r.ticker,
    type: "nonfinancial", sector: r.sector,
    price: r.price, shares, equity, netProfit,
    revenue, netDebt,
    syntheticSeries: true,
    assumptions: {
      beta: 1.0, rf: 0.071, erp: 0.085,
      ebitMargin:   sp.ebitMargin,
      taxRate:      sp.taxRate,
      revGrowth1:   sp.revGrowth,
      revGrowth2:   sp.revGrowth * 0.6,
      stage1Years: 5, stage2Years: 5,
      terminalGrowth: Math.min(sp.revGrowth * 0.4, 0.06),
    },
    series,
  };
}
