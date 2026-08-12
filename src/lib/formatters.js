/* Display formatters. Pure, side-effect free, used everywhere. */

export const fmt = (n, d = 0) =>
  n == null || isNaN(n)
    ? "—"
    : n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });

export const inr = (n, d = 0) =>
  n == null || isNaN(n) ? "—" : "₹" + fmt(n, d);

export const pct = (n, d = 1) =>
  n == null || isNaN(n) ? "—" : (n * 100).toFixed(d) + "%";

export const cr = (n, d = 0) =>
  n == null || isNaN(n) ? "—" : fmt(n, d) + " cr";

export const safe = (v, d = 0) => v ?? d;

/* ── "Not meaningful" aware formatters ───────────────────────────────
   A valuation multiple is only meaningful when its denominator is
   positive. A negative or zero P/E (loss-making) or P/B (negative book
   equity) must NOT be printed as a number — it reads as if the stock is
   cheap when it is the opposite. We render "N/M" (not meaningful). */

export const isMeaningfulMultiple = (n) =>
  n != null && isFinite(n) && n > 0;

// A multiple (P/E, P/B, EV/EBITDA …). Returns "N/M" when ≤ 0 / null / ∞.
export const multiple = (n, d = 1) =>
  isMeaningfulMultiple(n) ? fmt(n, d) + "x" : "N/M";

// A ₹ value that can legitimately be unavailable.
export const inrOrDash = (n, d = 0) =>
  n == null || isNaN(n) || !isFinite(n) ? "—" : "₹" + fmt(n, d);

// Signed percent for margins of safety, changes, etc.
export const signedPct = (n, d = 1) =>
  n == null || isNaN(n) || !isFinite(n)
    ? "—"
    : (n >= 0 ? "+" : "") + (n * 100).toFixed(d) + "%";

/* Verdict display helpers. "LOW CONF" reads like a broken product; "NO CALL"
   reads like a judgment — which is what it is: the model knows this name needs
   a specialist approach and refuses to guess. API values are unchanged. */
export const verdictLabel = v => (v === "LOW CONF" ? "NO CALL" : v);
export const verdictTitle = v =>
  v === "LOW CONF"
    ? "No automated call: this name's economics need a specialist model (conglomerate, insurer, demerger, or an implausible model fit). We'd rather say nothing than something wrong."
    : v === "NO DATA"
    ? "Not enough verified data to value this name."
    : undefined;

/* Period-on-period growth, where the base may be NEGATIVE.
 *
 * `(current / prior - 1) * 100` is only meaningful off a POSITIVE base. Off a
 * negative one it silently inverts the sign, and the two lines that matter most
 * on a results table — Profit before tax and Net Profit — are exactly the ones
 * that go negative. Measured against real filings:
 *
 *   IDEA net profit  -5,286 -> +51,970 cr   a loss turning into a large profit
 *                                           rendered "-1083%" in RED
 *   YESBANK          -366   -> -559 cr      a loss DEEPENING by 53%
 *                                           rendered "+53%" in GREEN
 *
 * Both are the worst possible reading, and the Results screen additionally
 * SORTED on the number, so loss-makers ranked top of "PAT growth".
 *
 * So: describe the transition in words when a percentage would lie, and tell
 * the caller whether the figure is safe to rank on.
 *
 * Returns { txt, tone: "pos"|"neg"|"flat", sortable, pct }.
 * `tone` is intentionally semantic — the caller maps it to its own palette.
 */
export function growthOnBase(current, prior) {
  const c = Number(current), p = Number(prior);
  if (!isFinite(c) || !isFinite(p)) return { txt: "—", tone: "flat", sortable: false, pct: null };
  if (p === 0) return { txt: "n/m", tone: "flat", sortable: false, pct: null,
                        title: "No prior-period base to grow from." };
  if (p < 0) {
    // A percentage here would be sign-inverted. Say what actually happened.
    if (c >= 0) return { txt: "loss → profit", tone: "pos", sortable: false, pct: null,
                         title: `Turnaround: ${p.toFixed(0)} → ${c.toFixed(0)}. A percentage change off a negative base would print a negative number for an improvement, so it is withheld.` };
    const worse = c < p;
    return { txt: worse ? "loss widened" : "loss narrowed", tone: worse ? "neg" : "pos",
             sortable: false, pct: null,
             title: `${p.toFixed(0)} → ${c.toFixed(0)}. A percentage change off a negative base inverts its sign, so it is withheld.` };
  }
  if (c < 0) return { txt: "profit → loss", tone: "neg", sortable: false, pct: null,
                      title: `${p.toFixed(0)} → ${c.toFixed(0)}.` };
  const g = (c / p - 1) * 100;
  return { txt: (g >= 0 ? "+" : "") + g.toFixed(0) + "%", tone: g >= 0 ? "pos" : "neg",
           sortable: true, pct: g };
}
