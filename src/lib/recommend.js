/**
 * recommend.js — Composite recommendation engine.
 *
 * Weights: 40% valuation MoS · 30% quality · 18% momentum · 12% risk
 * Uses blendedValuation() for the intrinsic value component.
 */
import { blendedValuation, fundamentals } from "./valuation.js";
import { technicals } from "./technicals.js";

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

export function recommend(co, a) {
  const blend = blendedValuation(co, a);
  const v     = blend.v;
  const iv    = blend.blended;
  const f     = fundamentals(co);
  const t     = technicals(co);
  const mos   = (iv - co.price) / co.price;

  const reasons = [];

  // 1. Valuation (40%)
  reasons.push({
    label: "Valuation",
    score: clamp(50 + mos * 100, 0, 100),
    note:  `${(mos * 100).toFixed(1)}% MoS vs blended intrinsic ₹${Math.round(iv)}`,
    good: mos > 0.1,
    bad:  mos < -0.1,
    weight: 0.40,
  });

  // 2. Quality (30%)
  let quality, qnote;
  if (co.type === "financial") {
    quality =
      0.45 * clamp(((f.roe ?? 0.12) - 0.10) / 0.15 * 100, 0, 100) +
      0.30 * clamp((0.05 - (co.nbfc?.gnpa ?? 0.03)) / 0.05 * 100, 0, 100) +
      0.25 * clamp(((co.nbfc?.crar ?? 0.18) - 0.15) / 0.15 * 100, 0, 100);
    qnote = `ROE ${((f.roe||0)*100).toFixed(1)}%, GNPA ${((co.nbfc?.gnpa||0.03)*100).toFixed(2)}%, CRAR ${((co.nbfc?.crar||0.18)*100).toFixed(1)}%`;
  } else {
    quality =
      0.40 * clamp(((f.roe ?? 0.12) - 0.10) / 0.15 * 100, 0, 100) +
      0.35 * clamp((a.ebitMargin ?? 0.12) / 0.20 * 100, 0, 100) +
      0.25 * clamp((0.5 - (a.debtWeight ?? 0.25)) / 0.5 * 100, 0, 100);
    qnote = `ROE ${((f.roe||0)*100).toFixed(1)}%, EBIT margin ${((a.ebitMargin||0.12)*100).toFixed(1)}%`;
  }
  reasons.push({ label:"Quality", score:clamp(quality,0,100), note:qnote, good:quality>60, bad:quality<40, weight:0.30 });

  // 3. Momentum (18%)
  let mom = 50;
  if (t.aboveSMA50) mom += 18;
  if (t.aboveSMA20) mom += 10;
  if (t.rsi > 70)   mom -= 15;
  if (t.rsi < 30)   mom += 10;
  mom = clamp(mom, 0, 100);
  reasons.push({ label:"Momentum", score:mom, note:`${t.aboveSMA50?"Above":"Below"} 50-DMA, RSI ${t.rsi.toFixed(0)}`, good:t.aboveSMA50, bad:!t.aboveSMA50, weight:0.18 });

  // 4. Risk (12%)
  let risk = 0; const flags = [];
  if (co.type === "financial") {
    if ((co.nbfc?.gnpa ?? 0.03) > 0.04) { risk += 25; flags.push("Elevated GNPA"); }
    if ((co.nbfc?.crar ?? 0.18) < 0.16) { risk += 20; flags.push("Thin CRAR"); }
    if ((co.nbfc?.nim ?? 0.09) < 0.07)  { risk += 15; flags.push("Thin NIM"); }
  } else {
    if ((a.debtWeight ?? 0.25) > 0.45)  { risk += 25; flags.push("High leverage"); }
    if (mos < -0.30)                     { risk += 15; flags.push("Significantly overvalued"); }
  }
  const rs = 100 - clamp(risk, 0, 100);
  reasons.push({ label:"Risk", score:rs, note:flags.length?flags.join(", "):"No major flags", good:flags.length===0, bad:flags.length>=2, weight:0.12 });

  const composite = reasons.reduce((s, r) => s + r.score * r.weight, 0);

  return {
    v,
    blended: blend,
    f, t, mos, reasons, composite,
    iv,
    verdict: composite >= 65 ? "BUY" : composite >= 45 ? "HOLD" : "AVOID",
  };
}
