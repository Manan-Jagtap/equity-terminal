/* Screener — search/sort/filter table of all companies.
   Click row → opens Company detail. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, ChevronRight, Database, Star, Download, Bookmark, Save, Trash2 } from "lucide-react";
import { C, mono, sans } from "../lib/theme.js";
import { fmt, inr, pct, multiple, inrOrDash, signedPct } from "../lib/formatters.js";
import { fundamentals } from "../lib/valuation.js";
import { valuationView } from "../lib/engineView.js";
import { VerdictBadge } from "./primitives.jsx";
import PageHeader from "./ui/PageHeader.jsx";
import Logo from "./Logo.jsx";
import { authFetch, getUser } from "../lib/auth.js";
import { useLive } from "../lib/live.js";
import { rowActivate } from "../lib/a11y.js";

const confColor = lvl => lvl === "high" ? C.green : lvl === "medium" ? C.gold : C.red;

/* Data confidence as a 3-segment meter: 3 filled = high, 2 = medium, 1 = low.
   The FILL COUNT is the primary channel and colour is redundant reinforcement,
   which is the inverse of what the 7px dot did. Same footprint (7px wide), so
   the row rhythm is unchanged. */
const CONF_STEPS = { high: 3, medium: 2, low: 1 };

/* Three states, not two. `flags` is UNDEFINED — never [] — for rows whose
   confidence came from /api/companies: measured against the live payload on
   9 Aug 2026, that endpoint serialises confidence as a bare level string
   ("high" | "medium" | "low") in 1013/1013 rows and carries no reasons at all.
   Only rows that fall through to the local recompute (50 of those 1013) have
   real flags, from dataQuality().
   So undefined has to read as "not carried on this endpoint", never as "none
   found". The row builder below used to hardcode an empty array, which asserted
   a clean bill of health for the other 963 rows — including the 128 the engine
   itself rated LOW confidence, i.e. exactly the names a user hovers to ask why.
   Those rows get a pointer to the company page instead of silence: that page
   fetches the per-ticker endpoint, whose confidence IS {score, level, flags},
   and it renders them under Principal risks. */
function confDetail(flags) {
  if (!flags) return null;
  return flags.length ? flags.join("; ") : "no data-quality flags";
}

function ConfidenceMeter({ conf }) {
  const level = conf?.level || "low";
  const filled = CONF_STEPS[level] ?? 1;
  const tone = confColor(level);
  const detail = confDetail(conf?.flags);
  const base = `Data confidence: ${level}`;
  // The company-page pointer is in the hover tooltip only. aria-label stays
  // terse without flags because that sentence is identical on 963 of 1013 rows
  // — it is navigation chrome, and a screen-reader user tabbing the table would
  // hear it once per row. Real per-row flags, when the payload has them, DO go
  // into aria-label: title is not announced once role/aria-label are set, so
  // that was the only channel in which those 50 rows' reasons were reachable.
  const label = detail ? `${base} — ${detail}` : base;
  return (
    <span role="img" aria-label={label}
      title={detail ? label : `${base} — open the company page for the reasons`}
      style={{ display: "inline-flex", flexDirection: "column-reverse", gap: 1,
               width: 7, flexShrink: 0, lineHeight: 0 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ height: 2, borderRadius: 1,
          background: i < filled ? tone : C.line2 }} />
      ))}
    </span>
  );
}
const sentColor = lbl => lbl === "positive" ? C.green : lbl === "negative" ? C.red : C.gold;

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
  const liveFeed = useLive(API);   // near-real-time CMP ticks (shared store)
  // SEBI cap bands (₹cr): Large ≥ 67,000 (~top 100), Mid 22,000–67,000, else Small.
  const capBand = (co, livePx) => {
    const px = livePx ?? co.price;
    const m = (px && co.shares) ? px * co.shares : (co.market_cap ?? null);
    if (m == null) return null;
    return m >= 67000 ? "Large" : m >= 22000 ? "Mid" : "Small";
  };
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("rank");
  const [sf, setSf] = useState("All");
  // Query-builder filters: verdict, data confidence, minimum margin of safety.
  const [vf, setVf] = useState("All");
  const [cf, setCf] = useState("All");
  const [minMos, setMinMos] = useState("");
  const [capf, setCapf] = useState("All");   // cap band filter
  const [tf, setTf] = useState("All");       // technical filter
  const [techMap, setTechMap] = useState(null);
  const VRANK = { BUY: 5, ACCUMULATE: 4, HOLD: 3, REDUCE: 2, TRIM: 2, AVOID: 1 };

  // Saved screens: name the current filter state (query/sector/sort), reload it
  // with one click. Auth-scoped like scenarios; silent when signed out.
  // getUser() parses localStorage and returns a NEW object every render, so it
  // must NOT sit in a hook dep list — keying reloadScreens on `user` made the
  // effect refetch /api/screens on every commit (a non-stop backend loop for
  // every signed-in user). Depend on the stable identity string instead.
  const user = getUser();
  const userKey = user?.email || user?.id || null;
  const [screens, setScreens] = useState([]);
  const [screenName, setScreenName] = useState("");
  const reloadScreens = useCallback(() => {
    // No sync clear here: the whole row is gated on `user`, and a user change
    // re-fetches, so a stale list is never rendered.
    if (!API || !userKey) return;
    authFetch(`${API}/api/screens`)
      .then(r => (r.ok ? r.json() : { items: [] }))
      .then(d => setScreens(d.items || []))
      .catch(() => setScreens([]));
  }, [API, userKey]);
  useEffect(() => { reloadScreens(); }, [reloadScreens]);

  /* Technical read for the whole visible universe — loaded once, keyed by
     ticker, used only when a technical filter is active.

     This is an OVERLAY on a screener that works fine without it, so it fails
     quietly: no full-width error panel over a table that is rendering real
     valuations. But quietly must not mean invisibly. Without the r.ok check a
     404/500 still RESOLVED (the API answers errors with a JSON body — prod:
     GET /api/definitely-not-a-route → HTTP 404, content-type
     application/json), `d.items` was undefined, and techMap became {}. That is
     the worst outcome available: the dropdown stayed ENABLED, and picking
     "Above 200-DMA" filtered 1,001 names down to zero — the screen stating that
     no stock in the universe is above its 200-day average. A failure rendered
     as a finding.

     So the failure is now its own state: the filter is disabled (it cannot
     produce an honest answer) and says why, in one dim line, beside itself. */
  const [techErr, setTechErr] = useState(false);
  useEffect(() => {
    if (!API) return;
    let live = true;
    fetch(`${API}/api/screen/technical`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        if (!live) return;
        const m = {};
        (d.items || []).forEach(t => { m[(t.ticker || "").toUpperCase()] = t; });
        setTechMap(m); setTechErr(false);
      })
      .catch(() => {
        if (!live) return;
        setTechMap(null); setTechErr(true);
        // Drop any active technical filter rather than evaluate it against a
        // map we never received. Leaving it set has only dishonest outcomes:
        // apply it and every row fails the predicate (a failure shown as "no
        // matches"), or skip it and unfiltered rows render under a filter
        // label (a failure shown as data). Neither is allowed, so the filter
        // stands down and the note beside the control says why.
        setTf("All");
      });
    return () => { live = false; };
  }, [API]);
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
      // Provenance, not populated-ness, decides this — see lib/engineView.js.
      // The old guard asked "did the backend give me a number OR a note?", which
      // silently excluded the 50 rows the engine abstains on with neither, and
      // dropped them into the local recompute below, republishing a figure the
      // engine had withdrawn.
      const view = valuationView(co, co.assumptions);
      return {
        co,
        ...view,
        pb: view.pb ?? f.pb, pe: view.pe ?? f.pe, roe: view.roe ?? f.roe,
      };
    })
    .filter(r => {
      const mQ = (r.co.name + r.co.ticker).toLowerCase().includes(q.toLowerCase());
      return mQ && (sf === "All" || sectorBucket(r.co.sector) === sf);
    })
    .filter(r => {
      if (vf !== "All" && r.verdict !== vf) return false;
      if (cf !== "All" && r.confidence.level !== cf) return false;
      if (capf !== "All" && capBand(r.co, liveFeed.prices?.[(r.co.ticker || "").toUpperCase()]) !== capf) return false;
      const m = parseFloat(minMos);
      if (!isNaN(m) && (r.mos == null || r.mos * 100 < m)) return false;
      if (tf !== "All") {
        const t = techMap && techMap[(r.co.ticker || "").toUpperCase()];
        if (!t) return false;
        if (tf === "above200" && !t.above_200dma) return false;
        if (tf === "golden" && t.cross !== "golden") return false;
        if (tf === "near_high" && !(t.pct_from_52w_high != null && t.pct_from_52w_high >= -5)) return false;
        if (tf === "oversold" && !(t.rsi14 != null && t.rsi14 < 30)) return false;
        if (tf === "overbought" && !(t.rsi14 != null && t.rsi14 > 70)) return false;
        if (tf === "volspike" && !(t.vol_vs_50d != null && t.vol_vs_50d >= 2)) return false;
        if (tf === "momo" && !(t.mom_12_1 != null && t.mom_12_1 >= 30)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "rank") {
        const d = (VRANK[b.verdict] || 0) - (VRANK[a.verdict] || 0);
        return d !== 0 ? d : (b.sortMos - a.sortMos);
      }
      if (sort === "composite") return b.composite - a.composite;
      if (sort === "mos")       return b.sortMos - a.sortMos;
      if (sort === "price")     return (b.co.price || 0) - (a.co.price || 0);
      if (sort === "roe")       return (b.roe || 0) - (a.roe || 0);
      if (sort === "sentiment") return (b.sentiment ?? -1) - (a.sentiment ?? -1);
      return a.co.name.localeCompare(b.co.name);
    }), [companies, q, sort, sf, vf, cf, minMos, capf, tf, techMap, liveFeed]);

  /* Sort state used to be colour alone (gold vs dim) with no direction glyph,
     so "which column am I sorted by" was invisible to anyone who cannot see the
     amber — WCAG 1.4.1, and the same "never color alone" rule tokens.css states
     for the verdict ladder. The caret is the non-colour channel. aria-sort makes
     it available to screen readers, which previously got a bare <th>. */
  const Th = ({ children, k }) => (
    <th onClick={() => k && setSort(k)}
      aria-sort={k ? (sort === k ? "descending" : "none") : undefined}
      style={{
      ...sans,
      color: sort === k ? C.gold : C.dim,
      fontSize: 11, fontWeight: 500,
      textAlign: "right", padding: "10px 12px",
      textTransform: "uppercase", letterSpacing: "0.04em",
      cursor: k ? "pointer" : "default",
      whiteSpace: "nowrap", userSelect: "none",
    }}>{children}{sort === k && <span aria-hidden="true" style={{ marginLeft: 4 }}>▼</span>}</th>
  );

  return (
    <div>
      <PageHeader
        title="Screener"
        meta={loading ? "loading…" : `${rows.length} of ${companies.length} companies`}
        actions={API && (
          <a href={`${API}/api/export/screener.xlsx`} title="Download screener as Excel" style={{
            ...sans, display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 500, textDecoration: "none",
            padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            border: `1px solid ${C.gold}66`, color: C.gold, background: C.gold + "0d",
          }}>
            <Download size={13} /> Excel
          </a>
        )}
      >
        Every listed name the engine covers, ranked by margin of safety. Filter,
        sort, then open any row for the full working.
      </PageHeader>

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
        <select value={capf} onChange={e => setCapf(e.target.value)} title="Filter by market-cap band" style={{
          ...sans, background: C.panel2, border: `1px solid ${capf !== "All" ? C.gold + "88" : C.line}`,
          borderRadius: 8, color: capf !== "All" ? C.gold : C.text, padding: "8px 12px",
          fontSize: 13, cursor: "pointer", outline: "none",
        }}>
          {[["All", "Any cap"], ["Large", "Large cap"], ["Mid", "Mid cap"], ["Small", "Small cap"]].map(([v, l]) =>
            <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={tf} onChange={e => setTf(e.target.value)}
          title={techErr
            ? "Technical filter unavailable — the indicator feed didn't respond"
            : "Technical filter"}
          disabled={techMap == null} style={{
          ...sans, background: C.panel2, border: `1px solid ${tf !== "All" ? C.gold + "88" : C.line}`,
          borderRadius: 8, color: tf !== "All" ? C.gold : C.text, padding: "8px 12px",
          // "wait" promises something is coming. Once the request has failed
          // nothing is, so the cursor stops lying too.
          fontSize: 13, cursor: techErr ? "not-allowed" : techMap == null ? "wait" : "pointer",
          outline: "none",
        }}>
          {[["All", "Any technical"], ["above200", "Above 200-DMA"], ["golden", "Golden cross"],
            ["near_high", "Near 52w high"], ["momo", "Strong momentum"], ["volspike", "Volume spike"],
            ["oversold", "Oversold (RSI<30)"], ["overbought", "Overbought (RSI>70)"]].map(([v, l]) =>
            <option key={v} value={v}>{l}</option>)}
        </select>
        {techErr && (
          /* Inline and quiet by design: the valuations in the table below are
             real and unaffected, so a full-width ErrorState here would report
             an outage the screen is not having. Scope the claim to the one
             control that lost its data.

             flexBasis 100% drops the note onto its own line of this wrapping
             row. Measured in the browser: sitting between the technical select
             and the MoS input it wrapped to three lines, grew the row from 38px
             to 66px and pushed the MoS field out of the control line. On its
             own row it is one line and the controls stay aligned. */
          <span role="status" style={{ ...sans, fontSize: 11, color: C.faint,
                                       flexBasis: "100%", marginTop: -4, lineHeight: 1.45 }}>
            Technical filters are off — the indicator feed didn't respond. Everything else on
            this screen is unaffected.
          </span>
        )}
        <input value={minMos} onChange={e => setMinMos(e.target.value)}
          placeholder="MoS ≥ %" inputMode="decimal" title="Minimum margin of safety (%)"
          style={{ ...mono, width: 74, background: C.panel2, fontSize: 12, color: minMos ? C.gold : C.text,
                   border: `1px solid ${minMos ? C.gold + "88" : C.line}`, borderRadius: 8,
                   padding: "8px 10px", outline: "none" }} />
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
            style={{ ...mono, fontSize: 12, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 6, color: C.text, padding: "5px 10px", width: 150, outline: "none" }}
          />
          <button onClick={saveScreen} disabled={!screenName.trim()} style={{
            ...sans, display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500,
            padding: "5px 11px", borderRadius: 6, cursor: screenName.trim() ? "pointer" : "default",
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
                aria-sort={sort === "name" ? "ascending" : "none"}
                style={{
                  ...sans, color: sort === "name" ? C.gold : C.dim,
                  fontSize: 11, fontWeight: 500, textAlign: "left",
                  padding: "10px 16px", textTransform: "uppercase",
                  letterSpacing: "0.04em", cursor: "pointer",
                  userSelect: "none",
                  // Cap the identity column. Unconstrained it took 448px of a
                  // 1169px table and pushed VERDICT past the right edge, and the
                  // ellipsis on the name never fired because the box just grew.
                  width: "34%", maxWidth: 340,
                }}
              >Company{sort === "name" && <span aria-hidden="true" style={{ marginLeft: 4 }}>▲</span>}</th>
              <Th k="price">CMP / Intrinsic</Th>
              <Th k="mos">MoS</Th>
              <Th k="roe">ROE</Th>
              <Th>P/B</Th>
              <Th>P/E</Th>
              <Th k="composite">Score</Th>
              <Th k="sentiment">Sentiment</Th>
              <Th>Verdict</Th>
              <th style={{ width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ ...sans, textAlign: "center", padding: 40, color: C.faint }}>Loading live data…</td></tr>
            ) : rows.map((r, idx) => (
              <tr
                key={r.co.ticker || r.co.id}
                {...rowActivate(() => onOpen(r.co.ticker || r.co.id))}
                style={{ borderTop: idx ? `1px solid ${C.line}` : "none", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = C.panel2)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ padding: "11px 16px", maxWidth: 340 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    {onToggleWatch && (
                      /* Measured 18x18 at 375px, under WCAG 2.5.8's 24x24 floor,
                         and its only accessible name was a `title` — which a
                         touch device never surfaces (no hover) and screen
                         readers treat as the weakest fallback. Padding buys the
                         hit area without moving the star; aria-label names it
                         for real and aria-pressed carries the toggle STATE,
                         which colour alone was carrying before. */
                      <button title={isWatched(r.co.ticker) ? "Remove from watchlist" : "Add to watchlist"}
                        aria-label={`${isWatched(r.co.ticker) ? "Remove" : "Add"} ${r.co.name || r.co.ticker} ${isWatched(r.co.ticker) ? "from" : "to"} watchlist`}
                        aria-pressed={isWatched(r.co.ticker)}
                        onClick={e => { e.stopPropagation(); onToggleWatch(r.co.ticker); }}
                        style={{ background:"transparent", border:"none", cursor:"pointer", padding:5, margin:-3, lineHeight:0, flexShrink:0 }}>
                        <Star size={14} color={isWatched(r.co.ticker) ? C.gold : C.faint}
                          fill={isWatched(r.co.ticker) ? C.gold : "none"} />
                      </button>
                    )}
                    {/* Data confidence carried a SECOND channel as well as colour.
                        It was a 7x7px dot whose only non-colour affordance was a
                        title tooltip, while the legend below states outright that
                        "green = high, amber = medium, red = low" — so to a
                        deuteranope it was three identical olive dots and the
                        legend described something they cannot see. WCAG 1.4.1,
                        and tokens.css commits to "never color alone" by name.
                        Three stacked bars, 3/2/1 filled: the count reads at a
                        glance without colour, and colour still works for those
                        who see it. */}
                    <ConfidenceMeter conf={r.confidence} />
                    <Logo ticker={r.co.ticker} name={r.co.name} sector={r.co.sector} size={26} />
                    {/* min-width:0 + nowrap/ellipsis: without it a long name or a
                        sector like "Electronic Instr. & Controls" wraps to a third
                        line and the row grows. Measured on the live table: row
                        heights ran 52/65/67/80px across 40 rows — a 28px spread
                        that destroys the vertical rhythm a dense table depends on.
                        The full text stays available via title=. */}
                    <div style={{ minWidth: 0, maxWidth: 176 }}>
                      <div title={r.co.name}
                        style={{ ...sans, color: C.text, fontSize: 13, fontWeight: 500,
                                 whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.co.name}</div>
                      <div title={`${r.co.ticker} · ${r.co.sector}`}
                        style={{ ...mono, color: C.faint, fontSize: 10,
                                 whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.co.ticker} · {r.co.sector}</div>
                    </div>
                  </div>
                </td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, whiteSpace: "nowrap" }}>
                  {inr(liveFeed.prices?.[(r.co.ticker || "").toUpperCase()] ?? r.co.price)} <span style={{ color: C.faint }}>/</span>{" "}
                  {r.consensus != null
                    ? <span title="Analyst consensus target — our model has no call on this name" style={{ color: C.dim }}>{inrOrDash(r.consensus)}<span style={{ fontSize: 9, color: C.faint }}> ⌖</span></span>
                    : r.iv == null && r.fairValueNote
                      ? <span title={r.fairValueNote} style={{ color: C.faint }}>n/m</span>
                    : <span style={{ color: C.gold }}>{inrOrDash(r.iv)}</span>}
                </td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: r.mos == null ? C.faint : r.mos >= 0 ? C.green : C.red }}>
                  {r.mos != null ? signedPct(r.mos)
                    : r.fairValueNote
                      ? <span title={r.fairValueNote} style={{ color: C.faint }}>n/m</span>
                    : r.consensusUpside != null
                      ? <span title="Analyst consensus upside — not our model" style={{ color: C.dim }}>{signedPct(r.consensusUpside)}<span style={{ fontSize: 9, color: C.faint }}> ⌖</span></span>
                      : "—"}
                </td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: C.text }}>{pct(r.roe)}</td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: C.text }}>{multiple(r.pb, 2)}</td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: C.text }}>{multiple(r.pe, 1)}</td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: C.text }}>{r.reliable ? fmt(r.composite) : "—"}</td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12 }}>
                  {r.sentiment == null ? <span style={{ color: C.faint }}>—</span>
                    : <span title={`Narrative momentum: ${r.sentimentLabel} — concall tone, estimate revisions, beat/miss track`}
                        style={{ color: sentColor(r.sentimentLabel) }}>{r.sentiment}</span>}
                </td>
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
          Intrinsic = blended fair value (DCF / Residual-Income + relative cross-checks) · the three-bar meter shows data
          confidence (three bars = high, one = low) · &quot;n/m&quot; means the engine withheld its fair value for that name —
          the verdict still stands · click a row for the full model
        </span>
      </div>
    </div>
  );
}
