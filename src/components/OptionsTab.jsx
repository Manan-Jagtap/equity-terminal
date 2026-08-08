/* OptionsTab.jsx — option chain (Dhan-backed) + a strategy payoff builder.
   Chain: OI, IV, LTP, greeks + PCR, centered on ATM. Builder: multi-leg
   payoff-at-expiry with presets, breakevens and max P&L, priced off the live
   chain LTPs. Degrades to an honest empty state when Dhan isn't connected or
   the name isn't in F&O. A data aid, not advice. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Layers, LineChart as LineIcon, Plus, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, ReferenceDot } from "recharts";
import { C, sans, serif, mono } from "../lib/theme.js";

const num = v => v == null ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const f2 = v => v == null ? "—" : Number(v).toFixed(2);
const inr = v => v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: v >= 100 ? 0 : 2 });
const signed = v => v == null ? "—" : (v >= 0 ? "+₹" : "−₹") + Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function Empty({ msg }) {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <Layers size={26} color={C.faint} style={{ marginBottom: 12 }} />
      <div style={{ ...sans, fontSize: 13, color: C.dim, maxWidth: 460, margin: "0 auto", lineHeight: 1.6 }}>{msg}</div>
    </div>
  );
}

// ── Payoff math ──────────────────────────────────────────────────────────────
// Per-share P&L at expiry for one leg (premium is the per-share option price).
function legPayoff(leg, S) {
  const intrinsic = leg.type === "call" ? Math.max(S - leg.strike, 0) : Math.max(leg.strike - S, 0);
  const sign = leg.action === "buy" ? 1 : -1;
  return sign * (intrinsic - leg.premium);
}
const netPayoff = (legs, S) => legs.reduce((a, l) => a + legPayoff(l, S) * (l.lots || 1), 0);
// Net cash flow at entry, per share × lots: buying pays premium (debit), selling collects it (credit).
const netPremium = (legs) => legs.reduce((a, l) => a + (l.action === "buy" ? -1 : 1) * l.premium * (l.lots || 1), 0);

function StrategyBuilder({ data, spot }) {
  const strikes = data.strikes || [];
  const lot = data.lot_size || 1;
  const atmStrike = useMemo(() => {
    if (!strikes.length || spot == null) return strikes[0]?.strike ?? 0;
    return strikes.reduce((b, s) => Math.abs(s.strike - spot) < Math.abs(b - spot) ? s.strike : b, strikes[0].strike);
  }, [strikes, spot]);

  const premiumAt = (strike, type) => {
    const row = strikes.find(s => s.strike === strike);
    const v = type === "call" ? row?.ce?.ltp : row?.pe?.ltp;
    return v != null ? Number(v) : 0;
  };
  const near = (offset) => {
    // strike `offset` steps from ATM (offset in index units)
    const i = strikes.findIndex(s => s.strike === atmStrike);
    return strikes[Math.max(0, Math.min(strikes.length - 1, i + offset))]?.strike ?? atmStrike;
  };
  const mk = (action, type, strike) => ({ id: Math.random().toString(36).slice(2), action, type, strike, premium: premiumAt(strike, type), lots: 1 });

  const PRESETS = {
    "Long Call": () => [mk("buy", "call", atmStrike)],
    "Long Put": () => [mk("buy", "put", atmStrike)],
    "Bull Call Spread": () => [mk("buy", "call", atmStrike), mk("sell", "call", near(2))],
    "Bear Put Spread": () => [mk("buy", "put", atmStrike), mk("sell", "put", near(-2))],
    "Long Straddle": () => [mk("buy", "call", atmStrike), mk("buy", "put", atmStrike)],
    "Long Strangle": () => [mk("buy", "call", near(2)), mk("buy", "put", near(-2))],
    "Short Straddle": () => [mk("sell", "call", atmStrike), mk("sell", "put", atmStrike)],
    "Iron Condor": () => [mk("sell", "put", near(-2)), mk("buy", "put", near(-4)), mk("sell", "call", near(2)), mk("buy", "call", near(4))],
  };

  const [legs, setLegs] = useState(() => PRESETS["Bull Call Spread"]());
  const [preset, setPreset] = useState("Bull Call Spread");

  const applyPreset = (name) => { setPreset(name); setLegs(PRESETS[name]()); };
  const update = (id, patch) => setLegs(ls => ls.map(l => {
    if (l.id !== id) return l;
    const next = { ...l, ...patch };
    if (patch.strike != null || patch.type != null) next.premium = premiumAt(next.strike, next.type);
    return next;
  }));
  const addLeg = () => { setPreset("Custom"); setLegs(ls => [...ls, mk("buy", "call", atmStrike)]); };
  const removeLeg = (id) => { setPreset("Custom"); setLegs(ls => ls.filter(l => l.id !== id)); };

  // Payoff curve + metrics over a price grid ±35% of spot (min 0).
  const { curve, maxP, maxL, breakevens, unlimitedUp, unlimitedDown } = useMemo(() => {
    if (spot == null || !legs.length) return { curve: [], maxP: null, maxL: null, breakevens: [], unlimitedUp: false, unlimitedDown: false };
    const lo = Math.max(0, spot * 0.65), hi = spot * 1.35, n = 120;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const S = lo + (hi - lo) * (i / n);
      pts.push({ S, pnl: netPayoff(legs, S) * lot });
    }
    let mp = -Infinity, ml = Infinity;
    pts.forEach(p => { mp = Math.max(mp, p.pnl); ml = Math.min(ml, p.pnl); });
    // breakevens: sign changes of pnl between grid points
    const bes = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if ((a.pnl <= 0 && b.pnl > 0) || (a.pnl >= 0 && b.pnl < 0)) {
        const t = a.pnl / (a.pnl - b.pnl);
        bes.push(a.S + (b.S - a.S) * t);
      }
    }
    // unbounded detection: net long calls → unlimited up; net long puts / short → down
    const upSlope = legs.reduce((a, l) => a + (l.type === "call" ? (l.action === "buy" ? 1 : -1) * (l.lots || 1) : 0), 0);
    const downSlope = legs.reduce((a, l) => a + (l.type === "put" ? (l.action === "buy" ? 1 : -1) * (l.lots || 1) : 0), 0);
    return { curve: pts, maxP: mp, maxL: ml, breakevens: bes, unlimitedUp: upSlope > 0, unlimitedDown: downSlope > 0 };
  }, [legs, spot, lot]);

  const prem = netPremium(legs) * lot;
  const pnlAtSpot = spot != null ? netPayoff(legs, spot) * lot : null;

  const sel = { ...mono, fontSize: 12, background: C.panel2, color: C.text, border: `1px solid ${C.line2}`, borderRadius: 6, padding: "4px 6px" };
  const metric = (label, value, color) => (
    <div>
      <div style={{ ...sans, fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".08em", color: C.dim }}>{label}</div>
      <div style={{ ...mono, fontSize: 15, color: color || C.text, marginTop: 2 }}>{value}</div>
    </div>
  );

  return (
    <div className="fadein">
      {/* presets */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {Object.keys(PRESETS).map(name => (
          <button key={name} onClick={() => applyPreset(name)} style={{
            ...sans, fontSize: 11.5, padding: "5px 10px", borderRadius: 7, cursor: "pointer",
            border: `1px solid ${preset === name ? C.gold : C.line2}`,
            background: preset === name ? C.gold + "16" : "transparent",
            color: preset === name ? C.gold : C.dim,
          }}>{name}</button>
        ))}
      </div>

      {/* payoff chart */}
      <div style={{ height: 260, border: `1px solid ${C.line}`, borderRadius: 12, background: "rgba(16,14,10,0.4)", padding: "12px 8px 4px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curve} margin={{ top: 4, right: 14, left: 4, bottom: 0 }}>
            <XAxis dataKey="S" type="number" domain={["dataMin", "dataMax"]} tick={{ fill: C.dim, fontSize: 9.5 }}
                   tickLine={false} axisLine={{ stroke: C.line }} tickFormatter={v => Math.round(v)} />
            <YAxis tick={{ fill: C.dim, fontSize: 9.5 }} tickLine={false} axisLine={false} width={52}
                   tickFormatter={v => (v >= 0 ? "" : "−") + "₹" + Math.abs(Math.round(v)).toLocaleString("en-IN")} />
            <ReferenceLine y={0} stroke={C.line2} />
            {spot != null && <ReferenceLine x={spot} stroke={C.gold} strokeDasharray="3 3" label={{ value: "spot", fill: C.gold, fontSize: 9, position: "top" }} />}
            {breakevens.map((b, i) => <ReferenceDot key={i} x={b} y={0} r={3} fill={C.text200} stroke="none" />)}
            <Tooltip contentStyle={{ background: C.bg900, border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 11 }}
                     labelFormatter={v => "Underlying ₹" + Math.round(v)} formatter={v => [signed(v), "P&L at expiry"]} />
            <Line type="monotone" dataKey="pnl" stroke={C.gold} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px,1fr))", gap: 12, margin: "16px 0" }}>
        {metric("Net premium", (prem >= 0 ? "Credit " : "Debit ") + signed(Math.abs(prem)).replace("+", ""), prem >= 0 ? C.green : C.red)}
        {metric("Max profit", unlimitedUp ? "Unlimited" : signed(maxP), (maxP ?? 0) >= 0 ? C.green : C.red)}
        {metric("Max loss", unlimitedDown ? "Unlimited" : signed(maxL), C.red)}
        {metric("Breakeven", breakevens.length ? breakevens.map(b => "₹" + Math.round(b)).join(" / ") : "—")}
        {metric("P&L at spot", signed(pnlAtSpot), (pnlAtSpot ?? 0) >= 0 ? C.green : C.red)}
      </div>

      {/* legs */}
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
        {legs.map(l => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderTop: `1px solid ${C.line}`, flexWrap: "wrap" }}>
            <select value={l.action} onChange={e => update(l.id, { action: e.target.value })} style={{ ...sel, color: l.action === "buy" ? C.green : C.red }}>
              <option value="buy">Buy</option><option value="sell">Sell</option>
            </select>
            <select value={l.type} onChange={e => update(l.id, { type: e.target.value })} style={sel}>
              <option value="call">Call</option><option value="put">Put</option>
            </select>
            <select value={l.strike} onChange={e => update(l.id, { strike: Number(e.target.value) })} style={sel}>
              {strikes.map(s => <option key={s.strike} value={s.strike}>{num(s.strike)}</option>)}
            </select>
            <span style={{ ...sans, fontSize: 10.5, color: C.dim }}>@</span>
            <input type="number" value={l.premium} step="0.05" onChange={e => update(l.id, { premium: Number(e.target.value) })}
                   style={{ ...sel, width: 72 }} />
            <span style={{ ...sans, fontSize: 10.5, color: C.dim }}>×</span>
            <input type="number" value={l.lots} min="1" step="1" onChange={e => update(l.id, { lots: Math.max(1, Number(e.target.value)) })}
                   style={{ ...sel, width: 54 }} title="lots" />
            <button onClick={() => removeLeg(l.id)} style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: C.faint, padding: 4, lineHeight: 0 }}><X size={14} /></button>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${C.line}` }}>
          <button onClick={addLeg} style={{ ...sans, fontSize: 12, color: C.gold, background: "transparent", border: "none", cursor: "pointer", padding: "9px 12px", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={13} /> Add leg
          </button>
        </div>
      </div>
      <div style={{ ...sans, fontSize: 10, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
        Payoff at expiry, {lot > 1 ? `per lot (${lot} shares) × lots` : "per share × lots"}, priced off the live chain LTPs (editable).
        Ignores time value before expiry, commissions and taxes. A modelling aid, not advice.
      </div>
    </div>
  );
}

export default function OptionsTab({ co, API }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expiry, setExpiry] = useState(null);
  const [view, setView] = useState("chain");
  const atmRef = useRef(null);

  useEffect(() => {
    if (!API) { setLoading(false); return; }
    let live = true; setLoading(true);
    const url = `${API}/api/companies/${co.ticker}/options` + (expiry ? `?expiry=${encodeURIComponent(expiry)}` : "");
    fetch(url).then(r => r.json())
      .then(d => { if (live) { setData(d); setLoading(false); if (!expiry && d.expiry) setExpiry(d.expiry); } })
      .catch(() => { if (live) { setData(null); setLoading(false); } });
    return () => { live = false; };
  }, [co.ticker, API, expiry]);

  const strikes = data?.strikes || [];
  const spot = data?.last_price;
  const atmIdx = useMemo(() => {
    if (!strikes.length || spot == null) return -1;
    let best = 0, bd = Infinity;
    strikes.forEach((s, i) => { const d = Math.abs(s.strike - spot); if (d < bd) { bd = d; best = i; } });
    return best;
  }, [strikes, spot]);
  const maxOI = useMemo(() => Math.max(1, ...strikes.flatMap(s => [s.ce?.oi || 0, s.pe?.oi || 0])), [strikes]);

  useEffect(() => { if (view === "chain" && atmRef.current) atmRef.current.scrollIntoView({ block: "center" }); }, [atmIdx, expiry, view]);

  if (loading) return (
    <div style={{ padding: 40, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} className="spin" /> Loading option chain…
    </div>
  );
  if (!data || data.configured === false) return <Empty msg={data?.message || "Options require Dhan to be connected."} />;
  if (!data.available) return <Empty msg={data.message || "No option chain available for this name."} />;

  const th = { ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: C.dim, padding: "7px 8px", textAlign: "right", whiteSpace: "nowrap" };
  const td = { ...mono, fontSize: 11.5, padding: "5px 8px", textAlign: "right", whiteSpace: "nowrap" };
  const oiBar = (v, side) => (
    <div style={{ height: 3, background: C.bg600, borderRadius: 2, marginTop: 2 }}>
      <div style={{ height: "100%", marginLeft: side === "ce" ? "auto" : 0, width: `${Math.min(100, (v / maxOI) * 100)}%`, background: side === "ce" ? C.red : C.green, opacity: 0.6, borderRadius: 2 }} />
    </div>
  );
  const tab = (id, icon, label) => (
    <button onClick={() => setView(id)} style={{
      ...sans, fontSize: 12.5, fontWeight: 500, padding: "6px 12px", borderRadius: 8, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 6,
      border: `1px solid ${view === id ? C.gold : C.line2}`,
      background: view === id ? C.gold + "14" : "transparent", color: view === id ? C.gold : C.dim,
    }}>{icon}{label}</button>
  );

  return (
    <div className="fadein" style={{ padding: "6px 2px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ ...serif, fontSize: 20, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
          <Layers size={17} color={C.gold} /> Options
        </span>
        <span style={{ ...mono, fontSize: 13, color: C.text200 }}>Spot {inr(spot)}</span>
        <span style={{ ...sans, fontSize: 12, color: C.dim }}>PCR{" "}
          <b style={{ ...mono, color: (data.pcr || 0) > 1 ? C.green : C.red }}>{data.pcr != null ? data.pcr.toFixed(2) : "—"}</b>
        </span>
        <select value={expiry || ""} onChange={e => setExpiry(e.target.value)}
          style={{ ...mono, marginLeft: "auto", fontSize: 12, background: C.panel2, color: C.text, border: `1px solid ${C.line2}`, borderRadius: 7, padding: "5px 9px" }}>
          {(data.expiries || []).map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {tab("chain", <Layers size={13} />, "Chain")}
        {tab("builder", <LineIcon size={13} />, "Strategy Builder")}
      </div>

      {view === "builder" ? (
        <StrategyBuilder data={data} spot={spot} />
      ) : (
        <>
          <div style={{ overflow: "auto", maxHeight: 560, border: `1px solid ${C.line}`, borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead style={{ position: "sticky", top: 0, background: C.bg900, zIndex: 1 }}>
                <tr>
                  <th style={{ ...th, textAlign: "left", color: C.red }}>CALL OI</th>
                  <th style={th}>IV</th><th style={th}>LTP</th>
                  <th style={{ ...th, textAlign: "center", color: C.gold }}>STRIKE</th>
                  <th style={{ ...th, textAlign: "left" }}>LTP</th><th style={{ ...th, textAlign: "left" }}>IV</th>
                  <th style={{ ...th, textAlign: "left", color: C.green }}>PUT OI</th>
                </tr>
              </thead>
              <tbody>
                {strikes.map((s, i) => {
                  const atm = i === atmIdx;
                  return (
                    <tr key={s.strike} ref={atm ? atmRef : null}
                        style={{ borderTop: `1px solid ${C.line}`, background: atm ? C.bg800 : "transparent" }}>
                      <td style={{ ...td, textAlign: "left" }}>{num(s.ce?.oi)}{oiBar(s.ce?.oi || 0, "ce")}</td>
                      <td style={{ ...td, color: C.dim }}>{f2(s.ce?.iv)}</td>
                      <td style={{ ...td, color: C.text }}>{f2(s.ce?.ltp)}</td>
                      <td style={{ ...td, textAlign: "center", color: atm ? C.gold : C.text200, fontWeight: atm ? 700 : 400 }}>{num(s.strike)}</td>
                      <td style={{ ...td, textAlign: "left", color: C.text }}>{f2(s.pe?.ltp)}</td>
                      <td style={{ ...td, textAlign: "left", color: C.dim }}>{f2(s.pe?.iv)}</td>
                      <td style={{ ...td, textAlign: "left" }}>{num(s.pe?.oi)}{oiBar(s.pe?.oi || 0, "pe")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ ...sans, fontSize: 10, color: C.faint, marginTop: 8 }}>
            Live option chain via Dhan · IV/greeks from Dhan · {data.expiry}. Highlighted row = at-the-money. Data aid, not advice.
          </div>
        </>
      )}
    </div>
  );
}
