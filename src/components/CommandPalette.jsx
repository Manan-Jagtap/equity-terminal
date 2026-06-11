/* CommandPalette — global fast search (Cmd/Ctrl+K or "/").
   Full-screen overlay with instant client-side fuzzy filtering over the
   companies array App.jsx already holds. ArrowUp/Down + Enter to open. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { inr, signedPct } from "../lib/formatters.js";
import { VerdictBadge } from "./primitives.jsx";

/* Rank: lower = better. Prefix matches first, then substrings, then a
   loose in-order (subsequence) match. Returns null when no match. */
function score(co, q) {
  const t = (co.ticker || "").toLowerCase();
  const n = (co.name || "").toLowerCase();
  if (!q) return 5;
  if (t.startsWith(q)) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(/\s+/).some(w => w.startsWith(q))) return 2;
  if (t.includes(q)) return 3;
  if (n.includes(q)) return 4;
  // subsequence over ticker+name (e.g. "hdfb" → HDFC Bank)
  const hay = t + " " + n;
  let i = 0;
  for (const ch of q) {
    i = hay.indexOf(ch, i);
    if (i === -1) return null;
    i += 1;
  }
  return 6;
}

const isTyping = el =>
  el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" ||
         el.tagName === "SELECT" || el.isContentEditable);

export default function CommandPalette({ open, setOpen, companies, onOpenCompany }) {
  const [q, setQ]       = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  /* Global shortcuts: Cmd/Ctrl+K toggles, "/" opens (when not typing). */
  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  /* Reset + focus on every open. */
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (companies || [])
      .map(co => ({ co, s: score(co, needle) }))
      .filter(r => r.s != null)
      .sort((a, b) => a.s - b.s || (a.co.name || "").localeCompare(b.co.name || ""))
      .slice(0, 12)
      .map(r => r.co);
  }, [companies, q]);

  useEffect(() => { setActive(0); }, [q]);

  /* Keep the active row visible while arrowing through the list. */
  useEffect(() => {
    const el = listRef.current?.children?.[active];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const pick = co => {
    const id = co.ticker || co.id;
    setOpen(false);
    if (id && onOpenCompany) onOpenCompany(id);
  };

  const onKeyDown = e => {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => results.length ? (a + 1) % results.length : 0); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setActive(a => results.length ? (a - 1 + results.length) % results.length : 0); }
    else if (e.key === "Enter")     { e.preventDefault(); if (results[active]) pick(results[active]); }
  };

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(10,9,7,0.82)", backdropFilter: "blur(6px)",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        paddingTop: "12vh",
      }}>
      <div className="fadein" style={{
        width: "min(640px, 92vw)", background: C.bg900,
        border: `1px solid ${C.line2}`, borderRadius: 12,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)", overflow: "hidden",
      }}>
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${C.line}` }}>
          <Search size={17} color={C.gold} strokeWidth={1.8} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search ticker or company…"
            style={{ ...sans, flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 16 }}
          />
          <span style={{ ...mono, fontSize: 10, color: C.faint, border: `1px solid ${C.line2}`, borderRadius: 5, padding: "2px 6px" }}>ESC</span>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 420, overflowY: "auto" }}>
          {results.map((co, i) => {
            const a = co.api || {};
            return (
              <div
                key={co.ticker || co.id}
                onMouseEnter={() => setActive(i)}
                onMouseDown={e => { e.preventDefault(); pick(co); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 18px", cursor: "pointer",
                  background: i === active ? C.bg800 : "transparent",
                  borderLeft: `2px solid ${i === active ? C.gold : "transparent"}`,
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...sans, fontSize: 13, fontWeight: 500, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{co.name}</div>
                  <div style={{ ...mono, fontSize: 10, color: C.faint }}>{co.ticker} · {co.sector}</div>
                </div>
                {co.price != null && (
                  <span style={{ ...mono, fontSize: 12, color: C.text200 }}>{inr(co.price)}</span>
                )}
                {a.mos != null && (
                  <span style={{ ...mono, fontSize: 11, color: a.mos >= 0 ? C.green : C.red, minWidth: 52, textAlign: "right" }}>{signedPct(a.mos)}</span>
                )}
                {a.verdict && <VerdictBadge verdict={a.verdict} />}
                {i === active && <CornerDownLeft size={13} color={C.dim} />}
              </div>
            );
          })}
          {results.length === 0 && (
            <div style={{ ...sans, padding: 36, textAlign: "center", color: C.faint, fontSize: 13 }}>
              No companies match “{q}”.
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div style={{ display: "flex", gap: 16, padding: "9px 18px", borderTop: `1px solid ${C.line}` }}>
          {[["↑↓", "navigate"], ["↵", "open"], ["esc", "close"]].map(([k, l]) => (
            <span key={l} style={{ ...sans, fontSize: 11, color: C.faint, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ ...mono, fontSize: 10, color: C.dim, border: `1px solid ${C.line2}`, borderRadius: 4, padding: "1px 5px" }}>{k}</span>{l}
            </span>
          ))}
          <span style={{ ...serif, fontSize: 12, color: C.vfaint, marginLeft: "auto" }}>Equity Terminal</span>
        </div>
      </div>
    </div>
  );
}
