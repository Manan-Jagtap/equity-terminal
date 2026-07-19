/* EquityVerdict — app root.
   Auth-aware: validates the stored session on boot, gates watchlist /
   portfolio behind sign-in, and lazy-loads the heavy views so the
   first paint ships a much smaller bundle. */

import { useEffect, useMemo, useState, useCallback, useRef, lazy, Suspense } from "react";
import { LayoutDashboard, List, Star, GitCompare, CalendarClock, Landmark, Gauge, History, Layers, Briefcase, Search, LogOut, ChevronDown, Sparkles , Rocket , PiggyBank , Globe2 , Boxes, Shield } from "lucide-react";
import { C, mono, sans, serif, auroraBg } from "./lib/theme.js";
import BrandMark from "./components/BrandMark.jsx";
import { useIsMobile } from "./lib/useResponsive.js";
import { SEED, buildFromApi } from "./lib/seedData.js";
import PageSkeleton from "./components/Skeleton.jsx";
import Screener from "./components/Screener.jsx";
import MarketDashboard from "./components/MarketDashboard.jsx";
import Watchlist from "./components/Watchlist.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import AuthModal from "./components/AuthModal.jsx";
import Landing from "./components/Landing.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { fetchWatchlist, saveWatch, removeWatch } from "./lib/watchlist.js";
import { getUser, me, clearSession, authFetch, logoutAll } from "./lib/auth.js";

/* Heavy views are code-split: each loads on first visit. Dashboard and
   Screener stay eager — they are the landing experience.

   lazyReload: a chunk fetch fails when the user's open session predates a
   fresh deploy (old HTML asks for hashed chunk files the CDN no longer has) —
   the "Something went wrong loading this view" boundary. One automatic reload
   picks up the new build invisibly; the sessionStorage guard stops a reload
   loop if the failure is anything else. */
const lazyReload = (factory) => lazy(() =>
  factory().then((m) => { sessionStorage.removeItem("ev-chunk-reload"); return m; })
    .catch((err) => {
      if (!sessionStorage.getItem("ev-chunk-reload")) {
        sessionStorage.setItem("ev-chunk-reload", "1");
        window.location.reload();
        return new Promise(() => {});   // reloading — never settle
      }
      throw err;
    }));

const Company     = lazyReload(() => import("./components/Company.jsx"));
const Compare     = lazyReload(() => import("./components/Compare.jsx"));
const Results     = lazyReload(() => import("./components/Results.jsx"));
const Ownership   = lazyReload(() => import("./components/Ownership.jsx"));
const Operations  = lazyReload(() => import("./components/Operations.jsx"));
const TrackRecord = lazyReload(() => import("./components/TrackRecord.jsx"));
const Styleguide  = lazyReload(() => import("./components/Styleguide.jsx"));  // internal, redesign Phase 0
const Sectors     = lazyReload(() => import("./components/Sectors.jsx"));
const FundManager = lazyReload(() => import("./components/FundManager.jsx"));
const IPOBoard    = lazyReload(() => import("./components/IPOBoard.jsx"));
const MFPanel     = lazyReload(() => import("./components/MFPanel.jsx"));
const EconomyDashboard = lazyReload(() => import("./components/EconomyDashboard.jsx"));
const Portfolio   = lazyReload(() => import("./components/Portfolio.jsx"));
const Ideas       = lazyReload(() => import("./components/Ideas.jsx"));
const Baskets     = lazyReload(() => import("./components/Baskets.jsx"));

const ViewLoader = () => <PageSkeleton label="Loading…" />;

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
  const [moreOpen, setMoreOpen] = useState(false);
  const [deepLinkMiss, setDeepLinkMiss] = useState(null);   // UX-15: bad deep-linked ticker

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

  // SEC-01: revoke every other session (leaked/old tokens) — this tab stays in.
  const signOutEverywhere = useCallback(async () => {
    if (!window.confirm("Sign out of all other devices? Any other logged-in session will be signed out. This device stays signed in.")) return;
    try {
      await logoutAll(API);
      setUserMenu(false);
      window.alert("Signed out of all other devices.");
    } catch {
      window.alert("Couldn't sign out other devices — please try again.");
    }
  }, [API]);

  // DPDP right-to-erasure: typed email confirmation, then the backend wipes
  // the account + every personal row and we drop the local session.
  const deleteAccount = useCallback(async () => {
    const email = window.prompt(
      "This permanently deletes your account, watchlist, portfolio, saved screens and scenarios.\n\nType your account email to confirm:");
    if (!email) return;
    try {
      const r = await authFetch(`${API}/api/auth/account`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_email: email.trim() }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        window.alert(d.detail || "Could not delete the account.");
        return;
      }
      clearSession();
      window.location.reload();
    } catch {
      window.alert("Network error — the account was not deleted.");
    }
  }, [API]);

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
            sentiment: r.sentiment, sentimentLabel: r.sentiment_label,
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

  // ── URL ↔ state routing: every navigation writes a #/route and browser
  // back/forward restore it exactly — the SPA behaves like real pages.
  // Hash-based so the static host needs no rewrite config. `navFromHash`
  // distinguishes "user pressed back" (replaceState — the browser already
  // moved in history) from "user clicked something" (pushState — a new entry).
  const VIEW_IDS = ["dashboard", "screener", "ideas", "baskets", "watchlist",
    "compare", "results", "ownership", "operations", "sectors", "economy",
    "ipo", "funds", "portfolio", "manager", "track", "styleguide"];
  const navFromHash = useRef(false);
  const routeRef = useRef({});
  routeRef.current = { view, selectedId, companies };
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const apply = () => {
      const { view: cv, selectedId: cs, companies: cos } = routeRef.current;
      const h = decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
      const [v, id] = h.split("/");
      if (v === "company" && id) {
        const t = id.toUpperCase();
        if (cv === "company" && (cs || "").toUpperCase() === t) return;
        if (cos.some(c => ((c.ticker || c.id) || "").toUpperCase() === t)) {
          navFromHash.current = true;
          openRef.current(t);
          setTimeout(() => { navFromHash.current = false; }, 0);
        }
      } else if (VIEW_IDS.includes(v) && cv !== v) {
        navFromHash.current = true;
        setView(v);
        setTimeout(() => { navFromHash.current = false; }, 0);
      }
    };
    apply();                                   // deep link on first paint
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep link straight to a company: retry once real data replaces the seed.
  useEffect(() => {
    const h = decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
    const [v, id] = h.split("/");
    if (v === "company" && id && view !== "company") {
      const t = id.toUpperCase();
      if (companies.some(c => ((c.ticker || c.id) || "").toUpperCase() === t)) {
        navFromHash.current = true;
        openRef.current(t);
        setTimeout(() => { navFromHash.current = false; }, 0);
      } else if (companies.length > 1) {
        // UX-15: the deep-linked ticker doesn't exist (companies have loaded past
        // the seed). Don't silently strand the visitor on a stale view — tell
        // them, and normalise the URL back to the dashboard.
        setDeepLinkMiss(t);
        navFromHash.current = true;
        history.replaceState(null, "", "#/dashboard");
        setTimeout(() => { navFromHash.current = false; }, 0);
        setTimeout(() => setDeepLinkMiss(null), 6000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies]);

  // State → URL (the writer). Empty initial hash is replaced, not pushed, so
  // the first Back never lands on a blank route.
  useEffect(() => {
    const want = view === "company" && selectedId
      ? `#/company/${encodeURIComponent(String(selectedId))}`
      : `#/${view}`;
    if (window.location.hash === want) return;
    if (navFromHash.current || !window.location.hash) {
      history.replaceState(null, "", want);
    } else {
      history.pushState(null, "", want);
    }
  }, [view, selectedId]);

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

  // Sign-in is compulsory: anonymous visitors get the landing page. Data
  // fetches above still warm in the background, so the app is instant on auth.
  // A pending ?scenario= deep link survives the gate — it applies right after
  // sign-in via the sharedScn effect.
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, ...auroraBg }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
          body { margin: 0; font-feature-settings: 'ss01','cv11'; }
          @keyframes fadein { from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;} }
          .fadein { animation: fadein .3s ease-out both; }
        `}</style>
        <Landing onSignIn={() => setAuthOpen(true)} />
        <AuthModal
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          API={API}
          onAuthed={u => setUser(u)}
        />
      </div>
    );
  }

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "screener",  label: "Screener",  icon: List },
    { id: "ideas",     label: "Ideas",     icon: Sparkles },
    { id: "baskets",   label: "Baskets",   icon: Boxes },
    { id: "watchlist", label: "Watchlist", icon: Star },
    { id: "compare",   label: "Compare",   icon: GitCompare },
    { id: "results",   label: "Results",   icon: CalendarClock },
    { id: "ownership", label: "Ownership", icon: Landmark },
    { id: "operations", label: "Operations", icon: Gauge },
    { id: "sectors",   label: "Sectors",   icon: Layers },
    { id: "economy",   label: "Economy",   icon: Globe2 },
    { id: "ipo",       label: "IPOs",      icon: Rocket },
    { id: "funds",     label: "Mutual Funds", icon: PiggyBank },
    { id: "portfolio", label: "Portfolio", icon: Briefcase },
    { id: "manager",   label: "Fund Manager", icon: Sparkles },
    { id: "track",     label: "Track Record", icon: History },
  ];
  const railVisible = !isMobile && view !== "company";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, paddingBottom: isMobile ? 62 : 0, ...auroraBg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        body { margin: 0; font-feature-settings: 'ss01','cv11'; }
        *::-webkit-scrollbar { height: 7px; width: 7px }
        *::-webkit-scrollbar-thumb { background: ${C.bg600}; border-radius: 4px }
        input[type=range] { -webkit-appearance: none; height: 2px; background: rgba(191,204,228,.18); border-radius: 99px; }
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

      {/* ── Desktop: left navigation rail (the Bloomberg-launchpad pattern —
             every destination one glance away, content gets the full width) */}
      {railVisible && (
        <aside style={{
          position: "fixed", left: 0, top: 0, bottom: 0, width: 216, zIndex: 110,
          display: "flex", flexDirection: "column", boxSizing: "border-box",
          padding: "18px 12px 14px", borderRight: `1px solid ${C.line}`,
          background: "rgba(8,13,26,0.78)", backdropFilter: "blur(16px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "2px 8px 14px" }}>
            <BrandMark size={22} />
            <span style={{ ...serif, fontSize: 18, fontWeight: 600, color: C.text }}>EquityVerdict</span>
          </div>

          <button onClick={() => setPaletteOpen(true)} title="Search companies (⌘K)" style={{
            ...sans, display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontSize: 12.5,
            border: `1px solid ${C.line2}`, background: C.bg900, color: C.dim, marginBottom: 12,
          }}>
            <Search size={14} strokeWidth={1.6} />Search
            <span style={{ ...mono, fontSize: 10, color: C.faint, border: `1px solid ${C.line}`,
              borderRadius: 4, padding: "1px 5px", marginLeft: "auto" }}>⌘K</span>
          </button>

          <nav style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setView(id)} style={{
                ...sans, display: "flex", alignItems: "center", gap: 10, position: "relative",
                padding: "9px 12px", borderRadius: 9, cursor: "pointer",
                fontSize: 13, fontWeight: 500, textAlign: "left", border: "none",
                background: view === id ? C.gold + "14" : "transparent",
                color: view === id ? C.gold : C.dim,
                boxShadow: view === id ? `inset 2px 0 0 ${C.gold}` : "none",
              }}>
                <Icon size={16} strokeWidth={1.6} />{label}
                {id === "watchlist" && watchAlerts > 0 && (
                  <span style={{ ...sans, fontSize: 10, fontWeight: 700, color: C.bg, background: C.gold,
                    borderRadius: 99, minWidth: 16, height: 16, padding: "0 4px", display: "inline-flex",
                    alignItems: "center", justifyContent: "center", marginLeft: "auto" }}>{watchAlerts}</span>
                )}
              </button>
            ))}
          </nav>

          <div style={{ position: "relative", borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: 8 }}>
            <button onClick={() => setUserMenu(m => !m)} style={{
              ...sans, display: "flex", alignItems: "center", gap: 9, width: "100%",
              padding: "7px 8px", borderRadius: 9, cursor: "pointer",
              fontSize: 12.5, fontWeight: 500, border: "none",
              background: "transparent", color: C.text200, textAlign: "left",
            }}>
              <span style={{
                ...serif, width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 600, color: C.bg,
                background: `linear-gradient(135deg, ${C.gold}, ${C.blue})`,
              }}>
                {(user.name || user.email || "?").trim().charAt(0).toUpperCase()}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.name || user.email}
              </span>
              <ChevronDown size={13} color={C.dim} style={{ marginLeft: "auto", flexShrink: 0 }} />
            </button>
            {userMenu && (
              <>
                <div onClick={() => setUserMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 150 }} />
                <div className="fadein" style={{
                  position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0, zIndex: 160,
                  background: C.bg900, border: `1px solid ${C.line2}`,
                  borderRadius: 10, boxShadow: "0 16px 48px rgba(0,0,0,0.55)", overflow: "hidden",
                }}>
                  <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.line}` }}>
                    {user.name && <div style={{ ...sans, fontSize: 13, fontWeight: 500, color: C.text }}>{user.name}</div>}
                    <div style={{ ...mono, fontSize: 10.5, color: C.dim, marginTop: user.name ? 3 : 0, overflowWrap: "anywhere" }}>{user.email}</div>
                  </div>
                  <button onClick={signOut} style={{
                    ...sans, display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "11px 14px", fontSize: 13, fontWeight: 500, textAlign: "left",
                    background: "transparent", border: "none", cursor: "pointer", color: C.dim,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.bg800; e.currentTarget.style.color = C.text; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.dim; }}>
                    <LogOut size={14} strokeWidth={1.6} />Sign out
                  </button>
                  <button onClick={signOutEverywhere} style={{
                    ...sans, display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "10px 14px", fontSize: 12, textAlign: "left",
                    background: "transparent", border: "none", cursor: "pointer", color: C.dim,
                    borderTop: `1px solid ${C.line}`,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.bg800; e.currentTarget.style.color = C.text; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.dim; }}>
                    <Shield size={13} strokeWidth={1.6} />Sign out everywhere
                  </button>
                  <button onClick={deleteAccount} style={{
                    ...sans, display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "10px 14px", fontSize: 12, textAlign: "left",
                    background: "transparent", border: "none", cursor: "pointer", color: C.faint,
                    borderTop: `1px solid ${C.line}`,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = C.red; }}
                    onMouseLeave={e => { e.currentTarget.style.color = C.faint; }}>
                    Delete account…
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>
      )}

      {/* ── Mobile: slim top bar (nav lives in the bottom tab bar) */}
      {isMobile && view !== "company" && (
        <header style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "13px 16px", borderBottom: `1px solid ${C.line}`,
        }}>
          <BrandMark size={21} />
          <span style={{ ...serif, fontSize: 18, fontWeight: 600, color: C.text }}>EquityVerdict</span>
          <button onClick={() => setPaletteOpen(true)} aria-label="Search" style={{
            marginLeft: "auto", display: "flex", padding: 8, borderRadius: 9, cursor: "pointer",
            border: `1px solid ${C.line2}`, background: "transparent",
          }}>
            <Search size={16} color={C.dim} strokeWidth={1.6} />
          </button>
          <button onClick={signOut} title="Sign out" style={{
            display: "flex", padding: 8, borderRadius: 9, cursor: "pointer",
            border: `1px solid ${C.line2}`, background: "transparent",
          }}>
            <LogOut size={16} color={C.dim} strokeWidth={1.6} />
          </button>
        </header>
      )}

      {/* UX-15: bogus deep-linked ticker → a brief, dismissible notice instead
          of silently stranding the visitor on the dashboard. */}
      {deepLinkMiss && (
        <div role="status" style={{
          position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
          zIndex: 240, ...sans, fontSize: 12.5, color: C.text,
          background: C.bg900, border: `1px solid ${C.line2}`, borderRadius: 8,
          padding: "9px 14px", boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}>
          "{deepLinkMiss}" isn't a covered ticker — showing the dashboard instead.
          <button onClick={() => setDeepLinkMiss(null)} style={{
            ...sans, marginLeft: 12, background: "transparent", border: "none",
            color: C.gold, cursor: "pointer", fontSize: 12.5 }}>Dismiss</button>
        </div>
      )}

      <main style={{ marginLeft: railVisible ? 216 : 0 }}>
        <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <ErrorBoundary resetKey={view}>

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
          {view === "economy" && (
            <EconomyDashboard />
          )}
          {view === "portfolio" && (
            <Portfolio API={API} onOpen={open} user={user} requestAuth={requestAuth} onAnalyse={() => setView("manager")} />
          )}
          {view === "manager" && (
            <FundManager API={API} onOpen={open} user={user} requestAuth={requestAuth} />
          )}
          {view === "ipo" && (
            <IPOBoard />
          )}
          {view === "funds" && (
            <MFPanel />
          )}
          {view === "ideas" && (
            <Ideas API={API} onOpen={open} />
          )}
          {view === "baskets" && (
            <Baskets API={API} onOpen={open} />
          )}
          {view === "track" && (
            <TrackRecord API={API} onOpen={open} />
          )}
          {view === "styleguide" && (
            <Styleguide />
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
              onOpenTicker={open}
            />
          )}
        </Suspense>
        </ErrorBoundary>
        {/* UX-01: an unavoidable disclaimer on EVERY logged-in view (verdicts,
            scores and targets appear on most of them, including the company
            page's default Business tab). Compulsory login means the logged-out
            landing disclaimer is otherwise never seen again. */}
        <div style={{ ...sans, fontSize: 10.5, lineHeight: 1.6, color: C.faint,
          borderTop: `1px solid ${C.line}`, marginTop: 28, paddingTop: 14, paddingBottom: 8 }}>
          EquityVerdict is an independent research &amp; analytics tool provided for educational
          purposes only. It is <b style={{ color: C.dim }}>not investment advice</b> and is not a SEBI-registered
          research analyst or investment adviser. Verdicts, scores, fair values and target prices are
          transparent model outputs — not recommendations to buy or sell any security. Do your own
          diligence and consult a registered adviser before investing.
        </div>
        </div>
      </main>

      {isMobile && moreOpen && (
        <div onClick={() => setMoreOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 118, background: "rgba(4,8,16,0.55)" }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: "absolute", left: 0, right: 0, bottom: 56,
            background: C.bg900, borderTop: `1px solid ${C.line2}`,
            borderRadius: "14px 14px 0 0", padding: "16px 14px 18px",
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14,
          }}>
            {[
              { id: "ideas",      label: "Ideas",      icon: Sparkles },
              { id: "baskets",    label: "Baskets",    icon: Boxes },
              { id: "watchlist",  label: "Watchlist",  icon: Star },
              { id: "compare",    label: "Compare",    icon: GitCompare },
              { id: "results",    label: "Results",    icon: CalendarClock },
              { id: "ownership",  label: "Ownership",  icon: Landmark },
              { id: "operations", label: "Operations", icon: Gauge },
              { id: "sectors",    label: "Sectors",    icon: Layers },
              { id: "economy",    label: "Economy",    icon: Globe2 },
              { id: "ipo",        label: "IPOs",       icon: Rocket },
              { id: "funds",      label: "Funds",      icon: PiggyBank },
              { id: "track",      label: "Track Rec.", icon: History },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setView(id); setMoreOpen(false); }} style={{
                ...sans, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                background: view === id ? C.bg800 : "transparent", border: `1px solid ${view === id ? C.line2 : "transparent"}`,
                borderRadius: 10, cursor: "pointer", fontSize: 10, padding: "10px 4px",
                color: view === id ? C.gold : C.text200,
              }}>
                <Icon size={20} strokeWidth={1.6} />{label}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* UX-10: the bottom tab bar stays on mobile COMPANY pages too — otherwise
          arriving from a share/deep link dead-ended with only "Back to screener".
          The root reserves paddingBottom:62 on mobile so content isn't hidden. */}
      {isMobile && (
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 120,
          display: "flex", justifyContent: "space-around", alignItems: "center",
          background: C.bg900, borderTop: `1px solid ${C.line2}`, padding: "6px 4px 8px",
          boxShadow: "0 -6px 24px rgba(0,0,0,0.4)",
        }}>
          {[
            { id: "dashboard", label: "Home",   icon: LayoutDashboard },
            { id: "screener",  label: "Screen", icon: List },
            { id: "manager",   label: "Manager", icon: Sparkles },
            { id: "portfolio", label: "Folio",  icon: Briefcase },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setView(id); setMoreOpen(false); }} style={{
              ...sans, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 9, padding: "2px 8px", color: view === id && !moreOpen ? C.gold : C.dim,
            }}>
              <Icon size={19} strokeWidth={1.7} />{label}
            </button>
          ))}
          <button onClick={() => setMoreOpen(v => !v)} style={{
            ...sans, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 9, padding: "2px 8px", color: moreOpen ? C.gold : C.dim,
          }}>
            <Layers size={19} strokeWidth={1.7} />More
          </button>
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
