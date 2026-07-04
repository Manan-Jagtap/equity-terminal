/* Landing.jsx — the logged-out face of the terminal.

   Sign-in is compulsory: anonymous visitors see this page, not the app. It has
   one job — say clearly what the terminal is (and is not), and get the visitor
   into the auth modal. Fully responsive; no data fetches, so it renders
   instantly even before the API wakes. */

import { useState } from "react";
import { TrendingUp, ShieldCheck, LineChart, Sparkles, History, LogIn } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { useIsMobile } from "../lib/useResponsive.js";
import PrivacyPolicy from "./PrivacyPolicy.jsx";

const PILLARS = [
  {
    icon: LineChart,
    title: "A valuation engine that shows its work",
    body: "Sector-correct DCF and residual-income models with every assumption on a slider. No black boxes — you can disagree with any number and the model recomputes live.",
  },
  {
    icon: History,
    title: "A track record that can't be faked",
    body: "Every verdict is snapshotted daily and graded in public — wins and losses, dividend-adjusted, never backfilled. The model keeps score on itself.",
  },
  {
    icon: Sparkles,
    title: "Evidence-weighted idea ranking",
    body: "A transparent 7-factor Alpha Score — quality, momentum, value, low-vol, growth, estimate revisions, earnings surprise — with the math shown per name.",
  },
  {
    icon: ShieldCheck,
    title: "Data that argues with itself",
    body: "Two independent price sources cross-checked daily. When numbers don't tie out, the terminal says so instead of showing you something confidently wrong.",
  },
];

export default function Landing({ onSignIn }) {
  const isMobile = useIsMobile();
  const PAD = isMobile ? 20 : 48;
  const [policyOpen, setPolicyOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", gap: 9, padding: `18px ${PAD}px`, borderBottom: `1px solid ${C.line}` }}>
        <TrendingUp size={20} color={C.gold} strokeWidth={1.8} />
        <span style={{ ...serif, fontSize: 22, color: C.text }}>Equity Terminal</span>
        <button onClick={onSignIn} style={{
          ...sans, display: "flex", alignItems: "center", gap: 7, marginLeft: "auto",
          padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500,
          border: `1px solid ${C.gold}66`, background: C.gold + "0d", color: C.gold,
        }}>
          <LogIn size={15} strokeWidth={1.6} /> Sign in
        </button>
      </header>

      {/* Hero */}
      <section style={{ padding: `${isMobile ? 48 : 88}px ${PAD}px ${isMobile ? 36 : 56}px`, maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ ...serif, fontSize: isMobile ? 34 : 52, lineHeight: 1.15, color: C.text, margin: 0, fontWeight: 400 }}>
          Independent equity research<br />
          <span style={{
            backgroundImage: `linear-gradient(92deg, ${C.gold}, ${C.blue} 70%, #A78BFA)`,
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}>with every number traceable.</span>
        </h1>
        <p style={{ ...sans, fontSize: isMobile ? 14.5 : 16.5, lineHeight: 1.65, color: C.dim, margin: "22px auto 0", maxWidth: 620 }}>
          Sector-correct valuations, a falsifiable public track record, and a
          multi-factor idea engine for Indian equities — built for people who want
          to see the working, not just the answer.
        </p>
        <button onClick={onSignIn} style={{
          ...sans, marginTop: 34, padding: "13px 34px", borderRadius: 10, cursor: "pointer",
          fontSize: 15, fontWeight: 600, border: "none", background: C.gold, color: C.bg,
        }}>
          Create your free account
        </button>
        <div style={{ ...mono, fontSize: 11, color: C.faint, marginTop: 12 }}>
          Nifty 500 coverage · 5-year history · daily model refresh
        </div>
      </section>

      {/* Pillars */}
      <section style={{
        display: "grid", gap: 14, padding: `10px ${PAD}px 40px`, maxWidth: 1080, margin: "0 auto", width: "100%",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(230px, 1fr))", boxSizing: "border-box",
      }}>
        {PILLARS.map(({ icon: Icon, title, body }) => (
          <div key={title} style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.bg900, padding: "20px 18px" }}>
            <Icon size={18} color={C.gold} strokeWidth={1.6} />
            <div style={{ ...sans, fontSize: 14, fontWeight: 600, color: C.text, margin: "10px 0 7px" }}>{title}</div>
            <div style={{ ...sans, fontSize: 12.5, lineHeight: 1.6, color: C.dim }}>{body}</div>
          </div>
        ))}
      </section>

      {/* Compliance footer — deliberately prominent, not fine print. */}
      <footer style={{ marginTop: "auto", borderTop: `1px solid ${C.line}`, padding: `18px ${PAD}px 26px` }}>
        <p style={{ ...sans, fontSize: 11.5, lineHeight: 1.65, color: C.faint, maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
          Equity Terminal is a research and analytics tool for educational purposes. Nothing on this
          platform is investment advice or a recommendation to buy or sell any security. Model outputs
          (intrinsic values, verdicts, scores) are automated estimates that can be wrong. Securities
          markets are subject to market risk. Do your own diligence or consult a SEBI-registered
          investment adviser before acting.
        </p>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <button onClick={() => setPolicyOpen(true)} style={{
            ...sans, background: "transparent", border: "none", padding: 0,
            color: C.dim, cursor: "pointer", fontSize: 11.5, textDecoration: "underline",
          }}>Privacy Policy</button>
        </div>
      </footer>
      <PrivacyPolicy open={policyOpen} onClose={() => setPolicyOpen(false)} />
    </div>
  );
}
