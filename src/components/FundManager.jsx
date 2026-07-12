/* FundManager.jsx — the manager's desk for YOUR book.

   A written PM note, a conviction-scored action queue with rupee sizing
   against risk-balanced targets, and the book's health at a glance. Every
   number is a mechanical restatement of the terminal's published research
   (verdicts, MoS, weights, momentum, holding terms) — educational decision
   support; the owner decides. */
import { useEffect, useState } from "react";
import { BadgeCheck, Briefcase, Loader2, Sparkles } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";
import { authFetch } from "../lib/auth.js";
import { SignInGate } from "./Watchlist.jsx";

const inr = v => v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const actionTone = a =>
  a.includes("EXIT") ? C.red : a.includes("TRIM") ? "#E8B054" : C.green;

function ConvictionBar({ v }) {
  return (
    <div title={`Conviction ${v}/100 — how strongly the model's own numbers back this action`}
      style={{ width: 74, flexShrink: 0 }}>
      <div style={{ ...mono, fontSize: 10, color: C.dim, textAlign: "right" }}>{v}</div>
      <div style={{ height: 4, background: C.line, borderRadius: 2 }}>
        <div style={{ height: 4, width: `${v}%`, borderRadius: 2,
                      background: v >= 70 ? C.gold : v >= 45 ? C.text200 : C.dim }} />
      </div>
    </div>
  );
}

export default function FundManager({ API, user, requestAuth, onOpen }) {
  const [data, setData] = useState(null);
  // loading derives from "signed in but no payload yet" — no sync setState.
  const [loaded, setLoaded] = useState(false);
  const loading = !!user && !loaded;

  useEffect(() => {
    if (!API || !user) return;
    let dead = false;
    authFetch(`${API}/api/portfolio/analysis`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!dead) { setData(d); setLoaded(true); } })
      .catch(() => { if (!dead) { setData(null); setLoaded(true); } });
    return () => { dead = true; };
  }, [API, user]);

  if (!user) return <SignInGate requestAuth={requestAuth} what="fund manager" />;
  if (loading) return (
    <div style={{ padding: 48, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Reading your book…
    </div>
  );

  const mgr = data?.manager;
  const empty = !mgr || !mgr.aum;

  return (
    <div className="fadein" style={{ padding: "24px 32px", maxWidth: 1080 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <Sparkles size={20} color={C.gold} />
        <span style={{ ...serif, fontSize: 30, color: C.text }}>Fund Manager</span>
        {mgr?.aum ? <span style={{ ...mono, fontSize: 13, color: C.dim }}>book {inr(mgr.aum)}</span> : null}
      </div>
      <div style={{ ...sans, fontSize: 12, color: C.faint, marginBottom: 20 }}>
        Conviction-scored actions from the terminal's own research — verdicts, margins of safety,
        risk-balanced sizing, momentum and holding-period tax. You decide; nothing here is SEBI-registered advice.
      </div>

      {empty && (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, padding: "48px 24px", textAlign: "center" }}>
          <Briefcase size={26} color={C.faint} style={{ marginBottom: 12 }} />
          <div style={{ ...serif, fontSize: 20, color: C.text200, marginBottom: 6 }}>No book to manage yet</div>
          <div style={{ ...sans, fontSize: 13, color: C.dim, maxWidth: 460, margin: "0 auto", lineHeight: 1.6 }}>
            Add holdings in the Portfolio tab (type them, paste from your broker, or import a CSV) and the
            manager's desk lights up with a written note and a sized action queue.
          </div>
        </div>
      )}

      {!empty && (
        <>
          {/* PM note */}
          <div style={{ border: `1px solid ${C.gold}33`, borderRadius: 12, background: C.panel, padding: "18px 22px", marginBottom: 18 }}>
            <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.gold, marginBottom: 8 }}>
              Manager's note
            </div>
            <div style={{ ...serif, fontSize: 16.5, color: C.text200, lineHeight: 1.7 }}>{mgr.note}</div>
          </div>

          {/* Action queue */}
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, padding: "16px 20px", marginBottom: 18 }}>
            <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.dim, marginBottom: 6 }}>
              Action queue · highest conviction first
            </div>
            {(mgr.actions || []).length === 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 0", ...sans, fontSize: 13, color: C.green }}>
                <BadgeCheck size={15} /> Nothing to act on — the book is aligned with the research.
              </div>
            )}
            {(mgr.actions || []).map((a, i) => (
              <div key={i} onClick={() => onOpen && onOpen(a.ticker)}
                onMouseEnter={e => e.currentTarget.style.background = C.bg800}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 6px",
                         borderTop: `1px solid ${C.line}`, cursor: "pointer" }}>
                <ConvictionBar v={a.conviction} />
                <span style={{ ...sans, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", flexShrink: 0,
                               padding: "3px 8px", borderRadius: 5, marginTop: 2,
                               color: actionTone(a.action), background: actionTone(a.action) + "1a" }}>
                  {a.action}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ ...mono, fontSize: 12.5, color: C.gold }}>{a.ticker}</span>
                    <span style={{ ...sans, fontSize: 12.5, color: C.text }}>{a.name}</span>
                    {a.size_inr != null && (
                      <span style={{ ...mono, fontSize: 11.5, color: C.text200 }}
                        title={a.size_note || ""}>~{inr(a.size_inr)}{a.size_note ? ` ${a.size_note}` : ""}</span>
                    )}
                  </div>
                  <div style={{ ...sans, fontSize: 11.5, color: C.dim, lineHeight: 1.55, marginTop: 2 }}>
                    {(a.reasons || []).join(" · ")}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Book health strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 14 }}>
            {[["Positions", data.concentration?.n],
              ["Top position", data.concentration?.top1 != null ? (data.concentration.top1 * 100).toFixed(0) + "%" : "—"],
              ["In BUY-rated names", data.verdict_mix?.BUY != null ? (data.verdict_mix.BUY * 100).toFixed(0) + "%" : "—"],
              ["Long-term (LTCG)", data.term?.long?.weight != null ? (data.term.long.weight * 100).toFixed(0) + "%" : "—"],
              ["1-day VaR (95%)", data.risk?.var_95_1d != null ? (data.risk.var_95_1d * 100).toFixed(1) + "%" : "—"],
              ["XIRR", data.risk?.xirr != null ? (data.risk.xirr * 100).toFixed(1) + "%" : "—"],
            ].map(([l, v]) => (
              <div key={l} style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel, padding: "12px 14px" }}>
                <div style={{ ...sans, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em", color: C.faint }}>{l}</div>
                <div style={{ ...mono, fontSize: 17, color: C.text, marginTop: 4 }}>{v ?? "—"}</div>
              </div>
            ))}
          </div>

          <div style={{ ...sans, fontSize: 10, color: C.faint, lineHeight: 1.5 }}>{data.disclaimer}</div>
        </>
      )}
    </div>
  );
}
