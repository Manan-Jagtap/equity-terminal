/* Watchlist.jsx — saved names + live valuation alerts.
   Reads /api/watchlist (verdict / MoS / price / 1-day move + triggered alerts),
   lets you tune per-name alert thresholds, and opens a name on click. */
import { useEffect, useState, useCallback } from "react";
import { Star, Bell, Trash2, Settings2, Loader2, Check, Lock } from "lucide-react";
import { C, sans, serif, mono, gridBg } from "../lib/theme.js";
import { VerdictBadge } from "./primitives.jsx";
import Logo from "./Logo.jsx";
import { fetchWatchlist, saveWatch, removeWatch } from "../lib/watchlist.js";
import PageHeader from "./ui/PageHeader.jsx";
import ErrorState from "./ui/ErrorState.jsx";
/* Modules, not the ui/ barrel — App.jsx imports this screen EAGERLY, so a
   barrel import would drag Radix into the entry chunk (see ui/index.js). */
import Card from "./ui/Card.jsx";
import Button from "./ui/Button.jsx";
import StatTile from "./ui/StatTile.jsx";
import { buttonReset } from "../lib/a11y.js";

const inr = v => v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const signed = v => v == null ? "—" : (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
/* Signed quantity -> StatTile tone. "no value" is its own tone, not a colour
   that happens to be grey: an absent margin of safety must never read as a
   flat one. */
const sign = v => v == null ? "muted" : v >= 0 ? "up" : "down";
const ALERT_C = { good: C.green, info: C.gold, warn: C.red };

function AlertChip({ a }) {
  const col = ALERT_C[a.level] || C.dim;
  return (
    <span style={{ ...sans, fontSize: 11, color: col, border: `1px solid ${col}55`,
      borderRadius: 6, padding: "3px 8px", display: "inline-flex", alignItems: "center", gap: 5 }}>
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
    /* A well cut INTO the row, not another panel on top of it — hence
       surface="base" (--ev-bg, the canvas) with the stronger hairline. */
    <Card pad="sm" surface="base" tone="strong" style={{ marginTop: 12 }}>
      <div style={{ ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: C.gold, marginBottom: 8 }}>Alert settings</div>
      <Row label="Entry target price"><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ ...sans, fontSize: 11, color: C.faint }}>₹</span>{num(tgt, setTgt, "")}</span></Row>
      <Row label="Margin-of-safety threshold">{num(mos, setMos, "%")}</Row>
      <Row label="Big-move threshold">{num(mv, setMv, "%")}</Row>
      <div style={{ height: 1, background: C.line, margin: "8px 0" }} />
      <Row label="Alert on verdict upgrade"><Toggle k="alert_verdict" label="Alert on verdict upgrade" on={!!flags["alert_verdict"]}
        onToggle={() => setFlags(f => ({ ...f, alert_verdict: !f.alert_verdict }))} /></Row>
      <Row label="Alert on margin of safety"><Toggle k="alert_mos" label="Alert on margin of safety" on={!!flags["alert_mos"]}
        onToggle={() => setFlags(f => ({ ...f, alert_mos: !f.alert_mos }))} /></Row>
      <Row label="Alert on price target"><Toggle k="alert_target" label="Alert on price target" on={!!flags["alert_target"]}
        onToggle={() => setFlags(f => ({ ...f, alert_target: !f.alert_target }))} /></Row>
      <Row label="Alert on big daily move"><Toggle k="alert_move" label="Alert on big daily move" on={!!flags["alert_move"]}
        onToggle={() => setFlags(f => ({ ...f, alert_move: !f.alert_move }))} /></Row>
      {/* These two were 29px and 31px tall side by side — same padding, but only
          one had a border — so the pair never sat on a common baseline. One
          size step puts both at 28. */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Button variant="primary" size="sm" onClick={save} loading={busy}>
          <Check size={13} /> Save
        </Button>
        <Button size="sm" tone="muted" onClick={onClose}>Cancel</Button>
      </div>
    </Card>
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
      <Button variant="primary" size="lg" onClick={requestAuth}>Sign in</Button>
    </div>
  );
}

/* Hoisted OUT of the parent's render on purpose. Defined inline, this was a
   NEW component type on every parent render, so React unmounted and remounted
   it — destroying keyboard focus every time the user activated it. The user
   toggles an alert, focus jumps to the top of the page, and they have to tab
   back to reach the next one.

   It was also an unnamed button whose only state channel was the pill's colour
   and the knob's position: nothing announced on or off. aria-pressed is the
   native mechanism for a toggle. */
function Toggle({ label, on, onToggle }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={on} aria-label={label}
      style={{
        width: 34, height: 20, borderRadius: 99, border: "none", cursor: "pointer",
        position: "relative", flexShrink: 0,
        background: on ? C.green : C.bg600, transition: "background .15s" }}>
      <span aria-hidden="true" style={{ position: "absolute", top: 2, left: on ? 16 : 2,
        width: 16, height: 16, borderRadius: "50%", background: C.bg, transition: "left .15s" }} />
    </button>
  );
}

export default function Watchlist({ API, onOpen, onChanged, user, requestAuth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const [err, setErr] = useState(null);   // an outage is not an empty watchlist

  const load = useCallback(() => {
    if (!API || !user) { setData(null); setErr(null); setLoading(false); return; }
    setLoading(true);
    /* fetchWatchlist DOES throw on a non-2xx — the catch then discarded the
       error, which collapsed to items=[] and rendered the never-saved-anything
       empty state. A 503 told the user their watchlist was empty and invited
       them to go star some names, which would have been a second failed write.
       Keep the error. */
    fetchWatchlist(API).then(d => { setData(d); setErr(null); setLoading(false); })
      .catch(e => { setData(null); setErr(e); setLoading(false); });
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
      <Loader2 size={16} className="spin" /> Loading watchlist…
    </div>
  );

  const items = data?.items || [];
  return (
    <div className="fadein" style={{ padding: "24px 32px" }}>
      <PageHeader
        title="Watchlist"
        meta={`${items.length} name${items.length === 1 ? "" : "s"}`}
        actions={data?.triggered > 0 && (
          <span style={{ ...sans, fontSize: 12, color: C.gold, border: `1px solid ${C.gold}55`, borderRadius: 99, padding: "2px 10px", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Bell size={12} /> {data.triggered} alert{data.triggered === 1 ? "" : "s"} live
          </span>
        )}
      >
        Saved names with live engine verdict, margin of safety, and your alert triggers. Star any company to add it here.
      </PageHeader>

      {/* An outage is not an empty watchlist. Checked BEFORE the empty
          branch, which otherwise told a user with saved names that they had
          none and invited them to go star some — a second write that would
          have failed the same way. */}
      {err ? (
        <ErrorState error={err} onRetry={load} what="your watchlist" />
      ) : items.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", border: `1px dashed ${C.line2}`, borderRadius: 12 }}>
          <Star size={26} color={C.faint} style={{ marginBottom: 10 }} />
          <div style={{ ...sans, fontSize: 14, color: C.dim }}>No names on your watchlist yet.</div>
          <div style={{ ...sans, fontSize: 12, color: C.faint, marginTop: 6 }}>Open a company or the screener and tap the ☆ to track it.</div>
        </div>
      ) : items.map(it => (
        <Card key={it.ticker} pad="sm" surface="over"
          tone={it.triggered ? "active" : "default"}
          style={{ position: "relative", overflow: "hidden", marginBottom: 14 }}>
          <div style={{ position: "absolute", inset: 0, ...gridBg, opacity: 0.25, pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <button type="button" onClick={() => onOpen(it.ticker)} style={{ ...buttonReset, width: "100%", boxSizing: "border-box",   cursor: "pointer", flex: 1  }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Logo ticker={it.ticker} name={it.name} sector={it.sector} size={30} />
                  <span style={{ ...serif, fontSize: 20, color: C.text }}>{it.name}</span>
                  <VerdictBadge verdict={it.verdict} />
                </div>
                <div style={{ ...mono, fontSize: 10, color: C.faint, marginTop: 2 }}>{it.ticker} · {it.sector}</div>
              </button>
              <div style={{ display: "flex", gap: 6 }}>
                <Button size="sm" iconOnly tone="muted" title="Alert settings"
                  pressed={editing === it.ticker}
                  onClick={() => setEditing(editing === it.ticker ? null : it.ticker)}>
                  <Settings2 size={15} />
                </Button>
                <Button size="sm" iconOnly tone="muted" title="Remove" onClick={() => onRemove(it.ticker)}>
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>

            {/* Six StatTiles. The tone names replace six hand-written colour
                ternaries — the tile decides what "up" looks like, not the
                screen, which is why this row can no longer drift away from the
                identical row on Sectors. */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 26, marginTop: 14 }}>
              {[
                ["CMP", inr(it.price), undefined],
                ["1-day", signed(it.day_move), sign(it.day_move)],
                /* The backend now nulls these and sets value_suppressed when
                   the engine withheld its estimate. "n/m" says withheld;
                   inr(null) would render a dash that reads as "we have no
                   data" — a different, wrong claim. */
                ["Fair value", it.value_suppressed ? "n/m" : inr(it.intrinsic),
                  it.value_suppressed ? "secondary" : "accent"],
                ["Margin of safety", it.value_suppressed ? "n/m" : signed(it.mos),
                  it.value_suppressed ? "secondary" : sign(it.mos)],
                ["Analyst upside", signed(it.analyst_upside), sign(it.analyst_upside)],
                ["Score", it.composite == null ? "—" : Math.round(it.composite) + "/100", "secondary"],
              ].map(([l, v, tone]) => (
                <StatTile key={l} size="sm" label={l} value={v} tone={tone} />
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
        </Card>
      ))}
    </div>
  );
}
