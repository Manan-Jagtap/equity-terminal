/* Screener — search/sort/filter table of all companies.
   Click row → opens Company detail. */

import { useMemo, useState } from "react";
import { Search, ChevronRight, Database } from "lucide-react";
import { C, mono, sans } from "../lib/theme.js";
import { fmt, inr, pct, multiple, inrOrDash, signedPct } from "../lib/formatters.js";
import { fundamentals } from "../lib/valuation.js";
import { recommend } from "../lib/recommend.js";
import { VerdictBadge } from "./primitives.jsx";

const confColor = lvl => lvl === "high" ? C.green : lvl === "medium" ? C.gold : C.red;

export default function Screener({ companies, onOpen, loading }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("rank");
  const [sf, setSf] = useState("All");
  const VRANK = { BUY: 5, ACCUMULATE: 4, HOLD: 3, REDUCE: 2, TRIM: 2, AVOID: 1 };

  const sectors = useMemo(() => {
    const s = new Set(companies.map(c => {
      const sec = (c.sector || "").toLowerCase();
      if (sec.includes("financial") || sec.includes("bank") || sec.includes("nbfc")) return "Financials";
      if (sec.includes("tech") || sec.includes("information")) return "Technology";
      if (sec.includes("pharma") || sec.includes("health")) return "Healthcare";
      if (sec.includes("auto")) return "Auto";
      if (sec.includes("fmcg") || sec.includes("consumer")) return "Consumer";
      if (sec.includes("energy") || sec.includes("oil") || sec.includes("power")) return "Energy";
      if (sec.includes("metal") || sec.includes("mining")) return "Metals";
      if (sec.includes("chem")) return "Chemicals";
      return "Other";
    }));
    return ["All", ...Array.from(s).sort()];
  }, [companies]);

  const rows = useMemo(() => companies
    .map(co => {
      const f = fundamentals(co);
      const a = co.api;
      // Prefer the backend's CONSENSUS-ANCHORED screener metrics (these include
      // the analyst overlay). Only fall back to a local recompute for seed/offline
      // rows that never came from the API.
      if (a && a.iv != null) {
        return {
          co,
          iv: a.iv, mos: a.mos, verdict: a.verdict,
          composite: a.composite ?? 0,
          reliable: a.reliable !== false,
          confidence: { level: a.confidence || "medium", flags: [] },
          pb: a.pb ?? f.pb, pe: a.pe ?? f.pe, roe: a.roe ?? f.roe,
          analystTarget: a.analystTarget, analystUpside: a.analystUpside,
          sortMos: a.mos ?? -Infinity,
        };
      }
      const r = recommend(co, co.assumptions);
      return { co, ...r, pb: f.pb, pe: f.pe, roe: f.roe, sortMos: r.mos ?? -Infinity };
    })
    .filter(r => {
      const mQ = (r.co.name + r.co.ticker).toLowerCase().includes(q.toLowerCase());
      if (sf === "All") return mQ;
      const sec = (r.co.sector || "").toLowerCase();
      if (sf === "Financials") return mQ && (sec.includes("financial") || sec.includes("bank") || sec.includes("nbfc"));
      if (sf === "Technology") return mQ && (sec.includes("tech") || sec.includes("information"));
      if (sf === "Healthcare") return mQ && (sec.includes("pharma") || sec.includes("health"));
      if (sf === "Auto")       return mQ && sec.includes("auto");
      if (sf === "Consumer")   return mQ && (sec.includes("fmcg") || sec.includes("consumer"));
      if (sf === "Energy")     return mQ && (sec.includes("energy") || sec.includes("oil") || sec.includes("power"));
      if (sf === "Metals")     return mQ && (sec.includes("metal") || sec.includes("mining"));
      if (sf === "Chemicals")  return mQ && sec.includes("chem");
      return mQ;
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
    }), [companies, q, sort, sf]);

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
        <div style={{ ...sans, color: C.faint, fontSize: 12 }}>
          {loading ? "Loading…" : `${rows.length} companies`}
        </div>
      </div>

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
              <Th>Analyst Tgt</Th>
              <Th>Upside</Th>
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
              <tr><td colSpan={11} style={{ ...sans, textAlign: "center", padding: 40, color: C.faint }}>Loading live data…</td></tr>
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
                    <span title={`Data confidence: ${r.confidence.level}${r.confidence.flags.length ? " — " + r.confidence.flags.join("; ") : ""}`}
                      style={{ width:7, height:7, borderRadius:"50%", background:confColor(r.confidence.level), flexShrink:0 }} />
                    <div>
                      <div style={{ ...sans, color: C.text, fontSize: 13, fontWeight: 500 }}>{r.co.name}</div>
                      <div style={{ ...mono, color: C.faint, fontSize: 10 }}>{r.co.ticker} · {r.co.sector}</div>
                    </div>
                  </div>
                </td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12 }}>
                  {inr(r.co.price)} <span style={{ color: C.faint }}>/</span> <span style={{ color: C.gold }}>{inrOrDash(r.iv)}</span>
                </td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: r.mos == null ? C.faint : r.mos >= 0 ? C.green : C.red }}>{signedPct(r.mos)}</td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: C.gold }}>{r.analystTarget != null ? inrOrDash(r.analystTarget, 0) : "—"}</td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: r.analystUpside == null ? C.faint : r.analystUpside >= 0 ? C.green : C.red }}>{r.analystUpside == null ? "—" : signedPct(r.analystUpside)}</td>
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
          Intrinsic = blended fair value (DCF / Residual-Income + relative cross-checks) · Analyst Tgt / Upside = sell-side consensus, shown separately ·
          the dot shows data confidence (green = high, amber = medium, red = low) · click a row for the full model
        </span>
      </div>
    </div>
  );
}
