import { useEffect } from "react";
/* TermsOfService.jsx — the terms overlay, linked from signup and the landing
   footer, mirroring PrivacyPolicy.jsx exactly (same dialog semantics, same
   section shape, same type scale).

   DRAFT v1 — HAVE AN INDIAN LAWYER REVIEW BEFORE COMMERCIAL LAUNCH.
   This is written to be accurate about what the product actually does today,
   not to be a substitute for advice. Three things in particular need a lawyer:

     1. The limitation of liability. Indian courts will not enforce an exclusion
        for fraud or gross negligence however it is drafted, and the Consumer
        Protection Act 2019 constrains what can be disclaimed against a
        "consumer". The cap below is deliberately modest for that reason.
     2. The jurisdiction clause. JURISDICTION below is an ASSUMPTION (see the
        constant) — it should be the operator's actual place of business.
     3. Section 2. It states we are NOT SEBI-registered and charge nothing.
        Both are true today. If either changes, this document must change in
        the SAME release — COMPLIANCE.md §1 is explicit that charging for these
        verdicts without RA registration would very likely be a violation.

   Fill the three constants below before this is meaningful. */

import { X } from "lucide-react";
import useModalA11y from "../lib/useModalA11y.js";
import { useEscape } from "../lib/a11y.js";
import { C, sans, serif } from "../lib/theme.js";

/* ── Fill these in ──────────────────────────────────────────────────────────
   OPERATOR deliberately does not claim a corporate form: there is no
   registered entity yet (COMPLIANCE.md §1), and naming a "Pvt Ltd" that does
   not exist is worse than naming nothing. */
const OPERATOR = "EquityVerdict";
const JURISDICTION = "Mumbai, Maharashtra";      // ASSUMPTION — confirm
const CONTACT = "mananjagtap27@gmail.com";

const SECTIONS = [
  ["1. What this service is", [
    `${OPERATOR} is an automated equity-research and analytics tool for Indian listed equities. It computes valuations, scores and screens from published financial data using disclosed models, and shows its working.`,
    "It is intended for education, research and your own independent analysis. It is a calculator and a reference, not a recommendation service.",
    "By creating an account or using the platform you agree to these Terms. If you do not agree, do not use the service.",
  ]],
  ["2. Not investment advice — and we are not SEBI-registered", [
    `${OPERATOR} is NOT registered with the Securities and Exchange Board of India as a Research Analyst, Investment Adviser, or in any other capacity, and is not a member of any stock exchange.`,
    "Nothing on this platform is investment advice, a research report within the meaning of the SEBI (Research Analysts) Regulations, 2014, or a solicitation to buy or sell any security. No output is personalised to you: the models do not know your finances, objectives, risk tolerance, tax position or holding period, and do not take them into account.",
    "Verdict labels such as BUY, ACCUMULATE, HOLD, REDUCE and AVOID are the OUTPUT OF A FORMULA comparing a computed intrinsic value to the market price. They are model states, not advice, not a recommendation, and not an opinion that you should transact.",
    "The service is provided free of charge. We do not charge any fee, subscription or other consideration for access to research outputs.",
    "Consult a SEBI-registered investment adviser before acting on anything you read here. Any decision you make, and any profit or loss that follows, is yours alone.",
  ]],
  ["3. Eligibility and your account", [
    "You must be at least 18 years old and competent to contract under the Indian Contract Act, 1872.",
    "You are responsible for keeping your password confidential and for everything done through your account. Tell us promptly at the address below if you believe it has been compromised.",
    "One account per person. Do not share, sell or transfer your account, and do not create accounts by automated means.",
    "The information you give us at signup must be accurate and kept current.",
  ]],
  ["4. What the numbers are, and how they can be wrong", [
    "Every intrinsic value, margin of safety, score and verdict is a MODEL ESTIMATE produced from third-party data under stated assumptions. Change an assumption and the number changes — which is why the assumptions are editable and shown to you.",
    "Models can be wrong, and are wrong regularly. Sector classifications can be wrong. Inputs can be stale, mis-parsed or missing. Where the model's own confidence is too low, or its methods disagree too widely, it withholds the number rather than publishing one it cannot stand behind — an absent figure is a deliberate abstention, not an error.",
    "We give no warranty that any figure is accurate, complete, current or fit for any purpose.",
    "The public track record records past model outputs and is append-only in both directions: we do not add favourable calls after the fact, and we do not remove unfavourable ones. It is a record of what the model said, not a claim about what it will say next. Past performance does not indicate future results.",
  ]],
  ["5. Market data and third-party sources", [
    "Financial and market data comes from third-party vendors and public filings. We do not own that data, cannot guarantee it, and are not liable for its errors, delays or omissions.",
    "Prices may be delayed and must not be relied on for trading or execution. Corporate actions — splits, bonuses, mergers, symbol and ISIN changes — may not be reflected immediately.",
    "Third-party terms may apply to the underlying data, and a vendor withdrawing a feed may remove features without notice.",
  ]],
  ["6. Acceptable use", [
    "Do not scrape, crawl or bulk-extract data or model outputs, or attempt to reconstruct the underlying dataset.",
    "Do not resell, redistribute, republish or commercially exploit the outputs, or present them as your own research or as the basis of advice you give to others.",
    "Do not reverse engineer or decompile the service, circumvent rate limits or authentication, probe or load-test it without written permission, or upload anything malicious.",
    "Do not use the service for anything unlawful, including market manipulation, insider dealing, or any use that would require a registration you do not hold.",
  ]],
  ["7. Your content, and ours", [
    "Watchlists, portfolio holdings, notes and saved scenarios you enter remain yours. You grant us only the limited licence needed to store and display them back to you in operating the service. See the Privacy Policy for how they are handled.",
    "The platform — its models, code, interface, text, and the outputs it generates — belongs to us and is protected by law. You get a personal, non-exclusive, non-transferable, revocable licence to use it for your own research.",
    "You may quote or screenshot modest amounts for personal, non-commercial use with attribution to EquityVerdict.",
  ]],
  ["8. Availability and changes", [
    "The service is provided on an \"as is\" and \"as available\" basis, with no guarantee of uptime, and may be changed, suspended or discontinued in whole or part at any time.",
    "Features that depend on third-party feeds may degrade or disappear when those feeds do.",
    "We may update these Terms. Material changes will be notified in the app or by email, and continuing to use the service after they take effect means you accept them. The effective date at the top of this page always reflects the current version.",
  ]],
  ["9. Liability", [
    "To the fullest extent Indian law permits, we are not liable for any trading or investment loss, lost profit, lost opportunity, or any indirect or consequential loss arising from your use of, or reliance on, this platform or anything it produces.",
    "Where liability cannot lawfully be excluded, our total aggregate liability to you is limited to ₹1,000 or the total amount you have paid us in the twelve months before the claim, whichever is greater. The service is currently free, so that amount is presently nil.",
    "Nothing here limits liability for fraud, wilful misconduct, or anything else that cannot be limited under applicable law — including your rights under the Consumer Protection Act, 2019.",
    "You agree to indemnify us against claims arising from your breach of these Terms or your misuse of the service.",
  ]],
  ["10. Suspension and termination", [
    "You may delete your account at any time; see the Privacy Policy for what happens to your data.",
    "We may suspend or terminate access for breach of these Terms, for abuse that threatens the platform's integrity or availability, or where required by law.",
    "Sections 2, 4, 5, 7, 9 and 11 survive termination.",
  ]],
  ["11. Governing law, grievances and contact", [
    `These Terms are governed by the laws of India. The courts at ${JURISDICTION} have exclusive jurisdiction, subject to any right you have as a consumer to proceed where you reside.`,
    `Grievances, including anything required to be addressed under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the Digital Personal Data Protection Act, 2023, may be raised at ${CONTACT}. We aim to acknowledge within 48 hours and resolve within 30 days.`,
    "If any provision is held unenforceable, the rest remains in force.",
  ]],
];

export default function TermsOfService({ open, onClose }) {
  /* Same dialog semantics as PrivacyPolicy: useModalA11y supplies the focus
     trap and restore, useEscape is capture-phase so a focused child cannot
     swallow the key, and initial focus goes to the container because this is a
     document to read rather than a form with a first field. A compliance
     document a keyboard user cannot leave is the worst one to get wrong. */
  const dialogRef = useModalA11y(open);
  useEscape(onClose, open);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => dialogRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open, dialogRef]);
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
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Terms of Service" tabIndex={-1}
        className="fadein" style={{
        width: "min(640px, 94vw)", background: C.bg900,
        border: `1px solid ${C.line2}`, borderRadius: 12,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)", padding: "28px 30px 26px",
        maxHeight: "84vh", overflowY: "auto", boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h2 style={{ ...serif, fontSize: 26, color: C.text, margin: 0, fontWeight: 400 }}>Terms of Service</h2>
          <span style={{ ...sans, fontSize: 11, color: C.faint }}>Effective 14 August 2026</span>
          <button onClick={onClose} aria-label="Close" style={{
            marginLeft: "auto", background: "transparent", border: "none",
            cursor: "pointer", padding: 4, lineHeight: 0,
          }}>
            <X size={17} color={C.dim} />
          </button>
        </div>
        <p style={{ ...sans, fontSize: 13, lineHeight: 1.65, color: C.text200, marginTop: 14 }}>
          These terms govern your use of {OPERATOR}. The short version: this is a
          research tool that shows its working, it is free, and it is not advice.
        </p>

        {/* The one thing a reader must not be able to miss. It is also the
            clause most likely to matter legally, so it gets a callout rather
            than a bullet three sections down. */}
        <div style={{
          marginTop: 16, padding: "13px 15px", borderRadius: 8,
          border: `1px solid ${C.line2}`, background: "rgba(212,175,94,0.06)",
        }}>
          <div style={{ ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: C.gold, marginBottom: 7 }}>
            Read this first
          </div>
          <p style={{ ...sans, fontSize: 12.5, lineHeight: 1.65, color: C.text200, margin: 0 }}>
            {OPERATOR} is <strong style={{ color: C.text }}>not registered with SEBI</strong> as a
            Research Analyst or Investment Adviser. Nothing here is investment
            advice or a recommendation to buy or sell any security. Verdicts like
            BUY or AVOID are the output of a formula, not an opinion that you
            should transact. Consult a SEBI-registered investment adviser before
            acting, and treat every number as an estimate that can be wrong.
          </p>
        </div>

        {SECTIONS.map(([title, items]) => (
          <div key={title} style={{ marginTop: 18 }}>
            <div style={{ ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: C.gold, marginBottom: 8 }}>{title}</div>
            {items.map((t, i) => (
              <p key={i} style={{ ...sans, fontSize: 12.5, lineHeight: 1.65, color: C.text200, margin: "0 0 7px" }}>· {t}</p>
            ))}
          </div>
        ))}
        <p style={{ ...sans, fontSize: 12, lineHeight: 1.6, color: C.dim, marginTop: 20, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
          Questions about these terms:{" "}
          <a href={`mailto:${CONTACT}`} style={{ color: C.gold }}>{CONTACT}</a>.
          See also the Privacy Policy for how your data is handled.
        </p>
      </div>
    </div>
  );
}
