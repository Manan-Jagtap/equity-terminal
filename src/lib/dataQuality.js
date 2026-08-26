/**
 * dataQuality.js — the trust layer.
 *
 * A valuation is only as good as its inputs. This module inspects a company
 * record and returns a confidence score (0–1), a level (high/medium/low) and
 * a list of human-readable flags. The recommendation engine multiplies the
 * final score by this confidence and REFUSES to issue a strong verdict when
 * confidence is low — so the terminal never launders a guess into a "BUY".
 *
 * It also catches the single most dangerous class of bug for this product:
 * a live (split/bonus-adjusted) price paired with STALE per-share fundamentals,
 * which silently fabricates an "undervalued" signal (e.g. Bajaj Finance showing
 * P/E 3.4x / P/B 0.73x). We detect that as an implausible-multiple mismatch.
 */

import { isFinancial } from "./valuation.js";

// Same threshold as data_quality.py / data_integrity.py, so the trust layer,
// the integrity sweep and this mirror all agree on what "stale" means.
const STALE_PRICE_DAYS = 5;

export function dataQuality(co) {
  const flags = [];
  let score = 1.0;
  const fin = isFinancial(co);

  const penal = (amount, msg) => { score -= amount; flags.push(msg); };

  // ── Core fundamentals present? ─────────────────────────────────────
  if (!(co.equity > 0))      penal(0.35, "Book equity missing or non-positive");
  if (co.netProfit == null)  penal(0.25, "Net profit (PAT) not available");
  if (!(co.shares > 0))      penal(0.20, "Shares outstanding missing");
  if (!fin && co.revenue == null)  penal(0.15, "Revenue not available");
  if (!fin && co.netDebt == null)  penal(0.10, "Net debt not available");

  // ── Price history: real or synthetic? ──────────────────────────────
  if (co.syntheticSeries) penal(0.10, "Price history is synthetic — momentum/52W not from real OHLC");
  // Mirrors data_quality.py's `synthetic_price` penalty. The backend keeps a ₹1
  // sentinel price plus a synthetic_price flag; the API sends the client
  // price=null for that same state, so ABSENCE of a price is how the flag
  // arrives here. Without this the client scored a priceless name HIGH
  // confidence (score 1.0) while the server scored it 0.40 / LOW — the same row,
  // two different trust badges, and a composite 2× the server's.
  if (!(co.price > 0)) penal(0.60, "Live price unavailable — margin of safety vs price is not meaningful");

  // Mirrors data_quality.py's delisted / stale-price penalties. A price that
  // stopped updating is not a live price, and the extreme case is a security
  // that no longer exists: JBCHEPHARM (amalgamated into Torrent Pharma on
  // 8 Jul 2026) was rendering a 28-day-old quote at confidence 1.0 "high",
  // because nothing on either side looked at the AGE of the price — only at
  // whether one was present.
  //
  // Both shapes are accepted because `co` here is spread straight off the API
  // response in Company.jsx (snake_case survives) but other call sites build a
  // camelCased object. Reading both keeps the client and server scores equal
  // whichever path built the row — the exact divergence the price penalty above
  // was written to close.
  const staleDays = co.price_stale_days ?? co.priceStaleDays;
  if (co.delisted) {
    penal(0.60, "No longer listed — figures are historical, not current market data");
  } else if (typeof staleDays === "number" && staleDays > STALE_PRICE_DAYS) {
    penal(0.30, `Price is ${Math.round(staleDays)} days old — margin of safety vs price may be out of date`);
  }

  // ── Basis-consistency checks (the split/stale-data trap) ───────────
  let pb = null, pe = null, roe = null;
  if (co.equity > 0 && co.shares > 0 && co.price > 0) pb = co.price / (co.equity / co.shares);
  if (co.netProfit > 0 && co.shares > 0 && co.price > 0) pe = co.price / (co.netProfit / co.shares);
  if (co.netProfit != null && co.equity > 0) roe = co.netProfit / co.equity;

  if (pb != null && pb < 0.3)
    penal(0.45, `Implausibly low P/B (${pb.toFixed(2)}x) — price and book value look to be on different bases (possible split/bonus or stale data)`);
  else if (pb != null && pb > 45)
    penal(0.15, `Very high P/B (${pb.toFixed(1)}x) — verify book value`);
  if (pe != null && pe < 3)
    penal(0.45, `Implausibly low P/E (${pe.toFixed(1)}x) — earnings and price look mismatched (possible split/bonus or stale data)`);

  // Composite trap: a genuinely high-ROE company essentially never trades at a
  // very low P/E AND very low P/B at the same time — that co-occurrence is the
  // signature of stale/pre-split per-share data (the exact Bajaj Finance case:
  // ROE 21%, P/E 3.4x, P/B 0.73x). Strong penalty, but harmless for true value
  // stocks, which have LOW ROE.
  if (roe != null && roe > 0.18 && pb != null && pb < 1.6 && pe != null && pe < 8)
    penal(0.50, `High ROE (${(roe*100).toFixed(0)}%) alongside very low P/E (${pe.toFixed(1)}x) and P/B (${pb.toFixed(2)}x) — almost certainly a stale/split data mismatch`);

  if (co.netProfit != null && co.netProfit < 0)
    penal(0.30, "Loss-making — earnings-based multiples and DCF are unreliable");
  if (co.equity != null && co.equity < 0)
    penal(0.45, "Negative net worth — book/return-based valuation is not meaningful");

  // ── Explicit upstream warning (e.g. from the API adapter) ──────────
  if (co.dataWarning) penal(0.45, co.dataWarning);

  score = Math.max(0, Math.min(1, score));
  // DAT-02(c), mirrors data_quality.py: a synthetic price series can never be a
  // HIGH-confidence call — cap just under the high threshold.
  if (co.syntheticSeries) score = Math.min(score, 0.79);
  const level = score >= 0.8 ? "high" : score >= 0.5 ? "medium" : "low";

  return { score, level, flags };
}

export function confidenceColor(level, C) {
  if (level === "high")   return C.green;
  if (level === "medium") return C.gold;
  return C.red;
}
