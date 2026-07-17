/* live.js — shared near-real-time price store.

   One poller per browser tab no matter how many components subscribe
   (screener rows, company header, dashboard indices all read the same
   store). Polls /api/live every 15s while the tab is visible; the backend
   caches ~12s and fans one Dhan batch-LTP call out to every client, so
   "real-time" costs one upstream request per window platform-wide. */

import { useEffect, useSyncExternalStore } from "react";

const EMPTY = { available: false, live: false, prices: {}, indices: {}, as_of: null };
let state = EMPTY;
let timer = null;
let api = null;
const subs = new Set();

async function tick() {
  if (!api || document.visibilityState === "hidden") return;
  try {
    const r = await fetch(`${api}/api/live`);
    if (!r.ok) return;
    const next = await r.json();
    if (next && typeof next === "object") {
      state = { ...EMPTY, ...next };
      subs.forEach(fn => fn());
    }
  } catch { /* network blip — keep the last snapshot */ }
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

/* → { available, live, prices: {TICKER: ltp}, indices: {name: ltp}, as_of } */
export function useLive(API) {
  useEffect(() => { ensurePolling(API); }, [API]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/* Tiny pulsing dot + label for live surfaces. */
export const liveDotStyle = color => ({
  width: 7, height: 7, borderRadius: "50%", background: color,
  display: "inline-block", boxShadow: `0 0 6px ${color}`,
});
