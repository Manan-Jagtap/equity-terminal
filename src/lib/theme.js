/* Legacy theme adapter — Redesign Phase 2b.

   The "Aurora" palette is retired. This file keeps its STABLE SEMANTIC KEYS
   (that was always the contract: `gold` = primary accent) but every value now
   derives from the redesign tokens (src/design/tokens.css|js): warm obsidian,
   one amber accent, muted verdict-ladder signals, warm hairlines.

   New components must import src/design/tokens.js + components/ui directly;
   THIS adapter exists so the ~25 legacy screens re-skin without edits while
   they await structural rebuild. Do not add new keys here.               */

export const C = {
  // Surface scale (warm obsidian, progressively raised)
  bg:      "#0a0907",   // = --ev-bg
  bg900:   "#12100d",   // = --ev-bg-raise
  bg800:   "#1a1713",   // = --ev-bg-over
  bg700:   "#241f19",
  bg600:   "#2e2820",
  bg500:   "#3b3329",
  bg400:   "#4f4536",

  // Text scale (warm off-white)
  text:    "#f2ede4",   // = --ev-text        (15.9:1)
  text200: "#b7ad9d",   // = --ev-text-2      (8.3:1)
  dim:     "#9a9080",   //                     (~6.3:1)
  // UX-04 (WCAG 1.4.3) still holds: faint stays ≥4.5:1 on the base canvas.
  faint:   "#7d7566",   // = --ev-text-3      (4.6:1 — AA floor)
  vfaint:  "#453e33",   // decoration only — never body text (fails AA by design)

  // Primary accent — warm amber-gold (the key finally means what it says)
  gold:    "#e8b45a",   // = --ev-accent
  gold500: "#d9a24a",
  gold600: "#b8863a",
  gold700: "#8a6429",
  goldDim: "#b8863a",

  // Signal colors — muted verdict ladder, never neon
  green:   "#57c48a",   // = --ev-buy
  green500:"#3da46e",
  red:     "#d97b6c",   // = --ev-avoid
  red500:  "#c25f50",
  blue:    "#85a8c8",   // info (announcements, FCF lines) — desaturated steel

  // Panel surfaces
  panel:   "#12100d",   // = bg900
  panel2:  "#1a1713",   // = bg800

  // Borders — warm hairlines
  line:    "rgba(242,237,228,0.08)",   // = --ev-line
  line2:   "rgba(242,237,228,0.14)",   // = --ev-line-2
};

/* Categorical ramp for multi-series charts/chips — muted, warm-compatible,
   all ~equal perceived brightness on the obsidian base. Order matters:
   accent first, then maximally-separated hues. */
export const series = [
  "#e8b45a",  // amber (accent)
  "#57c48a",  // green
  "#85a8c8",  // steel blue
  "#9d8fd4",  // lavender
  "#d99a5b",  // amber-orange
  "#5fb3b3",  // teal
  "#b98fc9",  // orchid
  "#c9a86a",  // gold
  "#c98a94",  // rose
  "#a8a29a",  // warm steel
];

// Sector accent hues — kept per-sector for identity, but desaturated into the
// warm family so no sector shouts over the single amber brand accent.
const SECTOR_ACCENTS = [
  [/financial|bank|nbfc|insurance/, "#9d8fd4"],   // muted lavender — institutions
  [/tech|information/,              "#5fb3b3"],   // muted teal — software
  [/pharma|health/,                 "#57c48a"],   // buy green — life
  [/auto/,                          "#d99a5b"],   // amber-orange — motion
  [/fmcg|consumer/,                 "#c98a94"],   // muted rose — retail
  [/energy|oil|power|gas|utilit/,   "#c9a86a"],   // gold — energy
  [/metal|mining/,                  "#a8a29a"],   // warm steel — heavy industry
  [/chem/,                          "#a78bda"],   // muted violet — chemistry
  [/realty|real estate|construction|cement|capital goods|engineering|industrial|defence/,
                                    "#c08573"],   // terracotta — built world
  [/telecom/,                       "#85a8c8"],   // steel blue — networks
  [/textile|media|service/,         "#b98fc9"],   // muted orchid — culture/services
];
export function sectorAccent(sector) {
  const s = (sector || "").toLowerCase();
  for (const [re, hue] of SECTOR_ACCENTS) if (re.test(s)) return hue;
  return C.gold;
}

// Depth helpers — hairlines over fills; whispers, not washes.
export const gridBg = {
  backgroundImage: `
    linear-gradient(rgba(242,237,228,.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(242,237,228,.02) 1px, transparent 1px)`,
  backgroundSize: "56px 56px",
};

// The wash behind the whole app: one faint warm glow top-right (candlelight,
// not aurora) + an even fainter deep-umber lift bottom-left.
export const auroraBg = {
  backgroundImage: `
    radial-gradient(1100px 700px at 85% -10%, rgba(232,180,90,0.05), transparent 60%),
    radial-gradient(900px 650px at -10% 108%, rgba(120,90,50,0.05), transparent 55%)`,
  backgroundAttachment: "fixed",
};

export const mono  = { fontFamily: "'JetBrains Mono Variable','JetBrains Mono',ui-monospace,monospace", fontVariantNumeric: "tabular-nums" };
export const serif = { fontFamily: "'Inter Variable','Inter',-apple-system,sans-serif", letterSpacing: "-0.011em" };
export const sans  = { fontFamily: "'Inter Variable','Inter',-apple-system,system-ui,sans-serif" };
