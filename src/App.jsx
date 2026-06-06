/* Equity Terminal — app root.
   Step 7: updated fonts (Instrument Serif + Inter) and passes
   historical price data (with dates) down to Company. */

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, LayoutDashboard, List } from "lucide-react";
import { C, mono, sans, serif, gridBg } from "./lib/theme.js";
import { SEED, buildFromApi } from "./lib/seedData.js";
import Screener from "./components/Screener.jsx";
import Company  from "./components/Company.jsx";
import MarketDashboard from "./components/MarketDashboard.jsx";

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

  useEffect(() => {
    if (!API) return;
    setLoading(true);
    fetch(`${API}/api/companies`)
      .then(r => r.json())
      .then(rows => {
        const visible = NIFTY50_ONLY ? rows.filter(r => NIFTY_50.has(r.ticker)) : rows;
        setCompanies(visible.length > 0 ? visible.map(r => buildFromApi(r)) : SEED);
      })
      .catch(() => setCompanies(SEED))
      .finally(() => setLoading(false));
  }, [API]);

  const selected = useMemo(
    () => companies.find(c => (c.ticker || c.id) === selectedId),
    [companies, selectedId]
  );

  const open = id => {
    const co = companies.find(c => (c.ticker || c.id) === id);
    if (!co) return;
    setSelectedId(id);
    setAssumptions({ ...co.assumptions });
    setPrice(co.price);
    setHistPrices(null);

    // Fetch historical prices with real dates
    if (API && co.ticker) {
      fetch(`${API}/api/companies/${co.ticker}/history`)
        .then(r => r.json())
        .then(d => setHistPrices(d))
        .catch(() => setHistPrices(null));
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
              ].map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setView(id)} style={{
                  ...sans, display: "flex", alignItems: "center", gap: 7,
                  padding: "7px 13px", borderRadius: 8, cursor: "pointer",
                  fontSize: 13, fontWeight: 500,
                  border: `1px solid ${view === id ? C.line2 : "transparent"}`,
                  background: view === id ? C.bg800 : "transparent",
                  color: view === id ? C.gold : C.dim,
                }}>
                  <Icon size={15} strokeWidth={1.6} />{label}
                </button>
              ))}
            </nav>
          </header>
        )}

        {view === "dashboard" && (
          <MarketDashboard API={API} companies={companies} onOpen={open} />
        )}
        {view === "screener" && (
          <Screener companies={companies} onOpen={open} loading={loading} />
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
          />
        )}
      </div>
    </div>
  );
}
