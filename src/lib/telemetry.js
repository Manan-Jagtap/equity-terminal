/* telemetry.js — INST-01 client beacon (self-owned, DPDP-fit).

   Fire-and-forget POST /api/telemetry: the backend stores ONLY a sanitised
   event slug + a query-stripped path (no IP, no user-agent, 180-day
   retention). Anonymous is fine; the Bearer header rides along when a
   session exists so DAU can be counted. A telemetry failure must never be
   visible in the product — every error is swallowed. */

import { authHeaders } from "./auth.js";

let _last = { key: "", t: 0 };

export function track(API, event, detail) {
  try {
    if (!API || !event) return;
    // drop immediate repeats (StrictMode double-fires, rapid re-renders)
    const key = `${event}|${detail || ""}`;
    const now = Date.now();
    if (key === _last.key && now - _last.t < 15000) return;
    _last = { key, t: now };
    fetch(`${API}/api/telemetry`, {
      method: "POST",
      keepalive: true,                       // survives navigation/unload
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        event,
        // path only — the backend strips query strings anyway, but never
        // send them in the first place (they can carry share tokens).
        detail: (detail || "").split("?")[0].slice(0, 200) || null,
      }),
    }).catch(() => {});
  } catch { /* telemetry must never break the app */ }
}
