/* Design tokens — JS mirror of tokens.css for components that need values in
   props (charts, motion springs). CSS custom properties remain the source of
   truth for anything CSS can express; THIS file must never diverge from it.
   Phase 0 of the redesign; the legacy theme.js keeps working until every
   component migrates (Phase 1–2). */

export const color = {
  bg: "#0a0907", bgRaise: "#12100d", bgOver: "#1a1713", bgInput: "#0e0c0a",
  text: "#f2ede4", text2: "#b7ad9d", text3: "#7d7566",
  line: "rgba(242,237,228,0.08)", line2: "rgba(242,237,228,0.14)",
  accent: "#e8b45a", accentDim: "#e8b45a33", accentInk: "#231a08",
  buy: "#57c48a", accumulate: "#8fbf6f", hold: "#c9a86a",
  reduce: "#d99a5b", avoid: "#d97b6c", nocall: "#8a8171",
  up: "#57c48a", down: "#d97b6c",
};

/* Verdict → token (single place; badge/label/sign pairing is the component's job) */
export const verdictColor = (v) => ({
  BUY: color.buy, ACCUMULATE: color.accumulate, HOLD: color.hold,
  REDUCE: color.reduce, AVOID: color.avoid,
}[v] || color.nocall);

export const font = {
  ui: '"Inter Variable", system-ui, -apple-system, sans-serif',
  mono: '"JetBrains Mono Variable", ui-monospace, SFMono-Regular, monospace',
};

export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 24, s6: 32, s7: 48, s8: 64 };
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 };

/* Motion: tight duration scale + shared springs (Framer/Motion configs).
   Rule: transforms/opacity only; honor prefers-reduced-motion at call sites
   via the useReducedMotion hook — these are the ONLY curves allowed. */
export const motionTokens = {
  duration: { fast: 0.12, base: 0.2, slow: 0.32 },
  ease: [0.22, 1, 0.36, 1],
  easeInOut: [0.65, 0, 0.35, 1],
  spring: { type: "spring", stiffness: 420, damping: 34, mass: 0.9 },   // interactive
  springSoft: { type: "spring", stiffness: 220, damping: 28 },          // entrances
};

/* Numeric formatting convention (applied EVERYWHERE; ties to .ev-num class):
   ₹ crore for company-scale sums, ₹ absolute for per-share, thousands via
   en-IN, explicit +/− signs on deltas, one decimal on percents. */
export const fmtNum = {
  inr: (v, d = 0) => v == null || isNaN(v) ? "—" :
    "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: d }),
  cr: (v) => v == null || isNaN(v) ? "—" :
    "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 }) + " cr",
  pct: (v, d = 1) => v == null || isNaN(v) ? "—" : (v * 100).toFixed(d) + "%",
  signedPct: (v, d = 1) => v == null || isNaN(v) ? "—" :
    (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(d) + "%",
};
