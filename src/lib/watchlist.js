/* watchlist.js — thin client for the backend /api/watchlist endpoints.
   All calls go through authFetch, which injects the Bearer token and
   broadcasts "auth:required" on a 401 (these routes now require auth). */

import { authFetch } from "./auth.js";

const base = (API) => `${API}/api/watchlist`;

const headers = { "Content-Type": "application/json" };

export async function fetchWatchlist(API) {
  const r = await authFetch(base(API), { headers });
  if (!r.ok) throw new Error(`watchlist ${r.status}`);
  return r.json();
}

export async function saveWatch(API, ticker, cfg = {}) {
  const r = await authFetch(base(API), {
    method: "POST", headers,
    body: JSON.stringify({ ticker, ...cfg }),
  });
  if (!r.ok) throw new Error(`save ${r.status}`);
  return r.json();
}

export async function removeWatch(API, ticker) {
  const r = await authFetch(`${base(API)}/${encodeURIComponent(ticker)}`, {
    method: "DELETE", headers,
  });
  if (!r.ok) throw new Error(`remove ${r.status}`);
  return r.json();
}
