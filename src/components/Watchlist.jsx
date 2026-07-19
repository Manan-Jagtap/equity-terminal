/* Watchlist.jsx — saved names + live valuation alerts.
   Reads /api/watchlist (verdict / MoS / price / 1-day move + triggered alerts),
   lets you tune per-name alert thresholds, and opens a name on click. */
import { useEffect, useState, useCallback } from "react";
import { Star, Bell, Trash2, Settings2, Loader2, Check, Lock } from "lucide-react";
import { C, sans, serif, mono, gridBg } from "../lib/theme.js";
import { VerdictBadge } from "./primitives.jsx";
import Logo from "./Logo.jsx";
import { fetchWatchlist, saveWatch, removeWatch } from "../lib/watchlist.js";

const inr = v => v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const signed = v => v == null ? "—" : (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
const ALERT_C = { good: C.green, info: C.gold, warn: C.red };

function AlertChip({ a }) {
  const col = ALERT_C[a.level] || C.dim;
  return (
    <span style={{ ...sans, fontSize: 11, color: col, border: `1px solid ${col}55`,
      borderRadius: 4, padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 5 }}>
      <Bell size={11} /> {a.message}
    </span>
  );
}

/* Row is defined OUTSIDE SettingsPanel: when it was declared inside, a new
   component type was created on every render, so React unmounted/remounted the
   subtree on each keystroke and the number inputs lost focus after one char. */
const Row = ({ label, children }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "5px 0" }}>
    <span style={{ ...sans, fontSize: 12, color: C.dim }}>{label}</span>{children}
  </div>
);

function SettingsPanel({ item, onSave, onClose }) {
  const [tgt, setTgt]   = useState(item.target_price ?? "");
  const [mos, setMos]   = useState(item.mos_threshold != null ? (item.mos_threshold * 100) : 15);
  const [mv,  setMv]    = useState(item.move_threshold != null ? (item.move_threshold * 100) : 8);
  const [flags, setFlags] = useState({
    alert_verdict: item.alert_verdict, alert_mos: item.alert_mos,
    alert_target: item.alert_target, alert_move: item.alert_move,
  });
  const [busy, setBusy] = useState(false);

  const num = (v, set, suffix) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input type="number" value={v} onChange={e => set(e.target.value)} style={{
        width: 78, ...mono, fontSize: 12, color: C.text, background: C.bg, textAlign: "right",
        border: `1px solid ${C.line2}`, borderRadius: 6, padding: "5px 7px" }} />
      <span style={{ ...sans, fontSize: 11, color: C.faint }}>{suffix}</span>
    </span>
  );
  const Toggle = ({ k }) => (
    <button onClick={() => setFlags(f => ({ ...f, [k]: !f[k] }))} style={{
      width: 34, height: 20, borderRadius: 99, border: "none", cursor: "pointer", position: "relative",
      background: flags[k] ? C.green : C.bg600, transition: "background .15s" }}>
      <span style={{ position: "absolute", top: 2, left: flags[k] ? 16 : 2, width: 16, height: 16,
        borderRadius: "50%", background: C.bg, transition: "left .15s" }} />
    </button>
  );

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        target_price: tgt === "" ? null : Number(tgt),
        mos_threshold: Number(mos) / 100,
        move_threshold: Number(mv) / 100,
        ...flags,
      });
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 12, padding: 16, background: C.bg, border: `1px solid ${C.line2}`, borderRadius: 10 }}>
      <div style={{ ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: C.gold, marginBottom: 8 }}>Alert settings</div>
      <Row label="Entry target price"><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ ...sans, fontSize: 11, color: C.faint }}>₹</span>{num(tgt, setTgt, "")}</span></Row>
      <Row label="Margin-of-safety threshold">{num(mos, setMos, "%")}</Row>
      <Row label="Big-move threshold">{num(mv, setMv, "%")}</Row>
      <div style={{ height: 1, background: C.line, margin: "8px 0" }} />
      <Row label="Alert on verdict upgrade"><Toggle k="alert_verdict" /></Row>
      <Row label="Alert on margin of safety"><Toggle k="alert_mos" /></Row>
      <Row label="Alert on price target"><Toggle k="alert_target" /></Row>
      <Row label="Alert on big daily move"><Toggle k="alert_move" /></Row>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={save} disabled={busy} style={{ ...sans, fontSize: 12, fontWeight: 600, color: C.bg,
          background: C.gold, border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 6 }}>
          {busy ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />} Save
        </button>
        <button onClick={onClose} style={{ ...sans, fontSize: 12, color: C.dim, background: "transparent",
          border: `1px solid ${C.line2}`, borderRadius: 7, padding: "7px 14px", cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

/* Centered, brand-styled gate shown when the user is signed out. */
export function SignInGate({ requestAuth, what }) {
  return (
    <div className="fadein" style={{
      minHeight: "55vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center", padding: 32,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%", display: "flex",
        alignItems: "center", justifyContent: "center", marginBottom: 18,
        background: C.bg800, border: `1px solid ${C.gold}66`, boxShadow: `0 0 0 1px ${C.gold}1a`,
      }}>
        <Lock size={22} color={C.gold} strokeWidth={1.6} />
      </div>
      <div style={{ ...serif, fontSize: 26, color: C.text, marginBottom: 8 }}>Sign in to continue</div>
      <div style={{ ...sans, fontSize: 13, color: C.dim, maxWidth: 380, lineHeight: 1.6, marginBottom: 22 }}>
        Sign in to use your {what} — your data is private to your account.
      </div>
      <button onClick={requestAuth} style={{
        ...sans, fontSize: 13, fontWeight: 600, color: C.bg, background: C.gold,
        border: "none", borderRadius: 8, padding: "10px 26px", cursor: "pointer",
      }}>Sign in</button>
    </div>
  );
}

export default function Watchlist({ API, onOpen, onChanged, user, requestAuth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    if (!API || !user) { setData(null); setLoading(false); return; }
    setLoading(true);
    fetchWatchlist(API).then(d => { setData(d); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }, [API, user]);
  useEffect(() => { load(); }, [load]);

  const onSave = async (ticker, cfg) => {
    await saveWatch(API, ticker, cfg);
    load();
  };
  const onRemove = async (ticker) => {
    await removeWatch(API, ticker);
    load();
    onChanged && onChanged();
  };

  if (!user) return <SignInGate requestAuth={requestAuth} what="watchlist" />;

  if (loading) return (
    <div style={{ padding: 48, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading watchlist…
    </div>
  );

  const items = data?.items || [];
  return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 4 }}>
        <span style={{ ...serif, fontSize: 30, color: C.text }}>Watchlist</span>
        <span style={{ ...sans, fontSize: 13, color: C.dim }}>{items.length} name{items.length === 1 ? "" : "s"}</span>
        {data?.triggered > 0 && (
          <span style={{ ...sans, fontSize: 12, color: C.gold, border: `1px solid ${C.gold}55`, borderRadius: 99, padding: "2px 10px", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Bell size={12} /> {data.triggered} alert{data.triggered === 1 ? "" : "s"} live
          </span>
        )}
      </div>
      <div style={{ ...sans, fontSize: 12, color: C.faint, marginBottom: 20 }}>
        Saved names with live engine verdict, margin of safety, and your alert triggers. Star any company to add it here.
      </div>

      {items.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", border: `1px dashed ${C.line2}`, borderRadius: 12 }}>
          <Star size={26} color={C.faint} style={{ marginBottom: 10 }} />
          <div style={{ ...sans, fontSize: 14, color: C.dim }}>No names on your watchlist yet.</div>
          <div style={{ ...sans, fontSize: 12, color: C.faint, marginTop: 6 }}>Open a company or the screener and tap the ☆ to track it.</div>
        </div>
      ) : items.map(it => (
        <div key={it.ticker} style={{ position: "relative", overflow: "hidden", marginBottom: 14,
          border: `1px solid ${it.triggered ? C.gold + "66" : C.line}`, borderRadius: 12, background: C.bg800, padding: 18 }}>
          <div style={{ position: "absolute", inset: 0, ...gridBg, opacity: 0.25, pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div onClick={() => onOpen(it.ticker)} style={{ cursor: "pointer", flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Logo ticker={it.ticker} name={it.name} sector={it.sector} size={30} />
                  <span style={{ ...serif, fontSize: 20, color: C.text }}>{it.name}</span>
                  <VerdictBadge verdict={it.verdict} />
                </div>
                <div style={{ ...mono, fontSize: 10, color: C.faint, marginTop: 2 }}>{it.ticker} · {it.sector}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button title="Alert settings" onClick={() => setEditing(editing === it.ticker ? null : it.ticker)} style={iconBtn}>
                  <Settings2 size={15} />
                </button>
                <button title="Remove" onClick={() => onRemove(it.ticker)} style={iconBtn}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 26, marginTop: 14 }}>
              {[
                ["CMP", inr(it.price), C.text],
                ["1-day", signed(it.day_move), it.day_move == null ? C.dim : it.day_move >= 0 ? C.green : C.red],
                ["Fair value", inr(it.intrinsic), C.gold],
                ["Margin of safety", signed(it.mos), it.mos == null ? C.dim : it.mos >= 0 ? C.green : C.red],
                ["Analyst upside", signed(it.analyst_upside), it.analyst_upside == null ? C.dim : it.analyst_upside >= 0 ? C.green : C.red],
                ["Score", it.composite == null ? "—" : Math.round(it.composite) + "/100", C.text200],
              ].map(([l, v, col]) => (
                <div key={l}>
                  <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim }}>{l}</div>
                  <div style={{ ...mono, fontSize: 17, color: col, marginTop: 3 }}>{v}</div>
                </div>
              ))}
            </div>

            {it.alerts && it.alerts.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                {it.alerts.map((a, i) => <AlertChip key={i} a={a} />)}
              </div>
            )}

            {editing === it.ticker && (
              <SettingsPanel item={it} onClose={() => setEditing(null)} onSave={cfg => onSave(it.ticker, cfg)} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const iconBtn = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30,
  borderRadius: 7, border: `1px solid ${C.line2}`, background: "transparent", color: C.dim, cursor: "pointer",
};
