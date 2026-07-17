/* ScenarioBar.jsx — save / load DCF scenarios (persist your slider what-ifs).
   Sits atop the DCF tab. Auth-scoped via authFetch; shows a gentle prompt when
   signed out. Saving captures the current assumptions dict; loading writes it
   back into the shared assumptions state so the whole model recomputes. */
import { useCallback, useEffect, useState } from "react";
import { Save, Trash2, Loader2, Bookmark, Link2, Check } from "lucide-react";
import { C, sans, mono } from "../lib/theme.js";
import { authFetch, getUser } from "../lib/auth.js";

export default function ScenarioBar({ API, ticker, assumptions, setAssumptions }) {
  const [list, setList]   = useState([]);
  const [name, setName]   = useState("");
  const [busy, setBusy]   = useState(false);
  // getUser() returns a fresh object each render; key the effect on the stable
  // identity string, not the object, or reload() refetches /api/scenarios on
  // every commit (a continuous loop on the DCF tab for every signed-in user).
  const user = getUser();
  const userKey = user?.email || user?.id || null;

  const reload = useCallback(() => {
    if (!API || !userKey || !ticker) { setList([]); return; }
    authFetch(`${API}/api/scenarios?ticker=${encodeURIComponent(ticker)}`)
      .then(r => (r.ok ? r.json() : { items: [] }))
      .then(d => setList(d.items || []))
      .catch(() => setList([]));
  }, [API, userKey, ticker]);
  useEffect(() => { reload(); }, [reload]);

  const save = async () => {
    if (!name.trim() || !assumptions) return;
    setBusy(true);
    try {
      await authFetch(`${API}/api/scenarios`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, name: name.trim(), data: assumptions }),
      });
      setName(""); reload();
    } catch { /* keep the name so the user can retry */ }
    setBusy(false);
  };
  const load = s => setAssumptions({ ...s.data });
  const del = async id => { try { await authFetch(`${API}/api/scenarios/${id}`, { method: "DELETE" }); } catch { /* noop */ } reload(); };

  // Mint a share token and put a deep link on the clipboard. Anyone with the
  // link sees the scenario read-only (?scenario= is handled at App boot).
  const [copiedId, setCopiedId] = useState(null);
  const share = async s => {
    try {
      const r = await authFetch(`${API}/api/scenarios/${s.id}/share`, { method: "POST" });
      if (!r.ok) return;
      const { token } = await r.json();
      const url = `${window.location.origin}${window.location.pathname}?scenario=${encodeURIComponent(token)}`;
      await navigator.clipboard.writeText(url);
      setCopiedId(s.id);
      setTimeout(() => setCopiedId(c => (c === s.id ? null : c)), 1600);
    } catch { /* clipboard denied or offline — nothing to clean up */ }
  };

  const wrap = {
    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
    border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel,
    padding: "10px 14px", marginBottom: 14,
  };
  const label = { ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim, display: "flex", alignItems: "center", gap: 6 };

  if (!user) return (
    <div style={wrap}>
      <span style={label}><Bookmark size={12} color={C.gold} /> Scenarios</span>
      <span style={{ ...sans, fontSize: 12, color: C.faint }}>Sign in to save and reload DCF scenarios.</span>
    </div>
  );

  return (
    <div style={wrap}>
      <span style={label}><Bookmark size={12} color={C.gold} /> Scenarios</span>
      <input
        value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") save(); }}
        placeholder="Name this scenario…"
        style={{ ...mono, fontSize: 12, background: C.panel2, border: `1px solid ${C.line2}`, borderRadius: 7, color: C.text, padding: "6px 10px", width: 170, outline: "none" }}
      />
      <button onClick={save} disabled={busy || !name.trim()} style={{
        ...sans, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500,
        padding: "6px 12px", borderRadius: 7, cursor: (busy || !name.trim()) ? "default" : "pointer",
        border: `1px solid ${C.gold}66`, color: C.gold, background: C.gold + "0d",
        opacity: (busy || !name.trim()) ? 0.5 : 1,
      }}>
        {busy ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={12} />} Save
      </button>
      {list.length > 0 && <span style={{ width: 1, height: 18, background: C.line2 }} />}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {list.map(s => (
          <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 5,
            border: `1px solid ${C.line2}`, borderRadius: 99, padding: "3px 6px 3px 11px", background: C.panel2 }}>
            <button onClick={() => load(s)} title="Load scenario" style={{ ...sans, fontSize: 12, color: C.text200, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>{s.name}</button>
            <button onClick={() => share(s)} title={copiedId === s.id ? "Link copied!" : "Copy share link"} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, lineHeight: 0 }}>
              {copiedId === s.id ? <Check size={11} color={C.green} /> : <Link2 size={11} color={C.faint} />}
            </button>
            <button onClick={() => del(s.id)} title="Delete" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, lineHeight: 0 }}>
              <Trash2 size={11} color={C.faint} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
