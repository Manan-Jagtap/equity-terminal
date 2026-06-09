/* Ownership.jsx — cross-company institutional & MF ownership trends.
   Reads /api/ownership: promoter / FII / DII / MF / public % + QoQ deltas. */
import { useEffect, useMemo, useState } from "react";
import { Landmark, Loader2, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";

const p1 = v => v == null ? "—" : Number(v).toFixed(1) + "%";

function Delta({ v }) {
  if (v == null) return <span style={{ ...mono, fontSize: 10, color: C.dim }}> </span>;
  if (Math.abs(v) < 0.05) return <span style={{ ...mono, fontSize: 10, color: C.dim }}>flat</span>;
  const up = v > 0;
  return (
    <span style={{ ...mono, fontSize: 10, color: up ? C.green : C.red, display: "inline-flex", alignItems: "center", gap: 2 }}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{(up ? "+" : "") + v.toFixed(1)}
    </span>
  );
}

const Cell = ({ pct, delta }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
    <span style={{ ...mono, fontSize: 12, color: C.text }}>{p1(pct)}</span>
    <Delta v={delta} />
  </div>
);

const SORTS = [
  { id: "inst",     label: "Institutional flow" },
  { id: "fii",      label: "FII change" },
  { id: "dii",      label: "DII change" },
  { id: "promoter", label: "Promoter change" },
];

export default function Ownership({ API, onOpen }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("inst");

  useEffect(() => {
    if (!API) { setLoading(false); return; }
    let live = true;
    setLoading(true);
    fetch(`${API}/api/ownership`).then(r => r.json())
      .then(d => { if (live) { setData(d); setLoading(false); } })
      .catch(() => { if (live) { setData(null); setLoading(false); } });
    return () => { live = false; };
  }, [API]);

  const rows = useMemo(() => {
    const items = (data?.items || []).slice();
    const d = (r, k) => (r[k]?.delta == null ? -999 : r[k].delta);
    if (sort === "inst")     items.sort((a, b) => d(b, "institutional") - d(a, "institutional"));
    if (sort === "fii")      items.sort((a, b) => d(b, "fii") - d(a, "fii"));
    if (sort === "dii")      items.sort((a, b) => d(b, "dii") - d(a, "dii"));
    if (sort === "promoter") items.sort((a, b) => d(b, "promoter") - d(a, "promoter"));
    return items;
  }, [data, sort]);

  if (loading) return (
    <div style={{ padding: 48, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading ownership…
    </div>
  );

  const th = { ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
    color: C.dim, padding: "10px 14px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" };
  const td = { padding: "11px 14px", borderTop: `1px solid ${C.line}` };

  return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <Landmark size={19} color={C.gold} />
        <span style={{ ...serif, fontSize: 30, color: C.text }}>Ownership</span>
        <span style={{ ...sans, fontSize: 13, color: C.dim }}>{rows.length} names · institutional &amp; MF flows (QoQ)</span>
      </div>
      <div style={{ ...sans, fontSize: 12, color: C.faint, marginBottom: 16 }}>
        Latest shareholding by promoter, foreign (FII), domestic (DII) and mutual funds, with the change vs the prior quarter. Rising institutional ownership is often a quiet vote of confidence.
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
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Company</th>
              <th style={{ ...th, textAlign: "right" }}>Promoter</th>
              <th style={{ ...th, textAlign: "right" }}>FII</th>
              <th style={{ ...th, textAlign: "right" }}>DII</th>
              <th style={{ ...th, textAlign: "right" }}>Mutual funds</th>
              <th style={{ ...th, textAlign: "right" }}>Public</th>
              <th style={{ ...th, textAlign: "right" }}>Instit. Δ</th>
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
                  <div style={{ ...mono, fontSize: 10, color: C.faint }}>{r.ticker} · {r.as_of || r.sector}</div>
                </td>
                <td style={{ ...td, textAlign: "right" }}><Cell pct={r.promoter?.pct} delta={r.promoter?.delta} /></td>
                <td style={{ ...td, textAlign: "right" }}><Cell pct={r.fii?.pct} delta={r.fii?.delta} /></td>
                <td style={{ ...td, textAlign: "right" }}><Cell pct={r.dii?.pct} delta={r.dii?.delta} /></td>
                <td style={{ ...td, textAlign: "right" }}><Cell pct={r.mf?.pct} delta={r.mf?.delta} /></td>
                <td style={{ ...td, textAlign: "right" }}><Cell pct={r.public?.pct} delta={r.public?.delta} /></td>
                <td style={{ ...td, textAlign: "right" }}>
                  <span style={{ ...mono, fontSize: 13, fontWeight: 600,
                    color: r.institutional?.delta == null ? C.dim : r.institutional.delta >= 0 ? C.green : C.red }}>
                    {r.institutional?.delta == null ? "—" : (r.institutional.delta >= 0 ? "+" : "") + r.institutional.delta.toFixed(1)}
                  </span>
                </td>
                <td style={{ ...td, textAlign: "center" }}><ChevronRight size={14} color={C.faint} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ ...sans, textAlign: "center", padding: 40, color: C.faint }}>
                No ownership data yet — run a refresh to populate shareholding snapshots.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
