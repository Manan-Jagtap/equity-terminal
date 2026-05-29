/* Design tokens — Equity Terminal.
   Warm ink palette matching the reference design exactly.
   Single source of truth for all colors and fonts. */

export const C = {
  // Ink scale (warm near-black, brownish tint)
  bg:      "#0a0907",   // ink-950
  bg900:   "#100e0a",   // ink-900
  bg800:   "#181510",   // ink-800
  bg700:   "#211d17",   // ink-700
  bg600:   "#2c2820",   // ink-600
  bg500:   "#3a3528",   // ink-500
  bg400:   "#5b5440",   // ink-400

  // Text scale
  text:    "#dcd5c1",   // ink-100
  text200: "#b8b09a",   // ink-200
  dim:     "#857d65",   // ink-300
  faint:   "#5b5440",   // ink-400
  vfaint:  "#3a3528",   // ink-500

  // Gold scale
  gold:    "#d4a93e",   // gold-400
  gold500: "#c89a39",   // gold-500
  gold600: "#a07d2c",   // gold-600
  gold700: "#7c5e1f",   // gold-700
  goldDim: "#a07d2c",

  // Signal colors
  green:   "#7aa87a",   // pos-400
  green500:"#5a8f5a",   // pos-500
  red:     "#c46f65",   // neg-400
  red500:  "#a85148",   // neg-500

  // Borders
  line:    "rgba(220,213,193,0.08)",   // hairline
  line2:   "rgba(220,213,193,0.12)",   // slightly more visible
};

// Gradient helpers
export const gridBg = {
  backgroundImage: `
    linear-gradient(rgba(220,213,193,.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(220,213,193,.025) 1px, transparent 1px)`,
  backgroundSize: "56px 56px",
};

export const mono  = { fontFamily: "'JetBrains Mono',monospace", fontVariantNumeric: "tabular-nums" };
export const serif = { fontFamily: "'Instrument Serif','Georgia',serif" };
export const sans  = { fontFamily: "'Inter',-apple-system,system-ui,sans-serif" };
