/* Composite recommendation:
   45% valuation (MoS-driven) + 28% quality + 14% momentum + 13% risk.
   Returns { v, f, t, mos, reasons[], composite, verdict }. */

import { fmt, pct, safe } from "./formatters.js";
import { valuate, fundamentals } from "./valuation.js";
import { technicals } from "./technicals.js";

export function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

export function recommend(co, a) {
  const v = valuate(co, a);
  const f = fundamentals(co);
  const t = technicals(co);
  const mos = (v.intrinsic - co.price) / co.price;
  const reasons = [];

  // Valuation
  reasons.push({
    label: "Valuation",
    score: clamp(50 + mos * 100, 0, 100),
    note: `${pct(mos)} MoS vs intrinsic ₹${fmt(v.intrinsic)}`,
    good: mos > 0.1,
    bad:  mos < -0.1,
  });

  // Quality — sector-specific weighting
  let quality, qnote;
  if (co.type === "financial") {
    quality =
      0.5 * clamp((safe(f.roe, 0.12) - 0.10) / 0.15 * 100, 0, 100) +
      0.3 * clamp((0.05 - safe(co.nbfc?.gnpa, 0.03)) / 0.05 * 100, 0, 100) +
      0.2 * clamp((safe(co.nbfc?.crar, 0.18) - 0.15) / 0.15 * 100, 0, 100);
    qnote = `ROE ${pct(f.roe)}, GNPA ${pct(safe(co.nbfc?.gnpa, 0.03), 2)}, CRAR ${pct(safe(co.nbfc?.crar, 0.18))}`;
  } else {
    quality =
      0.45 * clamp((safe(f.roe, 0.12) - 0.10) / 0.15 * 100, 0, 100) +
      0.35 * clamp(safe(a.ebitMargin, 0.12) / 0.20 * 100, 0, 100) +
      0.2  * clamp((0.3 - safe(a.debtWeight || co.fcff?.debtWeight, 0.20)) / 0.3 * 100, 0, 100);
    qnote = `ROE ${pct(f.roe)}, EBIT margin ${pct(safe(a.ebitMargin, 0.12))}`;
  }
  reasons.push({ label: "Quality", score: quality, note: qnote, good: quality > 60, bad: quality < 40 });

  // Momentum
  let mom = 50;
  if (t.aboveSMA50) mom += 18;
  if (t.aboveSMA20) mom += 10;
  if (t.rsi > 70) mom -= 15;
  if (t.rsi < 30) mom += 8;
  mom = clamp(mom, 0, 100);
  reasons.push({
    label: "Momentum",
    score: mom,
    note: `${t.aboveSMA50 ? "Above" : "Below"} 50-DMA, RSI ${fmt(t.rsi)}`,
    good: t.aboveSMA50,
    bad: !t.aboveSMA50,
  });

  // Risk
  let risk = 0;
  const flags = [];
  if (co.type === "financial") {
    if (safe(co.nbfc?.gnpa, 0.03) > 0.04) { risk += 25; flags.push("Elevated GNPA"); }
    if (safe(co.nbfc?.crar, 0.18) < 0.16) { risk += 20; flags.push("Thin CRAR"); }
  } else {
    if (safe(a.debtWeight || co.fcff?.debtWeight, 0.20) > 0.4) {
      risk += 25; flags.push("High leverage");
    }
  }
  if (mos < -0.25) { risk += 15; flags.push("Trading above intrinsic"); }
  const rs = 100 - clamp(risk, 0, 100);
  reasons.push({
    label: "Risk",
    score: rs,
    note: flags.length ? flags.join(", ") : "No major flags",
    good: flags.length === 0,
    bad: flags.length >= 2,
  });

  const composite = 0.45 * reasons[0].score + 0.28 * quality + 0.14 * mom + 0.13 * rs;
  return {
    v, f, t, mos, reasons, composite,
    verdict: composite >= 65 ? "BUY" : composite >= 45 ? "HOLD" : "AVOID",
  };
}
