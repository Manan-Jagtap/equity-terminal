/* IndexChart.jsx — full-history chart overlay for a market index.

   Opens when an index card on the dashboard is clicked. Reuses PriceChart
   (ranges, log scale, RSI, DMAs) on /api/indices/{name}/history. Loaded
   lazily so recharts stays out of the first-paint bundle. */

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { C, sans, serif } from "../lib/theme.js";
import PriceChart from "./PriceChart.jsx";
import ErrorState from "./ui/ErrorState.jsx";
import useResource from "../lib/useResource.js";

export default function IndexChart({ API, name, onClose }) {
  /* The chart is this overlay's whole reason to exist, so a failure earns the
     full ErrorState. Previously /history was read with `.then(r => r.json())`
     and no r.ok: a 5xx JSON envelope became `resp`, `resp.available` was
     undefined, and the overlay rendered "Could not load this index's history
     right now" — the SAME sentence a legitimate 200 `{available:false}` gets.
     Two different facts, one message; now the outage takes the error branch and
     the message below means only what it says. */
  const { data: resp, error, loading, retry } = useResource(
    API && name ? `${API}/api/indices/${encodeURIComponent(name)}/history` : null);

  // Recharts' ResponsiveContainer measures 0-width while the card's fadein
  // transform is animating — mount the chart only after the animation settles.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 360);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 250,
        background: "var(--ev-scrim-strong)", backdropFilter: "blur(8px)",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        padding: "6vh 14px", overflowY: "auto",
      }}>
      <div className="fadein" style={{
        width: "min(980px, 96vw)", background: C.bg900,
        border: `1px solid ${C.line2}`, borderRadius: 14,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        padding: "20px 22px 16px", boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <h2 style={{ ...serif, fontSize: 24, fontWeight: 600, color: C.text, margin: 0 }}>{name}</h2>
          {resp?.available && (
            <span style={{ ...sans, fontSize: 11, color: C.faint }}>
              {resp.count} sessions · NSE index · daily closes
            </span>
          )}
          <button onClick={onClose} aria-label="Close" style={{
            marginLeft: "auto", background: "transparent", border: "none",
            cursor: "pointer", padding: 4, lineHeight: 0,
          }}>
            <X size={18} color={C.dim} />
          </button>
        </div>

        {(loading || (!settled && resp?.available)) && (
          <div style={{ ...sans, display: "flex", alignItems: "center", gap: 10, padding: 60, color: C.dim, fontSize: 13, justifyContent: "center" }}>
            <Loader2 size={16} color={C.gold} className="spin" />
            Loading index history…
          </div>
        )}
        {!loading && settled && resp?.available && (
          <PriceChart data={resp.data} intrinsic={null} price={null} ticker={name} />
        )}
        {!loading && error && (
          <div style={{ padding: "14px 0 6px" }}>
            <ErrorState error={error} onRetry={retry} what="this index" />
          </div>
        )}
        {!loading && !error && !resp?.available && (
          <div style={{ ...sans, padding: "40px 20px 30px", color: C.dim, fontSize: 13, textAlign: "center" }}>
            {/* Reached only on a 200 that says so — a genuine gap, not an outage. */}
            {resp?.message || "No stored history for this index yet."}
          </div>
        )}
      </div>
    </div>
  );
}
