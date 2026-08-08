/* Phase 1 composite — StatTile. Micro-label over a hero number (tabular mono),
   optional signed delta. Delta carries an arrow so direction survives without
   color; delta=null renders an em-dash, never a fake zero.

   `size` is a step on the type scale (sm 16 / md 19 / lg 23 / xl 28), `tone`
   colours the VALUE by meaning (up | down | accent | secondary | muted) rather
   than by hex, `meta` is a right-hand slot on the label row, and `note` is the
   caption under the number. Each of the four was added because a real screen
   could not be converted without it — the tile as originally built could only
   render an uncoloured 23px number under an 11px label, which described none of
   the 17 stat groups in the product. `label` takes a node, so a verdict badge
   can stand in for the micro-label. */
import { fmtNum } from "../../design/tokens.js";
import "./ui.css";

export default function StatTile({
  label, value, delta, meta, note, size = "md", tone,
  deltaFormat = fmtNum.signedPct, className = "", ...rest
}) {
  const up = delta != null && delta >= 0;
  return (
    <div
      className={`evc-stat${className ? " " + className : ""}`}
      data-size={size}
      data-tone={tone}
      {...rest}
    >
      {meta === undefined
        ? <span className="evc-stat-label">{label}</span>
        : (
          <span className="evc-stat-head">
            <span className="evc-stat-label">{label}</span>
            <span className="evc-stat-meta">{meta}</span>
          </span>
        )}
      <span className="evc-stat-value">{value ?? "—"}</span>
      {delta !== undefined && (
        /* Direction as a data attribute, not an inline colour: the tile stops
           carrying hexes in JS and the palette gate can see what it paints. */
        <span className="evc-stat-delta" data-dir={delta == null ? "none" : up ? "up" : "down"}>
          {delta == null ? "—" : `${up ? "▲" : "▼"} ${deltaFormat(delta)}`}
        </span>
      )}
      {note != null && <span className="evc-stat-note">{note}</span>}
    </div>
  );
}
