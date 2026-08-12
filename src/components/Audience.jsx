/* Audience — who is actually using the platform.
 *
 * Reads GET /api/admin/audience, which is built only from tables we own
 * (usage_events, auth_events, users). No third-party analytics: the DPDP
 * position rules out a processor outside India, and the beacon that feeds this
 * is already self-owned and data-minimal (event slug + query-stripped path, no
 * IP, no user-agent).
 *
 * The counting rules are stated ON the screen rather than buried, because each
 * one is a place this kind of dashboard usually misleads its owner:
 *   - "Online now" is a 5-minute activity window, not a session count.
 *   - A person active five times counts once.
 *   - Anonymous hits are shown apart from people, never folded in.
 */
import { C, mono, sans, serif } from "../lib/theme.js";
import useResource from "../lib/useResource.js";
import ErrorState from "./ui/ErrorState.jsx";

const nf = n => (n == null ? "—" : Number(n).toLocaleString("en-IN"));

function Stat({ label, value, sub, tone, big }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel,
                  padding: big ? "18px 20px" : "14px 16px", minWidth: 0 }}>
      <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em",
                    color: C.dim, marginBottom: 6 }}>{label}</div>
      <div style={{ ...mono, fontSize: big ? 32 : 22, lineHeight: 1.1, color: tone || C.text }}>{value}</div>
      {sub && <div style={{ ...sans, fontSize: 11, color: C.faint, marginTop: 5, lineHeight: 1.45 }}>{sub}</div>}
    </div>
  );
}

/* A dependency-free sparkline. The chart libraries are already the two biggest
   chunks in the bundle and this is one series — it does not earn an import. */
function Spark({ series, height = 72 }) {
  const pts = (series || []).map(d => d.people || 0);
  if (pts.length < 2) return null;
  const max = Math.max(...pts, 1);
  const w = 100, step = w / (pts.length - 1);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${(100 - (v / max) * 100).toFixed(2)}`).join(" ");
  const area = `${d} L${w},100 L0,100 Z`;
  const peak = series[pts.indexOf(max)];
  return (
    <div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img"
           aria-label={`Daily active people over ${series.length} days. Peak ${max} on ${peak?.date}.`}
           style={{ width: "100%", height, display: "block" }}>
        <path d={area} fill={C.gold + "1e"} />
        <path d={d} fill="none" stroke={C.gold} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", ...mono, fontSize: 10, color: C.faint, marginTop: 4 }}>
        <span>{series[0]?.date}</span>
        <span>peak {max}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export default function Audience({ API }) {
  const { data, error, loading, retry } = useResource(API ? `${API}/api/admin/audience?days=30` : null);

  if (loading) return <div style={{ ...sans, padding: 32, color: C.dim, fontSize: 13 }}>Loading audience…</div>;
  if (error) return <div style={{ padding: 24 }}><ErrorState error={error} onRetry={retry} what="the audience data" /></div>;

  const p = data?.people || {}, e = data?.events || {}, a = data?.accounts || {}, l = data?.logins || {};
  const series = data?.series || [];
  const noData = !series.length && !p.active_30d && !a.total;

  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <h2 style={{ ...serif, fontSize: 20, fontWeight: 400, color: C.text, margin: 0 }}>Audience</h2>
        <span style={{ ...mono, fontSize: 10, color: C.faint }}>last {data?.window_days || 30} days</span>
      </div>
      <p style={{ ...sans, fontSize: 11.5, color: C.faint, lineHeight: 1.55, margin: "0 0 16px", maxWidth: 720 }}>
        From our own beacon — no third-party analytics. <strong style={{ color: C.dim }}>Online now</strong> means
        activity in the last 5 minutes, not a session count. A person active five times counts once.
      </p>

      {noData && (
        <div style={{ ...sans, fontSize: 12.5, color: C.dim, border: `1px solid ${C.line}`, borderRadius: 10,
                      padding: "12px 14px", marginBottom: 16, lineHeight: 1.55 }}>
          No activity recorded yet. The beacon writes one row per view, so this fills as soon as
          anyone (including you) navigates the app after this endpoint is deployed.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Stat big label="Online now" value={nf(p.online_now)} tone={p.online_now > 0 ? C.green : C.text}
              sub="active in the last 5 min" />
        <Stat big label="Active today" value={nf(p.active_24h)} sub="distinct people, 24h" />
        <Stat big label="Active this week" value={nf(p.active_7d)} sub="distinct people, 7d" />
        <Stat big label="Active this month" value={nf(p.active_30d)} sub="distinct people, 30d" />
      </div>

      {series.length > 1 && (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel,
                      padding: "16px 18px", marginTop: 12 }}>
          <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em",
                        color: C.dim, marginBottom: 10 }}>Daily active people</div>
          <Spark series={series} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
        <Stat label="Accounts" value={nf(a.total)} sub={`${nf(a.signups_7d)} new this week · ${nf(a.signups_30d)} this month`} />
        <Stat label="Logins (24h)" value={nf(l.last_24h)} sub={`${nf(l.last_7d)} in 7d`} />
        <Stat label="Failed logins (24h)" value={nf(l.failed_24h)}
              tone={l.failed_24h > 10 ? C.red : C.text}
              sub={l.failed_24h > 10 ? "unusually high — worth a look" : "a security signal, not usage"} />
        <Stat label="Page views (24h)" value={nf(e.last_24h)} sub={`${nf(e.last_7d)} in 7d`} />
        <Stat label="Signed-out views (30d)" value={nf(e.anonymous_30d)}
              sub="traffic, not people — kept separate on purpose" />
      </div>

      {(data?.top_events || []).length > 0 && (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel,
                      padding: "16px 18px", marginTop: 12 }}>
          <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: ".12em",
                        color: C.dim, marginBottom: 10 }}>Where they go</div>
          {data.top_events.map((t, i) => {
            const top = data.top_events[0].count || 1;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                <span style={{ ...mono, fontSize: 11.5, color: C.text200, minWidth: 150 }}>{t.event}</span>
                <span aria-hidden="true" style={{ height: 5, borderRadius: 3, background: C.gold + "66",
                              width: `${Math.max(2, (t.count / top) * 100)}%`, maxWidth: "60%" }} />
                <span style={{ ...mono, fontSize: 11, color: C.faint }}>{nf(t.count)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
