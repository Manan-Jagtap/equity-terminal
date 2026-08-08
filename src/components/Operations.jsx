/* Operations.jsx — cross-company operating-efficiency screen.
   Reads /api/operations: ROCE (+3y trend), ROE, working-capital cycle,
   debtor/inventory/payable days, cash conversion (+3y trend), asset turnover. */
import { useMemo, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { C, sans, mono } from "../lib/theme.js";
import { th, td, tdNum, thName, tdStack, stackLine } from "../design/table.js";
import { ListToolbar, applyControls, SortableTh } from "../lib/listControls.jsx";
import { VerdictBadge } from "./primitives.jsx";
import PageHeader from "./ui/PageHeader.jsx";
import ErrorState from "./ui/ErrorState.jsx";
import useResource from "../lib/useResource.js";

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
  // useResource: the old fetch().then(r=>r.json()).catch() never fired its
  // .catch on an API 4xx/5xx (FastAPI answers with a JSON body), so an
  // outage rendered as an empty dataset rather than a failure.
  const { data, error, loading, retry } = useResource(API ? `${API}/api/operations` : null);
  const [sort, setSort] = useState("roce");
  const [controls, setControls] = useState({});


  const rows = useMemo(() => {
    const items = (data?.items || []).slice();
    const n = (x, f) => (x == null ? f : x);
    if (sort === "roce")  items.sort((a, b) => n(b.roce, -1) - n(a.roce, -1));
    if (sort === "roe")   items.sort((a, b) => n(b.roe, -1) - n(a.roe, -1));
    if (sort === "turns") items.sort((a, b) => n(b.asset_turnover, -1) - n(a.asset_turnover, -1));
    if (sort === "ccc")   items.sort((a, b) => n(a.ccc, 1e9) - n(b.ccc, 1e9));   // lower cash cycle is better
    return applyControls(items, controls);
  }, [data, sort, controls]);

  if (loading) return (
    <div style={{ padding: 48, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} className="spin" /> Loading operations…
    </div>
  );

  // A failed request is not an empty dataset. useResource separates them;
  // this is where that distinction reaches the user.
  if (error) return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <PageHeader title="Operations">
        Operating quality across the covered universe.
      </PageHeader>
      <ErrorState error={error} onRetry={retry} what="operations" />
    </div>
  );

  return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <PageHeader title="Operations" meta={`${rows.length} names`}>
        How hard each business works its capital: returns on capital employed, and how quickly cash moves through receivables, inventory and payables. Small arrows show the 3-year trend.
      </PageHeader>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <ListToolbar rows={data?.items} controls={controls} setControls={setControls}
          metrics={[["roce", "ROCE %"], ["roe", "ROE %"], ["debtor_days", "Debtor days"],
                    ["inventory_days", "Inventory days"], ["payable_days", "Payable days"],
                    ["ccc", "Cash cycle"], ["asset_turnover", "Asset turns"]]} />
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
              <th style={thName}>Company</th>
              <SortableTh label="ROCE" k="roce" controls={controls} setControls={setControls} style={th} />
              <SortableTh label="ROE" k="roe" controls={controls} setControls={setControls} style={th} />
              <SortableTh label="Debtor days" k="debtor_days" controls={controls} setControls={setControls} style={th} />
              <SortableTh label="Inventory days" k="inventory_days" controls={controls} setControls={setControls} style={th} />
              <SortableTh label="Payable days" k="payable_days" controls={controls} setControls={setControls} style={th} />
              <SortableTh label="Cash cycle" k="ccc" controls={controls} setControls={setControls} style={th} />
              <SortableTh label="Asset turns" k="asset_turnover" controls={controls} setControls={setControls} style={th} />
              <th style={th}>Verdict</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.ticker} onClick={() => onOpen && onOpen(r.ticker)} style={{ cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg800}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                {/* Each LINE clamps independently: clamping the cell would drop the
                    sub-line, and clamping neither let the row grow — Operations ran ten
                    distinct heights (52-111px) before this. */}
                <td style={tdStack}>
                  <div title={r.name} style={{ ...sans, fontSize: 13, fontWeight: 500, color: C.text, ...stackLine }}>{r.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: C.faint, ...stackLine }}>{r.ticker} · {r.sector}</div>
                </td>
                <td style={{ ...tdNum, color: C.gold }}>{p1(r.roce)}<Trend v={r.roce_delta_3y} riseGood /></td>
                <td style={tdNum}>{p1(r.roe)}</td>
                <td style={tdNum}>{d0(r.debtor_days)}</td>
                <td style={tdNum}>{d0(r.inventory_days)}</td>
                <td style={tdNum}>{d0(r.payable_days)}</td>
                <td style={tdNum}>{d0(r.ccc)}<Trend v={r.ccc_delta_3y} riseGood={false} /></td>
                <td style={tdNum}>{x2(r.asset_turnover)}</td>
                <td style={td}><VerdictBadge verdict={r.verdict} /></td>
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
