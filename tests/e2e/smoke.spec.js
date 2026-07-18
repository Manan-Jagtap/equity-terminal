/* Runtime smoke — the flows a build cannot verify.
   Runs in seed-fallback mode (API unroutable, see playwright.config.js) with a
   dev token injected before any page script, exactly mirroring the manual
   browser-verification workflow. Guards against the "builds fine, crashes at
   runtime" class (e.g. an undefined lucide import taking down every company
   page — a real incident, 16 Jul 2026). */
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Sign-in bypass before any script runs; seed mode never validates it
  // against a backend (all fetches fail fast to the unroutable API).
  await page.addInitScript(() => {
    localStorage.setItem("eq_token", "dev-verify");
    localStorage.setItem("eq_user", JSON.stringify({ id: 1, email: "ci@local", name: "CI" }));
  });
});

function collectPageErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test("app shell renders for a signed-in user", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Screener" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Portfolio" })).toBeVisible();
  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});

test("screener renders the seed universe with honest verdicts", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Screener" }).click();
  // Seed fallback: the client engine (engine.js + derive.js) computes these live.
  // Row-scoped assertions: a bare getByText("AVOID") matches the HIDDEN <option>
  // in the verdict filter dropdown before any visible chip.
  const bajaj = page.locator("tr", { hasText: "Bajaj Finance" });
  await expect(bajaj).toBeVisible({ timeout: 15000 });
  await expect(bajaj).toContainText("AVOID");
  // The extreme-MoS lender gate must render NO CALL, never a naive BUY.
  const muthoot = page.locator("tr", { hasText: "Muthoot Finance" });
  await expect(muthoot).toContainText("NO CALL");
  await expect(page.getByText("Titan Company")).toBeVisible();
  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});

test("company page opens and the DCF tab computes a fair value", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Screener" }).click();
  await page.getByText("Titan Company").first().click();
  // Header renders (this exact surface crashed in the 16 Jul incident).
  await expect(page.getByRole("button", { name: "Valuation" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Valuation" }).click();
  // The parity core must produce a rupee fair value + a MoS readout. The tight
  // "Valuation · Blended Fair Value" header disambiguates from the Monte Carlo
  // copy that also mentions the phrase.
  await expect(page.getByText(/valuation · blended fair value/i).first())
    .toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/-?\d+(\.\d+)?%\s*MoS/i).first()).toBeVisible();
  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});

test("every sidebar view renders without page errors", async ({ page }) => {
  // The 18 Jul lesson: the old suite only visited 3 views, so a crash in any
  // other tab could ship. Walk ALL of them (seed mode; gated views render
  // their sign-in gate, which still must not throw).
  const errors = collectPageErrors(page);
  await page.goto("/");
  const tabs = ["Screener", "Ideas", "Baskets", "Watchlist", "Compare",
    "Results", "Ownership", "Operations", "Sectors", "Economy", "IPOs",
    "Mutual Funds", "Portfolio", "Fund Manager", "Track Record", "Dashboard"];
  for (const t of tabs) {
    await page.getByRole("button", { name: t, exact: true }).click();
    await page.waitForTimeout(350);
  }
  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});

test("navigation writes URLs and browser back restores the previous view", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Screener" }).click();
  await expect(page).toHaveURL(/#\/screener$/);
  await page.getByRole("button", { name: "Economy" }).click();
  await expect(page).toHaveURL(/#\/economy$/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/screener$/);
  // The view actually changed back, not just the URL.
  await expect(page.locator("tr", { hasText: "Bajaj Finance" })).toBeVisible({ timeout: 15000 });
  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
