/* MFPanel.jsx — the mutual-fund desk: browse the fund universe by category,
   with latest NAV and 1-day change, from the licensed vendor feed. */
import { useEffect, useMemo, useState } from "react";
import { PiggyBank } from "lucide-react";
import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { C, mono, sans, serif } from "../lib/theme.js";
import { useIsMobile } from "../lib/useResponsive.js";
import { selStyle } from "../lib/listControls.jsx";

const API = import.meta.env.VITE_API_URL;

const nav = v => (v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 }));
const pct = v => (v == null || isNaN(v) ? "—" : (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%");
const tone = v => (v == null ? C.dim : v >= 0 ? C.green : C.red);

export default function MFPanel() {
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [cat, setCat] = useState(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);      // {name} of the open fund
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!sel || !API) return;
    let dead = false;
    setDetail(null);
    fetch(`${API}/api/mutual-funds/detail?name=${encodeURIComponent(sel.name)}`)
      .then(r => r.json()).then(d => { if (!dead) setDetail(d); })
      .catch(() => { if (!dead) setDetail({ available: false }); });
    return () => { dead = true; };
  }, [sel]);

  useEffect(() => {
    if (!API) return;
    let dead = false;
    fetch(`${API}/api/mutual-funds`).then(r => r.json())
      .then(d => { if (!dead) { setData(d); setCat((d.categories || [])[0]?.name || null); } })
      .catch(() => { if (!dead) setData({ available: false, categories: [] }); });
    return () => { dead = true; };
  }, []);

  const cats = data?.categories || [];
  const active = useMemo(() => cats.find(c => c.name === cat) || cats[0], [cats, cat]);
  const subs = useMemo(() => {
    const ss = active?.sub_categories || [];
    if (!q.trim()) return ss;
    const needle = q.toLowerCase();
    return ss.map(s => ({ ...s, funds: s.funds.filter(f => (f.name || "").toLowerCase().includes(needle)) }))
      .filter(s => s.funds.length);
  }, [active, q]);

  if (!data) return <div style={{ ...sans, padding: 48, color: C.dim, fontSize: 13 }}>Loading the fund desk…</div>;

  return (
    <div className="fadein" style={{ padding: isMobile ? "20px 14px 40px" : "24px 32px 48px", maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <PiggyBank size={20} color={C.gold} />
        <span style={{ ...serif, fontSize: 30, color: C.text }}>Mutual Funds</span>
        {data.as_of && <span style={{ ...mono, fontSize: 11, color: C.faint }}>as of {data.as_of}</span>}
      </div>
      <div style={{ ...sans, fontSize: 12, color: C.faint, marginBottom: 16, lineHeight: 1.6, maxWidth: 760 }}>
        The fund universe by category — latest NAV and 1-day move, from the verified feed. A browsing aid,
        not investment advice.
      </div>

      {!cats.length ? (
        <div style={{ ...sans, fontSize: 13, color: C.dim, border: `1px solid ${C.line}`,
                      borderRadius: 12, padding: 32, textAlign: "center" }}>
          The fund feed is unreachable right now — it retries automatically.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <select value={cat || ""} onChange={e => { setCat(e.target.value); setQ(""); }} style={selStyle}
              title="Fund category">
              {cats.map(c => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
            </select>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search funds…"
              style={{ ...sans, fontSize: 12, padding: "7px 11px", borderRadius: 8, minWidth: 200,
                       background: C.bg800, color: C.text, border: `1px solid ${C.line2}`, outline: "none" }} />
          </div>

          {subs.map(sub => (
            <div key={sub.name} style={{ border: `1px solid ${C.line}`, borderRadius: 12,
                                         background: C.panel, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "12px 16px" }}>
                <span style={{ ...serif, fontSize: 16, color: C.text }}>{sub.name}</span>
                <span style={{ ...mono, fontSize: 11, color: C.faint }}>{sub.funds.length}</span>
              </div>
              {sub.funds.slice(0, 40).map((f, i) => (
                <div key={(f.name || "") + i} onClick={() => setSel({ name: f.name })}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg800}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  style={{ display: "flex", alignItems: "baseline", gap: 12,
                  padding: "9px 16px", borderTop: `1px solid ${C.line}`, cursor: "pointer" }}>
                  <span style={{ ...sans, fontSize: 12.5, color: C.text200, flex: 1, minWidth: 0 }}>{f.name}</span>
                  {f.asset_size != null && <span style={{ ...mono, fontSize: 10.5, color: C.faint }} title="AUM (₹ cr)">₹{Number(f.asset_size).toLocaleString("en-IN", { maximumFractionDigits: 0 })}cr</span>}
                  {f.rating != null && <span style={{ ...mono, fontSize: 11, color: "#E8B054" }}>{"★".repeat(Math.round(f.rating))}</span>}
                  <span style={{ ...mono, fontSize: 12, color: C.text, minWidth: 90, textAlign: "right" }}>{nav(f.nav)}</span>
                  <span style={{ ...mono, fontSize: 12, color: tone(f.change), minWidth: 66, textAlign: "right" }}>{pct(f.change)}</span>
                </div>
              ))}
            </div>
          ))}
          {subs.length === 0 && (
            <div style={{ ...sans, fontSize: 12, color: C.dim, padding: 24 }}>No funds match “{q}”.</div>
          )}
        </>
      )}
      {sel && <MFDetailModal name={sel.name} detail={detail} onClose={() => setSel(null)} />}
    </div>
  );
}

function MFDetailModal({ name, detail, onClose }) {
  const d = detail;
  const navSeries = (d?.nav_history || []);
  const first = navSeries[0]?.nav, last = navSeries[navSeries.length - 1]?.nav;
  const ret1y = (first && last) ? (last / first - 1) * 100 : null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(4,8,16,0.6)", display: "flex", alignItems: "flex-start",
      justifyContent: "center", padding: "6vh 16px", overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 620,
        background: C.bg900, border: `1px solid ${C.line2}`, borderRadius: 14, padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ ...serif, fontSize: 18, color: C.text, flex: 1 }}>{d?.name || name}</span>
          <button onClick={onClose} style={{ ...sans, fontSize: 12, color: C.dim, background: "transparent",
            border: `1px solid ${C.line2}`, borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>Close</button>
        </div>
        {!d ? <div style={{ ...sans, color: C.dim, fontSize: 13, padding: "20px 0" }}>Loading fund…</div>
          : d.available === false ? <div style={{ ...sans, color: C.dim, fontSize: 13, padding: "20px 0" }}>No detail available for this scheme.</div>
          : (
          <>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "10px 0 16px", ...sans, fontSize: 11.5, color: C.faint }}>
              {d.scheme_type && <span>{d.scheme_type}</span>}
              {d.isin && <span>ISIN <span style={{ ...mono, color: C.text200 }}>{d.isin}</span></span>}
              {ret1y != null && <span>1Y NAV <span style={{ ...mono, color: ret1y >= 0 ? C.green : C.red }}>{ret1y >= 0 ? "+" : ""}{ret1y.toFixed(1)}%</span></span>}
            </div>
            {navSeries.length > 1 && (
              <div style={{ height: 120, marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={navSeries.map((p, i) => ({ i, nav: p.nav, date: p.date }))} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                    <defs><linearGradient id="mfg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.gold} stopOpacity={0.25} /><stop offset="100%" stopColor={C.gold} stopOpacity={0} />
                    </linearGradient></defs>
                    <YAxis domain={["auto", "auto"]} tick={{ fill: C.dim, fontSize: 9 }} width={44} tickLine={false} axisLine={false} tickFormatter={v => "₹" + Math.round(v)} />
                    <Tooltip contentStyle={{ background: C.bg900, border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 11 }} formatter={v => ["₹" + Number(v).toFixed(2), "NAV"]} labelFormatter={() => ""} />
                    <Area type="monotone" dataKey="nav" stroke={C.gold} strokeWidth={1.6} fill="url(#mfg)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ ...sans, fontSize: 10, color: C.faint, textAlign: "center" }}>NAV · trailing year</div>
              </div>
            )}
            {(d.holdings || []).length > 0 && (
              <>
                <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim, marginBottom: 8 }}>
                  Top holdings ({d.holdings.length})
                </div>
                {d.holdings.slice(0, 15).map((h, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: `1px solid ${C.line}` }}>
                    <span style={{ ...sans, fontSize: 12.5, color: C.text200, flex: 1 }}>{h.name}</span>
                    <div style={{ width: 90, height: 5, background: C.line, borderRadius: 3 }}>
                      <div style={{ height: 5, width: `${Math.min(100, (h.allocation || 0))}%`, background: C.gold, borderRadius: 3 }} />
                    </div>
                    <span style={{ ...mono, fontSize: 12, color: C.text, minWidth: 48, textAlign: "right" }}>{h.allocation != null ? h.allocation.toFixed(1) + "%" : "—"}</span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
