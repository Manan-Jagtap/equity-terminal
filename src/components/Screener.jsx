/* Screener — search/sort/filter table of all companies.
   Click row → opens Company detail. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, ChevronRight, Database, Star, Download, Bookmark, Save, Trash2 } from "lucide-react";
import { C, mono, sans } from "../lib/theme.js";
import { fmt, inr, pct, multiple, inrOrDash, signedPct } from "../lib/formatters.js";
import { fundamentals } from "../lib/valuation.js";
import { recommend } from "../lib/recommend.js";
import { VerdictBadge } from "./primitives.jsx";
import Logo from "./Logo.jsx";
import { authFetch, getUser } from "../lib/auth.js";

const confColor = lvl => lvl === "high" ? C.green : lvl === "medium" ? C.gold : C.red;

/* One sector→bucket mapping for BOTH the dropdown and the row filter (they
   used to duplicate this logic). Order matters: "Consumer Services" must hit
   Consumer before the generic Services bucket; "Construction Materials" is
   Industrials, not Realty. Covers every sector name in the Nifty 500 feed. */
const sectorBucket = sec => {
  const s = (sec || "").toLowerCase();
  if (s.includes("financial") || s.includes("bank") || s.includes("nbfc") || s.includes("insurance")) return "Financials";
  if (s.includes("tech") || s.includes("information")) return "Technology";
  if (s.includes("pharma") || s.includes("health")) return "Healthcare";
  if (s.includes("auto")) return "Auto";
  if (s.includes("capital goods") || s.includes("construction") || s.includes("engineering") || s.includes("industrial") || s.includes("defence")) return "Industrials";
  if (s.includes("fmcg") || s.includes("consumer")) return "Consumer";
  if (s.includes("energy") || s.includes("oil") || s.includes("power") || s.includes("gas") || s.includes("utilit")) return "Energy";
  if (s.includes("metal") || s.includes("mining")) return "Metals";
  if (s.includes("chem")) return "Chemicals";
  if (s.includes("realty") || s.includes("real estate")) return "Realty";
  if (s.includes("telecom")) return "Telecom";
  if (s.includes("textile")) return "Textiles";
  if (s.includes("media")) return "Media";
  if (s.includes("service")) return "Services";
  return "Other";
};

export default function Screener({ companies, onOpen, loading, watched, onToggleWatch, API }) {
  const isWatched = t => watched && watched.has(t);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("rank");
  const [sf, setSf] = useState("All");
  // Query-builder filters: verdict, data confidence, minimum margin of safety.
  const [vf, setVf] = useState("All");
  const [cf, setCf] = useState("All");
  const [minMos, setMinMos] = useState("");
  const VRANK = { BUY: 5, ACCUMULATE: 4, HOLD: 3, REDUCE: 2, TRIM: 2, AVOID: 1 };

  // Saved screens: name the current filter state (query/sector/sort), reload it
  // with one click. Auth-scoped like scenarios; silent when signed out.
  const user = getUser();
  const [screens, setScreens] = useState([]);
  const [screenName, setScreenName] = useState("");
  const reloadScreens = useCallback(() => {
    // No sync clear here: the whole row is gated on `user`, and a user change
    // re-fetches, so a stale list is never rendered.
    if (!API || !user) return;
    authFetch(`${API}/api/screens`)
      .then(r => (r.ok ? r.json() : { items: [] }))
      .then(d => setScreens(d.items || []))
      .catch(() => setScreens([]));
  }, [API, user]);
  useEffect(() => { reloadScreens(); }, [reloadScreens]);
  const saveScreen = async () => {
    if (!screenName.trim()) return;
    try {
      await authFetch(`${API}/api/screens`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: screenName.trim(), data: { q, sort, sf, vf, cf, minMos } }),
      });
      setScreenName(""); reloadScreens();
    } catch { /* keep the name so the user can retry */ }
  };
  const applyScreen = s => {
    const d = s.data || {};
    setQ(d.q ?? ""); setSort(d.sort ?? "rank"); setSf(d.sf ?? "All");
    setVf(d.vf ?? "All"); setCf(d.cf ?? "All"); setMinMos(d.minMos ?? "");
  };
  const deleteScreen = async id => {
    try { await authFetch(`${API}/api/screens/${id}`, { method: "DELETE" }); } catch { /* noop */ }
    reloadScreens();
  };

  const sectors = useMemo(
    () => ["All", ...Array.from(new Set(companies.map(c => sectorBucket(c.sector)))).sort()],
    [companies]);

  const rows = useMemo(() => companies
    .map(co => {
      const f = fundamentals(co);
      const a = co.api;
      // Prefer the backend's CONSENSUS-ANCHORED screener metrics (these include
      // the analyst overlay). Only fall back to a local recompute for seed/offline
      // rows that never came from the API.
      if (a && a.iv != null) {
        // NO CALL / NO DATA names: the model has disowned its own intrinsic, so
        // never display or sort on it — that's how a +717% "margin of safety"
        // ends up green next to a grey badge. Fall back to analyst consensus
        // (clearly labeled) so the row still gives the user a reference point.
        const noCall = a.verdict === "LOW CONF" || a.verdict === "NO DATA";
        return {
          co,
          iv: noCall ? null : a.iv,
          mos: noCall ? null : a.mos,
          consensus: noCall ? a.analystTarget : null,
          consensusUpside: noCall ? a.analystUpside : null,
          verdict: a.verdict,
          composite: a.composite ?? 0,
          reliable: a.reliable !== false,
          confidence: { level: a.confidence || "medium", flags: [] },
          pb: a.pb ?? f.pb, pe: a.pe ?? f.pe, roe: a.roe ?? f.roe,
          sortMos: noCall ? -Infinity : (a.mos ?? -Infinity),
        };
      }
      const r = recommend(co, co.assumptions);
      return { co, ...r, pb: f.pb, pe: f.pe, roe: f.roe, sortMos: r.mos ?? -Infinity };
    })
    .filter(r => {
      const mQ = (r.co.name + r.co.ticker).toLowerCase().includes(q.toLowerCase());
      return mQ && (sf === "All" || sectorBucket(r.co.sector) === sf);
    })
    .filter(r => {
      if (vf !== "All" && r.verdict !== vf) return false;
      if (cf !== "All" && r.confidence.level !== cf) return false;
      const m = parseFloat(minMos);
      if (!isNaN(m) && (r.mos == null || r.mos * 100 < m)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "rank") {
        const d = (VRANK[b.verdict] || 0) - (VRANK[a.verdict] || 0);
        return d !== 0 ? d : (b.sortMos - a.sortMos);
      }
      if (sort === "composite") return b.composite - a.composite;
      if (sort === "mos")       return b.sortMos - a.sortMos;
      if (sort === "roe")       return (b.roe || 0) - (a.roe || 0);
      return a.co.name.localeCompare(b.co.name);
    }), [companies, q, sort, sf, vf, cf, minMos]);

  const Th = ({ children, k }) => (
    <th onClick={() => k && setSort(k)} style={{
      ...sans,
      color: sort === k ? C.gold : C.dim,
      fontSize: 11, fontWeight: 500,
      textAlign: "right", padding: "10px 12px",
      textTransform: "uppercase", letterSpacing: "0.04em",
      cursor: k ? "pointer" : "default",
      whiteSpace: "nowrap",
    }}>{children}</th>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: C.panel2, border: `1px solid ${C.line}`,
          borderRadius: 8, padding: "8px 12px", flex: "1 1 240px",
        }}>
          <Search size={15} color={C.dim} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search company or ticker…"
            style={{ ...sans, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 14, width: "100%" }}
          />
        </div>
        <select value={sf} onChange={e => setSf(e.target.value)} style={{
          ...sans, background: C.panel2, border: `1px solid ${C.line}`,
          borderRadius: 8, color: C.text, padding: "8px 12px",
          fontSize: 13, cursor: "pointer", outline: "none",
        }}>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={vf} onChange={e => setVf(e.target.value)} title="Filter by verdict" style={{
          ...sans, background: C.panel2, border: `1px solid ${vf !== "All" ? C.gold + "88" : C.line}`,
          borderRadius: 8, color: vf !== "All" ? C.gold : C.text, padding: "8px 12px",
          fontSize: 13, cursor: "pointer", outline: "none",
        }}>
          {["All", "BUY", "ACCUMULATE", "HOLD", "REDUCE", "AVOID"].map(v =>
            <option key={v} value={v}>{v === "All" ? "Any verdict" : v}</option>)}
        </select>
        <select value={cf} onChange={e => setCf(e.target.value)} title="Filter by data confidence" style={{
          ...sans, background: C.panel2, border: `1px solid ${cf !== "All" ? C.gold + "88" : C.line}`,
          borderRadius: 8, color: cf !== "All" ? C.gold : C.text, padding: "8px 12px",
          fontSize: 13, cursor: "pointer", outline: "none",
        }}>
          {[["All", "Any confidence"], ["high", "High conf"], ["medium", "Med conf"], ["low", "Low conf"]].map(([v, l]) =>
            <option key={v} value={v}>{l}</option>)}
        </select>
        <input value={minMos} onChange={e => setMinMos(e.target.value)}
          placeholder="MoS ≥ %" inputMode="decimal" title="Minimum margin of safety (%)"
          style={{ ...mono, width: 74, background: C.panel2, fontSize: 12, color: minMos ? C.gold : C.text,
                   border: `1px solid ${minMos ? C.gold + "88" : C.line}`, borderRadius: 8,
                   padding: "8px 10px", outline: "none" }} />
        <div style={{ ...sans, color: C.faint, fontSize: 12 }}>
          {loading ? "Loading…" : `${rows.length} companies`}
        </div>
        {API && (
          <a href={`${API}/api/export/screener.xlsx`} title="Download screener as Excel" style={{
            ...sans, display: "flex", alignItems: "center", gap: 6, marginLeft: "auto",
            fontSize: 12, fontWeight: 500, textDecoration: "none",
            padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            border: `1px solid ${C.gold}66`, color: C.gold, background: C.gold + "0d",
          }}>
            <Download size={13} /> Excel
          </a>
        )}
      </div>

      {user && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim, display: "flex", alignItems: "center", gap: 6 }}>
            <Bookmark size={12} color={C.gold} /> Screens
          </span>
          <input
            value={screenName} onChange={e => setScreenName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") saveScreen(); }}
            placeholder="Name this screen…"
            style={{ ...mono, fontSize: 12, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, color: C.text, padding: "5px 10px", width: 150, outline: "none" }}
          />
          <button onClick={saveScreen} disabled={!screenName.trim()} style={{
            ...sans, display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500,
            padding: "5px 11px", borderRadius: 7, cursor: screenName.trim() ? "pointer" : "default",
            border: `1px solid ${C.gold}66`, color: C.gold, background: C.gold + "0d",
            opacity: screenName.trim() ? 1 : 0.5,
          }}>
            <Save size={11} /> Save
          </button>
          {screens.map(s => (
            <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 5,
              border: `1px solid ${C.line}`, borderRadius: 99, padding: "3px 6px 3px 11px", background: C.panel2 }}>
              <button onClick={() => applyScreen(s)} title="Apply screen"
                style={{ ...sans, fontSize: 12, color: C.text200, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>{s.name}</button>
              <button onClick={() => deleteScreen(s.id)} title="Delete" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, lineHeight: 0 }}>
                <Trash2 size={11} color={C.faint} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflowX: "auto", background: C.panel }}>
        <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
          <thead style={{ background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
            <tr>
              <th
                onClick={() => setSort("name")}
                style={{
                  ...sans, color: sort === "name" ? C.gold : C.dim,
                  fontSize: 11, fontWeight: 500, textAlign: "left",
                  padding: "10px 16px", textTransform: "uppercase",
                  letterSpacing: "0.04em", cursor: "pointer",
                }}
              >Company</th>
              <Th k="mos">CMP / Intrinsic</Th>
              <Th k="mos">MoS</Th>
              <Th k="roe">ROE</Th>
              <Th>P/B</Th>
              <Th>P/E</Th>
              <Th k="composite">Score</Th>
              <Th>Verdict</Th>
              <th style={{ width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ ...sans, textAlign: "center", padding: 40, color: C.faint }}>Loading live data…</td></tr>
            ) : rows.map((r, idx) => (
              <tr
                key={r.co.ticker || r.co.id}
                onClick={() => onOpen(r.co.ticker || r.co.id)}
                style={{ borderTop: idx ? `1px solid ${C.line}` : "none", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = C.panel2)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "11px 16px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    {onToggleWatch && (
                      <button title={isWatched(r.co.ticker) ? "Remove from watchlist" : "Add to watchlist"}
                        onClick={e => { e.stopPropagation(); onToggleWatch(r.co.ticker); }}
                        style={{ background:"transparent", border:"none", cursor:"pointer", padding:2, lineHeight:0, flexShrink:0 }}>
                        <Star size={14} color={isWatched(r.co.ticker) ? C.gold : C.faint}
                          fill={isWatched(r.co.ticker) ? C.gold : "none"} />
                      </button>
                    )}
                    <span title={`Data confidence: ${r.confidence.level}${r.confidence.flags.length ? " — " + r.confidence.flags.join("; ") : ""}`}
                      style={{ width:7, height:7, borderRadius:"50%", background:confColor(r.confidence.level), flexShrink:0 }} />
                    <Logo ticker={r.co.ticker} name={r.co.name} size={26} />
                    <div>
                      <div style={{ ...sans, color: C.text, fontSize: 13, fontWeight: 500 }}>{r.co.name}</div>
                      <div style={{ ...mono, color: C.faint, fontSize: 10 }}>{r.co.ticker} · {r.co.sector}</div>
                    </div>
                  </div>
                </td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12 }}>
                  {inr(r.co.price)} <span style={{ color: C.faint }}>/</span>{" "}
                  {r.consensus != null
                    ? <span title="Analyst consensus target — our model has no call on this name" style={{ color: C.dim }}>{inrOrDash(r.consensus)}<span style={{ fontSize: 9, color: C.faint }}> ⌖</span></span>
                    : <span style={{ color: C.gold }}>{inrOrDash(r.iv)}</span>}
                </td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: r.mos == null ? C.faint : r.mos >= 0 ? C.green : C.red }}>
                  {r.mos != null ? signedPct(r.mos)
                    : r.consensusUpside != null
                      ? <span title="Analyst consensus upside — not our model" style={{ color: C.dim }}>{signedPct(r.consensusUpside)}<span style={{ fontSize: 9, color: C.faint }}> ⌖</span></span>
                      : "—"}
                </td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: C.text }}>{pct(r.roe)}</td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: C.text }}>{multiple(r.pb, 2)}</td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: C.text }}>{multiple(r.pe, 1)}</td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: C.text }}>{r.reliable ? fmt(r.composite) : "—"}</td>
                <td style={{ textAlign: "right", padding: "11px 12px" }}><VerdictBadge verdict={r.verdict} /></td>
                <td style={{ textAlign: "center" }}><ChevronRight size={14} color={C.faint} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        marginTop: 14, border: `1px solid ${C.line}`,
        borderRadius: 8, background: C.panel,
        padding: "11px 16px", display: "flex", alignItems: "center", gap: 10,
      }}>
        <Database size={14} color={C.gold} />
        <span style={{ ...sans, color: C.dim, fontSize: 12 }}>
          Intrinsic = blended fair value (DCF / Residual-Income + relative cross-checks) · the dot shows data confidence
          (green = high, amber = medium, red = low) · score &amp; verdict are suppressed when data is insufficient · click a row for the full model
        </span>
      </div>
    </div>
  );
}
