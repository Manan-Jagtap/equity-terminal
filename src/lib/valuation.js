/**
 * valuation.js — client valuation ADAPTER (no math of its own).
 *
 * HISTORY: this file used to be a second, independent valuation engine (its own
 * FCFF DCF, Residual Income, exit-multiple and P/E implementations) that could
 * — and did — drift from the backend. It is now a thin adapter: every intrinsic
 * the client computes flows through lib/engine.js (the bit-for-bit parity port
 * of app/engines.py) with assumptions from lib/derive.js (the parity port of
 * app/derive.py). ONE math core, client and server.
 *
 * The fallback path (seed data / backend unreachable / valuation not yet
 * loaded) therefore produces the same numbers the backend would produce given
 * the same inputs: statements when the page has them, else a single-year
 * snapshot grounding — exactly how the backend treats a name with one year of
 * ingested history.
 *
 * Exports kept for the app: isFinancial, fundamentals, blendedValuation.
 */
import * as engine from "./engine.js";
import { deriveClientAssumptions } from "./derive.js";

/**
 * Single, central definition of "is this a financial firm?".
 * Every panel (screener, header, DCF tab, recommendation) must agree on which
 * model is used (Residual Income vs FCFF DCF).
 */
export function isFinancial(co) {
  if (!co) return false;
  if (co.type === "financial") return true;
  return ["NBFC", "BANK", "INSURANCE"].includes(co.template_code);
}

// ── Snapshot fundamentals (display ratios — not valuation math) ─────────────
export function fundamentals(co) {
  const equity = co.equity;
  const shares = co.shares;
  const pat    = co.netProfit;
  const haveBook = equity != null && shares > 0;
  const bvps   = haveBook ? equity / shares : null;
  const eps    = pat != null && shares > 0 ? pat / shares : null;
  // P/E and P/B are "not meaningful" when the denominator is ≤ 0 (loss-making
  // or negative book value). Return null in those cases so the UI shows N/M
  // instead of a misleading negative or near-zero multiple.
  // Also require a real positive price: in JS `null / eps === 0`, so a missing
  // price was silently rendering P/E 0.0x / P/B 0.0x instead of "—".
  const px  = co.price > 0 ? co.price : null;
  const pe  = px != null && eps != null && eps > 0 ? px / eps : null;
  const pb  = px != null && bvps != null && bvps > 0 ? px / bvps : null;
  const roe = pat != null && equity > 0 ? pat / equity : null;
  return { bvps, eps, pb, pe, roe };
}

// ── Blended fair value — the ONE client fallback number ─────────────────────
/**
 * Blended intrinsic via the parity-locked engine. `a` may carry ENGINE-dialect
 * (snake_case) overrides — e.g. a backend-seeded scenario — which win over the
 * derived block; stale camelCase seed assumptions deliberately cannot skew the
 * base case (derive.js grounds in the company's own reported numbers instead).
 *
 * Return shape kept compatible with recommend.js:
 *   { v, blended, components, fundamental, assumptions, analyst,
 *     consensusValue, flags }
 * The analyst consensus is returned alongside for display — never blended.
 */
export function blendedValuation(co, a) {
  const assumptions = deriveClientAssumptions(co, a);
  const coE = engine.toEngineCo(co, co.price);
  const eb = engine.blended(coE, assumptions);

  const an = co.analyst;
  let consensusValue = null;
  const flags = [];
  if (an && an.target > 0) {
    consensusValue = an.target;
    if (eb.blended > 0) {
      const gap = eb.blended / an.target - 1;
      if (gap < -0.15) flags.push("model_below_consensus");
      else if (gap > 0.15) flags.push("model_above_consensus");
    }
  }

  return {
    v: eb.valuation,
    blended: eb.blended,
    components: eb.components,
    fundamental: eb.blended,
    assumptions,
    analyst: an || null,
    consensusValue,
    flags,
  };
}
