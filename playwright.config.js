// Playwright runtime-smoke config. Hermetic by design: VITE_API_URL points at an
// unroutable port so every backend fetch fails fast and the app runs in its seed
// fallback — the same mode used for local browser verification. This catches the
// class of failure `npm run build` structurally cannot (e.g. an undefined lucide
// import that builds fine but crashes every company page at runtime).
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    // NOT `!process.env.CI`. Reuse takes whatever already listens on 5173, and a
    // preview/dev server started for browser verification does NOT carry the
    // VITE_API_URL below — so the app comes up pointed at a real (or absent)
    // backend instead of seed mode, and the seed-mode assertions fail. That
    // produced three separate false failures during the Aug 2026 sweep, each
    // one read at first as a regression in the code under test.
    //
    // The env below is the contract this file exists to enforce; a server that
    // was not started with it cannot honour it. Reuse trades ~2s of startup for
    // a suite that lies, so it is off everywhere.
    reuseExistingServer: false,
    env: { VITE_API_URL: "http://127.0.0.1:9" },   // unroutable → seed mode
    timeout: 60_000,
  },
});
