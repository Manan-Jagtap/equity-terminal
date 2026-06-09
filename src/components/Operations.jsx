/* Operations.jsx — cross-company operating-efficiency screen.
   Reads /api/operations: ROCE (+3y trend), ROE, working-capital cycle,
   debtor/inventory/payable days, cash conversion (+3y trend), asset turnover. */
import { useEffect, useMemo, useState } from "react";
import { Gauge, Loader2, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";
import { VerdictBadge } from "./primitives.jsx";

const p1 = v => v == null ? "—" : Number(v).toFixed(1) + "%";
const d0 = v => v == null ? "—" : Math.round(v) + "d";
const x2 = v => v == null ? "—" : Number(v).toFixed(2) + "×";

/* Trend chip — `good` says whether a rise is good (ROCE) or bad (cash cycle). */
function Trend({ v, riseGood = true }) {
  if (v == null || Math.abs(v) < 0.05) return null;
  const up = v > 0;
  const positive = riseGood ? up : !up;
  return (
    <span style={{ ...mono, fontSize: 10, marginLeft: 5, color: positive ? C.green : C.red,
      display: "inline-flex", alignItems: "center", gap: 2 }}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{(up ? "+" : "") + v.toFixed(1)}
    </span>
  );
}

const SORTS = [
  { id: "roce",  label: "ROCE" },
  { id: "ccc",   label: "Cash cycle" },
  { id: "roe",   label: "ROE" },
  { id: "turns", label: "Asset turns" },
];

export default function Operations({ API, onOpen }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("roce");

  useEffect(() => {
    if (!API) { setLoading(false); return; }
    let live = true;
    setLoading(true);
    fetch(`${API}/api/operations`).then(r => r.json())
      .then(d => { if (live) { setData(d); setLoading(false); } })
      .catch(() => { if (live) { setData(null); setLoading(false); } });
    return () => { live = false; };
  }, [API]);

  const rows = useMemo(() => {
    const items = (data?.items || []).slice();
    const n = (x, f) => (x == null ? f : x);
    if (sort === "roce")  items.sort((a, b) => n(b.roce, -1) - n(a.roce, -1));
    if (sort === "roe")   items.sort((a, b) => n(b.roe, -1) - n(a.roe, -1));
    if (sort === "turns") items.sort((a, b) => n(b.asset_turnover, -1) - n(a.asset_turnover, -1));
    if (sort === "ccc")   items.sort((a, b) => n(a.ccc, 1e9) - n(b.ccc, 1e9));   // lower cash cycle is better
    return items;
  }, [data, sort]);

  if (loading) return (
    <div style={{ padding: 48, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading operations…
    </div>
  );

  const th = { ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
    color: C.dim, padding: "10px 14px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" };
  const td = { padding: "11px 14px", borderTop: `1px solid ${C.line}`, ...mono, fontSize: 12, color: C.text };

  return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <Gauge size={19} color={C.gold} />
        <span style={{ ...serif, fontSize: 30, color: C.text }}>Operations</span>
        <span style={{ ...sans, fontSize: 13, color: C.dim }}>{rows.length} names · capital efficiency &amp; working-capital cycle</span>
      </div>
      <div style={{ ...sans, fontSize: 12, color: C.faint, marginBottom: 16 }}>
        How hard each business works its capital: returns on capital employed, and how quickly cash moves through receivables, inventory and payables. Small arrows show the 3-year trend.
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {SORTS.map(s => (
          <button key={s.id} onClick={() => setSort(s.id)} style={{ ...sans, fontSize: 12,
            padding: "5px 12px", borderRadius: 8, cursor: "pointer",
            border: `1px solid ${sort === s.id ? C.line2 : "transparent"}`,
            background: sort === s.id ? C.bg800 : "transparent", color: sort === s.id ? C.gold : C.dim }}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Company</th>
              <th style={{ ...th, textAlign: "right" }}>ROCE</th>
              <th style={{ ...th, textAlign: "right" }}>ROE</th>
              <th style={{ ...th, textAlign: "right" }}>Debtor days</th>
              <th style={{ ...th, textAlign: "right" }}>Inventory days</th>
              <th style={{ ...th, textAlign: "right" }}>Payable days</th>
              <th style={{ ...th, textAlign: "right" }}>Cash cycle</th>
              <th style={{ ...th, textAlign: "right" }}>Asset turns</th>
              <th style={{ ...th, textAlign: "right" }}>Verdict</th>
              <th style={{ ...th }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.ticker} onClick={() => onOpen && onOpen(r.ticker)} style={{ cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg800}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ ...td }}>
                  <div style={{ ...sans, fontSize: 13, fontWeight: 500, color: C.text }}>{r.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: C.faint }}>{r.ticker} · {r.sector}</div>
                </td>
                <td style={{ ...td, textAlign: "right", color: C.gold }}>{p1(r.roce)}<Trend v={r.roce_delta_3y} riseGood /></td>
                <td style={{ ...td, textAlign: "right" }}>{p1(r.roe)}</td>
                <td style={{ ...td, textAlign: "right" }}>{d0(r.debtor_days)}</td>
                <td style={{ ...td, textAlign: "right" }}>{d0(r.inventory_days)}</td>
                <td style={{ ...td, textAlign: "right" }}>{d0(r.payable_days)}</td>
                <td style={{ ...td, textAlign: "right" }}>{d0(r.ccc)}<Trend v={r.ccc_delta_3y} riseGood={false} /></td>
                <td style={{ ...td, textAlign: "right" }}>{x2(r.asset_turnover)}</td>
                <td style={{ ...td, textAlign: "right" }}><VerdictBadge verdict={r.verdict} /></td>
                <td style={{ ...td, textAlign: "center" }}><ChevronRight size={14} color={C.faint} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ ...sans, textAlign: "center", padding: 40, color: C.faint }}>
                No operational data available.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
