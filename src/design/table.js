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
