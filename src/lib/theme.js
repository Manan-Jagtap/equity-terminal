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
  text:    "#f2ede4",   // = --ev-text        (17.07:1)
  text200: "#b7ad9d",   // = --ev-text-2      (8.98:1)
  dim:     "#9a9080",   //                     (~6.3:1)
  // UX-04 (WCAG 1.4.3) still holds: faint stays ≥4.5:1 on the base canvas.
  faint:   "#8d8474",   // = --ev-text-3      (5.39:1 on bg / 5.14 raise / 4.83 over — genuinely AA)
  vfaint:  "#453e33",   // decoration only — never body text (fails AA by design)

  // Primary accent — warm amber-gold (the key finally means what it says)
  gold:    "#e8b45a",   // = --ev-accent
  gold500: "#d9a24a",
  gold600: "#b8863a",
  gold700: "#8a6429",
  goldDim: "#b8863a",

  // Signal colors — muted verdict ladder, never neon
  green:   "#7ce0bd",   // = --ev-buy
  green500:"#5fc9a4",   // = --ev-accumulate (was #3da46e — off-ladder)
  red:     "#dd7d84",   // = --ev-avoid
  red500:  "#ef9070",   // = --ev-reduce    (was #c25f50 — off-ladder)
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
  "#7ce0bd",  // green
  "#85a8c8",  // steel blue
  "#9d8fd4",  // lavender
  "#d99a5b",  // amber-orange
  "#5fb3b3",  // teal
  "#b98fc9",  // orchid
  "#c9a86a",  // gold
  "#c98a94",  // rose
  "#a8a29a",  // warm steel
];

/* Sector accent hues — per-sector identity, desaturated into the warm family so
   no sector shouts over the single amber brand accent.

   These are NOT a categorical legend and must not be graded as one. There are
   exactly two consumers: Logo.jsx's FALLBACK branch, which tints an initials
   monogram (the letters are the identity; the colour is decoration on top of a
   text label), and Company.jsx, which shows ONE sector's hue at a time. No
   screen ever renders two sector tints side by side, so pairwise
   discrimination — 16 of 55 pairs sit under dE 10 somewhere, telecom/textile
   at dE 0.5 under deuteranopia — is not a defect here. Eleven perceptually
   distinct hues is roughly double what one desaturated family can hold, and
   the honest reason that is survivable is that nothing asks the user to tell
   them apart.

   What DOES matter is collision with a VERDICT colour, because the sector
   accent and the verdict badge appear together on the company page. Two were
   effectively identical to a ladder step after the ladder was rebuilt:

     pharma  #6fb89a  dE 0.8 from --ev-hold   -> #6dbab2  (clears by 10.0)
     energy  #c9a86a  dE 0.8 from --ev-reduce -> #a88538  (clears by 10.6)

   (#c9a86a was the OLD --ev-hold and auto's #d99a5b was the OLD --ev-reduce —
   freed when the ladder moved, which is why they drifted onto new steps.)
   The remaining four sit dE 3.0-4.2 from a step under DICHROMACY ONLY, on
   decorative chrome next to a badge that carries a glyph and the literal word
   "REDUCE". Left alone deliberately: moving them costs real sector identity
   (metal is "warm steel"; the nearest clearing colour is a mauve) to buy
   nothing a user can act on. */
const SECTOR_ACCENTS = [
  [/financial|bank|nbfc|insurance/, "#9d8fd4"],   // muted lavender — institutions
  [/tech|information/,              "#5fb3b3"],   // muted teal — software
  [/pharma|health/,                 "#6dbab2"],   // muted teal-jade — life (clear of --ev-hold)
  [/auto/,                          "#d99a5b"],   // amber-orange — motion
  [/fmcg|consumer/,                 "#c98a94"],   // muted rose — retail
  [/energy|oil|power|gas|utilit/,   "#a88538"],   // deep ochre — energy (clear of --ev-reduce)
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
/* `serif` is the display face — it sets every hero number in the product (the
   64px fair value in DCFModel, the 32px method cards, the StatTile values) and
   is spread at ~74 sites. `mono` has always carried tabular-nums; `serif` did
   not, and that asymmetry was the whole bug.

   Inter's proportional digits are NINE different widths (measured from the
   shipped woff2: '1' is 833/2048 em, '4' is 1323 — a 0.239em spread), so a hero
   number physically changes width as its value changes. On the DCF sliders,
   which update headIv on every drag frame with no debounce, ₹1,111 → ₹4,444
   shifts the glyphs 61px. The font ships the `tnum` feature; enabling it pins
   all ten digits to one width, so the number changes without the layout moving.
   Inter is kept — a 64px hero in mono would be a far bigger change than this
   warrants, and tabular *sans* at hero size is what Koyfin and Bloomberg use. */
export const serif = { fontFamily: "'Inter Variable','Inter',-apple-system,sans-serif", letterSpacing: "-0.011em", fontVariantNumeric: "tabular-nums" };
export const sans  = { fontFamily: "'Inter Variable','Inter',-apple-system,system-ui,sans-serif" };
