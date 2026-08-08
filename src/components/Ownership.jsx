/* Ownership.jsx — cross-company institutional & MF ownership trends.
   Reads /api/ownership: promoter / FII / DII / MF / public % + QoQ deltas. */
import { useMemo, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { C, sans, mono } from "../lib/theme.js";
import { ListToolbar, applyControls } from "../lib/listControls.jsx";
import PageHeader from "./ui/PageHeader.jsx";
import ErrorState from "./ui/ErrorState.jsx";
import useResource from "../lib/useResource.js";

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
  // useResource, not a bare fetch: the old code was
  //   fetch(url).then(r => r.json()).catch(() => setData(null))
  // which RESOLVES on a 4xx/5xx because FastAPI answers with a JSON body, so
  // the .catch never fired and an outage rendered as "No ownership data yet —
  // run a refresh", i.e. the user was told their data does not exist and
  // handed a remedy that cannot work.
  const { data, error, loading, retry } = useResource(API ? `${API}/api/ownership` : null);
  const [sort, setSort] = useState("inst");
  // Column-header sort: by holding LEVEL (pct), toggling asc/desc.
  const [colSort, setColSort] = useState(null); // {key, dir}
  const [controls, setControls] = useState({});


  const rows = useMemo(() => {
    const items = applyControls((data?.items || []).slice(), controls);
    if (colSort) {
      const p = r => (r[colSort.key]?.pct == null ? -999 : r[colSort.key].pct);
      items.sort((a, b) => (colSort.dir === "asc" ? p(a) - p(b) : p(b) - p(a)));
      return items;
    }
    const d = (r, k) => (r[k]?.delta == null ? -999 : r[k].delta);
    if (sort === "inst")     items.sort((a, b) => d(b, "institutional") - d(a, "institutional"));
    if (sort === "fii")      items.sort((a, b) => d(b, "fii") - d(a, "fii"));
    if (sort === "dii")      items.sort((a, b) => d(b, "dii") - d(a, "dii"));
    if (sort === "promoter") items.sort((a, b) => d(b, "promoter") - d(a, "promoter"));
    return items;
  }, [data, sort, colSort, controls]);

  const sortableTh = (label, key, style) => (
    <th onClick={() => setColSort(v => (v?.key === key
        ? (v.dir === "desc" ? { key, dir: "asc" } : null)
        : { key, dir: "desc" }))}
      title={`Sort by ${label} holding — click to toggle high→low / low→high / off`}
      style={{ ...style, cursor: "pointer", userSelect: "none",
               color: colSort?.key === key ? C.gold : style.color }}>
      {label}{colSort?.key === key ? (colSort.dir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  if (loading) return (
    <div style={{ padding: 48, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading ownership…
    </div>
  );

  // A failed request is not an empty dataset. Say which one happened.
  if (error) return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <PageHeader title="Ownership">
        Latest shareholding by promoter, foreign (FII), domestic (DII) and mutual funds.
      </PageHeader>
      <ErrorState error={error} onRetry={retry} what="ownership" />
    </div>
  );

  const th = { ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
    color: C.dim, padding: "10px 14px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" };
  const td = { padding: "11px 14px", borderTop: `1px solid ${C.line}` };

  return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <PageHeader title="Ownership" meta={`${rows.length} names`}>
        Latest shareholding by promoter, foreign (FII), domestic (DII) and mutual funds, with the change vs the prior quarter. Rising institutional ownership is often a quiet vote of confidence.
      </PageHeader>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <ListToolbar rows={data?.items} controls={controls} setControls={setControls}
          metrics={[["promoter.pct", "Promoter %"], ["fii.pct", "FII %"], ["dii.pct", "DII %"],
                    ["mf.pct", "MF %"], ["institutional.delta", "Instit. Δ"]]} />
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
              {sortableTh("Promoter", "promoter", { ...th, textAlign: "right" })}
              {sortableTh("FII", "fii", { ...th, textAlign: "right" })}
              {sortableTh("DII", "dii", { ...th, textAlign: "right" })}
              {sortableTh("Mutual funds", "mf", { ...th, textAlign: "right" })}
              {sortableTh("Public", "public", { ...th, textAlign: "right" })}
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
                No shareholding snapshots are published for this universe yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
