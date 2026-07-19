/* Phase 2 composite — Sparkline. Pure-SVG trend line + soft area fill; no chart
   lib. Colors from the data-viz tokens (up=buy, down=avoid, flat=accent).
   Decorative by default (aria-hidden) unless given an ariaLabel. */
import { chart } from "../../design/tokens.js";
import "./ui.css";

export default function Sparkline({
  data = [], width = 96, height = 32, ariaLabel, className = "", ...rest
}) {
  const pts = data.filter((v) => v != null && isFinite(v));
  if (pts.length < 2) return <span style={{ width, height, display: "inline-block" }} aria-hidden="true" />;

  const min = Math.min(...pts), max = Math.max(...pts);
  const span = max - min || 1;
  const pad = 2;
  const x = (i) => pad + (i / (pts.length - 1)) * (width - pad * 2);
  const y = (v) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const up = pts[pts.length - 1] > pts[0];
  const flat = pts[pts.length - 1] === pts[0];
  const stroke = flat ? chart.axis : up ? chart.up : chart.down;

  return (
    <svg
      className={`evc-crow-spark${className ? " " + className : ""}`}
      width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      {...(ariaLabel ? { role: "img", "aria-label": ariaLabel } : { "aria-hidden": "true" })}
      {...rest}
    >
      <path d={area} fill={stroke} opacity="0.10" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
