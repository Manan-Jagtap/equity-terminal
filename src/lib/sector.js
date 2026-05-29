/* Sector-keyword → DCF parameter map.
   Keys are matched as substrings against the company's sector string. */

export const SECTOR_PARAMS = {
  "oil gas":              { ebitMargin: 0.030, revGrowth: 0.06, reinvestRate: 0.50, taxRate: 0.30 },
  "petroleum":            { ebitMargin: 0.025, revGrowth: 0.06, reinvestRate: 0.50, taxRate: 0.30 },
  "refinery":             { ebitMargin: 0.025, revGrowth: 0.06, reinvestRate: 0.50, taxRate: 0.30 },
  "information technology": { ebitMargin: 0.230, revGrowth: 0.13, reinvestRate: 0.20, taxRate: 0.25 },
  "technology":           { ebitMargin: 0.220, revGrowth: 0.14, reinvestRate: 0.22, taxRate: 0.25 },
  "fast moving":          { ebitMargin: 0.175, revGrowth: 0.10, reinvestRate: 0.25, taxRate: 0.25 },
  "fmcg":                 { ebitMargin: 0.175, revGrowth: 0.10, reinvestRate: 0.25, taxRate: 0.25 },
  "consumer goods":       { ebitMargin: 0.160, revGrowth: 0.10, reinvestRate: 0.28, taxRate: 0.25 },
  "consumer durables":    { ebitMargin: 0.120, revGrowth: 0.11, reinvestRate: 0.32, taxRate: 0.25 },
  "consumer services":    { ebitMargin: 0.115, revGrowth: 0.13, reinvestRate: 0.35, taxRate: 0.25 },
  "pharma":               { ebitMargin: 0.185, revGrowth: 0.12, reinvestRate: 0.28, taxRate: 0.22 },
  "health":               { ebitMargin: 0.150, revGrowth: 0.14, reinvestRate: 0.35, taxRate: 0.25 },
  "automobile":           { ebitMargin: 0.095, revGrowth: 0.10, reinvestRate: 0.40, taxRate: 0.28 },
  "auto":                 { ebitMargin: 0.090, revGrowth: 0.10, reinvestRate: 0.40, taxRate: 0.28 },
  "power":                { ebitMargin: 0.280, revGrowth: 0.08, reinvestRate: 0.60, taxRate: 0.25 },
  "energy":               { ebitMargin: 0.240, revGrowth: 0.09, reinvestRate: 0.55, taxRate: 0.25 },
  "telecom":              { ebitMargin: 0.220, revGrowth: 0.08, reinvestRate: 0.50, taxRate: 0.25 },
  "metal":                { ebitMargin: 0.145, revGrowth: 0.07, reinvestRate: 0.45, taxRate: 0.28 },
  "mining":               { ebitMargin: 0.140, revGrowth: 0.06, reinvestRate: 0.40, taxRate: 0.28 },
  "cement":               { ebitMargin: 0.180, revGrowth: 0.09, reinvestRate: 0.42, taxRate: 0.28 },
  "construction":         { ebitMargin: 0.110, revGrowth: 0.12, reinvestRate: 0.45, taxRate: 0.28 },
  "realty":               { ebitMargin: 0.200, revGrowth: 0.12, reinvestRate: 0.50, taxRate: 0.25 },
  "chemical":             { ebitMargin: 0.165, revGrowth: 0.11, reinvestRate: 0.38, taxRate: 0.25 },
  "textile":              { ebitMargin: 0.110, revGrowth: 0.08, reinvestRate: 0.35, taxRate: 0.25 },
  "services":             { ebitMargin: 0.150, revGrowth: 0.12, reinvestRate: 0.30, taxRate: 0.25 },
  "retail":               { ebitMargin: 0.080, revGrowth: 0.14, reinvestRate: 0.40, taxRate: 0.25 },
  "media":                { ebitMargin: 0.200, revGrowth: 0.08, reinvestRate: 0.25, taxRate: 0.25 },
  "capital goods":        { ebitMargin: 0.130, revGrowth: 0.12, reinvestRate: 0.40, taxRate: 0.25 },
  "diversified":          { ebitMargin: 0.140, revGrowth: 0.10, reinvestRate: 0.38, taxRate: 0.25 },
};

export function sectorParams(sector) {
  const s = (sector || "").toLowerCase();
  for (const [key, params] of Object.entries(SECTOR_PARAMS)) {
    if (s.includes(key)) return params;
  }
  return { ebitMargin: 0.130, revGrowth: 0.10, reinvestRate: 0.38, taxRate: 0.25 };
}
