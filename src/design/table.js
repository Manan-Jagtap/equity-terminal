/* One table rhythm for the whole terminal.
 *
 * Measured before this existed: nine screens each declared their own `th`/`td`
 * style objects, producing SEVEN distinct header metrics and SEVEN distinct
 * cell metrics — padding anywhere from "5px 8px" to "11px 14px", header type at
 * 9.5px or 10px, body at 11.5px or 12px — plus 38 more one-off padding values
 * inline in Company.jsx. Eighteen files hand-roll a <table>; ui/Table.jsx, the
 * primitive built for exactly this, had zero product call sites.
 *
 * That is the "assembled rather than designed" feeling in its most literal
 * form: move between two screens and the table you are reading changes its
 * rhythm underneath you, for no reason a user could name.
 *
 * WHY OBJECTS AND NOT A CSS CLASS: the screens apply these inline
 * (`style={th}`), and an inline declaration beats a class selector. Shipping a
 * `.ev-table th {…}` rule would have lost that fight silently and left the
 * divergence in place while looking fixed. Exported objects keep the existing
 * mechanism and give it one source — a much smaller change than rewriting
 * eighteen tables into <Table columns={…}>, and it carries none of that
 * refactor's regression risk.
 *
 * The chosen values are Portfolio / Results / Screener's, because those are the
 * densest and most-used tables and matching them changes the fewest screens.
 *
 * Usage — spread, then override only what genuinely differs:
 *   import { th, td, tdNum } from "../design/table.js";
 *   <th style={{ ...th, textAlign: "left" }}>Company</th>
 *   <td style={tdNum}>{inr(x)}</td>
 */
import { C, mono, sans } from "../lib/theme.js";

/* Column header: uppercase micro-label, the tertiary text tier, hairline under. */
export const th = {
  ...sans,
  fontSize: 10,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: C.dim,
  padding: "10px 12px",
  whiteSpace: "nowrap",
  borderBottom: `1px solid ${C.line}`,
  textAlign: "right",          // most columns are numeric; override for the first
};

/* Body cell. */
export const td = {
  ...sans,
  fontSize: 12,
  color: C.text,
  padding: "11px 12px",
  borderBottom: `1px solid ${C.line}`,
  textAlign: "right",
};

/* Numeric body cell — mono + tabular figures so columns align digit-for-digit.
   A number column that is not tabular wanders as values change, which is the
   single most obvious tell of a table that was not built for numbers. */
export const tdNum = {
  ...td,
  ...mono,
  whiteSpace: "nowrap",
};

/* The identity column: left-aligned, wider gutter, and it must be allowed to
   truncate. Unbounded it takes whatever width the longest company name wants
   and pushes the columns that carry the actual verdict off the edge — measured
   on the screener at 448px of a 1169px table. */
export const thName = { ...th, textAlign: "left", padding: "10px 16px" };
export const tdName = {
  ...td,
  textAlign: "left",
  padding: "11px 16px",
  maxWidth: 260,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/* Stacked identity cell — a name over a "TICKER · Sector" sub-line.
   The trap: clamping the CELL to one line truncates the sub-line away, so the
   obvious fix is to drop the clamp — and then the row grows whenever either
   line wraps. Measured after the metric consolidation, with the clamp dropped:
   Operations ran TEN distinct row heights across 40 rows (52..111px, a 59px
   spread) and Results ran five (52..96px).

   Clamp each LINE independently instead. Both lines survive, each truncates on
   its own, and the row height is pinned — which is how the screener got from a
   28px spread to a single 52px row. Full text stays reachable via title=. */
export const tdStack = { ...td, textAlign: "left", padding: "11px 16px", maxWidth: 260 };
export const stackLine = {
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

/* ── Compact variant ────────────────────────────────────────────────────────
   One table in the app is legitimately denser than the rest: the option chain.
   It renders a strike ladder inside a 560px scroll box, and how many strikes a
   trader can see WITHOUT scrolling is the point of the view — an option chain
   you have to scroll to read is a worse option chain.

   Consolidating it onto the standard rhythm took its cells from 5px 8px /
   11.5px to 11px 12px / 12px, which roughly doubled the row height and halved
   the visible ladder. That is the consolidation being applied too literally:
   the goal was to remove SEVEN accidental rhythms, not to deny that one table
   has a real reason to be tighter.

   So there are exactly two rhythms, both defined here, and a screen may only
   use the compact one when density is the feature rather than an accident. */
export const thCompact = { ...th, padding: "7px 8px" };
export const tdCompact = { ...td, padding: "6px 8px", fontSize: 11.5 };
export const tdCompactNum = { ...tdCompact, ...mono, whiteSpace: "nowrap" };

/* THE uppercase micro-label.
 *
 * tokens.css defines exactly one (`.evc-stat-label`): 10px at 0.08em tracking in
 * the tertiary text tier. The product hand-writes ~161 of them in 64 distinct
 * size/tracking/colour combinations — including fractional sizes (8.5, 9.5,
 * 10.5, 11.5, 12.5) that no token backs, and tracking anywhere from none to
 * 0.18em.
 *
 * Spread this the way `th`/`td` already are. Two variants only, because two is
 * what the tokens actually describe:
 *   label      10px — the section/stat micro-label
 *   labelSm     9px — the same thing where space genuinely forces it smaller
 *
 * Colour is deliberately NOT baked in: these appear on several surfaces and the
 * palette gate checks contrast per surface, so the call site keeps that choice.
 */
export const label = {
  ...sans,
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontWeight: 500,
};

export const labelSm = { ...label, fontSize: 9 };
