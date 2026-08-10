/* THE single decision: do this company's valuation figures come from the ENGINE,
 * or from the local browser recompute?
 *
 * Getting this wrong has now shipped TWICE, the same way both times: a surface
 * asks "did the backend give me a number?" instead of "does the backend have a
 * view?". Those are different questions. The engine deliberately withholds a
 * point estimate while KEEPING its verdict — and it does so in more than one
 * shape:
 *
 *   value_suppressed / fair_value_note   "not meaningful"   (109 names)
 *   gate_state: abstain, no note at all                     ( 50 names)
 *
 * A guard written against whichever shape was known at the time misses the rest.
 * Measured against live production data on 10 Aug 2026, the surviving hole let
 * the browser publish a fair value for 107 of the 159 names the engine had
 * withheld, and flip the engine's verdict on 46 of them — TVSSCS came back as
 * ACCUMULATE +65.2% against a backend AVOID, which is the very ticker the first
 * fix was written for.
 *
 * So the question is asked ONCE, here, and it is a question about PROVENANCE,
 * not about which field happens to be populated: a row that came from
 * /api/companies carries `co.api`, and the backend has a view on it. Seed and
 * offline rows do not, and only those may be recomputed locally.
 *
 * app/valuation_public.py on the backend says it plainly: "any surface that
 * forgets the flag will print the number again." This module is how a surface
 * stops having to remember.
 */
import { recommend } from "./recommend.js";
import { fundamentals } from "./valuation.js";

/* True when the row came from the API — the engine HAS a view on this name,
   even when that view is "I decline to publish a number". */
export function hasEngineView(co) {
  return Boolean(co && co.api);
}

/* The valuation figures a surface may DISPLAY for a company.
 *
 * Returns the same shape either way, so a caller never branches on provenance:
 *   iv / mos      the point estimate, or null when the engine withheld it
 *   verdict       ALWAYS the engine's when it has one — never overridden locally
 *   noCall        the engine declined; show the note, not a number
 *   source        "engine" | "local"  (for tests and debugging, not for logic)
 */
export function valuationView(co, assumptions) {
  const a = co && co.api;

  if (a) {
    // The engine disowns its own intrinsic on these, so never display or sort on
    // it — that is how a +717% "margin of safety" ends up green beside a grey
    // badge. `a.iv` is ALSO null whenever the value was suppressed, which is why
    // this passes it through rather than trusting the verdict alone.
    const noCall = a.verdict === "LOW CONF" || a.verdict === "NO DATA";
    const f = fundamentals(co);
    return {
      source: "engine",
      iv:  noCall ? null : a.iv,
      mos: noCall ? null : a.mos,
      // Fall back to analyst consensus (clearly labelled at the call site) so a
      // no-call row still gives the reader a reference point.
      consensus:       noCall ? a.analystTarget : null,
      consensusUpside: noCall ? a.analystUpside : null,
      verdict:   a.verdict,
      composite: a.composite ?? 0,
      reliable:  a.reliable !== false,
      // No `flags` key: /api/companies sends a level string and nothing else, so
      // the reasons are UNKNOWN here, not absent. An empty array reads as "we
      // checked, it's clean".
      confidence: { level: a.confidence || "medium" },
      fairValueNote: a.fairValueNote || null,
      gateState:     a.gateState || null,
      noCall,
      f,
      pb: a.pb ?? f.pb, pe: a.pe ?? f.pe, roe: a.roe ?? f.roe,
      sentiment: a.sentiment ?? null,
      sentimentLabel: a.sentimentLabel ?? null,
      // -Infinity keeps a withheld figure out of the "most undervalued" end of a
      // sort — it must never rank as if it were a real one.
      sortMos: noCall ? -Infinity : (a.mos ?? -Infinity),
    };
  }

  // Seed / offline rows only: nothing upstream has an opinion, so the local
  // engine mirror is the only source there is.
  const r = recommend(co, assumptions ?? co.assumptions);
  return {
    source: "local",
    iv: r.iv,
    mos: r.mos,
    consensus: null,
    consensusUpside: null,
    verdict: r.verdict,
    composite: r.composite,
    reliable: r.reliable,
    confidence: r.confidence,
    fairValueNote: null,
    gateState: null,
    noCall: r.iv == null,
    f: r.f,
    pb: r.f.pb, pe: r.f.pe, roe: r.f.roe,
    sentiment: null,
    sentimentLabel: null,
    sortMos: r.mos ?? -Infinity,
    // Extra fields the company page's local path still reads.
    v: r.v, blended: r.blended, t: r.t, reasons: r.reasons,
  };
}
