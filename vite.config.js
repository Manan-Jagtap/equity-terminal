import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Set VITE_DEV_PROXY to a backend origin (e.g. http://3.110.160.88) to have the
// dev server forward /api same-origin — used with VITE_API_URL="" so the app
// makes relative requests. Unset → plain config, production builds unaffected.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The hand-written public/manifest.webmanifest is already correct and is
      // already linked from index.html. The plugin owns the SERVICE WORKER only;
      // two competing manifests is a classic cause of an install prompt that
      // never appears.
      manifest: false,
      injectRegister: 'auto',
      registerType: 'autoUpdate',
      workbox: {
        // ── Cached: THE APP SHELL, AND NOTHING ELSE ─────────────────────────
        // Build output is content-hashed, so cache-first is safe here: a deploy
        // produces new filenames and the old entries are cleaned up.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        // MUST mirror the exclusions in vercel.json's SPA rewrite
        //   "/((?!api/|stock/|.*\\.).*)" -> /index.html
        // Those paths are SERVER-rendered, not client routes:
        //   /api/*        Vercel functions
        //   /stock/:tkr   rewritten to /api/stock/:tkr for SEO/social cards
        //   /sitemap.xml  rewritten to /api/sitemap
        // A navigation to /stock/TCS is request.mode === 'navigate', so without
        // this denylist the service worker would answer it from the precached
        // shell and the server-rendered page would never be reached — the SPA
        // would still render for humans, so it would look fine, while crawlers
        // and link unfurls silently got the empty shell instead. Vercel already
        // excludes these; the worker has to agree or it quietly overrides the
        // platform's routing.
        navigateFallbackDenylist: [/^\/api\//, /^\/stock\//, /^\/sitemap\.xml$/],
        cleanupOutdatedCaches: true,

        // ── NOT cached: EVERY API RESPONSE ──────────────────────────────────
        // There is deliberately NO `runtimeCaching` entry for
        // api.equityverdict.com. Cross-origin requests are not precached, so
        // every price, valuation and verdict goes to the network every time.
        //
        // This is the load-bearing decision. A cached quote is a WRONG quote:
        // margin of safety is intrinsic/price - 1, so serving yesterday's price
        // against today's intrinsic silently fabricates a MoS the engine never
        // produced. We fixed exactly this shape of bug server-side on
        // 2026-08-02 — a stale value wearing a fresh timestamp, which published
        // prices up to 7.6% wrong across 15 names. Re-introducing it in the
        // service worker would be worse: the staleness would live on the user's
        // device, invisible to every server-side integrity check.
        //
        // Offline therefore means "the shell loads and the data fails loudly",
        // never "here is a number that looks current". For a research product
        // that is the honest failure mode.
        //
        // If offline reading is ever wanted it must be an explicit, user-visible
        // cache with an as-of timestamp rendered beside every figure — never a
        // transparent runtime cache.

        // A live tab must not lose its lazy chunks mid-session. skipWaiting
        // would activate the new worker immediately and cleanupOutdatedCaches
        // would then purge chunks the running page still needs — Company,
        // ChartTerminal and pdf are all lazy routes here, so that is a real 404
        // on the next navigation. The new version applies once every tab closes.
        skipWaiting: false,
        clientsClaim: false,
      },
      devOptions: {
        // No service worker on the dev server: it caches aggressively and makes
        // HMR behave in ways that waste debugging time.
        enabled: false,
      },
    }),
  ],
  server: process.env.VITE_DEV_PROXY
    ? { proxy: { '/api': { target: process.env.VITE_DEV_PROXY, changeOrigin: true } } }
    : undefined,
})
