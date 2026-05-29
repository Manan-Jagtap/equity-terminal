/* Equity Terminal — app root.
   Step 7: updated fonts (Instrument Serif + Inter) and passes
   historical price data (with dates) down to Company. */

import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { C, mono, sans, serif, gridBg } from "./lib/theme.js";
import { SEED, buildFromApi } from "./lib/seedData.js";
import Screener from "./components/Screener.jsx";
import Company  from "./components/Company.jsx";

export default function App() {
  const API = import.meta.env.VITE_API_URL;

  const [companies,   setCompanies]   = useState(SEED);
  const [loading,     setLoading]     = useState(false);
  const [view,        setView]        = useState("screener");
  const [selectedId,  setSelectedId]  = useState(null);
  const [assumptions, setAssumptions] = useState(null);
  const [price,       setPrice]       = useState(0);
  const [histPrices,  setHistPrices]  = useState(null);

  useEffect(() => {
    if (!API) return;
    setLoading(true);
    fetch(`${API}/api/companies`)
      .then(r => r.json())
      .then(rows => setCompanies(rows.length > 0 ? rows.map(r => buildFromApi(r)) : SEED))
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
      fetch(`${API}/api/companies/${co.ticker}/history/prices`)
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
            onBack={() => setView("screener")}
            API={API}
            allCompanies={companies}
            histPrices={histPrices}
          />
        )}
      </div>
    </div>
  );
}
