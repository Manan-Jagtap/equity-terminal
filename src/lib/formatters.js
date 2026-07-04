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
