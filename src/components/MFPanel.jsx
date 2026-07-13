/* MFPanel.jsx — the mutual-fund desk: browse the fund universe by category,
   with latest NAV and 1-day change, from the licensed vendor feed. */
import { useEffect, useMemo, useState } from "react";
import { PiggyBank } from "lucide-react";
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
                <div key={(f.name || "") + i} style={{ display: "flex", alignItems: "baseline", gap: 12,
                  padding: "9px 16px", borderTop: `1px solid ${C.line}` }}>
                  <span style={{ ...sans, fontSize: 12.5, color: C.text200, flex: 1, minWidth: 0 }}>{f.name}</span>
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
    </div>
  );
}
