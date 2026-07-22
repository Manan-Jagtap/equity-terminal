/* FeedbackModal — INST-02: the user-feedback channel.
   Signed-in users only (the backend 401s anonymous free-text). Posts
   {message, page} to /api/feedback via authFetch; Esc closes; brand-styled
   like AuthModal (ink scrim, ink-900 card, gold accent). */

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { authFetch } from "../lib/auth.js";
import useModalA11y from "../lib/useModalA11y.js";

const MAX = 2000;

export default function FeedbackModal({ open, onClose, API }) {
  const [msg, setMsg]   = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);
  const [sent, setSent] = useState(false);
  const boxRef = useRef(null);
  const dialogRef = useModalA11y(open);

  useEffect(() => {
    if (open) {
      setMsg(""); setErr(null); setBusy(false); setSent(false);
      setTimeout(() => boxRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async e => {
    e.preventDefault();
    const text = msg.trim();
    if (busy || !text) return;
    setBusy(true); setErr(null);
    try {
      const r = await authFetch(`${API}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.slice(0, MAX),
          page: window.location.pathname.split("?")[0].slice(0, 120),
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || "Could not send feedback — try again.");
      }
      setSent(true);
      setTimeout(onClose, 1400);
    } catch (ex) {
      setErr(ex.message || "Network error — feedback not sent.");
    } finally { setBusy(false); }
  };

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(10,9,7,0.82)", backdropFilter: "blur(6px)",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        paddingTop: "16vh",
      }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Send feedback"
        className="fadein" style={{
          width: "min(440px, 92vw)", background: C.bg900,
          border: `1px solid ${C.line2}`, borderRadius: 12,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)", overflow: "hidden",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "18px 22px 14px", borderBottom: `1px solid ${C.line}` }}>
          <MessageSquare size={16} color={C.gold} strokeWidth={1.6} />
          <span style={{ ...serif, fontSize: 18, color: C.text }}>Send feedback</span>
        </div>
        {sent ? (
          <div style={{ ...sans, padding: "26px 22px 30px", fontSize: 14, color: C.green, textAlign: "center" }}>
            Thank you — feedback received.
          </div>
        ) : (
          <form onSubmit={submit} style={{ padding: "18px 22px 22px" }}>
            <div style={{ ...sans, fontSize: 12.5, color: C.dim, lineHeight: 1.55, marginBottom: 12 }}>
              A bug, a wrong number, a missing name, something confusing — anything
              helps. Goes straight to the desk.
            </div>
            <textarea
              ref={boxRef} value={msg} maxLength={MAX}
              onChange={e => setMsg(e.target.value)}
              placeholder="What's on your mind?"
              rows={5}
              style={{
                ...mono, width: "100%", boxSizing: "border-box", resize: "vertical",
                fontSize: 13, lineHeight: 1.5, color: C.text,
                background: C.bg800, border: `1px solid ${C.line2}`,
                borderRadius: 9, padding: "11px 12px", outline: "none",
              }} />
            <div style={{ display: "flex", alignItems: "center", marginTop: 10 }}>
              <span style={{ ...mono, fontSize: 10.5, color: C.faint }}>{msg.length}/{MAX}</span>
              {err && <span style={{ ...sans, fontSize: 12, color: C.red, marginLeft: 10 }}>{err}</span>}
              <button type="submit" disabled={busy || !msg.trim()} style={{
                ...sans, marginLeft: "auto", padding: "9px 18px", fontSize: 13, fontWeight: 600,
                borderRadius: 8, border: "none",
                cursor: busy || !msg.trim() ? "default" : "pointer",
                background: C.gold, color: "#231B06",
                opacity: busy || !msg.trim() ? 0.55 : 1,
                display: "inline-flex", alignItems: "center", gap: 7,
              }}>
                {busy && <Loader2 size={13} className="spin" />}Send
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
