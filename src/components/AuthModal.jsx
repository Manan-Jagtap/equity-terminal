/* AuthModal — sign in / create account overlay.
   Brand-styled like CommandPalette: dim ink scrim, ink-900 card, hairline
   borders, serif masthead, gold accents, mono inputs. Enter submits,
   Esc closes, inline {detail} errors from the backend. */

import { useEffect, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import BrandMark from "./BrandMark.jsx";
import { login, signup, verifySignup, resendCode } from "../lib/auth.js";
import PrivacyPolicy from "./PrivacyPolicy.jsx";
import useModalA11y from "../lib/useModalA11y.js";

export default function AuthModal({ open, onClose, API, onAuthed }) {
  const [mode, setMode]   = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [pw, setPw]       = useState("");
  const [name, setName]   = useState("");
  const [consent, setConsent] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [err, setErr]     = useState(null);
  const [busy, setBusy]   = useState(false);
  const [verifyFor, setVerifyFor] = useState(null);  // email awaiting its code
  const [code, setCode]   = useState("");
  const [resent, setResent] = useState(false);
  const emailRef = useRef(null);
  const dialogRef = useModalA11y(open);   // UX-06: focus trap + restore

  /* Reset on every open. */
  useEffect(() => {
    if (open) {
      setMode("signin"); setEmail(""); setPw(""); setName(""); setConsent(false);
      setPolicyOpen(false); setErr(null); setBusy(false);
      setVerifyFor(null); setCode(""); setResent(false);
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

  const signupIncomplete = mode === "signup" && (!name.trim() || !consent);

  const submit = async e => {
    e?.preventDefault();
    if (busy || !email.trim() || !pw || signupIncomplete) return;
    setBusy(true); setErr(null);
    try {
      const res = mode === "signin"
        ? await login(API, email.trim(), pw)
        : await signup(API, email.trim(), pw, name.trim(), consent);
      if (res && res.pending_verification) {
        setVerifyFor(res.email);          // step 2: enter the emailed code
        return;
      }
      onAuthed(res);
      onClose();
    } catch (ex) {
      setErr(ex.message || "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  };

  const switchMode = m => { setMode(m); setErr(null); setVerifyFor(null); setCode(""); };

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
      <div ref={dialogRef} role="dialog" aria-modal="true"
        aria-label={mode === "signin" ? "Sign in to EquityVerdict" : "Create your EquityVerdict account"}
        className="fadein" style={{
        width: "min(420px, 92vw)", background: C.bg900,
        border: `1px solid ${C.line2}`, borderRadius: 12,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)", overflow: "hidden",
      }}>
        {/* Masthead */}
        <div style={{ padding: "26px 28px 18px", textAlign: "center", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
            <BrandMark size={21} />
            <span style={{ ...serif, fontSize: 24, color: C.text }}>EquityVerdict</span>
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

        {/* Step 2: email-ownership verification (account exists only after this) */}
        {verifyFor ? (
          <form style={{ padding: "22px 28px 26px" }}
            onSubmit={async e => {
              e.preventDefault();
              if (busy || code.trim().length < 6) return;
              setBusy(true); setErr(null);
              try {
                const user = await verifySignup(API, verifyFor, code.trim());
                onAuthed(user);
                onClose();
              } catch (ex) {
                setErr(ex.message || "Incorrect code — check the email and try again.");
              } finally { setBusy(false); }
            }}>
            <div style={{ ...sans, fontSize: 13, color: C.dim, lineHeight: 1.6, marginBottom: 16 }}>
              We emailed a 6-digit code to <span style={{ color: C.text }}>{verifyFor}</span>.
              Enter it below to activate your account. Check spam if it isn't there in a minute.
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Verification code</label>
              <input value={code} autoFocus inputMode="numeric" maxLength={6}
                onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000" style={{ ...field, letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }} />
            </div>
            {err && <div style={{ ...sans, fontSize: 12.5, color: C.red, marginBottom: 12 }}>{err}</div>}
            <button type="submit" disabled={busy || code.length < 6} style={{
              ...sans, width: "100%", padding: "13px 0", fontSize: 14.5, fontWeight: 600,
              borderRadius: 9, border: "none", cursor: busy ? "default" : "pointer",
              background: C.green, color: "#06231A", opacity: busy || code.length < 6 ? 0.6 : 1,
            }}>{busy ? "Verifying…" : "Verify & create account"}</button>
            <button type="button" disabled={resent}
              onClick={async () => { setResent(true); try { await resendCode(API, verifyFor); } catch { /* silent */ } }}
              style={{ ...sans, width: "100%", marginTop: 10, padding: "10px 0", fontSize: 12.5,
                       background: "transparent", border: "none", cursor: resent ? "default" : "pointer",
                       color: resent ? C.faint : C.dim, textDecoration: resent ? "none" : "underline" }}>
              {resent ? "Code re-sent — give it a minute" : "Resend code"}
            </button>
          </form>
        ) : (
        <form onSubmit={submit} style={{ padding: "22px 28px 26px" }}>
          {mode === "signup" && (
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} required
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

          {mode === "signup" && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 16, cursor: "pointer" }}>
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                style={{ marginTop: 2, accentColor: C.gold, cursor: "pointer" }} />
              <span style={{ ...sans, fontSize: 11.5, lineHeight: 1.55, color: C.dim }}>
                I agree to the{" "}
                <button type="button" onClick={() => setPolicyOpen(true)} style={{
                  ...sans, background: "transparent", border: "none", padding: 0,
                  color: C.gold, cursor: "pointer", fontSize: 11.5, textDecoration: "underline",
                }}>Privacy Policy</button>
                {" "}and understand this is a research tool, not investment advice.
              </span>
            </label>
          )}

          {err && (
            <div style={{ ...sans, fontSize: 12, color: C.red, border: `1px solid ${C.red}44`,
              borderRadius: 7, padding: "8px 12px", marginBottom: 14, background: C.red + "10" }}>
              {err}
            </div>
          )}

          <button type="submit" disabled={busy || !email.trim() || !pw || signupIncomplete} style={{
            ...sans, width: "100%", fontSize: 13, fontWeight: 600,
            color: C.bg, background: C.gold, border: "none", borderRadius: 8,
            padding: "11px 0", cursor: busy ? "wait" : "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
            opacity: (!email.trim() || !pw || signupIncomplete) ? 0.55 : 1,
          }}>
            {busy
              ? <Loader2 size={14} className="spin" />
              : <Lock size={13} strokeWidth={2} />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <div style={{ ...sans, fontSize: 11, color: C.faint, textAlign: "center", marginTop: 14 }}>
            Your watchlist and portfolio are private to your account.
          </div>
        </form>
        )}
      </div>
      <PrivacyPolicy open={policyOpen} onClose={() => setPolicyOpen(false)} />
    </div>
  );
}
