/* /styleguide — the living design-system reference (internal, Phase 0).
   Every token, type step, color, and (as Phase 1 lands) component state is
   inspectable here. If a UI decision isn't visible on this page, it isn't a
   system decision. Reached via #/styleguide (real route in Phase 0b). */
import { color, font, space, radius, verdictColor, fmtNum } from "../design/tokens.js";

const Section = ({ title, children }) => (
  <section style={{ marginBottom: 48 }}>
    <h2 style={{ fontFamily: font.ui, fontSize: 11, letterSpacing: "0.08em",
      textTransform: "uppercase", color: color.text3, margin: "0 0 16px" }}>{title}</h2>
    {children}
  </section>
);

const Swatch = ({ name, value, ink }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
    <div style={{ width: 44, height: 28, borderRadius: 6, background: value,
      boxShadow: `0 0 0 1px ${color.line2}` }} />
    <code style={{ fontFamily: font.mono, fontSize: 12, color: ink || color.text2 }}>
      {name} <span style={{ color: color.text3 }}>{value}</span></code>
  </div>
);

export default function Styleguide() {
  const typeRamp = [
    ["display", 34, 600], ["3xl", 28, 600], ["2xl", 23, 600], ["xl", 19, 500],
    ["lg", 16, 500], ["md (body)", 13, 400], ["sm", 12, 400], ["xs", 11, 400],
  ];
  const verdicts = ["BUY", "ACCUMULATE", "HOLD", "REDUCE", "AVOID", "LOW CONF"];
  return (
    <div className="ev-grain" style={{ fontFamily: font.ui, color: color.text,
      background: color.bg, minHeight: "100vh", padding: "48px 32px", position: "relative" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
          color: color.accent, marginBottom: 8 }}>EquityVerdict design system · Phase 0</div>
        <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.011em",
          margin: "0 0 6px" }}>A precision instrument that feels calm</h1>
        <p style={{ color: color.text2, fontSize: 13, lineHeight: 1.55, maxWidth: 560,
          margin: "0 0 48px" }}>
          Warm obsidian · numbers are the hero · hairlines over fills · one accent ·
          motion explains, never decorates. Every token on this page is the system;
          nothing in a component may bypass it.
        </p>

        <Section title="Surfaces & text">
          {Object.entries({ bg: color.bg, bgRaise: color.bgRaise, bgOver: color.bgOver,
            bgInput: color.bgInput }).map(([k, v]) => <Swatch key={k} name={`--ev-${k}`} value={v} />)}
          <div style={{ marginTop: 12 }}>
            <div style={{ color: color.text }}>Primary text — the answer (15.9:1)</div>
            <div style={{ color: color.text2 }}>Secondary — supporting context (8.3:1)</div>
            <div style={{ color: color.text3 }}>Tertiary — labels, ≥12px only (4.6:1 AA)</div>
          </div>
        </Section>

        <Section title="Accent (the only one)">
          <Swatch name="--ev-accent" value={color.accent} />
          <button style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600,
            background: color.accent, color: color.accentInk, border: "none",
            borderRadius: radius.md, padding: "10px 18px", cursor: "pointer" }}>
            Primary action</button>
          <span style={{ marginLeft: 12, fontSize: 12, color: color.text3 }}>
            focus / primary / live emphasis — nothing else</span>
        </Section>

        <Section title="Verdict ladder (semantic, muted, never color-alone)">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {verdicts.map(v => (
              <span key={v} style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 600,
                color: verdictColor(v), border: `1px solid ${verdictColor(v)}55`,
                borderRadius: radius.pill, padding: "5px 14px" }}>{v}</span>
            ))}
          </div>
        </Section>

        <Section title="Type ramp — Inter Variable (UI) · JetBrains Mono (numbers)">
          {typeRamp.map(([n, s, w]) => (
            <div key={n} style={{ fontSize: s, fontWeight: w, letterSpacing: "-0.011em",
              lineHeight: 1.25, marginBottom: 6 }}>
              The quick brown fox — {n} / {s}px</div>
          ))}
          <div className="ev-num" style={{ fontSize: 23, marginTop: 16, color: color.text }}>
            {fmtNum.inr(2772.76, 2)} <span style={{ color: color.up }}>{fmtNum.signedPct(0.0392)}</span>
          </div>
          <div className="ev-num" style={{ fontSize: 13, color: color.text2 }}>
            1,00,245.50 · 98,101.25 · {fmtNum.cr(357348)} — tabular figures: digits never jitter
          </div>
        </Section>

        <Section title="Space · radius · elevation · motion">
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 16 }}>
            {Object.entries(space).map(([k, v]) => (
              <div key={k} style={{ width: v, height: v, background: color.accentDim,
                borderRadius: 3 }} title={`${k}=${v}`} />
            ))}
            <code style={{ fontFamily: font.mono, fontSize: 11, color: color.text3 }}>4→64 (8pt base)</code>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            {[1, 2, 3].map(n => (
              <div key={n} style={{ background: color.bgRaise, borderRadius: radius.md,
                padding: "18px 22px", fontSize: 12, color: color.text2,
                boxShadow: `var(--ev-elev-${n})` }}>elev-{n}</div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: color.text3, marginTop: 16 }}>
            Motion: 120 / 200 / 320 ms · settle ease (0.22, 1, 0.36, 1) · springs for
            interactive elements · transforms/opacity only · reduced-motion collapses all.
          </p>
        </Section>

        <Section title="Phase 1 components will register here">
          <p style={{ fontSize: 12, color: color.text3 }}>
            Button · Input · Badge · Card · Table · Tabs · Tooltip · Modal · Toast ·
            Skeleton → VerdictBadge · AlphaScore · ValuationPanel · FinancialsTable ·
            PriceChart · CompanyRow · StatTile · CommandPalette — each with every state
            and a reduced-motion variant, or it doesn't ship.
          </p>
        </Section>
      </div>
    </div>
  );
}
