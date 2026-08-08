/* FvRange — bear / base / bull fair-value band.
 *
 * A point fair value overstates certainty; serious research quotes a range.
 * This runs the SAME parity-locked client engine (lib/engine.js) three times
 * over the backend-parity derived assumptions, flexing only the growth and
 * profitability drivers by fixed, disclosed factors — no new math, no backend
 * change, and the base case remains exactly the canonical blended value the
 * screener/header show.
 *
 * Deltas are deliberately modest and symmetric-ish (bear is harsher than bull,
 * matching how forecast errors actually skew). If anything fails (missing
 * statements, engine bail), we render nothing — never a wrong band.
 */
import { useMemo } from "react";
import { C, mono, sans } from "../lib/theme.js";
import * as engine from "../lib/engine.js";
import { deriveClientAssumptions } from "../lib/derive.js";

const BEAR = { rev_growth: 0.70, ebit_margin: 0.92, forecast_roe: 0.88, terminal_roe: 0.95 };
const BULL = { rev_growth: 1.22, ebit_margin: 1.05, forecast_roe: 1.10, terminal_roe: 1.04 };

function flex(a, f) {
  const out = { ...a };
  for (const k of Object.keys(f)) {
    if (out[k] != null && isFinite(out[k])) out[k] = out[k] * f[k];
  }
  return out;
}

const inr = v => "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function FvRange({ co, price, base }) {
  const band = useMemo(() => {
    try {
      const a = deriveClientAssumptions(co, null);
      if (!a) return null;
      const coSnake = engine.toEngineCo(co, price);
      const lo = engine.blended(coSnake, flex(a, BEAR))?.blended;
      const hi = engine.blended(coSnake, flex(a, BULL))?.blended;
      if (!isFinite(lo) || !isFinite(hi) || lo <= 0 || hi <= 0 || hi <= lo) return null;
      return { lo, hi };
    } catch {
      return null;
    }
  }, [co, price]);

  if (!band || base == null) return null;
  const { lo, hi } = band;
  // Position markers on the band (clamp so extremes stay visible at the edges).
  const span = hi - lo;
  const pos = v => Math.max(2, Math.min(98, ((v - lo) / span) * 100));

  return (
    <div style={{ margin: "10px 0 14px" }}>
      <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.dim, marginBottom: 6 }}>
        Fair-value range · bear → bull
      </div>
      <div style={{ position: "relative", height: 6, borderRadius: 6,
                    background: `linear-gradient(90deg, ${C.red}44, ${C.gold}44, ${C.green}44)` }}>
        {/* base marker */}
        <div title={`Base ${inr(base)}`} style={{ position: "absolute", left: `${pos(base)}%`, top: -3,
              width: 2, height: 12, background: C.gold, transform: "translateX(-1px)" }} />
        {/* price marker (where the market is inside the band) */}
        {price != null && price >= lo && price <= hi && (
          <div title={`Price ${inr(price)}`} style={{ position: "absolute", left: `${pos(price)}%`, top: -3,
                width: 2, height: 12, background: C.text, opacity: 0.7, transform: "translateX(-1px)" }} />
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
        <span style={{ ...mono, fontSize: 11.5, color: C.red }}>{inr(lo)}</span>
        <span style={{ ...mono, fontSize: 11.5, color: C.dim }}>
          base {inr(base)}{price != null && (price < lo || price > hi) ? ` · price ${inr(price)} outside band` : ""}
        </span>
        <span style={{ ...mono, fontSize: 11.5, color: C.green }}>{inr(hi)}</span>
      </div>
      <div style={{ ...sans, fontSize: 10.5, color: C.faint, marginTop: 5, lineHeight: 1.5 }}>
        Same engine, growth & profitability flexed by fixed factors (bear −30% growth / −8% margin;
        bull +22% / +5%). A range, because forecasts deserve humility.
      </div>
    </div>
  );
}
