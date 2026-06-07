/* Sector-keyword → DCF parameter map.
   Keys are matched as substrings against the company's sector string. */

export const SECTOR_PARAMS = {
  "oil gas":              { ebitMargin: 0.080, revGrowth: 0.06, reinvestRate: 0.50, taxRate: 0.25, template: "ENERGY" },
  "petroleum":            { ebitMargin: 0.060, revGrowth: 0.06, reinvestRate: 0.50, taxRate: 0.25, template: "ENERGY" },
  "refinery":             { ebitMargin: 0.060, revGrowth: 0.06, reinvestRate: 0.50, taxRate: 0.25, template: "ENERGY" },
  "information technology": { ebitMargin: 0.260, revGrowth: 0.10, reinvestRate: 0.18, taxRate: 0.25, template: "IT_SERVICES" },
  "technology":           { ebitMargin: 0.240, revGrowth: 0.12, reinvestRate: 0.20, taxRate: 0.25, template: "IT_SERVICES" },
  "software":             { ebitMargin: 0.240, revGrowth: 0.12, reinvestRate: 0.20, taxRate: 0.25, template: "IT_SERVICES" },
  "fast moving":          { ebitMargin: 0.220, revGrowth: 0.10, reinvestRate: 0.22, taxRate: 0.25, template: "CONSUMER" },
  "fmcg":                 { ebitMargin: 0.220, revGrowth: 0.10, reinvestRate: 0.22, taxRate: 0.25, template: "CONSUMER" },
  "consumer goods":       { ebitMargin: 0.200, revGrowth: 0.10, reinvestRate: 0.25, taxRate: 0.25, template: "CONSUMER" },
  "consumer durables":    { ebitMargin: 0.130, revGrowth: 0.12, reinvestRate: 0.32, taxRate: 0.25, template: "CONSUMER" },
  "consumer services":    { ebitMargin: 0.130, revGrowth: 0.13, reinvestRate: 0.35, taxRate: 0.25, template: "CONSUMER" },
  "retail":               { ebitMargin: 0.080, revGrowth: 0.14, reinvestRate: 0.40, taxRate: 0.25, template: "CONSUMER" },
  "pharma":               { ebitMargin: 0.200, revGrowth: 0.11, reinvestRate: 0.26, taxRate: 0.22, template: "PHARMA" },
  "health":               { ebitMargin: 0.170, revGrowth: 0.13, reinvestRate: 0.32, taxRate: 0.25, template: "PHARMA" },
  "automobile":           { ebitMargin: 0.110, revGrowth: 0.10, reinvestRate: 0.40, taxRate: 0.25, template: "AUTO" },
  "auto":                 { ebitMargin: 0.105, revGrowth: 0.10, reinvestRate: 0.40, taxRate: 0.25, template: "AUTO" },
  "power":                { ebitMargin: 0.280, revGrowth: 0.08, reinvestRate: 0.60, taxRate: 0.25, template: "UTILITIES" },
  "utilit":               { ebitMargin: 0.280, revGrowth: 0.07, reinvestRate: 0.55, taxRate: 0.25, template: "UTILITIES" },
  "energy":               { ebitMargin: 0.150, revGrowth: 0.08, reinvestRate: 0.50, taxRate: 0.25, template: "ENERGY" },
  "telecom":              { ebitMargin: 0.330, revGrowth: 0.10, reinvestRate: 0.50, taxRate: 0.25, template: "TELECOM" },
  "communication":        { ebitMargin: 0.330, revGrowth: 0.10, reinvestRate: 0.50, taxRate: 0.25, template: "TELECOM" },
  "metal":                { ebitMargin: 0.160, revGrowth: 0.06, reinvestRate: 0.45, taxRate: 0.28, template: "METAL" },
  "mining":               { ebitMargin: 0.180, revGrowth: 0.06, reinvestRate: 0.40, taxRate: 0.28, template: "METAL" },
  "cement":               { ebitMargin: 0.180, revGrowth: 0.09, reinvestRate: 0.42, taxRate: 0.25, template: "CEMENT" },
  "construction materials": { ebitMargin: 0.180, revGrowth: 0.09, reinvestRate: 0.42, taxRate: 0.25, template: "CEMENT" },
  "building":             { ebitMargin: 0.170, revGrowth: 0.10, reinvestRate: 0.42, taxRate: 0.25, template: "CEMENT" },
  "construction":         { ebitMargin: 0.120, revGrowth: 0.12, reinvestRate: 0.45, taxRate: 0.25, template: "MANUFACTURING" },
  "infrastructure":       { ebitMargin: 0.200, revGrowth: 0.10, reinvestRate: 0.50, taxRate: 0.25, template: "MANUFACTURING" },
  "realty":               { ebitMargin: 0.220, revGrowth: 0.12, reinvestRate: 0.50, taxRate: 0.25, template: "MANUFACTURING" },
  "chemical":             { ebitMargin: 0.170, revGrowth: 0.10, reinvestRate: 0.36, taxRate: 0.25, template: "MANUFACTURING" },
  "fertiliser":           { ebitMargin: 0.120, revGrowth: 0.08, reinvestRate: 0.35, taxRate: 0.25, template: "MANUFACTURING" },
  "textile":              { ebitMargin: 0.110, revGrowth: 0.08, reinvestRate: 0.35, taxRate: 0.25, template: "MANUFACTURING" },
  "media":                { ebitMargin: 0.180, revGrowth: 0.08, reinvestRate: 0.25, taxRate: 0.25, template: "MANUFACTURING" },
  "capital goods":        { ebitMargin: 0.140, revGrowth: 0.12, reinvestRate: 0.40, taxRate: 0.25, template: "MANUFACTURING" },
  "industrial":           { ebitMargin: 0.140, revGrowth: 0.11, reinvestRate: 0.40, taxRate: 0.25, template: "MANUFACTURING" },
  "services":             { ebitMargin: 0.150, revGrowth: 0.12, reinvestRate: 0.30, taxRate: 0.25, template: "MANUFACTURING" },
  "diversified":          { ebitMargin: 0.150, revGrowth: 0.10, reinvestRate: 0.38, taxRate: 0.25, template: "MANUFACTURING" },
};

export function sectorParams(sector) {
  const s = (sector || "").toLowerCase();
  for (const [key, params] of Object.entries(SECTOR_PARAMS)) {
    if (s.includes(key)) return params;
  }
  return { ebitMargin: 0.140, revGrowth: 0.10, reinvestRate: 0.38, taxRate: 0.25, template: "MANUFACTURING" };
}
