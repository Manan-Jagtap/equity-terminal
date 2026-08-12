/* AdminPanel.jsx — owner ops view at /admin (deliberately NOT in the nav).
   Feature-detected like SegmentSOTP's verified store: the admin GETs return
   200 only for ADMIN_EMAILS accounts (403 for everyone else), so non-admins
   see an honest "admin only" note and nothing leaks.

   Three read-only panes off the INST/ARCH-04 backend:
     · /api/admin/usage      — DAU per day + top events (180-day retention)
     · /api/admin/feedback   — newest user feedback
     · /api/admin/kv-health  — every KV blob with owner + staleness */

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { authFetch } from "../lib/auth.js";
import Audience from "./Audience.jsx";

const card = {
  background: C.bg900, border: `1px solid ${C.line2}`, borderRadius: 12,
  padding: "18px 20px", marginBottom: 16,
};
const h2 = { ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: C.gold, marginBottom: 12 };
const td = { ...mono, fontSize: 12, color: C.text200, padding: "5px 10px 5px 0", whiteSpace: "nowrap" };

export default function AdminPanel({ API }) {
  const [usage, setUsage] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [kv, setKv] = useState(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  // All setState happens inside promise callbacks (never synchronously in the
  // effect body) — keeps the lint ratchet clean.
  const fetchAll = () =>
    Promise.all([
      authFetch(`${API}/api/admin/usage`).then(r => (r.ok ? r.json() : Promise.reject(r.status))),
      authFetch(`${API}/api/admin/feedback?limit=50`).then(r => (r.ok ? r.json() : null)),
      authFetch(`${API}/api/admin/kv-health`).then(r => (r.ok ? r.json() : null)),
    ])
      .then(([u, f, k]) => { setUsage(u); setFeedback(f); setKv(k); setDenied(false); })
      .catch(() => setDenied(true))
      .finally(() => setLoading(false));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll(); }, [API]);   // fetchAll is stable per-render by construction

  const load = () => { setLoading(true); fetchAll(); };   // click handler

  if (denied) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ ...sans, fontSize: 14, color: C.dim }}>
          This page is for the platform administrator only.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "26px 28px", maxWidth: 980 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 }}>
        <h1 style={{ ...serif, fontSize: 24, fontWeight: 400, color: C.text, margin: 0 }}>Ops</h1>
        <span style={{ ...sans, fontSize: 11.5, color: C.faint }}>
          usage · feedback · data-blob health — self-owned, {usage?.retention_days ?? 180}-day retention
        </span>
        <button onClick={load} disabled={loading} aria-label="Refresh" style={{
          marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
          ...sans, fontSize: 12, color: C.dim, background: "transparent",
          border: `1px solid ${C.line2}`, borderRadius: 8, padding: "6px 12px",
          cursor: loading ? "default" : "pointer",
        }}>
          <RefreshCw size={12} className={loading ? "spin" : undefined} />Refresh
        </button>
      </div>

      {/* ── Usage ── */}
      <div style={card}>
        <div style={h2}>Usage — last {usage?.window_days ?? 30} days ({usage?.events_total ?? "…"} events)</div>
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
          <div>
            <div style={{ ...sans, fontSize: 11, color: C.faint, marginBottom: 6 }}>Daily active (signed-in) users</div>
            <table><tbody>
              {(usage?.daily_active_users ?? []).slice(-14).map(d => (
                <tr key={d.date}><td style={td}>{d.date}</td><td style={{ ...td, color: C.text }}>{d.users}</td></tr>
              ))}
              {usage && !usage.daily_active_users?.length && (
                <tr><td style={{ ...td, color: C.faint }}>no signed-in usage recorded yet</td></tr>
              )}
            </tbody></table>
          </div>
          <div>
            <div style={{ ...sans, fontSize: 11, color: C.faint, marginBottom: 6 }}>Top events</div>
            <table><tbody>
              {(usage?.top_events ?? []).map(e => (
                <tr key={e.event}><td style={td}>{e.event}</td><td style={{ ...td, color: C.text }}>{e.n}</td></tr>
              ))}
              {usage && !usage.top_events?.length && (
                <tr><td style={{ ...td, color: C.faint }}>no events in window</td></tr>
              )}
            </tbody></table>
          </div>
        </div>
      </div>

      {/* ── Feedback ── */}
      <div style={card}>
        <div style={h2}>User feedback (newest first)</div>
        {(feedback?.feedback ?? []).map(f => (
          <div key={f.id} style={{ borderBottom: `1px solid ${C.line}`, padding: "9px 0" }}>
            <div style={{ ...mono, fontSize: 10.5, color: C.faint }}>
              #{f.id} · user {f.user_id ?? "—"} · {f.page || "—"} · {f.created_at}
            </div>
            <div style={{ ...sans, fontSize: 13, color: C.text200, marginTop: 4, whiteSpace: "pre-wrap" }}>{f.message}</div>
          </div>
        ))}
        {feedback && !feedback.feedback?.length && (
          <div style={{ ...sans, fontSize: 12.5, color: C.faint }}>No feedback yet.</div>
        )}
      </div>

      {/* ── KV health ── */}
      <div style={card}>
        <div style={h2}>Data-blob health (ARCH-04 envelope)</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["key", "owner", "v", "age (h)"].map(hd => (
                  <th key={hd} style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.faint, textAlign: "left", padding: "0 14px 6px 0" }}>{hd}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(kv?.keys ?? []).map(k => (
                <tr key={k.key}>
                  <td style={td}>{k.key}</td>
                  <td style={{ ...td, color: k.owner ? C.dim : C.red }}>{k.owner || "UNREGISTERED"}</td>
                  <td style={td}>{k.schema_version ?? "—"}</td>
                  <td style={{ ...td, color: k.age_hours != null && k.age_hours > 48 ? C.red : C.text }}>
                    {k.age_hours ?? "pre-envelope"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Audience API={API} />
    </div>
  );
}
