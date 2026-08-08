/* SegmentSOTP.jsx — Sum-of-the-Parts for diversified conglomerates that a
   single-sector DCF can't value (Reliance, Adani Ent, L&T, ITC …).

   Two layers:
   1. The ILLUSTRATIVE calculator (everyone): editable segment-EV starting
      points — a transparent by-hand SOTP, not ingested truth.
   2. The VERIFIED segment store (admins): enter the REPORTED Ind-AS 108
      segment results straight off the company's own filing — segment EBIT ×
      the sector EV/EBITDA multiple, listed stakes at market value. Saved rows
      OVERRIDE the backend's illustrative preset, so the headline verdict then
      values the conglomerate on real reported segments. No AI, no vendor —
      a 5-row read off a public filing, once per name. */

import { useEffect, useState } from "react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { fmt, inr } from "../lib/formatters.js";
import { authFetch } from "../lib/auth.js";
import { SECTOR_PARAMS } from "../lib/engine.js";

// Illustrative segment EV starting points (₹ Cr) + net debt + share count.
// These are editable defaults, not ingested truth — adjust to taste.
const PRESETS = {
  RELIANCE: {
    netDebt: 120788, shares: 1601.78,
    segments: [
      { name: "Jio — Digital Services", ev: 1100000 },
      { name: "Reliance Retail", ev: 900000 },
      { name: "O2C — Oil-to-Chemicals", ev: 450000 },
      { name: "Oil & Gas E&P + New Energy", ev: 150000 },
    ],
  },
  ADANIENT: {
    netDebt: 97672, shares: 130.2,
    segments: [
      { name: "Adani Airports", ev: 60000 },
      { name: "Adani New Industries (green H2 / ANIL)", ev: 120000 },
      { name: "Roads & Infrastructure", ev: 40000 },
      { name: "Data Centres (AdaniConneX)", ev: 35000 },
      { name: "Mining, IRM & Others", ev: 80000 },
    ],
  },
  "M&M": {
    netDebt: 0, shares: 122.37,
    segments: [
      { name: "Automotive (SUVs + LCVs)", ev: 220000 },
      { name: "Farm Equipment (tractors)", ev: 150000 },
      { name: "Mahindra Finance (stake)", ev: 35000 },
      { name: "Tech Mahindra (stake)", ev: 40000 },
      { name: "Growth Gems + Other (realty, hospitality, EV)", ev: 45000 },
    ],
  },
  BAJAJFINSV: {
    netDebt: 0, shares: 322.45,
    segments: [
      { name: "Bajaj Finance (lending, ~52% stake)", ev: 320000 },
      { name: "Bajaj Allianz Life Insurance", ev: 70000 },
      { name: "Bajaj Allianz General Insurance", ev: 80000 },
      { name: "Bajaj Finserv Direct + Other", ev: 20000 },
    ],
  },
  GRASIM: {
    netDebt: 25000, shares: 140.85,
    segments: [
      { name: "UltraTech Cement (stake)", ev: 280000 },
      { name: "Aditya Birla Capital (stake)", ev: 60000 },
      { name: "Viscose (VSF + filament)", ev: 45000 },
      { name: "Chemicals (caustic soda)", ev: 25000 },
      { name: "Paints (Birla Opus) + B2B + Other", ev: 50000 },
    ],
  },
  LT: {
    netDebt: 0, shares: 163.92,
    segments: [
      { name: "Infrastructure & Construction E&C", ev: 300000 },
      { name: "IT services (LTIMindtree + LTTS stakes)", ev: 220000 },
      { name: "Financial holdings (LTF)", ev: 35000 },
      { name: "Hi-Tech Mfg + Energy (hydrocarbon, green)", ev: 80000 },
      { name: "Realty, Hyderabad Metro & Other", ev: 40000 },
    ],
  },
};

const API = import.meta.env.VITE_API_URL;

// Backend SOTP conglomerates (app/alt_models.SOTP_PRESETS) — the names whose
// headline verdict rides an illustrative preset until verified segments exist.
const BACKEND_SOTP = ["RELIANCE", "ADANIENT", "BAJAJFINSV", "LT", "ITC", "GRASIM",
                      "VEDL", "BAJAJHLDNG", "GODREJIND", "ABCAPITAL"];

const SECTOR_KEYS = Object.keys(SECTOR_PARAMS);

const emptyRow = () => ({ name: "", kind: "operating", ebit: "", value: "", sector: "MANUFACTURING" });

export default function SegmentSOTP({ ticker, price, isMobile }) {
  const tk = (ticker || "").toUpperCase();
  const preset = PRESETS[tk];
  const relevant = !!preset || BACKEND_SOTP.includes(tk);
  // Hooks must run unconditionally — seed empty if not a known conglomerate.
  const [segs, setSegs] = useState(preset ? preset.segments : []);
  const [netDebt, setNetDebt] = useState(preset ? preset.netDebt : 0);

  // ── Verified segment store (admin) ────────────────────────────────────────
  // Feature-detected: the admin GET returns 200 only for ADMIN_EMAILS accounts
  // (403 for everyone else — quiet, session untouched). Fetched only on SOTP-
  // relevant names so ordinary pages make no extra calls.
  const [adminStore, setAdminStore] = useState(null);   // null = not admin / not loaded
  const [rows, setRows] = useState([emptyRow()]);
  const [meta, setMeta] = useState({ net_debt: "", shares: "", as_of: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [savedSotp, setSavedSotp] = useState(null);
  useEffect(() => {
    if (!API || !relevant) return;
    let dead = false;
    authFetch(`${API}/api/admin/segment-financials`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (dead || !d) return;
        setAdminStore(d);
        const rec = d.store?.[tk];
        if (rec) {
          setRows((rec.segments || []).map(s => ({
            name: s.name || "", kind: s.kind || "operating",
            ebit: s.ebit ?? "", value: s.value ?? "", sector: s.sector || "MANUFACTURING",
          })));
          setMeta({ net_debt: rec.net_debt ?? "", shares: rec.shares ?? "", as_of: rec.as_of ?? "" });
          setSavedSotp(rec.sotp || null);
        }
      })
      .catch(() => {});
    return () => { dead = true; };
  }, [tk, relevant]);

  const verified = adminStore?.store?.[tk] || null;

  const save = async () => {
    if (!API || busy) return;
    setBusy(true); setMsg(null);
    try {
      const segments = rows
        .filter(r => r.name.trim() && (r.ebit !== "" || r.value !== ""))
        .map(r => ({
          name: r.name.trim(), kind: r.kind,
          ebit: r.kind === "operating" && r.ebit !== "" ? Number(r.ebit) : null,
          value: r.kind === "stake" && r.value !== "" ? Number(r.value) : null,
          sector: r.sector,
        }));
      const body = {
        ticker: tk, segments,
        net_debt: meta.net_debt === "" ? null : Number(meta.net_debt),
        shares: meta.shares === "" ? null : Number(meta.shares),
        as_of: meta.as_of || null,
      };
      const r = await authFetch(`${API}/api/admin/segment-refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || `HTTP ${r.status}`);
      setSavedSotp(d.sotp || null);
      setMsg({ tone: C.green, text: d.cleared
        ? "Cleared — reverts to the illustrative preset."
        : `Saved — SOTP ₹${d.sotp ? Math.round(d.sotp.intrinsic).toLocaleString("en-IN") : "—"}/share now drives the verdict.` });
    } catch (e) { setMsg({ tone: C.red, text: `Save failed: ${e.message}` }); }
    setBusy(false);
  };

  const clear = async () => {
    if (!API || busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await authFetch(`${API}/api/admin/segment-financials/${tk}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || `HTTP ${r.status}`);
      setSavedSotp(null);
      setRows([emptyRow()]);
      setMsg({ tone: C.gold, text: "Verified segments removed — the name reverts to the illustrative preset." });
    } catch (e) { setMsg({ tone: C.red, text: `Clear failed: ${e.message}` }); }
    setBusy(false);
  };

  const setRow = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  if (!preset && !(adminStore && relevant)) return null;

  const shares = preset?.shares;
  const totalEV = segs.reduce((s, x) => s + (Number(x.ev) || 0), 0);
  const equity = totalEV - Number(netDebt || 0);
  const perShare = shares > 0 ? equity / shares : null;
  const mos = price && perShare ? perShare / price - 1 : null;

  const setEv = (i, v) => setSegs(segs.map((s, j) => (j === i ? { ...s, ev: v } : s)));

  const inputStyle = {
    ...mono, fontSize: 13, color: C.text, background: "rgba(10,9,7,0.6)",
    border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 8px",
    width: 130, textAlign: "right",
  };
  const cellStyle = { ...inputStyle, width: undefined, flex: 1, minWidth: 90, textAlign: "left" };

  return (
    <div style={{ border: `1px solid ${C.gold}3d`, borderRadius: 12, background: C.bg900, padding: 18, marginBottom: 24 }}>
      <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.18em", color: C.faint }}>
        Sum-of-the-Parts · {ticker}
        {verified && <span style={{ color: C.green, marginLeft: 10 }}>● verified segments{verified.as_of ? ` · ${verified.as_of}` : ""}</span>}
      </div>

      {preset && <>
      <div style={{ ...sans, fontSize: 11, color: C.faint, marginTop: 6, lineHeight: 1.6, maxWidth: 620 }}>
        A single DCF mis-values this conglomerate — its parts trade on different economics. Build a fair value by segment below.
        Values are illustrative starting points; edit each segment's enterprise value to your own estimate.
      </div>

      {/* Segment rows */}
      <div style={{ marginTop: 16 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid rgba(220,213,193,.07)` }}>
            <span style={{ ...sans, fontSize: 13, color: C.text200 }}>{s.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ ...sans, fontSize: 11, color: C.faint }}>₹</span>
              <input type="number" value={s.ev} onChange={e => setEv(i, e.target.value)} style={inputStyle} />
              <span style={{ ...sans, fontSize: 11, color: C.faint }}>Cr EV</span>
            </div>
          </div>
        ))}
        {/* Net debt */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid rgba(220,213,193,.07)` }}>
          <span style={{ ...sans, fontSize: 13, color: C.red }}>(−) Net debt</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ ...sans, fontSize: 11, color: C.faint }}>₹</span>
            <input type="number" value={netDebt} onChange={e => setNetDebt(e.target.value)} style={inputStyle} />
            <span style={{ ...sans, fontSize: 11, color: C.faint }}>Cr</span>
          </div>
        </div>
      </div>

      {/* Result */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginTop: 18 }}>
        {[
          ["Total EV", "₹" + fmt(Math.round(totalEV)) + " Cr", C.text],
          ["Equity value", "₹" + fmt(Math.round(equity)) + " Cr", C.text],
          ["Per share", perShare != null ? inr(perShare, 0) : "—", C.gold],
          ["vs CMP " + (price ? inr(price, 0) : "—"), mos != null ? (mos >= 0 ? "+" : "") + (mos * 100).toFixed(0) + "%" : "—", mos == null ? C.dim : mos >= 0 ? C.green : C.red],
        ].map(([l, v, col]) => (
          <div key={l} style={{ background: "rgba(10,9,7,0.45)", border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: C.faint }}>{l}</div>
            <div style={{ ...serif, fontSize: 22, color: col, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>
      </>}

      {/* ── Verified segment financials (admin) ───────────────────────────── */}
      {adminStore && (
        <div style={{ marginTop: preset ? 20 : 10, paddingTop: preset ? 16 : 0, borderTop: preset ? `1px solid ${C.line}` : "none" }}>
          <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: C.green }}>
            Reported segment financials (Ind-AS 108) — drives the headline verdict
          </div>
          <div style={{ ...sans, fontSize: 11, color: C.faint, marginTop: 5, lineHeight: 1.6, maxWidth: 640 }}>
            Enter the segment table straight off the latest filing: operating segments by <b>segment result (EBIT, ₹Cr)</b> —
            valued at the sector EV/EBITDA multiple — listed stakes by <b>market value (₹Cr)</b>. Saving overrides the
            illustrative preset; the backend then values {tk} on its real reported parts.
          </div>

          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 8 }}>
              <input placeholder="Segment name" value={r.name} onChange={e => setRow(i, "name", e.target.value)} style={{ ...cellStyle, flex: 2 }} />
              <select value={r.kind} onChange={e => setRow(i, "kind", e.target.value)} style={{ ...cellStyle, flex: "0 0 110px" }}>
                <option value="operating">operating</option>
                <option value="stake">listed stake</option>
              </select>
              {r.kind === "operating" ? (
                <>
                  <input type="number" placeholder="EBIT ₹Cr" value={r.ebit} onChange={e => setRow(i, "ebit", e.target.value)} style={{ ...cellStyle, flex: "0 0 110px", textAlign: "right" }} />
                  <select value={r.sector} onChange={e => setRow(i, "sector", e.target.value)} style={{ ...cellStyle, flex: "0 0 150px" }}>
                    {SECTOR_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </>
              ) : (
                <input type="number" placeholder="Stake value ₹Cr" value={r.value} onChange={e => setRow(i, "value", e.target.value)} style={{ ...cellStyle, flex: "0 0 267px", textAlign: "right" }} />
              )}
              <button onClick={() => setRows(rows.filter((_, j) => j !== i))}
                style={{ ...sans, fontSize: 14, color: C.red, background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}>×</button>
            </div>
          ))}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 10 }}>
            <button onClick={() => setRows([...rows, emptyRow()])}
              style={{ ...sans, fontSize: 11.5, color: C.gold, background: C.gold + "0d", border: `1px solid ${C.gold}55`, borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
              + segment
            </button>
            <input type="number" placeholder="Net debt ₹Cr" value={meta.net_debt} onChange={e => setMeta({ ...meta, net_debt: e.target.value })} style={{ ...cellStyle, flex: "0 0 120px", textAlign: "right" }} title="Parent net debt (negative = net cash)" />
            <input type="number" placeholder="Shares (Cr)" value={meta.shares} onChange={e => setMeta({ ...meta, shares: e.target.value })} style={{ ...cellStyle, flex: "0 0 110px", textAlign: "right" }} title="Shares outstanding in crore — defaults to the stored count" />
            <input placeholder="As of (e.g. FY26)" value={meta.as_of} onChange={e => setMeta({ ...meta, as_of: e.target.value })} style={{ ...cellStyle, flex: "0 0 130px" }} />
            <button onClick={save} disabled={busy}
              style={{ ...sans, fontSize: 11.5, fontWeight: 600, color: C.bg, background: C.green, border: "none", borderRadius: 6, padding: "7px 14px", cursor: busy ? "wait" : "pointer" }}>
              {busy ? "Saving…" : "Save verified segments"}
            </button>
            {verified && (
              <button onClick={clear} disabled={busy}
                style={{ ...sans, fontSize: 11.5, color: C.red, background: "none", border: `1px solid ${C.red}55`, borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
                Clear → preset
              </button>
            )}
          </div>

          {savedSotp && (
            <div style={{ ...sans, fontSize: 12, color: C.text200, marginTop: 12 }}>
              <span style={{ color: C.green }}>Verified SOTP: {inr(savedSotp.intrinsic, 0)}/share</span>
              <span style={{ color: C.faint }}> · {(savedSotp.components || []).map(c => `${c.label} ₹${fmt(Math.round(c.value))}Cr${c.basis ? ` (${c.basis})` : ""}`).join(" · ")}</span>
            </div>
          )}
          {msg && <div style={{ ...sans, fontSize: 11.5, color: msg.tone, marginTop: 8 }}>{msg.text}</div>}
          {!verified && adminStore.presets_only?.includes(tk) && (
            <div style={{ ...sans, fontSize: 10.5, color: C.faint, marginTop: 8 }}>
              {tk} currently values on an ILLUSTRATIVE preset — entering the reported table above upgrades it to verified segments.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
