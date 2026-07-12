/* Portfolio.jsx — holdings tracker.
   Summary cards + add-holding form + holdings table against the backend
   /api/portfolio endpoints. All amounts ₹ Indian-formatted. */

import { useCallback, useEffect, useRef, useState } from "react";
import { Briefcase, Loader2, Plus, Trash2, ChevronRight, Sparkles, Upload } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";
import { inr, signedPct } from "../lib/formatters.js";
import { VerdictBadge } from "./primitives.jsx";
import { SignInGate } from "./Watchlist.jsx";
import { authFetch } from "../lib/auth.js";
import { parseHoldings } from "../lib/brokerImport.js";

const pnlColor = v => v == null ? C.dim : v >= 0 ? C.green : C.red;
// Backend sends pnl_pct, weight AND mos all as FRACTIONS (0.124 = 12.4%),
// consistent with the rest of the API. Multiply by 100 for display.
const pctNum = (v, d = 1) => v == null || !isFinite(v) ? "—" : (v >= 0 ? "+" : "") + (Number(v) * 100).toFixed(d) + "%";
const pctPlain = (v, d = 1) => v == null || !isFinite(v) ? "—" : (Number(v) * 100).toFixed(d) + "%";

export default function Portfolio({ API, onOpen, user, requestAuth, onAnalyse }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);

  // Add-holding form
  const [ticker, setTicker]   = useState("");
  const [qty, setQty]         = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [buyDate, setBuyDate] = useState("");
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
  // Allocation / LTCG / strategist analysis (same cadence). No synchronous
  // clear needed: the render gate (`analysis && items.length`) hides it the
  // moment holdings reset.
  const [analysis, setAnalysis] = useState(null);
  useEffect(() => {
    if (!API || !user) return;
    let dead = false;
    authFetch(`${API}/api/portfolio/analysis`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!dead) setAnalysis(d); })
      .catch(() => { if (!dead) setAnalysis(null); });
    return () => { dead = true; };
  }, [API, user, data]);

  const add = async e => {
    e.preventDefault();
    if (!API || !ticker.trim() || !qty || !avgCost || !buyDate) return;
    setSaving(true);
    try {
      await authFetch(`${API}/api/portfolio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase(), qty: Number(qty), avg_cost: Number(avgCost),
                               ...(buyDate ? { buy_date: buyDate } : {}) }),
      });
      setTicker(""); setQty(""); setAvgCost(""); setBuyDate("");
      reload();
    } catch { /* keep form values so the user can retry */ }
    setSaving(false);
  };

  const remove = async id => {
    if (!API) return;
    try { await authFetch(`${API}/api/portfolio/${id}`, { method: "DELETE" }); } catch { /* noop */ }
    reload();
  };

  // Broker import: parse a holdings CSV (Zerodha Console / Groww / generic)
  // client-side and bulk-upsert. Names outside our coverage are reported,
  // never silently dropped — the imported book must be auditable.
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const importText = async text => {
    if (!text?.trim() || !API) return;
    setImporting(true); setImportMsg(null);
    try {
      const parsed = parseHoldings(text);
      const { skipped, error } = parsed;
      let holdings = parsed.holdings;
      if (error) { setImportMsg({ tone: C.red, text: error }); setImporting(false); return; }
      // Broker exports identify rows by ISIN / display name, not NSE ticker —
      // resolve them against the universe before importing.
      if (holdings.some(h => !h.ticker)) {
        const norm = n => (n || "").toLowerCase().replace(/&/g, " and ")
          .replace(/\b(ltd|limited|company|corp|corporation|industries|enterprises|the|and|of|india)\b\.?/g, " ")
          .split(/[^a-z0-9]+/).filter(Boolean).join(" ");
        let maps = { map: {}, names: {} };
        try { maps = await fetch(`${API}/api/isin-map`).then(r => r.json()); } catch { /* best effort */ }
        holdings = holdings.map(h => {
          if (h.ticker) return h;
          const t = (h.isin && maps.map?.[h.isin]) || (h.label && maps.names?.[norm(h.label)]) || null;
          return t ? { ...h, ticker: t } : h;
        });
      }
      let ok = 0; const uncovered = [];
      for (const h of holdings) {
        if (!h.ticker) { uncovered.push(h.label || h.isin || "?"); continue; }
        try {
          const r = await authFetch(`${API}/api/portfolio`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(h),
          });
          if (r.ok) ok += 1; else uncovered.push(h.ticker);
        } catch { uncovered.push(h.ticker); }
      }
      const parts = [`Imported ${ok} holding${ok === 1 ? "" : "s"}`];
      if (uncovered.length) parts.push(`outside coverage: ${uncovered.join(", ")}`);
      if (skipped.length) parts.push(`${skipped.length} row${skipped.length === 1 ? "" : "s"} unparseable`);
      setImportMsg({ tone: uncovered.length || !ok ? C.gold : C.green, text: parts.join(" · ") });
      if (ok) { setPasteOpen(false); setPasteText(""); }
      reload();
    } catch {
      setImportMsg({ tone: C.red, text: "Could not read those holdings — paste rows like \"INFY 100 1450.50\" or your broker's holdings table." });
    }
    setImporting(false);
  };
  const importCsv = async file => {
    if (!file) return;
    try { await importText(await file.text()); }
    catch { setImportMsg({ tone: C.red, text: "Could not read that file — copy-paste your holdings instead (Paste holdings button)." }); }
    if (fileRef.current) fileRef.current.value = "";
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
          {xray.risk && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10, marginBottom: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
              {[
                ["VaR (95%, 1d)", xray.risk.var_95_1d != null ? "−" + (xray.risk.var_95_1d * 100).toFixed(1) + "%" : "—",
                  xray.risk.var_95_1d_amount != null ? "≈ ₹" + Math.round(xray.risk.var_95_1d_amount).toLocaleString("en-IN") : null],
                ["Max drawdown (1y)", xray.risk.max_drawdown != null ? "−" + (xray.risk.max_drawdown * 100).toFixed(1) + "%" : "—",
                  xray.risk.drawdown_trough ? "to " + xray.risk.drawdown_trough : null],
                ["XIRR", xray.risk.xirr != null ? (xray.risk.xirr * 100).toFixed(1) + "%" : "—",
                  xray.risk.xirr != null ? "money-weighted p.a." : "needs history"],
                ["Series coverage", xray.risk.coverage != null ? (xray.risk.coverage * 100).toFixed(0) + "%" : "—",
                  (xray.risk.uncovered || []).length ? "no data: " + xray.risk.uncovered.join(", ") : `${xray.risk.observations} obs`],
              ].map(([l, v, sub]) => (
                <div key={l}>
                  <div style={{ ...sans, fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</div>
                  <div style={{ ...mono, fontSize: 18, color: C.text, marginTop: 3 }}>{v}</div>
                  {sub && <div style={{ ...mono, fontSize: 10, color: C.faint, marginTop: 2 }}>{sub}</div>}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 4 }}>
            {[["value", "Value"], ["quality", "Quality"], ["momentum", "Momentum"], ["low_vol", "Low Vol"], ["growth", "Growth"], ["catalyst", "Catalyst"], ["surprise", "Surprise"]].map(([k, label]) => {
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
        <input value={buyDate} onChange={e => setBuyDate(e.target.value)} type="date"
          title="Purchase date (optional) — drives the short-/long-term tax classification"
          max={new Date().toISOString().slice(0, 10)}
          style={{ ...inputStyle, width: 150, colorScheme: "dark" }} />
        <button type="submit" disabled={saving || !ticker.trim() || !qty || !avgCost || !buyDate}
          title={!buyDate ? "Purchase date is required — it drives the LTCG/STCG tax terms and the Fund Manager's timing" : undefined}
          style={{
          ...sans, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500,
          padding: "8px 14px", borderRadius: 8, cursor: saving ? "wait" : "pointer",
          border: `1px solid ${C.gold}66`, color: C.gold, background: C.gold + "0d",
          opacity: (!ticker.trim() || !qty || !avgCost || !buyDate) ? 0.5 : 1,
        }}>
          {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={13} />}
          Add
        </button>
        <span style={{ width: 1, height: 20, background: C.line }} />
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
          onChange={e => importCsv(e.target.files?.[0])} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={importing}
          title="Import your broker's holdings export (Zerodha Console, Groww, or any CSV with symbol/qty/avg-price columns)"
          style={{
            ...sans, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500,
            padding: "8px 14px", borderRadius: 8, cursor: importing ? "wait" : "pointer",
            border: `1px solid ${C.line2}`, color: C.text200, background: "transparent",
          }}>
          {importing ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={13} />}
          Import broker CSV
        </button>
        <button type="button" disabled={importing}
          title="Pull your actual holdings straight from your Dhan account (read-only; no orders are ever placed)"
          onClick={async () => {
            setImporting(true); setImportMsg(null);
            try {
              const r = await authFetch(`${API}/api/portfolio/sync-dhan`, { method: "POST" });
              const d = await r.json();
              if (!r.ok) throw new Error(d?.detail || "sync failed");
              const parts = [`Synced ${d.imported} holding${d.imported === 1 ? "" : "s"} from Dhan`];
              if (d.uncovered?.length) parts.push(`outside coverage: ${d.uncovered.join(", ")}`);
              setImportMsg({ tone: C.green, text: parts.join(" · ") });
              reload();
            } catch (e) { setImportMsg({ tone: C.red, text: `Dhan sync: ${e.message}` }); }
            setImporting(false);
          }}
          style={{
            ...sans, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500,
            padding: "8px 14px", borderRadius: 8, cursor: importing ? "wait" : "pointer",
            border: `1px solid ${C.green}55`, color: C.green, background: C.green + "0d",
          }}>
          <Sparkles size={13} /> Sync from Dhan
        </button>
        {onAnalyse && (
          <button type="button" onClick={onAnalyse}
            title="Open the Fund Manager's read of this book — PM note, sized actions, levels"
            style={{
              ...sans, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500,
              padding: "8px 14px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${C.gold}66`, color: C.gold, background: C.gold + "0d",
            }}>
            <Sparkles size={13} /> Analyse
          </button>
        )}
        <button type="button" onClick={() => setPasteOpen(v => !v)} disabled={importing}
          title="Paste your holdings straight from your broker's page or a spreadsheet — no file needed"
          style={{
            ...sans, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500,
            padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            border: `1px solid ${pasteOpen ? C.gold + "66" : C.line2}`,
            color: pasteOpen ? C.gold : C.text200, background: pasteOpen ? C.gold + "0d" : "transparent",
          }}>
          <ChevronRight size={13} style={{ transform: pasteOpen ? "rotate(90deg)" : "none", transition: "transform 160ms" }} />
          Paste holdings
        </button>
        {importMsg && <span style={{ ...sans, fontSize: 11.5, color: importMsg.tone }}>{importMsg.text}</span>}
        {err && <span style={{ ...sans, fontSize: 11, color: C.red }}>Could not reach backend: {err}</span>}
      </form>

      {/* Paste-your-holdings panel — the no-upload import path */}
      {pasteOpen && (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel,
                      padding: "14px 16px", marginBottom: 18 }}>
          <div style={{ ...sans, fontSize: 12, color: C.dim, marginBottom: 8, lineHeight: 1.5 }}>
            Copy your holdings table from your broker (Zerodha Console, Groww, Upstox…) or a spreadsheet and paste it below —
            ISINs and display names resolve automatically; headers optional. Plain lines work too: <span style={{ ...mono, color: C.text200 }}>INFY 100 1450.50 2024-05-13</span>.
            <span style={{ color: C.text200 }}> Best of all: paste your ORDER HISTORY / tradebook</span> (it has a Buy/Sell column) —
            we replay it FIFO to recover true quantities, costs <span style={{ color: C.text200 }}>and purchase dates</span>, which holdings exports don't carry.
          </div>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={6}
            placeholder={"Symbol\tQty\tAvg price\nINFY\t100\t1450.50\nTCS\t12\t3200"}
            style={{ ...mono, fontSize: 12, width: "100%", boxSizing: "border-box", resize: "vertical",
                     background: C.bg900, color: C.text, border: `1px solid ${C.line2}`,
                     borderRadius: 8, padding: "10px 12px", outline: "none" }} />
          <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
            <button type="button" disabled={importing || !pasteText.trim()} onClick={() => importText(pasteText)}
              style={{ ...sans, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500,
                       padding: "8px 14px", borderRadius: 8, cursor: importing ? "wait" : "pointer",
                       border: `1px solid ${C.gold}66`, color: C.gold, background: C.gold + "0d",
                       opacity: !pasteText.trim() ? 0.5 : 1 }}>
              {importing ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={13} />}
              Import pasted holdings
            </button>
            <span style={{ ...sans, fontSize: 10.5, color: C.faint }}>
              Parsed locally in your browser — nothing is uploaded anywhere until you import.
            </span>
          </div>
        </div>
      )}

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
                <th style={{ ...th, textAlign: "right" }}>Held</th>
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
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}
                      title={h.term ? (h.date_source === "added"
                          ? "No purchase date given — measured from when the row was added; edit the holding to set the real date"
                          : (h.term === "long" ? "Long-term (≥12 months) — LTCG applies"
                             : `Short-term — turns long-term in ${h.days_to_lt} days`)) : ""}>
                    {h.holding_days == null ? <span style={{ color: C.faint }}>—</span> : (
                      <>
                        <span style={{ color: C.text200 }}>
                          {h.holding_days >= 365 ? (h.holding_days / 365).toFixed(1) + "y" : h.holding_days + "d"}
                        </span>
                        <span style={{ ...sans, fontSize: 9, fontWeight: 600, marginLeft: 6, padding: "2px 6px", borderRadius: 4,
                                       color: h.term === "long" ? C.green : "#E8B054",
                                       background: (h.term === "long" ? C.green : "#E8B054") + "1a" }}>
                          {h.term === "long" ? "LT" : "ST"}
                        </span>
                        {h.date_source === "added" && (
                          <input type="date" defaultValue="" onClick={e => e.stopPropagation()}
                            max={new Date().toISOString().slice(0, 10)}
                            title="No purchase date on file (approximated from the add date) — set the real one for exact LTCG/STCG terms"
                            onChange={async e => {
                              e.stopPropagation();
                              const v = e.target.value;
                              if (!v) return;
                              try {
                                await authFetch(`${API}/api/portfolio`, {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ ticker: h.ticker, qty: h.qty, avg_cost: h.avg_cost, buy_date: v }),
                                });
                                reload();
                              } catch { /* keep */ }
                            }}
                            style={{ width: 22, height: 16, marginLeft: 5, border: "none", background: "transparent",
                                     colorScheme: "dark", cursor: "pointer", verticalAlign: "middle" }} />
                        )}
                      </>
                    )}
                  </td>
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

      {/* ── Portfolio Analysis ─────────────────────────────────────────── */}
      {analysis && items.length > 0 && (
        <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, padding: "16px 20px" }}>
            <div style={{ ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim, marginBottom: 14 }}>
              Portfolio Analysis
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20 }}>
              {/* Sector allocation */}
              <div>
                <div style={{ ...sans, fontSize: 10, color: C.faint, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Sector allocation</div>
                {(analysis.sectors || []).slice(0, 6).map(s2 => (
                  <div key={s2.sector} style={{ marginBottom: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", ...sans, fontSize: 11.5, color: C.text200 }}>
                      <span>{s2.sector}</span><span style={{ ...mono }}>{s2.weight != null ? (s2.weight * 100).toFixed(0) + "%" : "—"}</span>
                    </div>
                    <div style={{ height: 4, background: C.line, borderRadius: 2, marginTop: 3 }}>
                      <div style={{ height: 4, width: `${Math.min(100, (s2.weight || 0) * 100)}%`, background: C.gold, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Concentration */}
              <div>
                <div style={{ ...sans, fontSize: 10, color: C.faint, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Concentration</div>
                {[["Holdings", analysis.concentration?.n],
                  ["Top position", analysis.concentration?.top1 != null ? (analysis.concentration.top1 * 100).toFixed(0) + "%" : "—"],
                  ["Top 3", analysis.concentration?.top3 != null ? (analysis.concentration.top3 * 100).toFixed(0) + "%" : "—"],
                  ["HHI", analysis.concentration?.hhi != null ? analysis.concentration.hhi.toFixed(2) : "—"]].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: `1px solid ${C.line}` }}>
                    <span style={{ ...sans, fontSize: 12, color: C.dim }}>{l}</span>
                    <span style={{ ...mono, fontSize: 12.5, color: C.text }}>{v ?? "—"}</span>
                  </div>
                ))}
              </div>
              {/* Holding terms */}
              <div>
                <div style={{ ...sans, fontSize: 10, color: C.faint, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Holding terms (LTCG)</div>
                {[["Long-term", analysis.term?.long], ["Short-term", analysis.term?.short]].map(([l, t]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: `1px solid ${C.line}` }}>
                    <span style={{ ...sans, fontSize: 12, color: l === "Long-term" ? C.green : "#E8B054" }}>{l}</span>
                    <span style={{ ...mono, fontSize: 12.5, color: C.text }}>
                      {t ? `${t.n} · ${t.weight != null ? (t.weight * 100).toFixed(0) + "%" : "—"}` : "—"}
                    </span>
                  </div>
                ))}
                {(analysis.term?.turning_lt_soon || []).slice(0, 3).map(x => (
                  <div key={x.ticker} style={{ ...sans, fontSize: 11, color: C.dim, marginTop: 5 }}>
                    {x.ticker} turns long-term in <span style={{ color: C.gold }}>{x.days_to_lt}d</span>
                  </div>
                ))}
              </div>
              {/* Verdict mix */}
              <div>
                <div style={{ ...sans, fontSize: 10, color: C.faint, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Model view of the book</div>
                {Object.entries(analysis.verdict_mix || {}).map(([v, w]) => (
                  <div key={v} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: `1px solid ${C.line}` }}>
                    <span style={{ ...sans, fontSize: 12, color: v === "BUY" ? C.green : v === "REDUCE" || v === "SELL" ? C.red : C.dim }}>{v}</span>
                    <span style={{ ...mono, fontSize: 12.5, color: C.text }}>{w != null ? (w * 100).toFixed(0) + "%" : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Strategist ─────────────────────────────────────────────── */}
          {(analysis.recommendations || []).length > 0 && (
            <div style={{ border: `1px solid ${C.gold}33`, borderRadius: 12, background: C.panel, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                <Sparkles size={13} color={C.gold} />
                <span style={{ ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: C.gold }}>Strategist</span>
                <span style={{ ...sans, fontSize: 11, color: C.dim }}>mechanical read of your book against the model — you decide</span>
              </div>
              {(analysis.recommendations || []).map((r, i) => (
                <div key={i} onClick={() => onOpen && onOpen(r.ticker)}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg800}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "10px 6px",
                           borderTop: `1px solid ${C.line}`, cursor: "pointer" }}>
                  <span style={{ ...sans, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", flexShrink: 0,
                                 padding: "3px 8px", borderRadius: 5,
                                 color: r.action.includes("EXIT") ? C.red : r.action.includes("TRIM") ? "#E8B054" : C.green,
                                 background: (r.action.includes("EXIT") ? C.red : r.action.includes("TRIM") ? "#E8B054" : C.green) + "1a" }}>
                    {r.action}
                  </span>
                  <span style={{ ...mono, fontSize: 12, color: C.gold, flexShrink: 0, minWidth: 92 }}>{r.ticker}</span>
                  <span style={{ ...sans, fontSize: 12, color: C.text200, lineHeight: 1.55 }}>
                    {(r.reasons || []).join(" · ")}
                  </span>
                </div>
              ))}
              <div style={{ ...sans, fontSize: 10, color: C.faint, marginTop: 12, lineHeight: 1.5 }}>
                {analysis.disclaimer}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
