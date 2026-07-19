/* Redesign Phase 4 — performance budget gate.
   Fails CI when the ENTRY chunk (the bytes every first paint pays, before any
   lazy view loads) exceeds budget. Lazy chunks are deliberately unbudgeted —
   they load on demand; the entry is what mobile users on Indian networks feel.

   Measured 2026-07-20 (post-redesign phases 0–4): entry 491 kB raw / 157 kB
   gzip. Budget set with ~10% headroom; raise it only with a reason in the
   commit message, never to silence the gate. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_GZIP_KB = 175;

const dir = join(process.cwd(), "dist", "assets");
const entry = readdirSync(dir).find((f) => /^index-.*\.js$/.test(f));
if (!entry) {
  console.error("bundle-budget: no dist/assets/index-*.js — run `npm run build` first.");
  process.exit(1);
}
const raw = readFileSync(join(dir, entry));
const gzipKB = gzipSync(raw, { level: 9 }).length / 1024;

const line = `entry ${entry}: ${(raw.length / 1024).toFixed(0)} kB raw / ${gzipKB.toFixed(1)} kB gzip (budget ${BUDGET_GZIP_KB} kB gzip)`;
if (gzipKB > BUDGET_GZIP_KB) {
  console.error(`bundle-budget: OVER BUDGET — ${line}`);
  console.error("Likely cause: an eager import pulled a heavy lib into the entry (check new imports in main.jsx/App.jsx and eager components; lazy views are free).");
  process.exit(1);
}
console.log(`bundle-budget: OK — ${line}`);
