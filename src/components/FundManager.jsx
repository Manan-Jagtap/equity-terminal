/* FundManager.jsx — the manager's desk for YOUR book.

   A written PM note, a conviction-scored action queue with rupee sizing
   against risk-balanced targets, and the book's health at a glance. Every
   number is a mechanical restatement of the terminal's published research
   (verdicts, MoS, weights, momentum, holding terms) — educational decision
   support; the owner decides. */
import { useEffect, useState } from "react";
import { BadgeCheck, Briefcase, Loader2, Sparkles, Landmark, GitCompare, ShieldAlert } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";
import { authFetch } from "../lib/auth.js";
import { SignInGate } from "./Watchlist.jsx";

const inr = v => v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const actionTone = a =>
  a.includes("EXIT") ? C.red : a.includes("TRIM") ? "#E8B054" : C.green;

const REGIME = {
  risk_on:  { label: "RISK-ON",  color: C.green },
  risk_off: { label: "RISK-OFF", color: C.red },
  neutral:  { label: "MIXED",    color: "#E8B054" },
};

/* The macro tape the engine read this morning — regime, breadth, trend,
   sector leadership. Same numbers that shaped conviction and sizing. */
function MacroStrip({ macro }) {
  if (!macro) return null;
  const reg = REGIME[macro.regime] || REGIME.neutral;
  const chip = { ...mono, fontSize: 10.5, padding: "3px 9px", borderRadius: 6,
                 border: `1px solid ${C.line2}`, color: C.text200, whiteSpace: "nowrap" };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
                  border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel,
                  padding: "10px 14px", marginBottom: 18 }}>
      <span style={{ ...sans, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.12em", color: C.dim }}>
        Macro read
      </span>
      <span style={{ ...chip, color: reg.color, borderColor: reg.color + "55", background: reg.color + "12" }}>
        {reg.label}
      </span>
      {macro.nifty?.above_200dma != null && (
        <span style={chip}>Nifty {macro.nifty.above_200dma ? "▲ above" : "▼ below"} 200-DMA</span>
      )}
      {macro.breadth_200dma != null && (
        <span style={chip} title="Share of the 1000-name universe trading above its own 200-day average">
          breadth {(macro.breadth_200dma * 100).toFixed(0)}%
        </span>
      )}
      {(macro.rs_leaders || []).length > 0 && (
        <span style={{ ...chip, color: C.green }} title="Strongest median 12-1 momentum">
          ↑ {macro.rs_leaders.join(" · ")}
        </span>
      )}
      {(macro.rs_laggards || []).length > 0 && (
        <span style={{ ...chip, color: C.red }} title="Weakest median 12-1 momentum">
          ↓ {macro.rs_laggards.join(" · ")}
        </span>
      )}
      {macro.rates?.gsec_10y?.last != null && (
        <span style={chip}
          title={`10-year G-sec yield (FBIL), as of ${macro.rates.gsec_10y.as_of}${macro.rates.stance ? ` — policy ${macro.rates.stance.replace("_", " ")}` : ""}`}>
          10Y {macro.rates.gsec_10y.last}%
          {macro.rates.gsec_10y.chg_3m_bps != null &&
            <span style={{ color: macro.rates.gsec_10y.chg_3m_bps <= 0 ? C.green : C.red }}>
              {" "}{macro.rates.gsec_10y.chg_3m_bps > 0 ? "+" : ""}{macro.rates.gsec_10y.chg_3m_bps}bps
            </span>}
        </span>
      )}
      {macro.rates?.stance && (
        <span style={{ ...chip,
          color: macro.rates.stance === "easing" ? C.green : macro.rates.stance === "tightening" ? C.red : C.dim }}
          title="Policy stance read from the repo rate's last move and the 3-month 10Y drift (RBI DBIE data)">
          {macro.rates.stance.replace("_", " ").toUpperCase()}
        </span>
      )}
      {macro.rates?.cpi_yoy?.pct != null && (
        <span style={chip} title={`CPI inflation YoY, as of ${macro.rates.cpi_yoy.as_of}`}>
          CPI {macro.rates.cpi_yoy.pct.toFixed(1)}%
        </span>
      )}
      {macro.rates?.usdinr?.last != null && (
        <span style={chip}
          title={`USDINR month-end, as of ${macro.rates.usdinr.as_of}${macro.rates.usdinr.chg_3m_pct != null ? ` (${macro.rates.usdinr.chg_3m_pct > 0 ? "+" : ""}${macro.rates.usdinr.chg_3m_pct}% over 3m)` : ""}`}>
          ₹/$ {macro.rates.usdinr.last}
        </span>
      )}
      {(macro.commodities || []).filter(c => Math.abs(c.pct || 0) >= 2).slice(0, 2).map(c => (
        <span key={c.name} style={{ ...chip, color: (c.pct || 0) >= 0 ? C.green : C.red }}>
          {c.name} {(c.pct >= 0 ? "+" : "") + c.pct?.toFixed(1)}%
        </span>
      ))}
    </div>
  );
}

/* Evidence chips: what actually voted on this action. */
function EvidenceChips({ ev }) {
  if (!ev) return null;
  const chip = { ...mono, fontSize: 9.5, padding: "2px 7px", borderRadius: 5,
                 border: `1px solid ${C.line}`, color: C.dim, whiteSpace: "nowrap" };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
      {ev.suspect && (
        <span style={{ ...chip, color: "#E8B054", borderColor: "#E8B05455", background: "#E8B05412" }}
          title="The model's fair value conflicted with the analyst consensus and/or this name's own 5-year valuation band (or was structurally unreliable) — it was excluded from this conviction score.">
          ⚠ MODEL SET ASIDE
        </span>
      )}
      {ev.val_blend != null && (
        <span style={chip} title={`Blended valuation view from: ${(ev.val_sources || []).join(", ") || "—"}`}>
          val {(ev.val_blend * 100).toFixed(0)}% · {(ev.val_sources || []).length} source{(ev.val_sources || []).length === 1 ? "" : "s"}
        </span>
      )}
      {ev.quality != null && (
        <span style={{ ...chip, color: ev.quality >= 65 ? C.green : ev.quality < 45 ? C.red : C.dim }}
          title="Accounting-quality composite (Piotroski F, accruals, cash conversion, coverage, leverage)">
          quality {Math.round(ev.quality)}
        </span>
      )}
      {ev.pe_pct_5y != null && (
        <span style={chip} title="Where today's trailing P/E sits inside this name's own 5-year range (lower = cheaper than its history)">
          P/E {Math.round(ev.pe_pct_5y)}th pctile
        </span>
      )}
      {ev.alpha != null && (
        <span style={chip} title="7-factor Alpha Score rank within the universe">α {Math.round(ev.alpha)}</span>
      )}
      {(ev.red_flags || []).map(f => (
        <span key={f} style={{ ...chip, color: C.red, borderColor: C.red + "44" }} title="Forensic red flag from the company's own statements">
          ⚑ {f}
        </span>
      ))}
    </div>
  );
}

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

/* One tax-move tile. Module-level so it isn't recreated during render. */
function TaxMove({ color, label, value, sub }) {
  return (
    <div style={{ flex: "1 1 200px", border: `1px solid ${C.line}`, borderRadius: 10,
                  background: C.bg900, padding: "12px 14px" }}>
      <div style={{ ...sans, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em", color }}>{label}</div>
      <div style={{ ...mono, fontSize: 18, color: C.text, marginTop: 4 }}>{value}</div>
      <div style={{ ...sans, fontSize: 10.5, color: C.faint, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>
    </div>
  );
}

/* Dry-powder control — the investable cash the manager sizes its adds against. */
function CashBar({ cash, onSave, onClear, busy }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState("");
  const amount = cash?.amount;
  const start = () => { setVal(amount != null ? String(amount) : ""); setEdit(true); };
  const commit = () => { const n = Number(val); if (!isNaN(n) && n >= 0) onSave(n); setEdit(false); };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                  border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel,
                  padding: "10px 14px", marginBottom: 18 }}>
      <span style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim }}>
        Investable cash
      </span>
      {edit ? (
        <>
          <input autoFocus type="number" value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && commit()}
            placeholder="₹ amount" style={{ ...mono, fontSize: 13, width: 130, padding: "5px 9px",
              borderRadius: 7, background: C.bg800, color: C.text, border: `1px solid ${C.line2}`, outline: "none" }} />
          <button onClick={commit} style={{ ...sans, fontSize: 11, padding: "5px 11px", borderRadius: 7,
            cursor: "pointer", border: `1px solid ${C.gold}66`, background: C.gold + "14", color: C.gold }}>Save</button>
        </>
      ) : (
        <>
          <span style={{ ...mono, fontSize: 16, color: amount ? C.text : C.faint }}>
            {amount != null ? inr(amount) : "not set"}
          </span>
          <button onClick={start} disabled={busy} style={{ ...sans, fontSize: 11, padding: "5px 11px", borderRadius: 7,
            cursor: busy ? "default" : "pointer", border: `1px solid ${C.line2}`, background: "transparent", color: C.dim }}>
            {amount != null ? "Edit" : "Set dry powder"}
          </button>
          {amount != null && (
            <button onClick={onClear} disabled={busy} title="Remove the cash setting"
              style={{ ...sans, fontSize: 11, padding: "5px 10px", borderRadius: 7,
                cursor: busy ? "default" : "pointer", border: `1px solid ${C.line2}`, background: "transparent", color: C.faint }}>
              Remove
            </button>
          )}
        </>
      )}
      {busy && (
        <span style={{ ...sans, fontSize: 11, color: C.dim, display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> updating…
        </span>
      )}
      {!busy && cash?.deployable != null && cash.deployable > 0 && (
        <span style={{ ...mono, fontSize: 11, color: C.green }}>
          {inr(cash.deployable)} deployable across {cash.n_funded} add{cash.n_funded === 1 ? "" : "s"}
        </span>
      )}
      <span style={{ ...sans, fontSize: 10.5, color: C.faint, marginLeft: "auto" }}>
        the manager sizes and gates its adds against this
      </span>
    </div>
  );
}

/* Capital-rotation strategist — the self-funding, no-leverage way to act on a
   high-conviction idea: trim the weakest held names to fund the strongest new
   ones. Includes the desk's explicit no-leverage stance. */
function RotationPanel({ rotations, leveragePolicy }) {
  if ((!rotations || !rotations.length) && !leveragePolicy) return null;
  return (
    <div style={{ border: `1px solid ${C.gold}22`, borderRadius: 12, background: C.panel,
                  padding: "16px 20px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <GitCompare size={14} color={C.gold} />
        <span style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.gold }}>
          Self-funding rotations
        </span>
        <span style={{ ...mono, fontSize: 10.5, color: C.faint }}>upgrade the book with no new capital</span>
      </div>
      {(rotations || []).map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap",
                              padding: "9px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
          <span style={{ ...mono, fontSize: 12.5, color: C.green }}>BUY {r.add?.ticker}</span>
          <span style={{ ...mono, fontSize: 10.5, color: C.dim }}>conv {r.add?.conviction} · {inr(r.add?.size_inr)}</span>
          <span style={{ ...sans, fontSize: 11, color: C.faint }}>← fund by trimming</span>
          {(r.fund_from || []).map((f, j) => (
            <span key={j} style={{ ...mono, fontSize: 11.5, color: "#E8B054" }}
              title={f.why}>{f.ticker} {inr(f.amount)}</span>
          ))}
        </div>
      ))}
      {leveragePolicy && (
        <div style={{ display: "flex", gap: 8, marginTop: rotations?.length ? 12 : 0,
                      padding: "10px 12px", borderRadius: 8, background: C.bg900,
                      border: `1px solid ${C.line}` }}>
          <ShieldAlert size={14} color={C.dim} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ ...sans, fontSize: 11, color: C.dim, lineHeight: 1.55 }}>{leveragePolicy}</span>
        </div>
      )}
    </div>
  );
}

/* Tax-optimization panel: exemption harvesting, loss harvesting, ST→LT timing. */
function TaxPanel({ tax }) {
  if (!tax) return null;
  const u = tax.unrealised || {};
  const harvest = tax.ltcg_harvest || [];
  const losses = tax.loss_harvest || [];
  const defers = tax.st_to_lt_deferrals || [];
  const usable = tax.ltcg_exemption_usable || 0;
  const shelter = losses.reduce((s, l) => s + (l.tax_shelter || 0), 0);
  const deferSave = defers.reduce((s, d) => s + (d.saving || 0), 0);
  if (!harvest.length && !losses.length && !defers.length) return null;

  return (
    <div style={{ border: `1px solid ${C.gold}22`, borderRadius: 12, background: C.panel,
                  padding: "16px 20px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Landmark size={14} color={C.gold} />
        <span style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.gold }}>
          Tax optimization
        </span>
        <span style={{ ...mono, fontSize: 10.5, color: C.faint }}>
          unrealised: LT {inr(u.lt_gain)} · ST {inr(u.st_gain)} · losses {inr((u.lt_loss || 0) + (u.st_loss || 0))}
        </span>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {harvest.length > 0 && (
          <TaxMove color={C.green} label="Harvest LTCG free"
            value={inr(usable)}
            sub={`Book long-term gains inside the ₹1.25L exemption on ${harvest.length} name${harvest.length !== 1 ? "s" : ""} — tax-free, resets basis higher.`} />
        )}
        {losses.length > 0 && (
          <TaxMove color="#E8B054" label="Harvest losses"
            value={inr(shelter)}
            sub={`Booking losses on ${losses.length} underwater name${losses.length !== 1 ? "s" : ""} shelters this much tax against gains.`} />
        )}
        {defers.length > 0 && (
          <TaxMove color={C.blue} label="Defer ST→LT"
            value={inr(deferSave)}
            sub={`${defers.length} short-term winner${defers.length !== 1 ? "s" : ""} near the 1-year mark — waiting drops 20%→12.5%.`} />
        )}
      </div>
      {harvest.length > 0 && (
        <div style={{ ...sans, fontSize: 11, color: C.dim, marginTop: 12, lineHeight: 1.6 }}>
          {harvest.slice(0, 4).map(h => (
            <span key={h.ticker} style={{ marginRight: 14 }}>
              <span style={{ ...mono, color: C.gold }}>{h.ticker}</span>{" "}
              sell {Math.round(h.sell_fraction * 100)}% → {inr(h.harvest_gain)} gain tax-free
            </span>
          ))}
        </div>
      )}
      <div style={{ ...sans, fontSize: 9.5, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>{tax.disclaimer}</div>
    </div>
  );
}

export default function FundManager({ API, user, requestAuth, onOpen }) {
  const [data, setData] = useState(null);
  // loading derives from "signed in but no payload yet" — no sync setState.
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);      // bump to refetch after a cash change
  const loading = !!user && !loaded;

  useEffect(() => {
    if (!API || !user) return;
    let dead = false;
    authFetch(`${API}/api/portfolio/analysis`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!dead) { setData(d); setLoaded(true); } })
      .catch(() => { if (!dead) { setData(null); setLoaded(true); } });
    return () => { dead = true; };
  }, [API, user, reload]);

  const [cashBusy, setCashBusy] = useState(false);
  const saveCash = amount => {
    setCashBusy(true);
    authFetch(`${API}/api/portfolio/cash`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    }).then(() => setReload(n => n + 1)).catch(() => {}).finally(() => setCashBusy(false));
  };
  const clearCash = () => {
    setCashBusy(true);
    authFetch(`${API}/api/portfolio/cash`, { method: "DELETE" })
      .then(() => setReload(n => n + 1)).catch(() => {}).finally(() => setCashBusy(false));
  };

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
      <div style={{ ...sans, fontSize: 12, color: C.faint, marginBottom: 20, maxWidth: 860, lineHeight: 1.6 }}>
        Conviction comes from triangulated evidence — the model's fair value cross-examined against analyst
        consensus and each name's own 5-year valuation band, plus forensic accounting quality, institutional
        flow, results momentum and the macro tape. A model that fails cross-examination is set aside, and the
        action says so. You decide; nothing here is SEBI-registered advice.
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
          <CashBar cash={mgr.cash} onSave={saveCash} onClear={clearCash} busy={cashBusy} />
          <MacroStrip macro={mgr.macro} />
          {/* PM note */}
          <div style={{ border: `1px solid ${C.gold}33`, borderRadius: 12, background: C.panel, padding: "18px 22px", marginBottom: 18 }}>
            <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.gold, marginBottom: 8 }}>
              Manager's note
            </div>
            <div style={{ ...serif, fontSize: 16.5, color: C.text200, lineHeight: 1.7 }}>{mgr.note}</div>
          </div>

          <RotationPanel rotations={mgr.rotations} leveragePolicy={mgr.leverage_policy} />

          <TaxPanel tax={mgr.tax} />

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
                    {a.after_tax_inr != null && a.tax_estimate > 0 && (
                      <span style={{ ...mono, fontSize: 10.5, color: C.faint }}
                        title={`Estimated capital-gains tax ${inr(a.tax_estimate)} on this trim`}>
                        ≈ {inr(a.after_tax_inr)} after tax
                      </span>
                    )}
                  </div>
                  {a.levels?.target != null && (
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4, ...mono, fontSize: 11 }}>
                      <span style={{ color: C.dim }}>CMP <span style={{ color: C.text200 }}>{inr(a.levels.price)}</span></span>
                      {a.action.startsWith("ADD") || a.action.startsWith("TOP-UP")
                        ? <span style={{ color: C.dim }} title="Price at which the margin of safety reaches the model's 25% BUY gate">
                            entry zone <span style={{ color: C.green }}>≤ {inr(a.levels.entry_below)}</span>
                          </span>
                        : null}
                      <span style={{ color: C.dim }}
                        title={a.levels.basis === "consensus"
                          ? "The Street's mean target — quoted because the model's own fair value failed cross-examination on this name"
                          : "The model's fair value — its 12–18 month anchor, re-derived every refresh"}>
                        {a.levels.basis === "consensus" ? "consensus target" : "target"}{" "}
                        <span style={{ color: C.gold }}>{inr(a.levels.target)}</span>
                      </span>
                      {a.levels.target_low != null && a.levels.target_high != null && (
                        <span style={{ color: C.faint }}
                          title="Corridor spanned by the analyst low/high targets and the model's fair value — a range, not false precision">
                          range {inr(a.levels.target_low)}–{inr(a.levels.target_high)}
                        </span>
                      )}
                      {a.levels.upside_pct != null && (
                        <span style={{ color: a.levels.upside_pct >= 0 ? C.green : C.red }}>
                          {(a.levels.upside_pct * 100).toFixed(0)}% to {a.levels.basis === "consensus" ? "consensus" : "fair"}
                        </span>
                      )}
                    </div>
                  )}
                  <EvidenceChips ev={a.evidence} />
                  {(a.hold_for_results || a.cash_note) && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                      {a.hold_for_results && (
                        <span style={{ ...mono, fontSize: 9.5, padding: "2px 8px", borderRadius: 5,
                          color: "#E8B054", border: "1px solid #E8B05455", background: "#E8B05412" }}
                          title={`Reports ${a.results_due?.date} — the manager is holding for the print`}>
                          ⏳ WAIT FOR RESULTS{a.results_due?.days_away >= 0 ? ` · ${a.results_due.days_away}d` : ""}
                        </span>
                      )}
                      {a.cash_note && (
                        <span style={{ ...mono, fontSize: 9.5, padding: "2px 8px", borderRadius: 5,
                          color: C.dim, border: `1px solid ${C.line2}` }} title="Sized against your investable cash">
                          {a.fundable === false ? "⛔ " : ""}{a.cash_note}
                        </span>
                      )}
                      {a.fundable === true && (
                        <span style={{ ...mono, fontSize: 9.5, padding: "2px 8px", borderRadius: 5,
                          color: C.green, border: `1px solid ${C.green}44` }} title="Funded by your available cash">
                          ✓ funded from cash
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ ...sans, fontSize: 11.5, color: C.dim, lineHeight: 1.55, marginTop: 2 }}>
                    {(a.reasons || []).join(" · ")}
                  </div>
                  {(a.flip || []).length > 0 && (
                    <div style={{ ...sans, fontSize: 10.5, color: C.faint, marginTop: 3, fontStyle: "italic" }}
                      title="The evidence closest to flipping this call — what the engine is watching">
                      Would change this call: {a.flip.join(" · ")}
                    </div>
                  )}
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

          {mgr.engine && (
            <div style={{ ...mono, fontSize: 9.5, color: C.vfaint, marginBottom: 6 }}
              title="Signal weights are calibrated monthly against 5 years of the terminal's own full-universe history (information coefficients vs forward 6-month returns), shrunk toward research priors.">
              engine {mgr.engine.version}
              {mgr.engine.evidence_as_of ? ` · evidence ${String(mgr.engine.evidence_as_of).slice(0, 10)}` : ""}
              {mgr.engine.calibration_as_of ? ` · calibrated ${String(mgr.engine.calibration_as_of).slice(0, 10)}` : " · calibration pending — prior weights"}
            </div>
          )}
          <div style={{ ...sans, fontSize: 10, color: C.faint, lineHeight: 1.5 }}>{data.disclaimer}</div>
        </>
      )}
    </div>
  );
}
