/* useResource — one honest fetch lifecycle for the list screens.

   The defect this exists to kill: eleven screens did

       fetch(url).then(r => r.json()).catch(() => setData(null))

   and then rendered copy like "No ownership data yet — run a refresh to
   populate shareholding snapshots." A backend outage was reported to the user
   as an empty dataset, and the suggested remedy was an action that could not
   help. Two different facts had been collapsed into one rendering:

     * the request failed      -> we do not know what the data is
     * the request returned [] -> we know, and it is empty

   They must look different, so they are separate return values here.

   Note the `r.ok` check, which is the part that actually matters. FastAPI
   answers 4xx/5xx with a JSON body (verified against prod: GET /api/no-route
   returns 404 with content-type application/json and {"detail":"Not Found"}),
   so `.then(r => r.json())` RESOLVES on an error status and the old `.catch`
   never fired. Measured across the screens: 10 of 11 had zero r.ok checks. The
   most common outage shape — app up, API erroring — therefore took no error
   path at all and silently showed the empty state. A status code is a failure.

   Retry: `retry()` re-runs the request. The hook also re-runs it by itself when
   the browser comes back online or the tab becomes visible again — but ONLY
   while it is in the error state, so a healthy screen never refetches behind
   the user's back. That ordering matters: IPOBoard's existing outage copy
   promised "it retries automatically" while the component fetched once on
   mount with no listener at all. Here the claim is made true before it is made.

   Returns { data, error, loading, retry }.
     error is null, or { kind: "status" | "network" | "parse", detail } — never
     a bare boolean, because "503 from the API" and "your wifi dropped" deserve
     different copy and the screens should be able to tell them apart.
*/
import { useCallback, useEffect, useRef, useState } from "react";

export function useResource(url, { enabled = true, transform } = {}) {
  const [nonce, setNonce] = useState(0);
  // One state object stamped with the request it belongs to. `loading` is then
  // DERIVED (stamp !== current request), which is what lets the effect avoid a
  // synchronous setState on every url change.
  const stamp = `${url}::${nonce}`;
  const [res, setRes] = useState({ stamp: null, data: null, error: null });

  // Kept in a ref so the online/visibility listeners can read the CURRENT error
  // state without re-subscribing on every state change. Written in an effect,
  // never during render.
  const erroredRef = useRef(false);
  useEffect(() => { erroredRef.current = Boolean(res.error); }, [res.error]);

  const retry = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    if (!url || !enabled) return;
    let live = true;

    fetch(url)
      .then(r => {
        if (!r.ok) {
          // Consume the body so the connection is released, but do not let a
          // JSON error envelope masquerade as data.
          const e = new Error(`HTTP ${r.status}`);
          e.kind = "status"; e.status = r.status;
          throw e;
        }
        return r.json().catch(() => {
          const e = new Error("Malformed response");
          e.kind = "parse";
          throw e;
        });
      })
      .then(j => {
        if (live) setRes({ stamp, data: transform ? transform(j) : j, error: null });
      })
      .catch(err => {
        if (live) setRes({ stamp, data: null,
          error: { kind: err.kind || "network", detail: err.message || String(err) } });
      });

    return () => { live = false; };
    // `transform` is intentionally not a dep: callers pass an inline arrow, so
    // depending on it would refetch on every render.
  }, [url, enabled, nonce, stamp]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Recover on its own when the network or the tab comes back — but only from
  // the error state, so this never refetches a screen that is working.
  useEffect(() => {
    const onBack = () => {
      if (!erroredRef.current) return;
      if (document.visibilityState === "hidden") return;
      retry();
    };
    window.addEventListener("online", onBack);
    document.addEventListener("visibilitychange", onBack);
    return () => {
      window.removeEventListener("online", onBack);
      document.removeEventListener("visibilitychange", onBack);
    };
  }, [retry]);

  const settled = res.stamp === stamp;
  return {
    data:    settled ? res.data  : null,
    error:   settled ? res.error : null,
    loading: Boolean(url && enabled) && !settled,
    retry,
  };
}

export default useResource;
