/* Phase 1 primitive — Badge + VerdictBadge.
   Tone drives color via the --evc-badge-c custom property (ui.css derives the
   border/fill from it, so one variable = the whole treatment).
   VerdictBadge adds a glyph so meaning is never carried by color alone. */
import { color, verdictColor } from "../../design/tokens.js";
import "./ui.css";

const TONES = {
  neutral: color.text2, accent: color.accent,
  buy: color.buy, accumulate: color.accumulate, hold: color.hold,
  reduce: color.reduce, avoid: color.avoid, nocall: color.nocall,
  up: color.up, down: color.down,
};

export function Badge({ tone = "neutral", fill = false, children, className = "", style, ...rest }) {
  return (
    <span
      className={`evc-badge${className ? " " + className : ""}`}
      data-fill={fill}
      style={{ "--evc-badge-c": TONES[tone] || TONES.neutral, ...style }}
      {...rest}
    >
      {children}
    </span>
  );
}

/* Verdict → glyph: shape + direction, legible without color. */
const VERDICT_GLYPH = {
  BUY: "▲", ACCUMULATE: "△", HOLD: "◆", TRIM: "▽", REDUCE: "▽", AVOID: "▼",
};

export function VerdictBadge({ verdict, fill = true, style, ...rest }) {
  const v = (verdict || "").toUpperCase();
  // LOW CONF (or nothing) reads as the honest "NO CALL"; other unknowns
  // (e.g. NO DATA) keep their own words — never relabel a data problem.
  const label = VERDICT_GLYPH[v] ? v : (!v || v === "LOW CONF") ? "NO CALL" : v;
  return (
    <Badge fill={fill} style={{ "--evc-badge-c": verdictColor(v), ...style }} {...rest}>
      <span aria-hidden="true">{VERDICT_GLYPH[v] || "○"}</span>
      {label}
    </Badge>
  );
}

export default Badge;
