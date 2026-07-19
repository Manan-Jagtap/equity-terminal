/* Phase 0b — path-based routing (replaces hash routing).
 *
 * Real routes: `/`, `/screener`, `/company/TCS`, `/styleguide` … Deep links are
 * shareable and crawler-legible, and per-page <title> updates. A PERMANENT shim
 * (`hashToPath`) converts any legacy `#/…` URL on load so old links never 404.
 * Query strings (e.g. `?scenario=<token>`) are always preserved.
 *
 * The SPA fallback lives in vercel.json — its catch-all rewrite must exclude
 * `/api/*`, `/stock/*` (the SSR pages) and any dotted static file, or a hard
 * reload of `/company/TCS` would 404. That ordering is load-bearing.
 */

export const VIEW_IDS = [
  "dashboard", "screener", "ideas", "baskets", "watchlist", "compare",
  "results", "ownership", "operations", "sectors", "economy", "ipo",
  "funds", "portfolio", "manager", "track", "styleguide",
];

/** pathname → { view, ticker? } | null (unknown → caller falls back, never crashes) */
export function parsePath(pathname) {
  const p = (pathname || "/").replace(/^\/+|\/+$/g, "");
  if (!p) return { view: "dashboard" };            // "/" is home
  const [seg, id] = p.split("/");
  if (seg === "company" && id) return { view: "company", ticker: decodeURIComponent(id).toUpperCase() };
  if (VIEW_IDS.includes(seg)) return { view: seg };
  return null;
}

/** {view, selectedId} → real path (dashboard is the bare "/") */
export function pathForRoute(view, selectedId) {
  if (view === "company" && selectedId) return `/company/${encodeURIComponent(String(selectedId))}`;
  if (view === "dashboard") return "/";
  return `/${view}`;
}

/** legacy `#/company/TCS` | `#/screener` → real path, or null. Used once on mount. */
export function hashToPath(hash) {
  const h = decodeURIComponent((hash || "").replace(/^#\/?/, ""));
  if (!h) return null;
  const [seg, id] = h.split("/");
  if (seg === "company" && id) return `/company/${encodeURIComponent(id)}`;
  if (VIEW_IDS.includes(seg)) return `/${seg}`;
  return null;
}

const VIEW_TITLE = {
  dashboard: "Dashboard", screener: "Screener", ideas: "Ideas", baskets: "Baskets",
  watchlist: "Watchlist", compare: "Compare", results: "Results", ownership: "Ownership",
  operations: "Operating KPIs", sectors: "Sectors", economy: "Economy", ipo: "IPOs",
  funds: "Mutual Funds", portfolio: "Portfolio", manager: "Fund Manager",
  track: "Track Record", styleguide: "Style Guide",
};

/** Per-page browser title. Company pages get the name + ticker. */
export function pageTitle(view, ticker, companyName) {
  if (view === "company" && ticker) {
    return `${companyName ? companyName + " " : ""}(${ticker}) — EquityVerdict`;
  }
  const t = VIEW_TITLE[view];
  return t ? `${t} — EquityVerdict` : "EquityVerdict — Independent Equity Research";
}
