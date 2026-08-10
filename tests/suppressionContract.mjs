/* The suppression contract, as an executable gate.
 *
 * The engine deliberately withholds a fair value while KEEPING its verdict. A
 * surface that republishes the withheld number breaks the product's core claim.
 * This has shipped TWICE — first on the Screener (110 names), then, after that
 * fix, on the company page's peer table (107 names, 46 of them with the engine's
 * verdict overridden). Both times the guard enumerated the suppression SHAPES it
 * knew about and missed the rest.
 *
 * So this tests the invariant rather than any one shape:
 *
 *     if a row came from the API, the browser never invents a fair value,
 *     a margin of safety, or a verdict for it.
 *
 * Runs offline against fixtures covering every gate_state the API emits. Add a
 * new suppression shape to FIXTURES when the backend grows one.
 *
 *     node tests/suppressionContract.mjs
 */
import { valuationView } from "../src/lib/engineView.js";

let failures = 0;
const check = (name, cond, detail) => {
  if (cond) { console.log(`  ok    ${name}`); return; }
  failures++;
  console.log(`  FAIL  ${name}${detail ? "\n          " + detail : ""}`);
};

/* A company row shaped exactly as App.jsx builds it: real fundamentals (so the
   local engine COULD compute a value — that is the whole point) plus the `api`
   envelope carrying the backend's view. */
const withApi = (api, over = {}) => ({
  id: "TEST", ticker: "TEST", name: "Test Co",
  type: "nonfinancial", sector: "Software & Programming",
  template_code: "IT_SERVICES",
  price: 100, shares: 10, equity: 500, netProfit: 60, revenue: 1000, netDebt: 0,
  assumptions: { rf: 0.069, erp: 0.05 },
  ...over,
  api,
});

/* Every way the backend says "I am not publishing a number here". */
const FIXTURES = [
  { name: "value_suppressed + note",
    api: { iv: null, mos: null, verdict: "AVOID", fairValueNote: "not meaningful",
           gateState: "value_suppressed", confidence: "low" } },
  { name: "high_dispersion + note",
    api: { iv: null, mos: null, verdict: "AVOID", fairValueNote: "not meaningful",
           gateState: "high_dispersion", confidence: "low" } },
  // The shape the second leak rode in on: abstained with NO note at all.
  { name: "abstain, NO note (the 2nd leak)",
    api: { iv: null, mos: null, verdict: "LOW CONF", fairValueNote: null,
           gateState: "abstain", confidence: "medium" } },
  { name: "abstain, NO DATA verdict",
    api: { iv: null, mos: null, verdict: "NO DATA", fairValueNote: null,
           gateState: "abstain", confidence: "low" } },
  { name: "high_sensitivity",
    api: { iv: null, mos: null, verdict: "REDUCE", fairValueNote: "not meaningful",
           gateState: "high_sensitivity", confidence: "low" } },
  { name: "high_tv_share",
    api: { iv: null, mos: null, verdict: "HOLD", fairValueNote: "not meaningful",
           gateState: "high_tv_share", confidence: "medium" } },
  { name: "relative_only",
    api: { iv: null, mos: null, verdict: "HOLD", fairValueNote: "relative only",
           gateState: "relative_only", confidence: "medium" } },
  // A withheld value with NO note AND NO gate_state — the shape nobody has seen
  // yet. The invariant must hold on provenance alone.
  { name: "withheld, no note, no gate (unknown future shape)",
    api: { iv: null, mos: null, verdict: "AVOID", fairValueNote: null,
           gateState: null, confidence: "low" } },
];

console.log("suppression contract — withheld values must never be reinvented\n");

for (const fx of FIXTURES) {
  const v = valuationView(withApi(fx.api));
  check(`${fx.name}: no fair value`, v.iv == null, `got iv=${v.iv}`);
  check(`${fx.name}: no margin of safety`, v.mos == null, `got mos=${v.mos}`);
  check(`${fx.name}: engine's verdict kept`, v.verdict === fx.api.verdict,
        `engine said ${fx.api.verdict}, surface shows ${v.verdict}`);
  check(`${fx.name}: never sorts as undervalued`, v.sortMos === -Infinity || v.sortMos <= 0,
        `sortMos=${v.sortMos}`);
}

/* The engine's own numbers must still flow through untouched. */
console.log("");
const valued = valuationView(withApi({
  iv: 150, mos: 0.5, verdict: "BUY", composite: 72, reliable: true,
  confidence: "high", fairValueNote: null, gateState: "clean",
}));
check("a valued name keeps its intrinsic", valued.iv === 150, `got ${valued.iv}`);
check("a valued name keeps its MoS", valued.mos === 0.5, `got ${valued.mos}`);
check("a valued name keeps its verdict", valued.verdict === "BUY", `got ${valued.verdict}`);
check("a valued name sorts on its real MoS", valued.sortMos === 0.5, `got ${valued.sortMos}`);

/* Seed / offline rows have no upstream opinion, so the local mirror is the only
   source there is — that fallback must keep working. */
console.log("");
const seed = valuationView({
  id: "SEED", ticker: "SEED", name: "Seed Co", type: "nonfinancial",
  sector: "Software & Programming", template_code: "IT_SERVICES",
  price: 100, shares: 10, equity: 500, netProfit: 60, revenue: 1000, netDebt: 0,
  assumptions: { rf: 0.069, erp: 0.05 },
});
check("seed/offline row still recomputes locally", seed.source === "local", `source=${seed.source}`);
check("seed/offline row produces a verdict", typeof seed.verdict === "string" && seed.verdict.length > 0);

console.log(failures === 0
  ? "\nsuppression-contract: OK — no surface reinvents a withheld valuation."
  : `\nsuppression-contract: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
