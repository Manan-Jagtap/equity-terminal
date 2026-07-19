/**
 * recommend.js — Composite recommendation engine (confidence-gated).
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
 */
import { blendedValuation, fundamentals, isFinancial } from "./valuation.js";
import { technicals } from "./technicals.js";
import { dataQuality } from "./dataQuality.js";

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

export function recommend(co, a) {
  const fin   = isFinancial(co);
  const blend = blendedValuation(co, a);
  const v     = blend.v;
  const ivRaw = blend.blended;
  const iv    = isFinite(ivRaw) && ivRaw > 0 ? ivRaw : null;
  const f     = fundamentals(co);
  const t     = technicals(co);
  const conf  = dataQuality(co);
  // The DERIVED assumption block (lib/derive.js — the backend's own derivation
  // run locally): grounded margin / leverage for the quality & risk legs, in
  // place of whatever the caller's seed assumptions guessed.
  const da    = blend.assumptions || {};
  const ebitMargin = da.ebit_margin ?? a?.ebitMargin ?? 0.12;
  const debtWeight = da.debt_weight ?? a?.debtWeight ?? 0.25;

  const mos = iv != null && co.price > 0 ? (iv - co.price) / co.price : null;
  const reliable = iv != null && conf.score >= 0.5;

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

  // 2. Quality (28%)
  let quality, qnote;
  if (fin) {
    quality =
      0.45 * clamp(((f.roe ?? 0.12) - 0.10) / 0.15 * 100, 0, 100) +
      0.30 * clamp((0.05 - (co.nbfc?.gnpa ?? 0.03)) / 0.05 * 100, 0, 100) +
      0.25 * clamp(((co.nbfc?.crar ?? 0.18) - 0.15) / 0.15 * 100, 0, 100);
    qnote = `ROE ${((f.roe || 0) * 100).toFixed(1)}%, GNPA ${((co.nbfc?.gnpa || 0.03) * 100).toFixed(2)}%, CRAR ${((co.nbfc?.crar || 0.18) * 100).toFixed(1)}%`;
  } else {
    quality =
      0.40 * clamp(((f.roe ?? 0.12) - 0.10) / 0.15 * 100, 0, 100) +
      0.35 * clamp(ebitMargin / 0.20 * 100, 0, 100) +
      0.25 * clamp((0.5 - debtWeight) / 0.5 * 100, 0, 100);
    qnote = `ROE ${((f.roe || 0) * 100).toFixed(1)}%, EBIT margin ${(ebitMargin * 100).toFixed(1)}%`;
  }
  reasons.push({ label: "Quality", score: clamp(quality, 0, 100), note: qnote, good: quality > 60, bad: quality < 40, weight: 0.28 });

  // 3. Momentum (16%) — note: only trustworthy when price history is real.
  let mom = 50;
  if (t.aboveSMA50) mom += 18;
  if (t.aboveSMA20) mom += 10;
  if (t.rsi > 70)   mom -= 15;
  if (t.rsi < 30)   mom += 10;
  mom = clamp(mom, 0, 100);
  reasons.push({
    label: "Momentum",
    score: mom,
    note: co.syntheticSeries
      ? "Synthetic price history — momentum not reliable"
      : `${t.aboveSMA50 ? "Above" : "Below"} 50-DMA, RSI ${t.rsi.toFixed(0)}`,
    good: t.aboveSMA50, bad: !t.aboveSMA50, weight: 0.16,
  });

  // 4. Risk (14%)
  let risk = 0; const flags = [];
  if (fin) {
    if ((co.nbfc?.gnpa ?? 0.03) > 0.04) { risk += 25; flags.push("Elevated GNPA"); }
    if ((co.nbfc?.crar ?? 0.18) < 0.16) { risk += 20; flags.push("Thin CRAR"); }
    if ((co.nbfc?.nim ?? 0.09) < 0.07)  { risk += 15; flags.push("Thin NIM"); }
  } else {
    if (debtWeight > 0.45)  { risk += 25; flags.push("High leverage"); }
  }
  if (mos != null && mos < -0.30) { risk += 15; flags.push("Significantly overvalued"); }
  if (co.netProfit != null && co.netProfit < 0) { risk += 25; flags.push("Loss-making"); }
  const rs = 100 - clamp(risk, 0, 100);
  reasons.push({ label: "Risk", score: rs, note: flags.length ? flags.join(", ") : "No major flags", good: flags.length === 0, bad: flags.length >= 2, weight: 0.14 });

  // Composite of the sub-scores, then scaled by data confidence.
  const rawComposite = reasons.reduce((s, r) => s + r.score * r.weight, 0);
  const composite = reliable ? rawComposite * (0.6 + 0.4 * conf.score) : rawComposite * 0.5;

  // Verdict — demanding, and willing to say "no".
  // A BUY now requires HIGH data confidence (not just "present"); medium-
  // confidence names cap at ACCUMULATE so a thin-data estimate can't shout BUY.
  let verdict;
  if (iv == null)            verdict = "NO DATA";
  else if (conf.score < 0.5) verdict = "LOW CONF";
  // Mirrors backend engines.recommend: an intrinsic >3x price from a generic
  // sector model is more likely mis-modeled than a hidden multi-bagger.
  else if (mos != null && mos > 2.0)       verdict = "LOW CONF";
  else if (composite >= 68 && mos > 0.15 && conf.level === "high") verdict = "BUY";
  else if (composite >= 58 && mos > 0.05)  verdict = "ACCUMULATE";
  else if (mos >= -0.10)                   verdict = "HOLD";
  // ARC-01: backend engines.recommend emits "REDUCE" here, not "TRIM" — this
  // client mirror had drifted (the parity harness covers valuation math, not the
  // verdict string), so the fallback verdict could disagree with the server.
  else if (mos >= -0.25)                   verdict = "REDUCE";
  else                                     verdict = "AVOID";
  // Mirrors backend engines.recommend's lender divergence gate: a financial
  // showing an extreme MoS is far more likely mis-modeled (book quality,
  // regulatory overhang) than a giveaway — never a confident BUY.
  if (fin && mos != null && mos >= 0.80 && (verdict === "BUY" || verdict === "ACCUMULATE"))
    verdict = "LOW CONF";

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
