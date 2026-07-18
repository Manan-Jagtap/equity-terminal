/* PrivacyPolicy.jsx — the privacy policy overlay, linked from signup and the
   landing footer. Plain-language v1 drafted for the DPDP Act's notice
   requirement — have a lawyer review before commercial launch (COMPLIANCE.md §4). */

import { X } from "lucide-react";
import { C, sans, serif } from "../lib/theme.js";

const SECTIONS = [
  ["What we collect", [
    "Account details: your name, email address, and a one-way hash of your password (we can never read the password itself).",
    "Your research data: watchlists, portfolio holdings you enter or import, saved screens and valuation scenarios.",
    "Security telemetry: sign-in events with IP address and browser user-agent, kept to protect your account and detect abuse.",
  ]],
  ["What we use it for", [
    "Operating your account and keeping your watchlist, portfolio and scenarios private to you.",
    "Securing the platform: rate limiting, detecting credential-stuffing, investigating suspicious sign-ins.",
    "Improving the product with aggregate, non-identifying usage patterns.",
  ]],
  ["What we never do", [
    "We do not sell or rent your personal data to anyone.",
    "We do not share your portfolio or watchlist with any third party.",
    "We do not send marketing email without a separate, explicit opt-in.",
  ]],
  ["Storage & retention", [
    "Data is stored on managed cloud infrastructure with encryption in transit. Passwords are salted and hashed (PBKDF2, 260,000 iterations).",
    "Sign-in telemetry is retained for security purposes and periodically pruned.",
    "Your research data is retained while your account exists.",
  ]],
  ["Your rights", [
    "You can access and correct your account data at any time from within the app.",
    "You can request deletion of your account and all associated data by emailing the address below; we will action it within 30 days.",
    "You can raise any privacy grievance at the same address.",
  ]],
];

export default function PrivacyPolicy({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(10,9,7,0.85)", backdropFilter: "blur(6px)",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        padding: "7vh 16px", overflowY: "auto",
      }}>
      <div className="fadein" style={{
        width: "min(640px, 94vw)", background: C.bg900,
        border: `1px solid ${C.line2}`, borderRadius: 12,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)", padding: "28px 30px 26px",
        maxHeight: "84vh", overflowY: "auto", boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h2 style={{ ...serif, fontSize: 26, color: C.text, margin: 0, fontWeight: 400 }}>Privacy Policy</h2>
          <span style={{ ...sans, fontSize: 11, color: C.faint }}>Effective 4 July 2026</span>
          <button onClick={onClose} aria-label="Close" style={{
            marginLeft: "auto", background: "transparent", border: "none",
            cursor: "pointer", padding: 4, lineHeight: 0,
          }}>
            <X size={17} color={C.dim} />
          </button>
        </div>
        <p style={{ ...sans, fontSize: 13, lineHeight: 1.65, color: C.text200, marginTop: 14 }}>
          EquityVerdict collects the minimum personal data needed to run a private,
          secure research account. This page explains exactly what that means.
        </p>
        {SECTIONS.map(([title, items]) => (
          <div key={title} style={{ marginTop: 18 }}>
            <div style={{ ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: C.gold, marginBottom: 8 }}>{title}</div>
            {items.map((t, i) => (
              <p key={i} style={{ ...sans, fontSize: 12.5, lineHeight: 1.65, color: C.text200, margin: "0 0 7px" }}>· {t}</p>
            ))}
          </div>
        ))}
        <p style={{ ...sans, fontSize: 12, lineHeight: 1.6, color: C.dim, marginTop: 20, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
          Contact for privacy requests, deletion, and grievances:{" "}
          <a href="mailto:mananjagtap27@gmail.com" style={{ color: C.gold }}>mananjagtap27@gmail.com</a>.
          EquityVerdict is a research tool and does not provide investment advice; see the
          disclaimer on every page.
        </p>
      </div>
    </div>
  );
}
