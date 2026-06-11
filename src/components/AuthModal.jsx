/* AuthModal — sign in / create account overlay.
   Brand-styled like CommandPalette: dim ink scrim, ink-900 card, hairline
   borders, serif masthead, gold accents, mono inputs. Enter submits,
   Esc closes, inline {detail} errors from the backend. */

import { useEffect, useRef, useState } from "react";
import { TrendingUp, Loader2, Lock } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { login, signup } from "../lib/auth.js";

export default function AuthModal({ open, onClose, API, onAuthed }) {
  const [mode, setMode]   = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [pw, setPw]       = useState("");
  const [name, setName]   = useState("");
  const [err, setErr]     = useState(null);
  const [busy, setBusy]   = useState(false);
  const emailRef = useRef(null);

  /* Reset on every open. */
  useEffect(() => {
    if (open) {
      setMode("signin"); setEmail(""); setPw(""); setName(""); setErr(null); setBusy(false);
      setTimeout(() => emailRef.current?.focus(), 10);
    }
  }, [open]);

  /* Esc closes. */
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async e => {
    e?.preventDefault();
    if (busy || !email.trim() || !pw) return;
    setBusy(true); setErr(null);
    try {
      const user = mode === "signin"
        ? await login(API, email.trim(), pw)
        : await signup(API, email.trim(), pw, name.trim() || undefined);
      onAuthed(user);
      onClose();
    } catch (ex) {
      setErr(ex.message || "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  };

  const switchMode = m => { setMode(m); setErr(null); };

  const field = {
    ...mono, fontSize: 13, width: "100%", boxSizing: "border-box",
    background: C.bg, border: `1px solid ${C.line2}`, borderRadius: 8,
    color: C.text, padding: "10px 13px", outline: "none",
  };
  const label = {
    ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em",
    color: C.dim, display: "block", marginBottom: 6,
  };

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(10,9,7,0.82)", backdropFilter: "blur(6px)",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        paddingTop: "14vh",
      }}>
      <div className="fadein" style={{
        width: "min(420px, 92vw)", background: C.bg900,
        border: `1px solid ${C.line2}`, borderRadius: 12,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)", overflow: "hidden",
      }}>
        {/* Masthead */}
        <div style={{ padding: "26px 28px 18px", textAlign: "center", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
            <TrendingUp size={19} color={C.gold} strokeWidth={1.8} />
            <span style={{ ...serif, fontSize: 24, color: C.text }}>Equity Terminal</span>
          </div>
          <div style={{ ...sans, fontSize: 12, color: C.faint, marginTop: 6 }}>
            Independent equity research for Indian markets
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.line}` }}>
          {[["signin", "Sign in"], ["signup", "Create account"]].map(([m, l]) => (
            <button key={m} onClick={() => switchMode(m)} style={{
              ...sans, flex: 1, fontSize: 13, fontWeight: 500, padding: "12px 0",
              background: "transparent", border: "none", cursor: "pointer",
              color: mode === m ? C.gold : C.dim,
              borderBottom: `2px solid ${mode === m ? C.gold : "transparent"}`,
            }}>{l}</button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={submit} style={{ padding: "22px 28px 26px" }}>
          {mode === "signup" && (
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Name <span style={{ color: C.vfaint, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name" autoComplete="name" style={field} />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={label}>Email</label>
            <input ref={emailRef} value={email} onChange={e => setEmail(e.target.value)}
              type="email" placeholder="you@example.com" autoComplete="email" style={field} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Password</label>
            <input value={pw} onChange={e => setPw(e.target.value)}
              type="password" placeholder={mode === "signup" ? "8+ characters" : "••••••••"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"} style={field} />
          </div>

          {err && (
            <div style={{ ...sans, fontSize: 12, color: C.red, border: `1px solid ${C.red}44`,
              borderRadius: 7, padding: "8px 12px", marginBottom: 14, background: C.red + "10" }}>
              {err}
            </div>
          )}

          <button type="submit" disabled={busy || !email.trim() || !pw} style={{
            ...sans, width: "100%", fontSize: 13, fontWeight: 600,
            color: C.bg, background: C.gold, border: "none", borderRadius: 8,
            padding: "11px 0", cursor: busy ? "wait" : "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
            opacity: (!email.trim() || !pw) ? 0.55 : 1,
          }}>
            {busy
              ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              : <Lock size={13} strokeWidth={2} />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <div style={{ ...sans, fontSize: 11, color: C.faint, textAlign: "center", marginTop: 14 }}>
            Your watchlist and portfolio are private to your account.
          </div>
        </form>
      </div>
    </div>
  );
}
