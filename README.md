# Step 1 — Frontend refactor

Pure structural refactor. **Zero behavior change.** The site should look and work identically after this PR — that's the test. Verified clean `vite build` (2.2s, no errors).

## What changes

`src/App.jsx` (639 lines, monolith) → broken into:

```
src/
├── App.jsx                          ← thin root (~110 lines): state, layout, view router
├── main.jsx                         ← unchanged
├── lib/
│   ├── theme.js                     ← colors (C) + font families
│   ├── formatters.js                ← fmt, inr, pct, cr, safe
│   ├── sector.js                    ← SECTOR_PARAMS + sectorParams()
│   ├── fyHelpers.js                 ← currentFY, fyLabel
│   ├── seedData.js                  ← SEED, makeSeries, buildFromApi
│   ├── valuation.js                 ← ke, buildRIRows, buildFCFFRows, valuate, sensitivity, fundamentals
│   ├── technicals.js                ← sma, rsiCalc, technicals
│   └── recommend.js                 ← composite score + verdict
└── components/
    ├── primitives.jsx               ← VerdictBadge, Stat, Field, BRow, MTable, TH, TR
    ├── Screener.jsx
    ├── Company.jsx                  ← header + tabs orchestrator
    ├── DCFModel.jsx
    ├── FinancialStatements.jsx
    ├── Fundamentals.jsx
    ├── Technical.jsx
    └── Verdict.jsx
```

## How to apply

From the root of your `equity-terminal` repo:

```bash
git checkout -b refactor/modularize-app
unzip -o step1-refactor.zip            # extract over src/
git status                              # should show src/App.jsx modified, 16 new files
npm run build                           # confirm it builds
npm run dev                             # eyeball — should look identical to prod
git add src/
git commit -m "refactor: split App.jsx into lib/ + components/

Pure structural refactor — no behavior change.
- src/lib/* holds pure logic (valuation, technicals, formatters, theme tokens)
- src/components/* holds UI (Screener, Company, DCF, Statements, etc.)
- App.jsx is now a thin root owning view-routing state only

Unblocks step 2 (template_code migration) and step 5 (new Company design)."
git push origin refactor/modularize-app
```

Then open a PR on GitHub, merge to `main`, let Vercel redeploy. Visit https://equity-terminal-one.vercel.app/ and confirm everything works as before. That's the green light to move to step 2.

## What this unlocks

The single biggest blocker was: you can't drop a new Company-page design into a 639-line monolith without breaking things. Now `Company.jsx` is a 100-line orchestrator that imports five tab components. Step 5 will replace it with the 7-tab editorial layout — a clean, contained change.

Beyond that, `src/lib/valuation.js`, `src/lib/recommend.js`, and friends become unit-testable. You can also lazy-import the tab components if you want to trim the 576 KB bundle (recharts is the big offender).

## Known issues, intentionally not fixed in this PR

Lint errors about inline components (`Tab`, `Th`, `StmtTab` defined inside parent components) are pre-existing in the original code (24 problems before, 19 after). Fixing them changes behavior subtly (referential identity), so it goes in a separate cleanup PR after step 5 lands.
