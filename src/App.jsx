/* Equity Terminal — app root.
   Auth-aware: validates the stored session on boot, gates watchlist /
   portfolio behind sign-in, and lazy-loads the heavy views so the
   first paint ships a much smaller bundle. */

import { useEffect, useMemo, useState, useCallback, useRef, lazy, Suspense } from "react";
import { TrendingUp, LayoutDashboard, List, Star, GitCompare, CalendarClock, Landmark, Gauge, History, Layers, Briefcase, Search, Loader2, LogIn, LogOut, ChevronDown, Sparkles } from "lucide-react";
import { C, mono, sans, serif, gridBg } from "./lib/theme.js";
import { useIsMobile } from "./lib/useResponsive.js";
import { SEED, buildFromApi } from "./lib/seedData.js";
import Screener from "./components/Screener.jsx";
import MarketDashboard from "./components/MarketDashboard.jsx";
import Watchlist from "./components/Watchlist.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import AuthModal from "./components/AuthModal.jsx";
import { fetchWatchlist, saveWatch, removeWatch } from "./lib/watchlist.js";
import { getUser, me, clearSession } from "./lib/auth.js";

/* Heavy views are code-split: each loads on first visit. Dashboard and
   Screener stay eager — they are the landing experience. */
const Company     = lazy(() => import("./components/Company.jsx"));
const Compare     = lazy(() => import("./components/Compare.jsx"));
const Results     = lazy(() => import("./components/Results.jsx"));
const Ownership   = lazy(() => import("./components/Ownership.jsx"));
const Operations  = lazy(() => import("./components/Operations.jsx"));
const TrackRecord = lazy(() => import("./components/TrackRecord.jsx"));
const Sectors     = lazy(() => import("./components/Sectors.jsx"));
const Portfolio   = lazy(() => import("./components/Portfolio.jsx"));
const Ideas       = lazy(() => import("./components/Ideas.jsx"));

const ViewLoader = () => (
  <div style={{ padding: 48, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading…
  </div>
);

/* ── Visibility whitelist ────────────────────────────────────────────────────
   What the terminal shows is driven by the backend /api/universe (the SINGLE
   source of truth — currently the Nifty 100). The NIFTY_50 set below is only a
   FALLBACK used when that call can't be reached. NIFTY50_ONLY gates whether we
   filter at all; set it false to show every ingested name.                      */
const NIFTY50_ONLY = true;
// Official Nifty 50 (niftyindices.com, 2026-07-04) minus INDIGO (no defensible
// sector model — the backend excludes it too) plus FEDFINA (backend
// EXTRA_TICKERS). Post-demerger this carries TMPV, not TATAMOTORS.
const NIFTY_50 = new Set([
  "RELIANCE","HDFCBANK","BHARTIARTL","TCS","ICICIBANK","SBIN","INFY","BAJFINANCE","ITC","LT",
  "HINDUNILVR","KOTAKBANK","AXISBANK","M&M","SUNPHARMA","MARUTI","NTPC","HCLTECH","ULTRACEMCO","TITAN",
  "BAJAJFINSV","ONGC","ADANIENT","ADANIPORTS","POWERGRID","WIPRO","JSWSTEEL","NESTLEIND","COALINDIA","TATASTEEL",
  "ASIANPAINT","BAJAJ-AUTO","TRENT","JIOFIN","BEL","GRASIM","HINDALCO","SBILIFE","TECHM","HDFCLIFE",
  "SHRIRAMFIN","CIPLA","DRREDDY","EICHERMOT","APOLLOHOSP","TATACONSUM","ETERNAL","TMPV","MAXHEALTH",
  // Extra coverage beyond the Nifty 50 (mirror backend EXTRA_TICKERS)
  "FEDFINA",
]);

export default function App() {
  const API = import.meta.env.VITE_API_URL;
  const isMobile = useIsMobile();

  const [companies,   setCompanies]   = useState(SEED);
  const [loading,     setLoading]     = useState(false);
  const [view,        setView]        = useState("dashboard");
  const [selectedId,  setSelectedId]  = useState(null);
  const [assumptions, setAssumptions] = useState(null);
  const [price,       setPrice]       = useState(0);
  const [histPrices,  setHistPrices]  = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Auth session — seeded from localStorage, validated against /auth/me on boot.
  const [user,        setUser]        = useState(() => getUser());
  const [authOpen,    setAuthOpen]    = useState(false);
  const [userMenu,    setUserMenu]    = useState(false);
  const requestAuth = useCallback(() => setAuthOpen(true), []);

  useEffect(() => {
    if (!API) return;
    me(API).then(u => setUser(u));
  }, [API]);

  // Any 401 from an authenticated route clears the session (in auth.js)
  // and lands here: drop the stale user and prompt for sign-in.
  useEffect(() => {
    const onRequired = () => { setUser(null); setAuthOpen(true); };
    window.addEventListener("auth:required", onRequired);
    return () => window.removeEventListener("auth:required", onRequired);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
    setUserMenu(false);
  }, []);

  // Watchlist membership (set of tickers) + a live alert count for the nav badge.
  const [watched,     setWatched]     = useState(() => new Set());
  const [watchAlerts, setWatchAlerts] = useState(0);

  // Ref mirror of `watched` so toggleWatch never captures a stale Set
  // (rapid toggles / memoized children would otherwise act on old state).
  const watchedRef = useRef(watched);
  useEffect(() => { watchedRef.current = watched; }, [watched]);

  const reloadWatched = useCallback(() => {
    if (!API || !user) {
      const empty = new Set();
      watchedRef.current = empty;
      setWatched(empty);
      setWatchAlerts(0);
      return;
    }
    fetchWatchlist(API)
      .then(d => {
        const next = new Set((d.items || []).map(i => i.ticker));
        watchedRef.current = next;
        setWatched(next);
        setWatchAlerts(d.triggered || 0);
      })
      .catch(() => {});
  }, [API, user]);
  useEffect(() => { reloadWatched(); }, [reloadWatched]);

  const toggleWatch = useCallback(async (ticker) => {
    if (!API || !ticker) return;
    if (!user) { setAuthOpen(true); return; }
    const has = watchedRef.current.has(ticker);
    // optimistic — update the ref synchronously so back-to-back toggles
    // always see the latest membership, then mirror into state.
    const next = new Set(watchedRef.current);
    has ? next.delete(ticker) : next.add(ticker);
    watchedRef.current = next;
    setWatched(next);
    try {
      has ? await removeWatch(API, ticker) : await saveWatch(API, ticker, {});
    } catch { /* revert on failure */ reloadWatched(); return; }
    reloadWatched();
  }, [API, user, reloadWatched]);

  useEffect(() => {
    if (!API) return;
    setLoading(true);
    // Visibility is driven by the backend /api/universe (single source of truth),
    // so backend and frontend can't drift. NIFTY_50 below is only a fallback for
    // when that call can't be reached.
    const universe = fetch(`${API}/api/universe`)
      .then(r => r.json())
      .then(d => (Array.isArray(d?.tickers) && d.tickers.length) ? new Set(d.tickers) : NIFTY_50)
      .catch(() => NIFTY_50);
    Promise.all([universe, fetch(`${API}/api/companies`).then(r => r.json())])
      .then(([visibleSet, rows]) => {
        const visible = NIFTY50_ONLY ? rows.filter(r => visibleSet.has(r.ticker)) : rows;
        // Carry the backend's CONSENSUS-ANCHORED screener metrics onto each
        // company so the Screener displays them directly instead of recomputing
        // a bare DCF (which has no analyst data on the list page).
        const built = visible.map(r => ({
          ...buildFromApi(r),
          api: {
            iv: r.intrinsic, mos: r.mos, verdict: r.verdict, composite: r.composite,
            reliable: r.reliable, confidence: r.confidence,
            roe: r.roe, pb: r.pb, pe: r.pe,
            analystTarget: r.analyst_target, analystUpside: r.analyst_upside,
            analystRating: r.analyst_rating,
          },
        }));
        setCompanies(built.length > 0 ? built : SEED);
      })
      .catch(() => setCompanies(SEED))
      .finally(() => setLoading(false));
  }, [API]);

  const selected = useMemo(
    () => companies.find(c => (c.ticker || c.id) === selectedId),
    [companies, selectedId]
  );

  // Shared-scenario deep link (?scenario=<token>): resolve the public payload,
  // then open that company with the shared assumptions once data is loaded.
  const [sharedScn, setSharedScn] = useState(null);
  useEffect(() => {
    if (!API) return;
    const tok = new URLSearchParams(window.location.search).get("scenario");
    if (!tok) return;
    fetch(`${API}/api/scenarios/shared/${encodeURIComponent(tok)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && d.ticker) setSharedScn(d); })
      .catch(() => {});
  }, [API]);

  // Guards the history fetch against races: if the user opens company A and
  // then B before A's response lands, A's stale payload must not overwrite B's.
  const histReqRef = useRef(null);

  // Which tab the Company page opens on. Normal opens land on the overview;
  // ⌘K model commands and shared-scenario links land on the Valuation tab.
  const [companyTab, setCompanyTab] = useState(null);

  const open = id => {
    const co = companies.find(c => (c.ticker || c.id) === id);
    if (!co) return;
    setCompanyTab(null);
    setSelectedId(id);
    setAssumptions({ ...co.assumptions });
    setPrice(co.price);
    setHistPrices(null);
    histReqRef.current = co.ticker || null;

    // Fetch historical prices with real dates
    if (API && co.ticker) {
      const ticker = co.ticker;
      fetch(`${API}/api/companies/${ticker}/history`)
        .then(r => r.json())
        .then(d => { if (histReqRef.current === ticker) setHistPrices(d); })
        .catch(() => { if (histReqRef.current === ticker) setHistPrices(null); });
    }
    setView("company");
  };

  // Apply a resolved shared scenario as soon as its company is available:
  // open the name, then overlay the shared assumptions on the company's own
  // (so any field the share omits falls back to the model's derived value).
  // Deferred a tick so navigation happens after the render commit (and to keep
  // this effect free of synchronous setState).
  useEffect(() => {
    if (!sharedScn) return;
    const co = companies.find(c => (c.ticker || c.id) === sharedScn.ticker);
    if (!co) return;
    const t = setTimeout(() => {
      open(sharedScn.ticker);
      setAssumptions({ ...co.assumptions, ...(sharedScn.data || {}) });
      setCompanyTab("dcf");   // a scenario IS a valuation what-if — land on it
      setSharedScn(null);
      window.history.replaceState({}, "", window.location.pathname);
    }, 0);
    return () => clearTimeout(t);
  }, [sharedScn, companies]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, paddingBottom: isMobile ? 62 : 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        body { margin: 0; font-feature-settings: 'ss01','cv11'; }
        *::-webkit-scrollbar { height: 7px; width: 7px }
        *::-webkit-scrollbar-thumb { background: ${C.bg600}; border-radius: 4px }
        input[type=range] { -webkit-appearance: none; height: 2px; background: rgba(220,213,193,.18); border-radius: 99px; }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; height: 14px; width: 14px; border-radius: 50%;
          background: ${C.gold}; border: 2px solid ${C.bg}; cursor: pointer;
        }
        @keyframes fadein { from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;} }
        .fadein { animation: fadein .3s ease-out both; }
        @keyframes blink { 0%,100%{opacity:.4;}50%{opacity:1;} }
        .blink { animation: blink 1.6s ease-in-out infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: ${C.bg800} }
      `}</style>

      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        {view !== "company" && (
          <header style={{
            display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap",
            padding: "16px 32px", borderBottom: `1px solid ${C.line}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <TrendingUp size={20} color={C.gold} strokeWidth={1.8} />
              <span style={{ ...serif, fontSize: 22, color: C.text }}>Equity Terminal</span>
            </div>
            <nav style={{ display: "flex", gap: 4,
                          flexWrap: isMobile ? "nowrap" : "wrap",
                          overflowX: isMobile ? "auto" : "visible",
                          maxWidth: isMobile ? "100%" : "none",
                          WebkitOverflowScrolling: "touch" }}>
              {[
                { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                { id: "screener",  label: "Screener",  icon: List },
                { id: "ideas",     label: "Ideas",     icon: Sparkles },
                { id: "watchlist", label: "Watchlist", icon: Star },
                { id: "compare",   label: "Compare",   icon: GitCompare },
                { id: "results",   label: "Results",   icon: CalendarClock },
                { id: "ownership", label: "Ownership", icon: Landmark },
                { id: "operations", label: "Operations", icon: Gauge },
                { id: "sectors",   label: "Sectors",   icon: Layers },
                { id: "portfolio", label: "Portfolio", icon: Briefcase },
                { id: "track",     label: "Track Record", icon: History },
              ].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setView(id)} style={{
                  ...sans, display: "flex", alignItems: "center", gap: 7,
                  padding: "7px 13px", borderRadius: 8, cursor: "pointer",
                  fontSize: 13, fontWeight: 500, position: "relative",
                  border: `1px solid ${view === id ? C.line2 : "transparent"}`,
                  background: view === id ? C.bg800 : "transparent",
                  color: view === id ? C.gold : C.dim,
                }}>
                  <Icon size={15} strokeWidth={1.6} />{label}
                  {id === "watchlist" && watchAlerts > 0 && (
                    <span style={{ ...sans, fontSize: 10, fontWeight: 700, color: C.bg, background: C.gold,
                      borderRadius: 99, minWidth: 16, height: 16, padding: "0 4px", display: "inline-flex",
                      alignItems: "center", justifyContent: "center", marginLeft: 2 }}>{watchAlerts}</span>
                  )}
                </button>
              ))}
            </nav>
            <button onClick={() => setPaletteOpen(true)} title="Search companies (⌘K)" style={{
              ...sans, display: "flex", alignItems: "center", gap: 7, marginLeft: "auto",
              padding: "7px 13px", borderRadius: 8, cursor: "pointer",
              fontSize: 13, fontWeight: 500,
              border: `1px solid ${C.line2}`, background: "transparent", color: C.dim,
            }}>
              <Search size={15} strokeWidth={1.6} />Search
              <span style={{ ...mono, fontSize: 10, color: C.faint, border: `1px solid ${C.line}`,
                borderRadius: 4, padding: "1px 5px" }}>⌘K</span>
            </button>

            {!user ? (
              <button onClick={() => setAuthOpen(true)} style={{
                ...sans, display: "flex", alignItems: "center", gap: 7,
                padding: "7px 13px", borderRadius: 8, cursor: "pointer",
                fontSize: 13, fontWeight: 500,
                border: `1px solid ${C.gold}55`, background: C.gold + "0d", color: C.gold,
              }}>
                <LogIn size={15} strokeWidth={1.6} />Sign in
              </button>
            ) : (
              <div style={{ position: "relative" }}>
                <button onClick={() => setUserMenu(m => !m)} style={{
                  ...sans, display: "flex", alignItems: "center", gap: 8,
                  padding: "4px 10px 4px 4px", borderRadius: 99, cursor: "pointer",
                  fontSize: 13, fontWeight: 500,
                  border: `1px solid ${C.line2}`, background: "transparent", color: C.text200,
                }}>
                  <span style={{
                    ...serif, width: 26, height: 26, borderRadius: "50%",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, color: C.gold, background: C.bg800,
                    border: `1px solid ${C.gold}88`, boxShadow: `0 0 0 1px ${C.gold}22`,
                  }}>
                    {(user.name || user.email || "?").trim().charAt(0).toUpperCase()}
                  </span>
                  {user.name || user.email}
                  <ChevronDown size={13} color={C.dim} />
                </button>
                {userMenu && (
                  <>
                    <div onClick={() => setUserMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 150 }} />
                    <div className="fadein" style={{
                      position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 160,
                      minWidth: 220, background: C.bg900, border: `1px solid ${C.line2}`,
                      borderRadius: 10, boxShadow: "0 16px 48px rgba(0,0,0,0.55)", overflow: "hidden",
                    }}>
                      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line}` }}>
                        {user.name && <div style={{ ...sans, fontSize: 13, fontWeight: 500, color: C.text }}>{user.name}</div>}
                        <div style={{ ...mono, fontSize: 11, color: C.dim, marginTop: user.name ? 3 : 0 }}>{user.email}</div>
                      </div>
                      <button onClick={signOut} style={{
                        ...sans, display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "11px 16px", fontSize: 13, fontWeight: 500, textAlign: "left",
                        background: "transparent", border: "none", cursor: "pointer", color: C.dim,
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.bg800; e.currentTarget.style.color = C.text; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.dim; }}>
                        <LogOut size={14} strokeWidth={1.6} />Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </header>
        )}

        {view === "dashboard" && (
          <MarketDashboard API={API} companies={companies} onOpen={open} />
        )}
        {view === "screener" && (
          <Screener companies={companies} onOpen={open} loading={loading}
                    watched={watched} onToggleWatch={toggleWatch} API={API} />
        )}
        {view === "watchlist" && (
          <Watchlist API={API} onOpen={open} onChanged={reloadWatched}
                     user={user} requestAuth={requestAuth} />
        )}
        <Suspense fallback={<ViewLoader />}>
          {view === "compare" && (
            <Compare API={API} companies={companies} onOpen={open} seed={[...watched].slice(0, 4)} />
          )}
          {view === "results" && (
            <Results API={API} onOpen={open} />
          )}
          {view === "ownership" && (
            <Ownership API={API} onOpen={open} />
          )}
          {view === "operations" && (
            <Operations API={API} onOpen={open} />
          )}
          {view === "sectors" && (
            <Sectors API={API} onOpen={open} />
          )}
          {view === "portfolio" && (
            <Portfolio API={API} onOpen={open} user={user} requestAuth={requestAuth} />
          )}
          {view === "ideas" && (
            <Ideas API={API} onOpen={open} />
          )}
          {view === "track" && (
            <TrackRecord API={API} onOpen={open} />
          )}
          {view === "company" && selected && assumptions && (
            <Company
              co={selected}
              assumptions={assumptions}
              setAssumptions={setAssumptions}
              price={price}
              setPrice={setPrice}
              onBack={() => setView("dashboard")}
              API={API}
              allCompanies={companies}
              histPrices={histPrices}
              isWatched={watched.has(selected.ticker)}
              onToggleWatch={toggleWatch}
              initialTab={companyTab}
            />
          )}
        </Suspense>
      </div>

      {isMobile && view !== "company" && (
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 120,
          display: "flex", justifyContent: "space-around", alignItems: "center",
          background: C.bg900, borderTop: `1px solid ${C.line2}`, padding: "6px 4px 8px",
          boxShadow: "0 -6px 24px rgba(0,0,0,0.4)",
        }}>
          {[
            { id: "dashboard", label: "Home",   icon: LayoutDashboard },
            { id: "screener",  label: "Screen", icon: List },
            { id: "ideas",     label: "Ideas",  icon: Sparkles },
            { id: "watchlist", label: "Watch",  icon: Star },
            { id: "portfolio", label: "Folio",  icon: Briefcase },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setView(id)} style={{
              ...sans, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 9, padding: "2px 8px", color: view === id ? C.gold : C.dim,
            }}>
              <Icon size={19} strokeWidth={1.7} />{label}
            </button>
          ))}
        </div>
      )}

      <CommandPalette
        open={paletteOpen}
        setOpen={setPaletteOpen}
        companies={companies}
        onOpenCompany={open}
        onNavigate={setView}
        onOpenModel={(ticker, overrides) => setSharedScn({ ticker, data: overrides })}
      />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        API={API}
        onAuthed={u => setUser(u)}
      />
    </div>
  );
}
