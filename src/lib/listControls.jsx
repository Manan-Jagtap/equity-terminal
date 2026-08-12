/* listControls.jsx — one filter/sort vocabulary for every list page.

   <ListToolbar> renders: a sector dropdown (built from the rows themselves),
   an optional extra dropdown (e.g. done/upcoming), and a numeric threshold
   filter (metric ≥ / ≤ value). `applyControls` applies the lot; `SortableTh`
   makes any numeric column click-sortable (desc → asc → off). */
import { C, mono, sans } from "./theme.js";

export const selStyle = {
  ...sans, fontSize: 12, padding: "6px 10px", borderRadius: 8,
  background: C.bg800, color: C.text200, border: `1px solid ${C.line2}`,
  outline: "none", cursor: "pointer",
};

export function ListToolbar({ rows, controls, setControls, metrics = [], extra = null }) {
  const sectors = [...new Set((rows || []).map(r => r.sector).filter(Boolean))].sort();
  const set = patch => setControls(c => ({ ...c, ...patch }));
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
      <select value={controls.sector || ""} onChange={e => set({ sector: e.target.value || null })}
        style={selStyle} title="Filter by sector">
        <option value="">All sectors</option>
        {sectors.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {extra}
      {metrics.length > 0 && (
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <select value={controls.numKey || ""} onChange={e => set({ numKey: e.target.value || null })}
            style={selStyle} title="Numeric filter — pick a metric">
            <option value="">Filter metric…</option>
            {metrics.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select value={controls.numOp || ">="} onChange={e => set({ numOp: e.target.value })}
            style={{ ...selStyle, padding: "6px 6px" }} disabled={!controls.numKey}>
            <option value=">=">≥</option>
            <option value="<=">≤</option>
          </select>
          <input type="number" step="any" placeholder="value" value={controls.numVal ?? ""}
            onChange={e => set({ numVal: e.target.value === "" ? null : Number(e.target.value) })}
            disabled={!controls.numKey}
            style={{ ...mono, fontSize: 12, width: 88, padding: "6px 8px", borderRadius: 8,
                     background: C.bg800, color: C.text, border: `1px solid ${C.line2}`, outline: "none" }} />
        </span>
      )}
      {(controls.sector || (controls.numKey && controls.numVal != null) || controls.sortKey) && (
        <button onClick={() => setControls({})} style={{ ...sans, fontSize: 11, padding: "6px 10px",
          borderRadius: 8, cursor: "pointer", border: `1px solid ${C.line2}`,
          background: "transparent", color: C.dim }}>Clear</button>
      )}
    </div>
  );
}

/* get(row, key) supports "a.b" paths and functions. */
const getv = (r, k) => (typeof k === "function" ? k(r)
  : k.split(".").reduce((o, p) => (o == null ? o : o[p]), r));

export function applyControls(rows, controls) {
  let out = rows || [];
  if (controls.sector) out = out.filter(r => r.sector === controls.sector);
  if (controls.numKey && controls.numVal != null) {
    out = out.filter(r => {
      const v = getv(r, controls.numKey);
      if (v == null || !isFinite(v)) return false;
      return controls.numOp === "<=" ? v <= controls.numVal : v >= controls.numVal;
    });
  }
  if (controls.sortKey) {
    const dir = controls.sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const va = getv(a, controls.sortKey), vb = getv(b, controls.sortKey);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va - vb) * dir;
    });
  }
  return out;
}

export function SortableTh({ label, k, controls, setControls, style }) {
  const active = controls.sortKey === k;
  const cycle = () => setControls(c => (c.sortKey === k
      ? (c.sortDir === "desc" ? { ...c, sortDir: "asc" } : { ...c, sortKey: null, sortDir: null })
      : { ...c, sortKey: k, sortDir: "desc" }));
  /* A <th onClick> is not a control: no focus, no Enter/Space, and nothing
     announced the sort state — so every sortable column in the app was
     mouse-only, and a screen reader could not tell which column the table was
     sorted by. aria-sort carries the state natively; the inner <button> makes
     it operable without turning the header cell itself into a tab stop that
     announces nothing. */
  return (
    <th aria-sort={active ? (controls.sortDir === "desc" ? "descending" : "ascending") : "none"}
      style={{ ...style, userSelect: "none", color: active ? C.gold : style?.color }}>
      <button type="button" onClick={cycle}
        title={`Sort by ${label} — high→low, low→high, off`}
        style={{ background: "none", border: "none", padding: 0, margin: 0, font: "inherit",
                 color: "inherit", cursor: "pointer", textAlign: "inherit",
                 letterSpacing: "inherit", textTransform: "inherit" }}>
        {label}{active ? (controls.sortDir === "desc" ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );
}
