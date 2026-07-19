/* Phase 2 composite — FinancialsTable. Statement grid: metric label column +
   FY columns, values right-aligned tabular mono, emphasis rows (Revenue, PAT)
   get weight + a stronger hairline, negatives read in restrained red.

     <FinancialsTable
       years={["FY23", "FY24", "FY25"]}
       rows={[{ label: "Revenue", values: [2.4e5, 2.6e5, 2.9e5], emph: true },
              { label: "EBIT margin", values: [0.24, 0.25, 0.26], format: "pct" }]} />

   format: "cr" (default) | "pct" | "x" | "raw"                              */
import { fmtNum } from "../../design/tokens.js";
import "./ui.css";

const FMT = {
  cr: (v) => fmtNum.cr(v),
  pct: (v) => fmtNum.pct(v),
  x: (v) => (v == null || isNaN(v) ? "—" : Number(v).toFixed(1) + "×"),
  raw: (v) => (v == null ? "—" : String(v)),
};

export default function FinancialsTable({ years = [], rows = [], sticky = false, className = "" }) {
  return (
    <div className={`evc-table-wrap${className ? " " + className : ""}`}>
      <table className="evc-table" data-sticky={sticky}>
        <thead>
          <tr>
            <th>{" "}</th>
            {years.map((y) => <th key={y} data-num="true">{y}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const fmt = FMT[r.format] || FMT.cr;
            return (
              <tr key={r.label} data-emph={r.emph || undefined}>
                <td>{r.label}</td>
                {years.map((y, i) => {
                  const v = r.values?.[i];
                  return (
                    <td key={y} data-num="true" data-neg={(v != null && v < 0) || undefined}>
                      {fmt(v)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
