/* CommandPalette — global fast search (Cmd/Ctrl+K or "/").
   Full-screen overlay with instant client-side fuzzy filtering over the
   companies array App.jsx already holds. ArrowUp/Down + Enter to open. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft, ArrowRight, Calculator } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { zIndex } from "../design/tokens.js";
import { inr, signedPct } from "../lib/formatters.js";
import { VerdictBadge } from "./primitives.jsx";
import useModalA11y from "../lib/useModalA11y.js";
import "./ui/ui.css";

/* Command language: type a destination ("SECTORS", "IDEAS", "TRACK") to jump
   straight there — the Bloomberg-style keyboard-first navigation. */
const COMMANDS = [
  { view: "ideas",      label: "Ideas · Alpha Score", kw: ["ideas", "alpha", "rank", "factor"] },
  { view: "sectors",    label: "Sectors",             kw: ["sectors", "sector"] },
  { view: "screener",   label: "Screener",            kw: ["screener", "screen"] },
  { view: "track",      label: "Track Record",        kw: ["track", "record", "backtest"] },
  { view: "portfolio",  label: "Portfolio",           kw: ["portfolio", "holdings"] },
  { view: "watchlist",  label: "Watchlist",           kw: ["watchlist", "watch"] },
  { view: "dashboard",  label: "Dashboard",           kw: ["dashboard", "home", "market"] },
  { view: "compare",    label: "Compare",             kw: ["compare"] },
  { view: "results",    label: "Results",             kw: ["results", "earnings"] },
  { view: "ownership",  label: "Ownership",           kw: ["ownership", "shareholding"] },
  { view: "operations", label: "Operations",          kw: ["operations", "efficiency"] },
];

function matchCommands(q) {
  if (!q) return [];
  return COMMANDS
    .filter(c => c.kw.some(k => k.startsWith(q) || q.startsWith(k) || k.includes(q)))
    .slice(0, 4);
}

/* Model command: "TCS DCF at 12% growth 18% margin beta 1.1" → open the name's
   Valuation tab with those assumptions applied. Recognized overrides:
   "<x>% growth" (revenue growth), "<x>% margin" (EBIT), "<x>% roe"
   (financials), "beta <x>". Bare "<ticker> dcf" just jumps to the model. */
function parseModelCommand(q, companies, scoreFn) {
  const m = q.match(/^(.+?)\s+(?:dcf|valuation|model)\b(.*)$/i);
  if (!m) return null;
  const needle = m[1].trim().toLowerCase();
  const rest = m[2] || "";
  const best = (companies || [])
    .map(c => ({ c, s: scoreFn(c, needle) }))
    .filter(r => r.s != null)
    .sort((a, b) => a.s - b.s)[0];
  if (!best) return null;
  const overrides = {};
  const parts = [];
  const gm = rest.match(/(\d+(?:\.\d+)?)\s*%\s*(?:rev(?:enue)?\s*)?growth/i);
  if (gm) { overrides.rev_growth = +gm[1] / 100; parts.push(`${gm[1]}% growth`); }
  const mm = rest.match(/(\d+(?:\.\d+)?)\s*%\s*(?:ebit\s*)?margin/i);
  if (mm) { overrides.ebit_margin = +mm[1] / 100; parts.push(`${mm[1]}% margin`); }
  const rm = rest.match(/(\d+(?:\.\d+)?)\s*%\s*roe/i);
  if (rm) { overrides.forecast_roe = +rm[1] / 100; parts.push(`${rm[1]}% ROE`); }
  const bm = rest.match(/beta\s*(\d+(?:\.\d+)?)/i);
  if (bm) { overrides.beta = +bm[1]; parts.push(`beta ${bm[1]}`); }
  return { co: best.c, overrides, desc: parts.join(" · ") || "base assumptions" };
}

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

export default function CommandPalette({ open, setOpen, companies, onOpenCompany, onNavigate, onOpenModel }) {
  const [q, setQ]       = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const dialogRef = useModalA11y(open);   // UX-06: focus trap + restore
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

  /* Reset on every open — state adjusted during render (no cascading
     effect render); only the DOM focus (an external system) stays in an
     effect. Active row resets whenever the query changes, same pattern. */
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) { setQ(""); setActive(0); }
  }
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setActive(0);
  }
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const model = onOpenModel ? parseModelCommand(q.trim(), companies, score) : null;
    const modelRow = model ? [{ type: "model", ...model }] : [];
    const cmds = matchCommands(needle).map(cmd => ({ type: "cmd", cmd }));
    const cos = (companies || [])
      .map(co => ({ co, s: score(co, needle) }))
      .filter(r => r.s != null)
      .sort((a, b) => a.s - b.s || (a.co.name || "").localeCompare(b.co.name || ""))
      .slice(0, 10)
      .map(r => ({ type: "co", co: r.co }));
    return [...modelRow, ...cmds, ...cos];
  }, [companies, q, onOpenModel]);

  /* Keep the active row visible while arrowing through the list. */
  useEffect(() => {
    const el = listRef.current?.children?.[active];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const pick = item => {
    setOpen(false);
    if (item.type === "cmd") { if (onNavigate) onNavigate(item.cmd.view); return; }
    if (item.type === "model") {
      if (onOpenModel) onOpenModel(item.co.ticker || item.co.id, item.overrides);
      return;
    }
    const id = item.co.ticker || item.co.id;
    if (id && onOpenCompany) onOpenCompany(id);
  };

  const onKeyDown = e => {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => items.length ? (a + 1) % items.length : 0); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setActive(a => items.length ? (a - 1 + items.length) % items.length : 0); }
    else if (e.key === "Enter")     { e.preventDefault(); if (items[active]) pick(items[active]); }
  };

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}
      style={{
        position: "fixed", inset: 0, zIndex: zIndex.modal,
        background: "rgba(10,9,7,0.82)", backdropFilter: "blur(6px)",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        paddingTop: "12vh",
      }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Command palette — search and commands"
        className="evc-anim-drop" style={{
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
            placeholder='Ticker, page, or a model: "TCS DCF at 12% growth"…'
            style={{ ...sans, flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 16 }}
          />
          <span style={{ ...mono, fontSize: 10, color: C.faint, border: `1px solid ${C.line2}`, borderRadius: 5, padding: "2px 6px" }}>ESC</span>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 420, overflowY: "auto" }}>
          {items.map((it, i) => {
            const activeRow = i === active;
            const rowStyle = {
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 18px", cursor: "pointer",
              background: activeRow ? C.bg800 : "transparent",
              borderLeft: `2px solid ${activeRow ? C.gold : "transparent"}`,
            };
            if (it.type === "model") {
              return (
                <div key={"model-" + (it.co.ticker || it.co.id)}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={e => { e.preventDefault(); pick(it); }}
                  style={rowStyle}>
                  <Calculator size={15} color={C.gold} strokeWidth={1.8} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...sans, fontSize: 13, fontWeight: 500, color: C.text }}>
                      Open {it.co.name} — Valuation model
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: C.gold }}>{it.desc}</div>
                  </div>
                  {activeRow && <CornerDownLeft size={13} color={C.dim} />}
                </div>
              );
            }
            if (it.type === "cmd") {
              return (
                <div key={"cmd-" + it.cmd.view}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={e => { e.preventDefault(); pick(it); }}
                  style={rowStyle}>
                  <ArrowRight size={15} color={C.gold} strokeWidth={1.8} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...sans, fontSize: 13, fontWeight: 500, color: C.text }}>Go to {it.cmd.label}</div>
                    <div style={{ ...mono, fontSize: 10, color: C.faint }}>command</div>
                  </div>
                  {activeRow && <CornerDownLeft size={13} color={C.dim} />}
                </div>
              );
            }
            const co = it.co, a = co.api || {};
            return (
              <div
                key={co.ticker || co.id}
                onMouseEnter={() => setActive(i)}
                onMouseDown={e => { e.preventDefault(); pick(it); }}
                style={rowStyle}>
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
                {activeRow && <CornerDownLeft size={13} color={C.dim} />}
              </div>
            );
          })}
          {items.length === 0 && (
            <div style={{ ...sans, padding: 36, textAlign: "center", color: C.faint, fontSize: 13 }}>
              No matches for “{q}”. Try a ticker, a company, or a page like “sectors”.
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
          <span style={{ ...serif, fontSize: 12, color: C.vfaint, marginLeft: "auto" }}>EquityVerdict</span>
        </div>
      </div>
    </div>
  );
}
