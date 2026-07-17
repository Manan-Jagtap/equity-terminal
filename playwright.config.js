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
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_URL: "http://127.0.0.1:9" },   // unroutable → seed mode
    timeout: 60_000,
  },
});
