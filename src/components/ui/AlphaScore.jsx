/* Phase 2 composite — AlphaScore. Number-first (no gauge theatrics): mono score,
   band word, 5-segment track. Band colors ride the verdict ladder so "good/bad"
   reads consistently everywhere; null renders an honest em-dash, never 0. */
import { color } from "../../design/tokens.js";
import "./ui.css";

const band = (s) =>
  s >= 70 ? { label: "Strong", c: color.buy }
  : s >= 55 ? { label: "Leaning", c: color.accumulate }
  : s >= 40 ? { label: "Neutral", c: color.hold }
  : s >= 25 ? { label: "Weak", c: color.reduce }
  : { label: "Poor", c: color.avoid };

export default function AlphaScore({ score, label = "Alpha", segments = 5, className = "", ...rest }) {
  const ok = score != null && isFinite(score);
  const b = ok ? band(score) : { label: "No score", c: color.nocall };
  const on = ok ? Math.round((Math.max(0, Math.min(100, score)) / 100) * segments) : 0;
  return (
    <div className={`evc-alpha${className ? " " + className : ""}`}
      role="img" aria-label={`${label}: ${ok ? `${Math.round(score)} of 100, ${b.label}` : "no score"}`}
      style={{ "--evc-alpha-c": b.c }} {...rest}>
      <span className="evc-stat-label">{label}</span>
      <div className="evc-alpha-row">
        <span className="evc-alpha-value">{ok ? Math.round(score) : "—"}</span>
        <span className="evc-alpha-band" style={{ color: b.c }}>{b.label}</span>
      </div>
      <div className="evc-alpha-track" aria-hidden="true">
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className="evc-alpha-seg" data-on={i < on} />
        ))}
      </div>
    </div>
  );
}
