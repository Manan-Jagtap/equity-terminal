/* watchlist.js — thin client for the backend /api/watchlist endpoints.
   User scoping is built in: pass a userKey once login exists; until then the
   backend defaults every row to "default". */

const base = (API) => `${API}/api/watchlist`;

function headers(userKey) {
  const h = { "Content-Type": "application/json" };
  if (userKey) h["X-User-Key"] = userKey;
  return h;
}

export async function fetchWatchlist(API, userKey) {
  const r = await fetch(base(API), { headers: headers(userKey) });
  if (!r.ok) throw new Error(`watchlist ${r.status}`);
  return r.json();
}

export async function saveWatch(API, ticker, cfg = {}, userKey) {
  const r = await fetch(base(API), {
    method: "POST", headers: headers(userKey),
    body: JSON.stringify({ ticker, ...cfg }),
  });
  if (!r.ok) throw new Error(`save ${r.status}`);
  return r.json();
}

export async function removeWatch(API, ticker, userKey) {
  const r = await fetch(`${base(API)}/${encodeURIComponent(ticker)}`, {
    method: "DELETE", headers: headers(userKey),
  });
  if (!r.ok) throw new Error(`remove ${r.status}`);
  return r.json();
}
