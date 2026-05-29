/* Screener — search/sort/filter table of all companies.
   Click row → opens Company detail. */

import { useMemo, useState } from "react";
import { Search, ChevronRight, Database } from "lucide-react";
import { C, mono, sans } from "../lib/theme.js";
import { fmt, inr, pct } from "../lib/formatters.js";
import { fundamentals } from "../lib/valuation.js";
import { recommend } from "../lib/recommend.js";
import { VerdictBadge } from "./primitives.jsx";

export default function Screener({ companies, onOpen, loading }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("composite");
  const [sf, setSf] = useState("All");

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
      const r = recommend(co, co.assumptions);
      const f = fundamentals(co);
      return { co, ...r, pb: f.pb, pe: f.pe, roe: f.roe };
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
      if (sort === "composite") return b.composite - a.composite;
      if (sort === "mos")       return b.mos - a.mos;
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

      <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", background: C.panel }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                  <div style={{ ...sans, color: C.text, fontSize: 13, fontWeight: 500 }}>{r.co.name}</div>
                  <div style={{ ...mono, color: C.faint, fontSize: 10 }}>{r.co.ticker} · {r.co.sector}</div>
                </td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12 }}>
                  {inr(r.co.price)} <span style={{ color: C.faint }}>/</span> <span style={{ color: C.gold }}>{inr(r.v.intrinsic)}</span>
                </td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: r.mos >= 0 ? C.green : C.red }}>{pct(r.mos)}</td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: C.text }}>{pct(r.roe)}</td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: C.text }}>{fmt(r.pb, 2)}</td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: C.text }}>{r.pe ? fmt(r.pe, 1) : "—"}</td>
                <td style={{ ...mono, textAlign: "right", padding: "11px 12px", fontSize: 12, color: C.text }}>{fmt(r.composite)}</td>
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
          Live prices · 15-min refresh during market hours · EBIT margins calibrated by sector · click row for full DCF
        </span>
      </div>
    </div>
  );
}
