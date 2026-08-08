/* ConcallKeyPoints.jsx — pre-extracted pointers from the latest earnings call.

   Auto-loads /transcript-insight (populated by the daily ingester): guidance,
   margins, capex, demand, risks, and a management-tone gauge — pulled by a
   deterministic rule-based extractor from the company's own transcript. Shows
   an honest "processed within a day" state until the ingester has run. */
import { useEffect, useState } from "react";
import { Mic, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { C, sans, mono } from "../lib/theme.js";

const GROUPS = [
  ["guidance", "Guidance & outlook", C.gold],
  ["margins", "Margins & costs", "#85a8c8"],
  ["capex", "Capex & capacity", "#5fb3b3"],   // teal — a CATEGORY tint must not reuse a verdict colour
  ["demand", "Demand & orders", "#5fb3b3"],
  ["risks", "Risks & watch-items", C.red],
];

function ToneGauge({ tone, direction }) {
  if (tone == null) return null;
  const pct = Math.round(((tone + 1) / 2) * 100);
  const label = tone >= 0.2 ? "Confident" : tone <= -0.2 ? "Cautious" : "Balanced";
  const col = tone >= 0.2 ? C.green : tone <= -0.2 ? C.red : "#E8B054";
  const Dir = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ ...mono, fontSize: 11, color: col }}>{label} tone</span>
      <div style={{ width: 120, height: 5, background: C.line, borderRadius: 6, position: "relative" }}>
        <div style={{ position: "absolute", left: `${pct}%`, top: -2, width: 3, height: 9,
                      background: col, borderRadius: 2, transform: "translateX(-50%)" }} />
      </div>
      {direction && direction !== "neutral" && (
        <span style={{ ...mono, fontSize: 10.5, color: col, display: "flex", alignItems: "center", gap: 3 }}>
          <Dir size={12} /> guidance {direction}
        </span>
      )}
    </div>
  );
}

export default function ConcallKeyPoints({ API, ticker }) {
  // Keep the loaded ticker with the payload so switching companies shows
  // nothing stale — without a synchronous setState reset inside the effect.
  const [loaded, setLoaded] = useState({ ticker: null, data: null });

  useEffect(() => {
    if (!API || !ticker) return;
    let dead = false;
    fetch(`${API}/api/companies/${ticker}/transcript-insight`)
      .then(r => r.json())
      .then(d => { if (!dead) setLoaded({ ticker, data: d }); })
      .catch(() => { if (!dead) setLoaded({ ticker, data: { available: false } }); });
    return () => { dead = true; };
  }, [API, ticker]);

  const data = loaded.ticker === ticker ? loaded.data : null;
  if (!data) return null;                       // silent while loading / stale
  const p = data.points || {};
  const hasAny = data.available && (GROUPS.some(([k]) => (p[k] || []).length) || (p.kpis || []).length);

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel,
                  padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em",
                       color: C.dim, display: "flex", alignItems: "center", gap: 6 }}>
          <Mic size={13} color={C.gold} /> Concall key points
        </span>
        {data.quarter && <span style={{ ...mono, fontSize: 11, color: C.faint }}>{data.quarter}</span>}
        <div style={{ marginLeft: "auto" }}>
          {data.available && <ToneGauge tone={data.tone_score} direction={p.guidance_direction} />}
        </div>
      </div>

      {data.available && (p.kpis || []).length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {p.kpis.map((k, i) => (
            <div key={i} style={{ border: `1px solid ${C.line2}`, borderRadius: 8, background: C.bg900,
                                  padding: "7px 11px", minWidth: 0 }}
              title="Operational metric management cited on the latest call">
              <div style={{ ...sans, fontSize: 9.5, color: C.faint, whiteSpace: "nowrap" }}>{k.metric}</div>
              <div style={{ ...mono, fontSize: 14, color: C.gold, marginTop: 1 }}>
                {k.unit && k.unit.startsWith("₹") ? `₹${Number(k.value).toLocaleString("en-IN")} ${k.unit.slice(1).trim()}` : `${k.value}${k.unit || ""}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasAny ? (
        <div style={{ ...sans, fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>
          {data.available
            ? "The latest transcript held no clearly extractable pointers."
            : "No transcript processed yet — the ingester runs daily and will populate this automatically."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14,
                      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          {GROUPS.map(([key, title, col]) => {
            const items = p[key] || [];
            if (!items.length) return null;
            return (
              <div key={key}>
                <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.09em",
                              color: col, marginBottom: 6 }}>{title}</div>
                {items.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 7, marginBottom: 6 }}>
                    <span style={{ color: col, flexShrink: 0, lineHeight: 1.5 }}>·</span>
                    <span style={{ ...sans, fontSize: 12.5, color: C.text200, lineHeight: 1.5 }}>{s}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {data.available && (
        <div style={{ ...sans, fontSize: 9.5, color: C.faint, marginTop: 10 }}>
          Extracted from the company's own earnings-call transcript · verbatim sentences, not paraphrased ·
          {data.source_url ? <a href={data.source_url} target="_blank" rel="noreferrer"
            style={{ color: C.dim, marginLeft: 4 }}>source ↗</a> : null}
        </div>
      )}
    </div>
  );
}
