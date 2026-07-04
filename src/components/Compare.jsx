/* Compare.jsx — side-by-side comparison of up to 4 names.
   Pulls /api/compare and renders a grouped metric table with best-in-row
   highlighting (model valuation, multiples, analyst, forensics). */
import { useEffect, useMemo, useState, Fragment } from "react";
import { Search, X, Plus, Loader2, GitCompare } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";
import { VerdictBadge } from "./primitives.jsx";
import Logo from "./Logo.jsx";

const MAX = 4;

const inr   = v => v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const cr    = v => v == null ? "—" : v >= 1e5 ? "₹" + (v / 1e5).toFixed(2) + " L cr"
                                              : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 }) + " cr";
const pct   = v => v == null ? "—" : (v * 100).toFixed(1) + "%";
const signed= v => v == null ? "—" : (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
const n1    = v => v == null ? "—" : Number(v).toFixed(1);
const n2    = v => v == null ? "—" : Number(v).toFixed(2);
const r0    = v => v == null ? "—" : Math.round(v).toString();
const mlt   = (v, d = 1) => v == null ? "—" : Number(v).toFixed(d) + "×";

const GRADE_RANK = { A: 4, B: 3, C: 2, D: 1 };
const VERDICT_RANK = { BUY: 5, ACCUMULATE: 4, HOLD: 3, "LOW CONF": 2.5, "NO DATA": 2, REDUCE: 2, AVOID: 1 };

// dir: "up" higher wins, "down" lower wins, "grade"/"verdict" categorical, null = no highlight
const GROUPS = [
  { title: "Snapshot", rows: [
    { k: "price",       label: "Price",            fmt: inr },
    { k: "market_cap",  label: "Market cap",       fmt: cr },
    { k: "verdict",     label: "Engine verdict",   dir: "verdict" },
    { k: "composite",   label: "Composite / 100",  dir: "up", fmt: r0 },
  ]},
  { title: "Model valuation", rows: [
    { k: "intrinsic",   label: "Fair value",       fmt: inr },
    { k: "mos",         label: "Margin of safety", dir: "up", fmt: signed },
  ]},
  { title: "Multiples", rows: [
    // posOnly: a negative P/E (loss-maker) / negative P/B (negative book) is not
    // meaningful and must never be highlighted as "best" just because it's low.
    { k: "pe",          label: "P / E",            dir: "down", posOnly: true, fmt: v => mlt(v, 1) },
    { k: "pb",          label: "P / B",            dir: "down", posOnly: true, fmt: v => mlt(v, 2) },
    { k: "roe",         label: "ROE",              dir: "up",   fmt: pct },
  ]},
  { title: "Analyst consensus", rows: [
    { k: "analyst_target", label: "12M target",    fmt: inr },
    { k: "analyst_upside", label: "Upside",        dir: "up", fmt: signed },
    { k: "analyst_rating", label: "Rating" },
  ]},
  { title: "Forensics", rows: [
    { k: "forensic_grade", label: "Quality grade", dir: "grade" },
    { k: "altman_z",       label: "Altman Z″",     dir: "up",   fmt: n2 },
    { k: "beneish_m",      label: "Beneish M",     dir: "down", fmt: n2 },
    { k: "piotroski",      label: "Piotroski F / 9", dir: "up", fmt: n1 },
  ]},
];

function bestIndex(items, row) {
  if (!row.dir) return -1;
  const score = (it) => {
    const v = it[row.k];
    if (v == null) return null;
    if (row.posOnly && !(v > 0)) return null;
    if (row.dir === "grade")   return GRADE_RANK[v] ?? null;
    if (row.dir === "verdict") return VERDICT_RANK[v] ?? null;
    if (row.dir === "down")    return -v;
    return v;                                  // "up"
  };
  let best = -1, bestS = null;
  items.forEach((it, i) => {
    const s = score(it);
    if (s == null) return;
    if (bestS == null || s > bestS) { bestS = s; best = i; }
  });
  return best;
}

export default function Compare({ API, companies = [], onOpen, seed = [] }) {
  const [sel, setSel] = useState(() => seed.slice(0, MAX));
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!API || sel.length === 0) { setData(null); return; }
    let live = true;
    setLoading(true);
    fetch(`${API}/api/compare?tickers=${encodeURIComponent(sel.join(","))}`)
      .then(r => r.json())
      .then(d => { if (live) { setData(d); setLoading(false); } })
      .catch(() => { if (live) { setData(null); setLoading(false); } });
    return () => { live = false; };
  }, [API, sel]);

  const options = useMemo(() => {
    const picked = new Set(sel);
    const ql = q.trim().toLowerCase();
    return companies
      .filter(c => c.ticker && !picked.has(c.ticker))
      .filter(c => !ql || (c.name + c.ticker).toLowerCase().includes(ql))
      .slice(0, 8);
  }, [companies, sel, q]);

  const add = t => { if (sel.length < MAX && !sel.includes(t)) { setSel([...sel, t]); setQ(""); } };
  const remove = t => setSel(sel.filter(x => x !== t));

  const items = data?.items || [];

  return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <GitCompare size={20} color={C.gold} />
        <span style={{ ...serif, fontSize: 30, color: C.text }}>Compare</span>
        <span style={{ ...sans, fontSize: 13, color: C.dim }}>up to {MAX} names, side by side</span>
      </div>
      <div style={{ ...sans, fontSize: 12, color: C.faint, marginBottom: 18 }}>
        Model verdict, valuation, multiples, analyst consensus and forensic quality — best in each row highlighted in gold.
      </div>

      {/* Picker */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 20 }}>
        {sel.map(t => {
          const it = items.find(x => x.ticker === t);
          return (
            <span key={t} style={{ ...sans, fontSize: 13, color: C.text, background: C.bg800,
              border: `1px solid ${C.line2}`, borderRadius: 99, padding: "5px 6px 5px 12px",
              display: "inline-flex", alignItems: "center", gap: 8 }}>
              {it?.name || t}
              <button onClick={() => remove(t)} style={{ background: "transparent", border: "none", cursor: "pointer",
                color: C.dim, display: "inline-flex", padding: 2 }}><X size={13} /></button>
            </span>
          );
        })}
        {sel.length < MAX && (
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.bg800,
              border: `1px solid ${C.line2}`, borderRadius: 99, padding: "5px 12px" }}>
              <Search size={13} color={C.faint} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Add a company…"
                style={{ ...sans, fontSize: 13, color: C.text, background: "transparent", border: "none", outline: "none", width: 150 }} />
            </div>
            {q && options.length > 0 && (
              <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 20, minWidth: 220,
                background: C.bg800, border: `1px solid ${C.line2}`, borderRadius: 10, padding: 6, boxShadow: "0 12px 30px rgba(0,0,0,.4)" }}>
                {options.map(c => (
                  <button key={c.ticker} onClick={() => add(c.ticker)} style={{ ...sans, fontSize: 13, color: C.text,
                    width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer",
                    padding: "7px 9px", borderRadius: 7, display: "flex", alignItems: "center", gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = C.bg600}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <Plus size={12} color={C.gold} /> {c.name} <span style={{ ...mono, fontSize: 10, color: C.faint }}>{c.ticker}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {sel.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", border: `1px dashed ${C.line2}`, borderRadius: 12 }}>
          <GitCompare size={26} color={C.faint} style={{ marginBottom: 10 }} />
          <div style={{ ...sans, fontSize: 14, color: C.dim }}>Add two or more names to compare them.</div>
        </div>
      ) : loading && items.length === 0 ? (
        <div style={{ padding: 40, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading comparison…
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 120 * items.length + 220 }}>
            <thead>
              <tr>
                <th style={{ ...sans, fontSize: 11, color: C.dim, textAlign: "left", padding: "14px 16px",
                  position: "sticky", left: 0, background: C.bg, borderBottom: `1px solid ${C.line}` }}></th>
                {items.map(it => (
                  <th key={it.ticker} onClick={() => onOpen && onOpen(it.ticker)} style={{ cursor: "pointer", padding: "14px 16px",
                    borderBottom: `1px solid ${C.line}`, textAlign: "left", minWidth: 130 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Logo ticker={it.ticker} name={it.name} sector={it.sector} size={26} />
                      <div style={{ ...serif, fontSize: 18, color: C.text }}>{it.name}</div>
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: C.faint, marginTop: 2 }}>{it.ticker} · {it.sector}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map(group => (
                <Fragment key={group.title}>
                  <tr>
                    <td colSpan={items.length + 1} style={{ ...sans, fontSize: 10, textTransform: "uppercase",
                      letterSpacing: "0.14em", color: C.gold, padding: "14px 16px 6px",
                      background: C.bg800, borderTop: `1px solid ${C.line}` }}>{group.title}</td>
                  </tr>
                  {group.rows.map(row => {
                    const best = bestIndex(items, row);
                    return (
                      <tr key={row.k}>
                        <td style={{ ...sans, fontSize: 12, color: C.dim, padding: "9px 16px",
                          position: "sticky", left: 0, background: C.bg, borderTop: `1px solid ${C.line}` }}>{row.label}</td>
                        {items.map((it, i) => {
                          const val = it[row.k];
                          const isBest = i === best && val != null;
                          return (
                            <td key={it.ticker} style={{ padding: "9px 16px", borderTop: `1px solid ${C.line}`,
                              ...mono, fontSize: 13, color: isBest ? C.gold : C.text,
                              fontWeight: isBest ? 600 : 400, background: isBest ? C.gold + "12" : "transparent" }}>
                              {row.dir === "verdict" ? <VerdictBadge verdict={val} />
                                : row.fmt ? row.fmt(val)
                                : (val == null ? "—" : val)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
