/* live.js — shared near-real-time price store.

   One poller per browser tab no matter how many components subscribe
   (screener rows, company header, dashboard indices all read the same
   store). Polls /api/live every 15s while the tab is visible; the backend
   caches ~12s and fans one Dhan batch-LTP call out to every client, so
   "real-time" costs one upstream request per window platform-wide. */

import { useEffect, useSyncExternalStore } from "react";

const EMPTY = { available: false, live: false, stale: false, stale_s: 0, prices: {}, indices: {}, as_of: null };
let last = EMPTY;      // the server's latest payload, its own `live` claim intact
let freshAt = 0;       // Date.now() when `last.as_of` last CHANGED
let state = EMPTY;     // what subscribers see: `last` with the staleness verdict applied
let timer = null;
let api = null;
const subs = new Set();

/* A feed that has produced no NEW tick for this long is dead, not live. The
   server caches ~12s and we poll every 15s, so a healthy market-hours feed
   changes as_of on essentially every poll — six silent polls in a row is an
   outage, not a blip. */
export const STALE_AFTER_MS = 90 * 1000;

/* Pure. Apply the staleness verdict to a server payload. `ageMs` is the time
   since as_of last CHANGED — not since we last heard from the server: when Dhan
   dies the backend keeps answering 200 with the same frozen payload
   (live_prices.snapshot serves its cache on upstream failure), and that has to
   read stale exactly like a backend we cannot reach at all. Both used to leave
   the LIVE badge pulsing green over prices that had stopped moving, because
   `live` was only ever the server's claim from the last payload we managed to
   receive and nothing ever retired it. Returns the input untouched when it is
   fine, so useSyncExternalStore sees a stable snapshot and nothing re-renders. */
export function withStaleness(feed, ageMs) {
  if (!feed.live || !(ageMs > STALE_AFTER_MS)) return feed;
  return { ...feed, live: false, stale: true, stale_s: Math.round(ageMs / 1000) };
}

function publish(next) {
  if (next === state) return;
  state = next;
  subs.forEach(fn => fn());
}

/* Staleness is judged on the poll cadence, never at render (Date.now() in
   render is impure — react-hooks/purity). Runs synchronously at the top of
   tick as well as after the fetch, so a dashboard remounted hours after the
   store was parked does not paint the parked snapshot as LIVE while the first
   fetch is in flight — or forever, if that fetch fails. */
const rejudge = () => publish(withStaleness(last, Date.now() - freshAt));

async function tick() {
  if (!api || document.visibilityState === "hidden") return;
  rejudge();
  try {
    const r = await fetch(`${api}/api/live`);
    if (r.ok) {
      const next = await r.json();
      if (next && typeof next === "object") {
        if ((next.as_of ?? null) !== last.as_of) freshAt = Date.now();
        last = { ...EMPTY, ...next };
      }
    }
  } catch { /* network blip — keep the last snapshot */ }
  rejudge();
}

const _onVisible = () => { if (document.visibilityState === "visible") tick(); };  // instant catch-up

function ensurePolling(API) {
  if (!API) return;
  api = API;
  if (!timer) {
    tick();
    timer = setInterval(tick, 15000);
    document.addEventListener("visibilitychange", _onVisible);
  }
}

function stopPolling() {
  if (timer) { clearInterval(timer); timer = null; }
  document.removeEventListener("visibilitychange", _onVisible);
}

const subscribe = fn => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
    // No subscribers left → stop the interval and drop the listener (audit E7:
    // the shared poller and visibilitychange handler used to run for the app's
    // lifetime and leak the listener). Re-arms automatically on the next mount.
    if (subs.size === 0) stopPolling();
  };
};
const getSnapshot = () => state;

/* → { available, live, stale, stale_s, prices: {TICKER: ltp}, indices: {name: ltp}, as_of }
   `live` is already net of staleness; `stale` + `stale_s` (seconds since the
   last NEW tick) let a surface say STALE rather than fall back to EOD. */
export function useLive(API) {
  useEffect(() => { ensurePolling(API); }, [API]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/* Tiny pulsing dot + label for live surfaces. */
export const liveDotStyle = color => ({
  width: 7, height: 7, borderRadius: "50%", background: color,
  display: "inline-block", boxShadow: `0 0 6px ${color}`,
});
