/* Equity Terminal — app root.
   Step 7: updated fonts (Instrument Serif + Inter) and passes
   historical price data (with dates) down to Company. */

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { TrendingUp, LayoutDashboard, List, Star, GitCompare, CalendarClock, Landmark, Gauge, History, Layers, Briefcase, Search } from "lucide-react";
import { C, mono, sans, serif, gridBg } from "./lib/theme.js";
import { SEED, buildFromApi } from "./lib/seedData.js";
import Screener from "./components/Screener.jsx";
import Company  from "./components/Company.jsx";
import MarketDashboard from "./components/MarketDashboard.jsx";
import Watchlist from "./components/Watchlist.jsx";
import Compare from "./components/Compare.jsx";
import Results from "./components/Results.jsx";
import Ownership from "./components/Ownership.jsx";
import Operations from "./components/Operations.jsx";
import TrackRecord from "./components/TrackRecord.jsx";
import Sectors from "./components/Sectors.jsx";
import Portfolio from "./components/Portfolio.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import { fetchWatchlist, saveWatch, removeWatch } from "./lib/watchlist.js";

/* ── TEMPORARY: focus the terminal on the Nifty 50 only ──────────────────────
   While we make the Nifty 50 pages 100% accurate, everything else is hidden.
   To show all companies again, set NIFTY50_ONLY = false.
   Index composition changes occasionally — edit this list if a name is wrong.   */
const NIFTY50_ONLY = true;
const NIFTY_50 = new Set([
  "RELIANCE","HDFCBANK","BHARTIARTL","TCS","ICICIBANK","SBIN","INFY","BAJFINANCE","ITC","LT",
  "HINDUNILVR","KOTAKBANK","AXISBANK","M&M","SUNPHARMA","MARUTI","NTPC","HCLTECH","ULTRACEMCO","TITAN",
  "BAJAJFINSV","ONGC","ADANIENT","ADANIPORTS","POWERGRID","WIPRO","JSWSTEEL","NESTLEIND","COALINDIA","TATASTEEL",
  "ASIANPAINT","BAJAJ-AUTO","TRENT","JIOFIN","BEL","GRASIM","HINDALCO","SBILIFE","TECHM","HDFCLIFE",
  "SHRIRAMFIN","CIPLA","DRREDDY","EICHERMOT","BRITANNIA","APOLLOHOSP","TATACONSUM","HEROMOTOCO","ETERNAL","TATAMOTORS",
]);

export default function App() {
  const API = import.meta.env.VITE_API_URL;

  const [companies,   setCompanies]   = useState(SEED);
  const [loading,     setLoading]     = useState(false);
  const [view,        setView]        = useState("dashboard");
  const [selectedId,  setSelectedId]  = useState(null);
  const [assumptions, setAssumptions] = useState(null);
  const [price,       setPrice]       = useState(0);
  const [histPrices,  setHistPrices]  = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Watchlist membership (set of tickers) + a live alert count for the nav badge.
  const [watched,     setWatched]     = useState(() => new Set());
  const [watchAlerts, setWatchAlerts] = useState(0);

  // Ref mirror of `watched` so toggleWatch never captures a stale Set
  // (rapid toggles / memoized children would otherwise act on old state).
  const watchedRef = useRef(watched);
  useEffect(() => { watchedRef.current = watched; }, [watched]);

  const reloadWatched = useCallback(() => {
    if (!API) return;
    fetchWatchlist(API)
      .then(d => {
        const next = new Set((d.items || []).map(i => i.ticker));
        watchedRef.current = next;
        setWatched(next);
        setWatchAlerts(d.triggered || 0);
      })
      .catch(() => {});
  }, [API]);
  useEffect(() => { reloadWatched(); }, [reloadWatched]);

  const toggleWatch = useCallback(async (ticker) => {
    if (!API || !ticker) return;
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
  }, [API, reloadWatched]);

  useEffect(() => {
    if (!API) return;
    setLoading(true);
    fetch(`${API}/api/companies`)
      .then(r => r.json())
      .then(rows => {
        const visible = NIFTY50_ONLY ? rows.filter(r => NIFTY_50.has(r.ticker)) : rows;
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

  // Guards the history fetch against races: if the user opens company A and
  // then B before A's response lands, A's stale payload must not overwrite B's.
  const histReqRef = useRef(null);

  const open = id => {
    const co = companies.find(c => (c.ticker || c.id) === id);
    if (!co) return;
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

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
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
            <nav style={{ display: "flex", gap: 4 }}>
              {[
                { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                { id: "screener",  label: "Screener",  icon: List },
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
          <Watchlist API={API} onOpen={open} onChanged={reloadWatched} />
        )}
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
          <Portfolio API={API} onOpen={open} />
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
          />
        )}
      </div>

      <CommandPalette
        open={paletteOpen}
        setOpen={setPaletteOpen}
        companies={companies}
        onOpenCompany={open}
      />
    </div>
  );
}
