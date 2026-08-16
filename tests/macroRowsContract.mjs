/* The Economy grid's row contract, as an executable gate.
 *
 * /api/macro answers with three kinds of row and they are three different facts:
 * a figure, a wired source whose next release has not printed, and an indicator
 * with no source wired at all. The grid filtered out every row flagged
 * `awaiting`, collapsing the last two — and seven of the twenty rows sit
 * permanently in the third state (GST collections, e-way bills, both PMIs, peak
 * power, auto sales, UPI). "Growth & activity" therefore rendered three cards out
 * of nine with nothing to say the other six exist and are unsourced, while the
 * header credited GSTN, NPCI and Grid India for figures it has never carried.
 *
 *     node tests/macroRowsContract.mjs
 */
import { partitionSection } from "../src/lib/macroRows.js";

let failures = 0;
const check = (name, cond, detail) => {
  if (cond) { console.log(`  ok    ${name}`); return; }
  failures++;
  console.log(`  FAIL  ${name}${detail ? "\n          " + detail : ""}`);
};

/* One row of each kind the API emits, shaped exactly as macro_data.dashboard
   builds them. */
const cpi    = { slug: "cpi", label: "CPI inflation", value: 4.9 };
const oecd   = { slug: "oecd_cli_india", label: "Leading indicator (OECD)", value: null,
                 awaiting: true, status: "awaiting_release", source: "OECD" };
const upi    = { slug: "upi_transactions_mn", label: "UPI transactions", value: null,
                 awaiting: true, status: "no_feed", source: "NPCI" };
const legacy = { slug: "gst_gross_collections_cr", label: "GST collections", value: null,
                 awaiting: true, source: "GSTN portal · manual entry" };

const sec = partitionSection({ title: "Growth & activity", series: [cpi, oecd, upi, legacy] });
const shown = sec.live.concat(sec.unwired);

check("a populated row is still a card",
      sec.live.length === 1 && sec.live[0].slug === "cpi");
check("no card is ever built from a row without a value",
      sec.live.every(r => r.value != null));
check("an unwired indicator reaches the reader",
      sec.unwired.some(r => r.slug === "upi_transactions_mn"));
check("an unwired indicator keeps its publisher",
      sec.unwired.every(r => !!r.source));
check("a wired source between prints stays hidden — it returns on its own",
      !shown.some(r => r.slug === "oecd_cli_india"));
/* Vercel ships this file on merge; the API deploys by hand, so the browser talks
   to a pre-`status` backend for a while. Guessing which silence an unlabelled
   row is would invent the fact this module exists to report. */
check("rows from a backend that predates `status` degrade to today's behaviour",
      !shown.some(r => r.slug === "gst_gross_collections_cr"));

/* Six of Growth & activity's nine rows are unwired; if a section ever became
   wholly unwired the old filter collapsed it and the reader lost the last trace
   that those indicators exist at all. */
const only = partitionSection({ title: "Growth & activity", series: [upi] });
check("a wholly unwired section still has something to render",
      only.live.length === 0 && only.unwired.length === 1);

check("an absent or malformed section does not throw",
      partitionSection(undefined).live.length === 0 &&
      partitionSection({ title: "x" }).unwired.length === 0);

console.log(failures === 0
  ? "\nmacro-row-contract: OK — an unwired indicator is named, not hidden."
  : `\nmacro-row-contract: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
