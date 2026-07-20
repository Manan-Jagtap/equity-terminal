# Phase 0 — Feature → IA Map (the contract: nothing is dropped)

Every capability in the current product, mapped to its home in the new IA.
Source of truth: the 16 current VIEW_IDs + the 15 company-page tabs + global
actions at HEAD 957a9ed. If a feature seems worth cutting, it is FLAGGED for the
owner — never silently dropped.

## New IA (persistent left rail desktop / bottom bar mobile + ⌘K everywhere)

| New home | Absorbs (current) |
|---|---|
| **⌘K Search** | CommandPalette — companies, "TCS DCF at 12% growth" command language, view jumps; EXTENDED to actions (watchlist add, export, compare) |
| **Home** | `dashboard` (MarketDashboard: indices strip, movers, breadth, sentiment) + personalized deltas (watchlist/portfolio movers, verdict changes, Alpha movers) |
| **Research** | `company/:ticker` — ALL 15 tabs: Overview/ScoreCard, Chart (PriceChart + ChartTerminal), Financials, Ratios, DCF (ScenarioBar + DCFModel + SegmentSOTP editor), Valuation/Verdict (FvRange bear/base/bull), Peer Universe, Ownership, Results/Earnings-track, Concalls, News, Docs, Forensics, Options (F&O names), 3-Statement Model; one-pager PDF + Excel export |
| **Discover** | `screener` (+ saved screens), `ideas` (Alpha ranking), `manager` (Fund Manager/hidden gems), `sectors`, `economy` (macro dashboard + regulatory tracker), `ipo` board, `funds` (MF panel), `baskets` (thematic), `compare`, StrategyLab backtester, `results` (earnings scoreboard + upcoming calendar + corporate-action calendar), `ownership` (cross-company trends), `operations` (KPI extractor) |
| **Portfolio** | `portfolio` (holdings, risk: VaR/drawdown/XIRR, tax-lots, vs-benchmark, x-ray, broker CSV/paste import, Dhan sync), `watchlist`, scenario save/share links |
| **Track Record** | `track` (append-only ledger, cohort stats, calibration) — PROMOTED to first-class rail item |
| **Account** | auth (signup/verify/login), sign out, sign out everywhere (SEC-01), DPDP delete, privacy policy |

Global/system surfaces that persist unchanged in function: Landing (logged-out),
public SSR /stock/:ticker pages (SEO, outside the SPA), disclaimers on every
verdict surface, LOW-CONF/NO-CALL honest states, density toggle (NEW),
onboarding tour (NEW, skippable).

## Flags for owner (nothing dropped without sign-off)
- `operations` (KPI extractor) has thin data coverage — kept, filed under
  Discover → "Operating KPIs"; flag if it should merge into company Financials.
- Legacy `#/...` URLs: redirects will map to new real routes (Phase 0b) —
  hash deep links keep working forever via a shim.

## Phase order (contract)
0a (this PR): tokens + fonts + motion lib + /styleguide + this map.
0b: real routes + hash redirects + per-page meta.
1: primitives → composites (all states + reduced-motion variants).
2: screens (Company detail is the crown jewel).
3: motion layer. 4: responsive/a11y/perf. 5: PDF + polish + before/after.
