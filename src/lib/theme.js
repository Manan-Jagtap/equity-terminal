/* Design tokens — Equity Terminal "Aurora" theme.

   Deep-space indigo base with a luminous mint-cyan accent: dark enough for
   long research sessions, cool and alive instead of flat black. Signals are
   unmistakable (spring green / coral), depth comes from aurora gradients
   rather than borders, and every sector carries its own accent hue on the
   company page (see sectorAccent).

   Single source of truth: components must read from here, never hard-code.
   NOTE: token KEYS are semantic and stable — `gold` = primary accent
   (historical name, kept so 25 components re-skin without edits). */

export const C = {
  // Abyss scale (deep space navy)
  bg:      "#060A13",   // abyss-950
  bg900:   "#0A101E",   // abyss-900
  bg800:   "#101A2C",   // abyss-800
  bg700:   "#16223A",   // abyss-700
  bg600:   "#1E2E4E",   // abyss-600
  bg500:   "#293B63",   // abyss-500
  bg400:   "#3E5788",   // abyss-400

  // Text scale (cool porcelain)
  text:    "#E8EEFA",
  text200: "#BFCCE4",
  dim:     "#7E8FB0",
  faint:   "#526180",
  vfaint:  "#39466B",

  // Primary accent — aurora mint-cyan (key name `gold` kept for stability)
  gold:    "#3EE6C1",
  gold500: "#2BC9A8",
  gold600: "#1FA085",
  gold700: "#177862",
  goldDim: "#1FA085",

  // Signal colors
  green:   "#4ADE80",   // spring green — unambiguous positive
  green500:"#22B563",
  red:     "#FB7185",   // coral — negative without alarm-red harshness
  red500:  "#E5484D",
  blue:    "#60A5FA",   // info (announcements, FCF lines)

  // Panel surfaces
  panel:   "#0A101E",   // = bg900
  panel2:  "#101A2C",   // = bg800

  // Borders — cool hairlines
  line:    "rgba(147,171,255,0.09)",
  line2:   "rgba(147,171,255,0.16)",
};

// Sector accent hues — each stock page carries its industry's color.
// Muted-luminous family chosen to sit on the abyss base at the same perceived
// brightness as the brand accent, so no sector feels louder than another.
const SECTOR_ACCENTS = [
  [/financial|bank|nbfc|insurance/, "#818CF8"],   // indigo — institutions
  [/tech|information/,              "#22D3EE"],   // cyan — software
  [/pharma|health/,                 "#4ADE80"],   // green — life
  [/auto/,                          "#FB923C"],   // orange — motion
  [/fmcg|consumer/,                 "#D8919F"],   // muted rose — retail
  [/energy|oil|power|gas|utilit/,   "#FACC15"],   // amber — energy
  [/metal|mining/,                  "#94A3B8"],   // steel — heavy industry
  [/chem/,                          "#A78BFA"],   // violet — chemistry
  [/realty|real estate|construction|cement|capital goods|engineering|industrial|defence/,
                                    "#D08B7E"],   // muted terracotta — built world
  [/telecom/,                       "#38BDF8"],   // sky — networks
  [/textile|media|service/,         "#C08BD8"],   // muted orchid — culture/services
];
export function sectorAccent(sector) {
  const s = (sector || "").toLowerCase();
  for (const [re, hue] of SECTOR_ACCENTS) if (re.test(s)) return hue;
  return C.gold;
}

// Depth helpers
export const gridBg = {
  backgroundImage: `
    linear-gradient(rgba(147,171,255,.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(147,171,255,.03) 1px, transparent 1px)`,
  backgroundSize: "56px 56px",
};

// The aurora wash behind the whole app — two soft radial glows (cyan top-right,
// indigo bottom-left) that give the abyss base depth without distracting.
export const auroraBg = {
  backgroundImage: `
    radial-gradient(1100px 700px at 85% -10%, rgba(62,230,193,0.07), transparent 60%),
    radial-gradient(900px 650px at -10% 108%, rgba(99,102,241,0.09), transparent 55%),
    radial-gradient(700px 500px at 50% 120%, rgba(56,189,248,0.05), transparent 60%)`,
  backgroundAttachment: "fixed",
};

export const mono  = { fontFamily: "'JetBrains Mono',monospace", fontVariantNumeric: "tabular-nums" };
export const serif = { fontFamily: "'Space Grotesk','Inter',-apple-system,sans-serif", letterSpacing: "-0.01em" };
export const sans  = { fontFamily: "'Inter',-apple-system,system-ui,sans-serif" };
