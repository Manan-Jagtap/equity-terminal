/* Equity Research Terminal — application root.

   This file is intentionally small: it owns the top-level state (which view
   we're on, the list of companies, the currently selected ticker, the
   editable assumptions for the selected company) and the global font import.

   All actual logic lives in src/lib/. All UI lives in src/components/. */

import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { C, mono, sans, serif } from "./lib/theme.js";
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

  // Fetch live company list on mount when an API URL is configured.
  useEffect(() => {
    if (!API) return;
    setLoading(true);
    fetch(`${API}/api/companies`)
      .then(r => r.json())
      .then(rows => {
        const mapped = rows.map(r => buildFromApi(r));
        setCompanies(mapped.length > 0 ? mapped : SEED);
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
    setView("company");
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        body { margin: 0 }
        *::-webkit-scrollbar { height: 7px; width: 7px }
        *::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 4px }
        input[type=range] { height: 4px; border-radius: 2px; background: ${C.line} }
        select option { background: ${C.panel2} }
      `}</style>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "22px 20px 80px" }}>
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingBottom: 16, borderBottom: `1px solid ${C.line}`, marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: C.gold + "18", border: `1px solid ${C.gold}55`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <TrendingUp size={18} color={C.gold} />
            </div>
            <div>
              <div style={{ ...serif, fontSize: 20, fontWeight: 600, color: C.text, lineHeight: 1 }}>
                Equity Research Terminal
              </div>
              <div style={{ ...mono, fontSize: 11, color: C.faint, marginTop: 3 }}>
                DCF · statements · technicals · verdict
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!loading && (
              <div style={{ ...sans, fontSize: 11, color: C.faint }}>
                {companies.length} companies
              </div>
            )}
            <div style={{
              ...sans, fontSize: 11, color: C.goldDim,
              border: `1px solid ${C.goldDim}55`,
              padding: "4px 10px", borderRadius: 20,
              background: C.gold + "0d",
            }}>
              {API ? "LIVE DATA" : "SAMPLE DATA"}
            </div>
          </div>
        </header>

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
          />
        )}
      </div>
    </div>
  );
}
