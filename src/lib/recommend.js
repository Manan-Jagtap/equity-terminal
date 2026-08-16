/**
 * recommend.js — Composite recommendation engine (confidence-gated).
 *
 * ⚠️  PARITY CONTRACT (ARC-01/ARC-07): this ladder must emit the SAME VERDICT
 *     STRING as app/engines.recommend for the same company + assumptions. It is
 *     not decorative — valuationView() runs it for every seed/offline row (the
 *     whole screener whenever /api/companies fails) and Company.jsx runs it for
 *     the header while /api/companies/{ticker} loads, so a drifting band puts a
 *     different word on the same name depending on which path rendered it.
 *     Pinned by tests/verdictParity.mjs (113 backend-generated cases).
 *
 * Design principles (post-review):
 *  1. ONE intrinsic value: the blended value from valuation.js. Header, screener
 *     and DCF tab all read this same number — they can never disagree.
 *  2. The engine can say "no". When the intrinsic can't be computed cleanly, or
 *     data confidence is low, the verdict is "NO DATA" (or "LOW CONF"), never a
 *     confident BUY on a fabricated input.
 *  3. The composite is multiplied by data confidence, so weak data can never
 *     produce a strong score. BUY is deliberately rare and demanding.
 *
 * Weights (of the quality-of-thesis sub-scores): 42% valuation · 28% quality
 *  · 16% momentum · 14% risk. Final = (weighted sub-scores) × confidence.
 *
 * DELIBERATELY NOT MIRRORED (ticker-keyed overrides, exactly as the backend's
 * own generator excludes them from this contract): alt_models presets (SOTP /
 * P-EV) and their DAT-03 divergence guard, _CONGLOMERATES, _FEE_FINANCIALS.
 * Those key off a hand-maintained ticker list the client has no copy of; a
 * half-ported list would disagree with the server MORE often than no port at
 * all, and every one of them only ever RELAXES a call to LOW CONF, so the
 * client's worst case here is a call the server is more cautious about. The
 * conviction legs (tv_share / sensitivity_swing) are likewise not mirrored:
 * they only cap the DISPLAYED confidence to medium and cannot move the verdict
 * on either side.
 */
import { blendedValuation, fundamentals, isFinancial } from "./valuation.js";
import { gordonPbValue, params } from "./engine.js";
import { technicals } from "./technicals.js";
import { dataQuality } from "./dataQuality.js";

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

/** DAT-13b: does an INDEPENDENT leg agree a collapsed fair value is right about
 *  DIRECTION? Mirror of engines.collapse_corroborated — same three legs in the
 *  same order (a relative multiple also below price; a premium to book earned
 *  with sub-sector returns; net debt above the whole equity market value). When
 *  nothing corroborates, the backend abstains rather than launder a broken
 *  number into a call, and so must we. */
function collapseCorroborated(co, f, components, valuationSector) {
  const price = co.price;
  if (!(price > 0)) return false;
  for (const c of components || []) {
    if (c.method === "Exit Multiple" || c.method === "P/E (sector)") {
      if (c.value != null && c.value > 0 && c.value < price) return true;
    }
  }
  const matureRoe = params(valuationSector).mature_roe;
  if (f.pb != null && f.roe != null && matureRoe
      && f.pb > 3.0 && f.roe < 1.0 * matureRoe) return true;
  const nd = co.netDebt, sh = co.shares;
  if (nd && sh && nd > 1.0 * price * sh) return true;
  return false;
}

export function recommend(co, a) {
  const fin   = isFinancial(co);
  const blend = blendedValuation(co, a);
  const v     = blend.v;
  const ivRaw = blend.blended;
  let   iv    = isFinite(ivRaw) && ivRaw > 0 ? ivRaw : null;
  const f     = fundamentals(co);
  const t     = technicals(co);
  const conf  = dataQuality(co);
  // The DERIVED assumption block (lib/derive.js — the backend's own derivation
  // run locally): grounded margin / leverage for the quality & risk legs, in
  // place of whatever the caller's seed assumptions guessed.
  const da    = blend.assumptions || {};
  const ebitMargin = da.ebit_margin ?? a?.ebitMargin ?? 0.12;
  // Fallback 0.20, not 0.25 — engines.recommend reads safe(a["debt_weight"], 0.20)
  // for BOTH the quality and risk legs, and a 0.25 stand-in put the two ports on
  // different leverage whenever derive.js returned nothing.
  const debtWeight = da.debt_weight ?? a?.debtWeight ?? 0.20;
  const components = blend.components || [];

  // DAT-14: a negative primary DCF zeroes `iv`. The backend does NOT abstain
  // there — it falls back to its own RELATIVE legs (>= 2 positive ones, so one
  // stray multiple can't carry a name) and forces the result to LOW CONF below:
  // a no-call with a reference number, never a published conviction. Without
  // this the client showed "NO DATA" where the server showed a figure.
  let relativeOnly = false;
  if (iv == null) {
    const rel = components
      .filter((c) => (c.method === "Exit Multiple" || c.method === "P/E (sector)")
                     && c.value != null && c.value > 0)
      .map((c) => c.value);
    if (rel.length >= 2) {
      iv = rel.reduce((s, x) => s + x, 0) / rel.length;
      relativeOnly = true;
    }
  }

  const mos = iv != null && co.price > 0 ? (iv - co.price) / co.price : null;
  let reliable = iv != null && conf.score >= 0.5;

  const reasons = [];

  // 1. Valuation (42%) — gentler MoS→score curve so it does not saturate at
  //    just +50% MoS the way the old version did. ~+100% MoS ≈ 90/100.
  const valScore = mos == null ? 50 : clamp(50 + mos * 45, 0, 100);
  reasons.push({
    label: "Valuation",
    score: valScore,
    note: mos == null
      ? "Intrinsic value not computable from available data"
      : `${(mos * 100).toFixed(1)}% MoS vs blended intrinsic ₹${Math.round(iv)}`,
    good: mos != null && mos > 0.15,
    bad:  mos != null && mos < -0.10,
    weight: 0.42,
  });

  // 2. Quality (28%) — leg weights are the backend's (0.5/0.3/0.2 for a lender,
  //    0.45/0.35/0.2 otherwise) and the leverage leg scores against a 0.30 debt
  //    weight, not 0.50. The client's own split scored every levered industrial
  //    several points too kindly, which pushed names across the >= 58
  //    ACCUMULATE line the server kept at HOLD.
  let quality, qnote;
  if (fin) {
    quality =
      0.50 * clamp(((f.roe ?? 0.12) - 0.10) / 0.15 * 100, 0, 100) +
      0.30 * clamp((0.05 - (co.nbfc?.gnpa ?? 0.03)) / 0.05 * 100, 0, 100) +
      0.20 * clamp(((co.nbfc?.crar ?? 0.18) - 0.15) / 0.15 * 100, 0, 100);
    qnote = `ROE ${((f.roe || 0) * 100).toFixed(1)}%, GNPA ${((co.nbfc?.gnpa || 0.03) * 100).toFixed(2)}%, CRAR ${((co.nbfc?.crar || 0.18) * 100).toFixed(1)}%`;
  } else {
    quality =
      0.45 * clamp(((f.roe ?? 0.12) - 0.10) / 0.15 * 100, 0, 100) +
      0.35 * clamp(ebitMargin / 0.20 * 100, 0, 100) +
      0.20 * clamp((0.3 - debtWeight) / 0.3 * 100, 0, 100);
    qnote = `ROE ${((f.roe || 0) * 100).toFixed(1)}%, EBIT margin ${(ebitMargin * 100).toFixed(1)}%`;
  }
  reasons.push({ label: "Quality", score: clamp(quality, 0, 100), note: qnote, good: quality > 60, bad: quality < 40, weight: 0.28 });

  // 3. Momentum (16%) — NEUTRAL when the series is synthetic or absent. The
  //    synthetic walk trends gently upward by construction, so reading momentum
  //    off it fabricates a bullish above-50-DMA signal on a name with no real
  //    OHLC; the backend scores 50 there and the client was scoring the walk.
  let mom = 50;
  if (co.syntheticSeries || t.last == null) {
    reasons.push({
      label: "Momentum", score: mom,
      note: "Insufficient real price history — momentum neutral",
      good: false, bad: false, weight: 0.16,
    });
  } else {
    if (t.aboveSMA50) mom += 18;
    if (t.aboveSMA20) mom += 10;
    if (t.rsi > 70)   mom -= 15;
    if (t.rsi < 30)   mom += 8;   // backend credits 8, not 10, for an oversold tape
    mom = clamp(mom, 0, 100);
    reasons.push({
      label: "Momentum",
      score: mom,
      note: `${t.aboveSMA50 ? "Above" : "Below"} 50-DMA, RSI ${t.rsi.toFixed(0)}`,
      good: t.aboveSMA50, bad: !t.aboveSMA50, weight: 0.16,
    });
  }

  // 4. Risk (14%) — the leverage flag trips at the backend's 0.40 debt weight
  //    (was 0.45, which silently forgave the whole 0.40-0.45 band), and there is
  //    no NIM leg: engines.recommend flags GNPA and CRAR only, so the client's
  //    extra "Thin NIM" penalty was docking every low-NIM bank 15 risk points
  //    the server never charged.
  let risk = 0; const flags = [];
  if (fin) {
    if ((co.nbfc?.gnpa ?? 0.03) > 0.04) { risk += 25; flags.push("Elevated GNPA"); }
    if ((co.nbfc?.crar ?? 0.18) < 0.16) { risk += 20; flags.push("Thin capital adequacy"); }
  } else {
    if (debtWeight > 0.40)  { risk += 25; flags.push("High leverage"); }
  }
  if (mos != null && mos < -0.30) { risk += 15; flags.push("Significantly overvalued"); }
  if (co.netProfit != null && co.netProfit < 0) { risk += 25; flags.push("Loss-making"); }
  const rs = 100 - clamp(risk, 0, 100);
  reasons.push({ label: "Risk", score: rs, note: flags.length ? flags.join(", ") : "No major flags", good: flags.length === 0, bad: flags.length >= 2, weight: 0.14 });

  // Composite of the sub-scores, then scaled by data confidence.
  const rawComposite = reasons.reduce((s, r) => s + r.score * r.weight, 0);
  const composite = reliable ? rawComposite * (0.6 + 0.4 * conf.score) : rawComposite * 0.5;

  // A genuinely HIGH-RETURN franchise (>= 16% ROE — reported, or the derived
  // franchise ROE for a bank/NBFC). The sector DCF is the leg known to
  // understate such names, so they read a real REDUCE ("richly valued, trim")
  // through the moderate-discount zone instead of a confident AVOID, and only an
  // EXTREME discount (< -45%) drops them to LOW CONF. The client had neither
  // band, so every premium compounder printed AVOID.
  const highRoe = (f.roe || 0) >= 0.16
    || (["BANK", "NBFC"].includes(da._valuation_sector)
        && Math.max(da.forecast_roe || 0, da.terminal_roe || 0) >= 0.16);

  // Verdict — demanding, and willing to say "no". Bands are FIX-18's, calibrated
  // against the 1,001-name groundtruth: AVOID starts at -18% (not the client's
  // stale -25%), and BUY CAPS at +50% — beyond that the size of the claimed
  // upside is itself the risk, so the top label steps down to ACCUMULATE.
  // Confidence LEVEL is deliberately not a BUY condition: engines.recommend
  // gates on conf.score >= 0.5 only, and the client's extra `level === "high"`
  // test demoted every medium-confidence BUY the server published.
  let verdict;
  if (iv == null)            verdict = "NO DATA";
  // THE COERCION BUG: `mos` is null for a name with no live price, and the old
  // chain fell through to `else if (mos >= -0.10)` — where JS coerces
  // `null >= -0.10` to TRUE — so a priceless name read a confident HOLD. The
  // backend answers NO DATA (it has an intrinsic but no usable price); this
  // branch is explicit so no later comparison can ever see a null again.
  else if (mos == null)      verdict = "NO DATA";
  else if (conf.score < 0.5) verdict = "LOW CONF";
  else if (composite >= 68 && mos > 0.15 && mos <= 0.50) verdict = "BUY";
  else if (composite >= 58 && mos > 0.05)  verdict = "ACCUMULATE";
  else if (mos >= -0.10)                   verdict = "HOLD";
  // ARC-01: backend engines.recommend emits "REDUCE" here, not "TRIM" — this
  // client mirror had drifted (the parity harness covers valuation math, not the
  // verdict string), so the fallback verdict could disagree with the server.
  else if (mos >= -0.18)                   verdict = "REDUCE";
  else if (mos >= -0.45 && highRoe)        verdict = "REDUCE";
  else                                     verdict = "AVOID";

  // Mirrors backend engines.recommend's lender divergence gate: a financial the
  // model values 80%+ above the market is a large disagreement (the RI model is
  // trusting a forecast ROE the market discounts for reasons it can't see), so
  // it is never a confident BUY. FIX-10: the call is KEPT when a SECOND,
  // independent leg agrees — the Gordon-growth justified P/B also lands >= 1.25x
  // price. The client had the gate but not the corroboration, so it abstained on
  // exactly the PSU lenders (PFC/RECLTD/LICHSGFIN) the server publishes.
  if (fin && mos != null && mos >= 0.80 && (verdict === "BUY" || verdict === "ACCUMULATE")) {
    // engine.gordonPbValue reads ke/bvps0 off `v` and the terminal ROE/growth
    // off the assumptions — it never touches `co`, so pass null rather than
    // hand it the client's camelCase shape and hide a future mismatch.
    const gpb = gordonPbValue(null, da, v);
    const corroborated = gpb != null && co.price > 0 && gpb >= 1.25 * co.price;
    if (corroborated) {
      reasons.push({ label: "Corroboration", score: 70, weight: 0,
                     note: `Two independent legs agree cheap: blend ${(mos * 100).toFixed(0)}% below ` +
                           `intrinsic AND Gordon-growth justified P/B ₹${gpb.toFixed(0)} >= 1.25× price. ` +
                           "Call kept (not gate-cleared).", good: true, bad: false });
    } else {
      verdict = "LOW CONF";
    }
  }

  // Model-reliability chain — the backend's `elif` ladder, minus the ticker-keyed
  // members documented at the top of this file. Each says the same thing: the
  // intrinsic model does not fit this name, so publish a no-call, not a number.
  if (da._valuation_sector === "INSURANCE") {
    // Life insurers are worth their EMBEDDED VALUE (future profit on in-force
    // policies), which is not on the balance sheet — RI/P-B/P-E all structurally
    // understate them, so a confident AVOID here would be a modelling artefact.
    verdict = "LOW CONF"; reliable = false;
    reasons.push({ label: "Model", score: 50, weight: 0, good: false, bad: true,
                   note: "Life insurer — value is embedded value, not book; RI/P-B/P-E understate it." });
  } else if (f.roe != null && f.roe < 0.04) {
    // Negligible OR NEGATIVE returns (pre-profit growth names and outright
    // loss-makers). A DCF/RI built on near-zero earnings is meaningless, and a
    // loss-maker is MORE unreliable than a 3%-ROE name — not less — so it must
    // not fall through to a confident AVOID either.
    verdict = "LOW CONF"; reliable = false;
    reasons.push({ label: "Model", score: 50, weight: 0, good: false, bad: true,
                   note: "Negligible or negative current earnings — intrinsic model unreliable." });
  } else if (mos != null && mos > 1.0) {
    // Mirrors backend engines.recommend (DAT-02): an intrinsic more than DOUBLE
    // the price from a generic sector model is more likely mis-modeled than a
    // hidden multi-bagger (was 2.0; tightened with the backend).
    verdict = "LOW CONF"; reliable = false;
    reasons.push({ label: "Model", score: 50, weight: 0, good: false, bad: true,
                   note: `Implausible margin of safety (${(mos * 100).toFixed(0)}%) — the sector model ` +
                         "likely doesn't fit this name's economics." });
  } else if (mos != null && mos < -0.45 && highRoe) {
    // Mirror of the +100% gate for extreme DOWNSIDE: a model valuing a genuinely
    // high-return franchise 45%+ below price is far more likely understating a
    // premium compounder than catching a real overvaluation (the Nestlé / HUL /
    // Colgate false-AVOID cohort). Low-return names at a premium keep their AVOID.
    verdict = "LOW CONF"; reliable = false;
    reasons.push({ label: "Model", score: 50, weight: 0, good: false, bad: true,
                   note: `Model values a high-return franchise ${(mos * 100).toFixed(0)}% below price — ` +
                         "a single-sector DCF often understates premium compounders." });
  }

  // How far the engine's OWN methods disagree (max/min across the WEIGHTED,
  // positive legs) — the input to both corroboration gates below.
  const wvals = components.filter((c) => c.value && c.value > 0 && (c.weight || 0) > 0)
                          .map((c) => c.value);
  const dispersion = wvals.length >= 2 ? Math.max(...wvals) / Math.min(...wvals) : null;

  // VAL-01 corroboration band. A NON-financial the generic sector model places
  // 50-100% above market keeps a confident BUY/ACC only when the engine's own
  // evidence corroborates it: the weighted methods broadly agree (<= 2.5x, the
  // tolerance calibrated on the audit sample) AND the market-anchored sector-P/E
  // cross-check itself clears the price. The +60..+100% hole shipped 27
  // confident calls (AWL "BUY +91%" with its own methods disagreeing 15x) before
  // this gate; the client had no mirror of it at all.
  if ((verdict === "BUY" || verdict === "ACCUMULATE") && !fin && mos != null && mos > 0.50) {
    const peLeg = components.find((c) => c.method === "P/E (sector)")?.value ?? null;
    const peOk = Boolean(peLeg && co.price > 0 && peLeg >= co.price);
    if (dispersion == null || dispersion > 2.5 || !peOk) {
      verdict = "LOW CONF"; reliable = false;
      reasons.push({ label: "Model", score: 50, weight: 0, good: false, bad: true,
                     note: `Large upside (${(mos * 100).toFixed(0)}%) without corroboration — ` +
                           "not a confident call." });
    }
  }

  // VAL-04: no confident BUY when the engine's own methods disagree > 2.5x. The
  // fair value isn't corroborated, so the strongest label isn't available —
  // ACCUMULATE and below are untouched, exactly as on the server.
  if (verdict === "BUY" && dispersion != null && dispersion > 2.5) {
    verdict = "LOW CONF"; reliable = false;
    reasons.push({ label: "Conviction", score: 45, weight: 0, good: false, bad: true,
                   note: `Engine methods disagree ${dispersion.toFixed(1)}× (> 2.5×) — the fair value ` +
                         "isn't corroborated, so this is not a confident BUY." });
  }

  // DAT-13: COLLAPSED fair value — intrinsic below 10% of price. The symmetric
  // twin of the implausible-upside cliff: a one-size model claiming a business
  // is worth almost nothing is wrong more often than the market. When an
  // independent leg corroborates the DIRECTION the backend keeps the call and
  // withholds only the number (a presentation contract the client honours via
  // engineView's suppression path); when nothing does, it abstains — and that
  // abstention is a verdict change the client was missing.
  if (mos != null && mos <= -0.90 && verdict !== "NO DATA"
      && !collapseCorroborated(co, f, components, da._valuation_sector)) {
    verdict = "LOW CONF"; reliable = false;
    reasons.push({ label: "Conviction", score: 40, weight: 0, good: false, bad: true,
                   note: "Fair value is under 10% of the market price and no independent method " +
                         "corroborates it — a no-call." });
  }

  // DAT-14: a relative-only value is a REFERENCE, never a conviction — the
  // primary model failed outright for this name, so the label is forced to LOW
  // CONF regardless of what the composite scored.
  if (relativeOnly && verdict !== "NO DATA") {
    verdict = "LOW CONF"; reliable = false;
    reasons.push({ label: "Fair value", score: 35, weight: 0, good: false, bad: true,
                   note: "The primary DCF is unusable for this name, so this figure comes only from " +
                         "relative multiples. A reference range, not a call." });
  }

  return {
    v,
    blended: blend,
    f, t, mos, reasons,
    composite,
    iv,
    confidence: conf,
    reliable,
    verdict,
  };
}
