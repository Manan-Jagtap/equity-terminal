/* macroRows.js — how the Economy grid decides what a section shows.
 *
 * /api/macro answers with three kinds of row, and they are three different
 * facts about the world:
 *
 *   · a figure           — the indicator has data
 *   · "awaiting_release" — a source is wired; this period has not printed yet
 *   · "no_feed"          — no source is wired; the indicator has never carried a
 *                          value, and nothing changes that but a decision
 *
 * The grid used to drop every row flagged `awaiting`, which turned the last two
 * into the same silence. Seven of the twenty rows sit permanently in the third
 * state (GST collections, e-way bills, both PMIs, peak power, auto sales, UPI),
 * so "Growth & activity" rendered three cards out of nine with nothing on the
 * page to say the other six exist and are unsourced — while the header credited
 * GSTN, NPCI and Grid India for figures it has never carried.
 *
 * Hiding a late print is honest: it returns by itself next month. Hiding an
 * unwired indicator is a claim that the dashboard is complete.
 *
 * Kept out of the component so tests/macroRowsContract.mjs can execute it.
 */

/* An indicator with no source behind it. Keyed on the API's explicit `status`
   and nothing else: this file ships to Vercel on merge while the API deploys by
   hand, so for a while the browser talks to a backend that sends `awaiting`
   with no `status`. Guessing which silence an unlabelled row is would invent the
   very fact this module exists to report, so it stays hidden as it is today. */
export function isUnwired(row) {
  return !!row && row.status === "no_feed";
}

/* → { title, live, unwired }. `live` become cards; `unwired` are named in a line
   beneath them; anything else (a wired source between prints) is left out and
   comes back on its own when the publisher releases. */
export function partitionSection(sec) {
  const rows = (sec && sec.series) || [];
  return {
    title: sec && sec.title,
    live: rows.filter(r => !r.awaiting),
    unwired: rows.filter(isUnwired),
  };
}
