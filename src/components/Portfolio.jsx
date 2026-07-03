/* Portfolio.jsx — holdings tracker.
   Summary cards + add-holding form + holdings table against the backend
   /api/portfolio endpoints. All amounts ₹ Indian-formatted. */

import { useCallback, useEffect, useState } from "react";
import { Briefcase, Loader2, Plus, Trash2, ChevronRight, Sparkles } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";
import { inr, signedPct } from "../lib/formatters.js";
import { VerdictBadge } from "./primitives.jsx";
import { SignInGate } from "./Watchlist.jsx";
import { authFetch } from "../lib/auth.js";

const pnlColor = v => v == null ? C.dim : v >= 0 ? C.green : C.red;
// Backend sends pnl_pct, weight AND mos all as FRACTIONS (0.124 = 12.4%),
// consistent with the rest of the API. Multiply by 100 for display.
const pctNum = (v, d = 1) => v == null || !isFinite(v) ? "—" : (v >= 0 ? "+" : "") + (Number(v) * 100).toFixed(d) + "%";
const pctPlain = (v, d = 1) => v == null || !isFinite(v) ? "—" : (Number(v) * 100).toFixed(d) + "%";

export default function Portfolio({ API, onOpen, user, requestAuth }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);

  // Add-holding form
  const [ticker, setTicker]   = useState("");
  const [qty, setQty]         = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [saving, setSaving]   = useState(false);
  const [xray, setXray]       = useState(null);

  const reload = useCallback(() => {
    if (!API || !user) { setData(null); setLoading(false); return; }
    setLoading(true);
    authFetch(`${API}/api/portfolio`)
      .then(r => { if (!r.ok) throw new Error(`portfolio ${r.status}`); return r.json(); })
      .then(d => { setData(d); setErr(null); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, [API, user]);
  useEffect(() => { reload(); }, [reload]);

  // Factor / risk X-ray (loads alongside; refreshes when holdings change).
  useEffect(() => {
    if (!API || !user) { setXray(null); return; }
    authFetch(`${API}/api/portfolio/xray`)
      .then(r => (r.ok ? r.json() : null)).then(setXray).catch(() => setXray(null));
  }, [API, user, data]);

  const add = async e => {
    e.preventDefault();
    if (!API || !ticker.trim() || !qty || !avgCost) return;
    setSaving(true);
    try {
      await authFetch(`${API}/api/portfolio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase(), qty: Number(qty), avg_cost: Number(avgCost) }),
      });
      setTicker(""); setQty(""); setAvgCost("");
      reload();
    } catch { /* keep form values so the user can retry */ }
    setSaving(false);
  };

  const remove = async id => {
    if (!API) return;
    try { await authFetch(`${API}/api/portfolio/${id}`, { method: "DELETE" }); } catch { /* noop */ }
    reload();
  };

  const items  = data?.items || [];
  const totals = data?.totals || {};

  if (!user) return <SignInGate requestAuth={requestAuth} what="portfolio" />;

  if (loading) return (
    <div style={{ padding: 48, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading portfolio…
    </div>
  );

  const th = { ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
    color: C.dim, padding: "10px 12px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" };
  const td = { ...mono, fontSize: 12, padding: "11px 12px", borderTop: `1px solid ${C.line}` };
  const inputStyle = {
    ...mono, fontSize: 13, background: C.panel2, border: `1px solid ${C.line2}`,
    borderRadius: 8, color: C.text, padding: "8px 12px", outline: "none",
  };

  return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <Briefcase size={20} color={C.gold} />
        <span style={{ ...serif, fontSize: 30, color: C.text }}>Portfolio</span>
        <span style={{ ...sans, fontSize: 13, color: C.dim }}>{items.length} {items.length === 1 ? "holding" : "holdings"}</span>
      </div>
      <div style={{ ...sans, fontSize: 12, color: C.faint, marginBottom: 18 }}>
        Track your actual holdings against the model — live value, P&amp;L, and the value-weighted margin of safety of the book.
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
        {[
          { l: "Total value", v: inr(totals.value), col: C.text },
          { l: "Capital P&L",
            v: totals.pnl != null ? (totals.pnl >= 0 ? "+" : "−") + inr(Math.abs(totals.pnl)) : "—",
            sub: pctNum(totals.pnl_pct), col: pnlColor(totals.pnl) },
          { l: "Dividends", v: totals.div_income ? inr(totals.div_income) : "—",
            sub: totals.div_income ? "received" : null, col: totals.div_income ? C.green : C.dim },
          { l: "Total return",
            v: totals.total_pnl != null ? (totals.total_pnl >= 0 ? "+" : "−") + inr(Math.abs(totals.total_pnl)) : "—",
            sub: totals.total_pnl_pct != null ? pctNum(totals.total_pnl_pct) + " incl. div" : null,
            col: pnlColor(totals.total_pnl) },
          { l: "Weighted MoS", v: totals.weighted_mos != null ? signedPct(totals.weighted_mos) : "—", col: pnlColor(totals.weighted_mos) },
          { l: "Holdings", v: String(items.length), col: C.text },
        ].map(s => (
          <div key={s.l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "13px 16px" }}>
            <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim }}>{s.l}</div>
            <div style={{ ...mono, fontSize: 20, color: s.col, marginTop: 5 }}>{s.v}</div>
            {s.sub && <div style={{ ...mono, fontSize: 11, color: s.col, marginTop: 2 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Portfolio X-ray — factor exposure + inverse-vol sizing */}
      {xray?.xray && xray.xray.n > 0 && (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, padding: "16px 18px", marginBottom: 18 }}>
          <div style={{ ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={13} color={C.gold} /> Portfolio X-ray · factor &amp; risk
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10, marginBottom: 14 }}>
            {[
              ["Weighted Alpha", xray.xray.weighted_alpha != null ? Math.round(xray.xray.weighted_alpha) : "—"],
              ["Est. volatility", xray.xray.est_volatility != null ? (xray.xray.est_volatility * 100).toFixed(0) + "%" : "—"],
              ["Top position", xray.xray.top_weight != null ? (xray.xray.top_weight * 100).toFixed(0) + "%" : "—"],
              ["Sector conc. (HHI)", xray.xray.hhi != null ? xray.xray.hhi.toFixed(2) : "—"],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ ...sans, fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</div>
                <div style={{ ...mono, fontSize: 18, color: C.text, marginTop: 3 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 4 }}>
            {[["value", "Value"], ["quality", "Quality"], ["momentum", "Momentum"], ["low_vol", "Low Vol"], ["growth", "Growth"], ["catalyst", "Catalyst"]].map(([k, label]) => {
              const v = xray.xray.factor_exposure?.[k];
              const col = v == null ? C.dim : v >= 60 ? C.green : v >= 40 ? C.gold : C.red;
              return (
                <div key={k} style={{ minWidth: 88 }}>
                  <div style={{ ...sans, fontSize: 10, color: C.dim }}>{label}</div>
                  <div style={{ height: 4, background: C.bg600, borderRadius: 2, marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${v == null ? 0 : v}%`, background: col, borderRadius: 2 }} />
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: C.dim, marginTop: 2 }}>{v == null ? "—" : Math.round(v)}</div>
                </div>
              );
            })}
          </div>
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr>
                  {["Holding", "Alpha", "Weight", "Suggested", "Notes"].map((h, i) => (
                    <th key={h} style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: C.dim, textAlign: i === 0 ? "left" : "right", padding: "6px 8px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {xray.items.map(it => (
                  <tr key={it.ticker} style={{ borderTop: `1px solid ${C.line}`, cursor: onOpen ? "pointer" : "default" }}
                      onClick={() => onOpen && onOpen(it.ticker)}>
                    <td style={{ ...mono, fontSize: 12, color: C.gold, padding: "7px 8px" }}>{it.ticker}</td>
                    <td style={{ ...mono, fontSize: 12, textAlign: "right", padding: "7px 8px", color: it.alpha_score == null ? C.dim : it.alpha_score >= 60 ? C.green : it.alpha_score >= 40 ? C.gold : C.red }}>{it.alpha_score != null ? Math.round(it.alpha_score) : "—"}</td>
                    <td style={{ ...mono, fontSize: 12, textAlign: "right", padding: "7px 8px", color: C.text }}>{it.weight != null ? (it.weight * 100).toFixed(0) + "%" : "—"}</td>
                    <td style={{ ...mono, fontSize: 12, textAlign: "right", padding: "7px 8px", color: C.text200 }}>{it.suggested_weight != null ? (it.suggested_weight * 100).toFixed(0) + "%" : "—"}</td>
                    <td style={{ ...sans, fontSize: 10, textAlign: "right", padding: "7px 8px", color: C.red }}>{(it.flags || []).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ ...sans, fontSize: 10, color: C.faint, marginTop: 8 }}>
            Suggested weights are inverse-volatility (risk-balanced), capped at 25%. A sizing aid, not investment advice.
          </div>
        </div>
      )}

      {/* Add-holding form */}
      <form onSubmit={add} style={{
        display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
        border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel,
        padding: "12px 16px", marginBottom: 18,
      }}>
        <span style={{ ...sans, fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.1em" }}>Add holding</span>
        <input value={ticker} onChange={e => setTicker(e.target.value)} placeholder="Ticker (e.g. INFY)"
          style={{ ...inputStyle, width: 150, textTransform: "uppercase" }} />
        <input value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty" type="number" min="0" step="any"
          style={{ ...inputStyle, width: 90 }} />
        <input value={avgCost} onChange={e => setAvgCost(e.target.value)} placeholder="Avg cost ₹" type="number" min="0" step="any"
          style={{ ...inputStyle, width: 120 }} />
        <button type="submit" disabled={saving || !ticker.trim() || !qty || !avgCost} style={{
          ...sans, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500,
          padding: "8px 14px", borderRadius: 8, cursor: saving ? "wait" : "pointer",
          border: `1px solid ${C.gold}66`, color: C.gold, background: C.gold + "0d",
          opacity: (!ticker.trim() || !qty || !avgCost) ? 0.5 : 1,
        }}>
          {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={13} />}
          Add
        </button>
        {err && <span style={{ ...sans, fontSize: 11, color: C.red }}>Could not reach backend: {err}</span>}
      </form>

      {/* Holdings table / empty state */}
      {items.length === 0 ? (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, padding: "48px 24px", textAlign: "center" }}>
          <Briefcase size={26} color={C.faint} style={{ marginBottom: 12 }} />
          <div style={{ ...serif, fontSize: 20, color: C.text200, marginBottom: 6 }}>No holdings yet</div>
          <div style={{ ...sans, fontSize: 13, color: C.dim, maxWidth: 460, margin: "0 auto", lineHeight: 1.6 }}>
            Add a ticker, quantity and average cost above. The terminal marks each position to the latest price,
            computes P&amp;L and weights, and overlays the model's verdict and margin of safety on your book.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Company</th>
                <th style={{ ...th, textAlign: "right" }}>Qty</th>
                <th style={{ ...th, textAlign: "right" }}>Avg cost</th>
                <th style={{ ...th, textAlign: "right" }}>LTP</th>
                <th style={{ ...th, textAlign: "right" }}>Value</th>
                <th style={{ ...th, textAlign: "right" }}>P&amp;L</th>
                <th style={{ ...th, textAlign: "right" }}>Div</th>
                <th style={{ ...th, textAlign: "right" }}>Weight</th>
                <th style={{ ...th, textAlign: "right" }}>MoS</th>
                <th style={{ ...th, textAlign: "right" }}>Verdict</th>
                <th style={{ ...th }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(h => (
                <tr key={h.id} onClick={() => onOpen && onOpen(h.ticker)} style={{ cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg800}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ ...td }}>
                    <div style={{ ...sans, fontSize: 13, fontWeight: 500, color: C.text }}>{h.name || h.ticker}</div>
                    <div style={{ ...mono, fontSize: 10, color: C.faint }}>{h.ticker}{h.sector ? ` · ${h.sector}` : ""}</div>
                  </td>
                  <td style={{ ...td, textAlign: "right", color: C.text }}>{h.qty != null ? Number(h.qty).toLocaleString("en-IN") : "—"}</td>
                  <td style={{ ...td, textAlign: "right", color: C.text200 }}>{inr(h.avg_cost, 2)}</td>
                  <td style={{ ...td, textAlign: "right", color: C.text }}>{inr(h.price, 2)}</td>
                  <td style={{ ...td, textAlign: "right", color: C.text }}>{inr(h.value)}</td>
                  <td style={{ ...td, textAlign: "right", color: pnlColor(h.pnl) }}>
                    {h.pnl != null ? (h.pnl >= 0 ? "+" : "−") + inr(Math.abs(h.pnl)) : "—"}
                    <span style={{ color: pnlColor(h.pnl), opacity: 0.85 }}> ({pctNum(h.pnl_pct)})</span>
                  </td>
                  <td style={{ ...td, textAlign: "right", color: h.div_income ? C.green : C.faint }}
                      title={h.div_income ? "dividends received since added" : "no dividends recorded"}>
                    {h.div_income ? inr(h.div_income) : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "right", color: C.text200 }}>{pctPlain(h.weight)}</td>
                  <td style={{ ...td, textAlign: "right", color: pnlColor(h.mos) }}>{signedPct(h.mos)}</td>
                  <td style={{ ...td, textAlign: "right" }}><VerdictBadge verdict={h.verdict || "—"} /></td>
                  <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                    <button title="Remove holding"
                      onClick={e => { e.stopPropagation(); remove(h.id); }}
                      style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, lineHeight: 0 }}
                      onMouseEnter={e => e.currentTarget.firstChild && (e.currentTarget.firstChild.style.color = C.red)}>
                      <Trash2 size={14} color={C.faint} />
                    </button>
                    <ChevronRight size={14} color={C.faint} style={{ verticalAlign: "middle" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
