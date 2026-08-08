/* ScoreCard.jsx — the per-stock scorecard: five sub-scores + overall grade +
   auto red/green flags, from /scorecard (a synthesis of the FM v4 evidence).
   Honest "not scored yet" state until the nightly evidence build covers the
   name. Educational, not advice. */
import { useEffect, useState } from "react";
import { Gauge, AlertTriangle, CheckCircle2 } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";

const LABELS = {
  valuation: "Valuation", quality: "Quality", growth: "Growth",
  momentum: "Momentum", safety: "Safety",
};
const HELP = {
  valuation: "Blended view — model fair value, analyst consensus and the name's own 5-yr multiple band (higher = cheaper)",
  quality: "Forensic accounting quality — Piotroski F, accruals, cash conversion, coverage, leverage",
  growth: "Revenue & profit growth plus the latest earnings surprise",
  momentum: "12-1 momentum, 50/200-DMA state and distance from the 52-week high",
  safety: "Balance-sheet & governance safety — docked for pledge, red flags and promoter selling",
};
const toneOf = v => v == null ? C.dim : v >= 70 ? C.green : v >= 45 ? "#E8B054" : C.red;
const gradeColor = g => g === "A" ? C.green : g === "B" ? "#7BD88F" : g === "C" ? "#E8B054" : C.red;

function Bar({ k, s }) {
  const v = s?.value;
  return (
    <div title={HELP[k]} style={{ cursor: "help" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ ...sans, fontSize: 11.5, color: C.text200 }}>{LABELS[k]}</span>
        <span style={{ ...mono, fontSize: 12, color: toneOf(v) }}>{v == null ? "—" : Math.round(v)}</span>
      </div>
      <div style={{ height: 5, background: C.line, borderRadius: 6 }}>
        <div style={{ height: 5, width: `${v || 0}%`, borderRadius: 6, background: toneOf(v),
                      transition: "width 300ms" }} />
      </div>
    </div>
  );
}

export default function ScoreCard({ API, ticker }) {
  const [loaded, setLoaded] = useState({ ticker: null, data: null, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!API || !ticker) return;
    let dead = false;
    fetch(`${API}/api/companies/${ticker}/scorecard`)
      .then(r => {
        /* The r.ok check is the whole fix. /scorecard answers 4xx/5xx with a
           JSON body, so r.json() RESOLVED on an outage and the old .catch never
           ran: {"detail":"Not Found"} arrived with `available` undefined and
           this card said "Not scored yet — the nightly evidence build ... will
           populate this automatically". That told the user the engine had not
           covered their stock, when in fact the engine had scored it and we
           merely could not read the answer. */
        if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { kind: "status" });
        return r.json().catch(() => {
          throw Object.assign(new Error("unreadable"), { kind: "parse" });
        });
      })
      .then(d => { if (!dead) setLoaded({ ticker, data: d, error: null }); })
      .catch(e => { if (!dead) setLoaded({ ticker, data: null, error: { kind: e.kind || "network" } }); });
    return () => { dead = true; };
  }, [API, ticker, nonce]);

  const fresh = loaded.ticker === ticker;
  const d = fresh ? loaded.data : null;
  const err = fresh ? loaded.error : null;
  if (!d && !err) return null;

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, background: C.panel,
                  padding: "18px 20px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Gauge size={15} color={C.gold} />
        <span style={{ ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim }}>
          Stock scorecard
        </span>
      </div>

      {err ? (
        /* Quiet and in place, not a full-width dashed ErrorState: this card is
           one of several on the overview, and a box that loud would dominate
           the page it is only a part of. All it has to do is stop claiming the
           name is unscored, and offer the retry that the surrounding page will
           not do on its own. */
        <div role="status" style={{ ...sans, fontSize: 12.5, color: C.dim, lineHeight: 1.6,
                                    display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <AlertTriangle size={12} color={C.gold} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>
            Couldn't load the scorecard — {err.kind === "status" ? "the data service refused the request"
              : err.kind === "parse" ? "the response came back unreadable"
              : "the request didn't get through"}. This name may well be scored; we can't read the answer right now.
          </span>
          {/* Clearing `loaded` before the refetch is what gives the click any
              feedback at all: this card renders nothing while loading, so it
              collapses and comes back — the same thing useResource's own retry
              does on the screens that use it. */}
          <button type="button" onClick={() => { setLoaded({ ticker: null, data: null, error: null }); setNonce(n => n + 1); }}
            style={{ ...sans, fontSize: 11.5, color: C.gold, background: "transparent",
                     border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>
            Retry
          </button>
        </div>
      ) : !d.available ? (
        <div style={{ ...sans, fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>
          Not scored yet — the nightly evidence build covers the visible universe and will populate this automatically.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 26, alignItems: "center" }}>
          {/* overall grade dial */}
          <div style={{ textAlign: "center", minWidth: 96 }}>
            <div style={{ ...serif, fontSize: 52, lineHeight: 1, color: gradeColor(d.grade) }}>{d.grade || "—"}</div>
            <div style={{ ...mono, fontSize: 13, color: C.text, marginTop: 4 }}>{d.overall != null ? Math.round(d.overall) : "—"}<span style={{ color: C.faint }}>/100</span></div>
            {d.alpha != null && <div style={{ ...mono, fontSize: 9.5, color: C.faint, marginTop: 3 }}>α-rank {Math.round(d.alpha)}</div>}
            {d.valuation_suspect && (
              <div style={{ ...mono, fontSize: 8.5, color: "#E8B054", marginTop: 5, border: "1px solid #E8B05455",
                            borderRadius: 6, padding: "2px 5px" }} title="The DCF failed cross-examination and was set aside; valuation leans on consensus + the own-history band.">
                model set aside
              </div>
            )}
          </div>
          {/* sub-score bars */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px 22px" }}>
            {["valuation", "quality", "growth", "momentum", "safety"].map(k => (
              <Bar key={k} k={k} s={d.scores?.[k]} />
            ))}
          </div>
        </div>
      )}

      {d?.available && (d.green_flags?.length || d.red_flags?.length) ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 16,
                      borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
          {d.green_flags?.length > 0 && (
            <div>
              <div style={{ ...sans, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em", color: C.green, marginBottom: 6 }}>What's working</div>
              {d.green_flags.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 7, marginBottom: 5 }}>
                  <CheckCircle2 size={13} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ ...sans, fontSize: 12, color: C.text200, lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          )}
          {d.red_flags?.length > 0 && (
            <div>
              <div style={{ ...sans, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em", color: C.red, marginBottom: 6 }}>Red flags</div>
              {d.red_flags.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 7, marginBottom: 5 }}>
                  <AlertTriangle size={13} color={C.red} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ ...sans, fontSize: 12, color: C.text200, lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
