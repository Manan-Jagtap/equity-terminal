/* Phase 1 composite — StatTile. Micro-label over a hero number (tabular mono),
   optional signed delta. Delta carries an arrow so direction survives without
   color; delta=null renders an em-dash, never a fake zero. */
import { color, fmtNum } from "../../design/tokens.js";
import "./ui.css";

export default function StatTile({ label, value, delta, deltaFormat = fmtNum.signedPct, className = "", ...rest }) {
  const up = delta != null && delta >= 0;
  return (
    <div className={`evc-stat${className ? " " + className : ""}`} {...rest}>
      <span className="evc-stat-label">{label}</span>
      <span className="evc-stat-value">{value ?? "—"}</span>
      {delta !== undefined && (
        <span className="evc-stat-delta" style={{ color: delta == null ? color.text3 : up ? color.up : color.down }}>
          {delta == null ? "—" : `${up ? "▲" : "▼"} ${deltaFormat(delta)}`}
        </span>
      )}
    </div>
  );
}
