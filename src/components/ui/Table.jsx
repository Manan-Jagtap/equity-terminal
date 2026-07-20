/* Phase 1 primitive — Table. Columns declare num:true to right-align in tabular
   mono (numbers are the hero). Wrapper scrolls horizontally; page never does.

     <Table
       columns={[{ key:"name", label:"Company" }, { key:"mcap", label:"M-cap", num:true }]}
       rows={[{ id, name, mcap }]}
       renderCell={(row, col) => …}   // optional; defaults to row[col.key]
       onRowClick={fn} sticky />                                              */
import "./ui.css";

export default function Table({
  columns = [], rows = [], renderCell, onRowClick, sticky = false,
  rowKey = (r, i) => r.id ?? r.ticker ?? i, empty = "No data", className = "",
}) {
  return (
    <div className={`evc-table-wrap${className ? " " + className : ""}`}>
      <table className="evc-table" data-sticky={sticky} data-hover={!!onRowClick}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} data-num={c.num || undefined} style={c.width ? { width: c.width } : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ textAlign: "center", padding: "24px 12px" }}>{empty}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={rowKey(row, i)} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {columns.map((c) => (
                <td key={c.key} data-num={c.num || undefined}>
                  {renderCell ? renderCell(row, c) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
