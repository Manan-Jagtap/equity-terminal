/* Display formatters. Pure, side-effect free, used everywhere. */

export const fmt = (n, d = 0) =>
  n == null || isNaN(n)
    ? "—"
    : n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });

export const inr = (n, d = 0) => "₹" + fmt(n, d);

export const pct = (n, d = 1) =>
  n == null || isNaN(n) ? "—" : (n * 100).toFixed(d) + "%";

export const cr = (n, d = 0) =>
  n == null || isNaN(n) ? "—" : fmt(n, d) + " cr";

export const safe = (v, d = 0) => v ?? d;
