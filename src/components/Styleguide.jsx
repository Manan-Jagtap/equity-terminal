/* /styleguide — the living design-system reference (internal, Phase 0).
   Every token, type step, color, and (as Phase 1 lands) component state is
   inspectable here. If a UI decision isn't visible on this page, it isn't a
   system decision. Reached via #/styleguide (real route in Phase 0b). */
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { color, font, space, radius, chart, zIndex, verdictColor, fmtNum } from "../design/tokens.js";
import { pick } from "../design/motion.js";
import {
  Button, Input, Badge, VerdictBadge, Card, Tabs, Tooltip, TooltipProvider,
  Modal, ToastProvider, useToast, Skeleton, SkeletonText, Table, StatTile,
  AlphaScore, ValuationPanel, FinancialsTable, Sparkline, CompanyRow, NumberTicker,
} from "./ui/index.js";

/* deterministic demo series (no Math.random — stable screenshots/diffs) */
const SPARK_UP = [412, 418, 409, 425, 431, 428, 440, 452, 447, 461];
const SPARK_DOWN = [512, 505, 511, 498, 488, 492, 471, 465, 470, 452];

/* NumberTicker demo: cycle deterministic "LTP updates" and watch the tween. */
const TICKS = [2772.75, 2781.4, 2765.1, 2790.0, 2772.75];
function TickerDemo() {
  const [i, setI] = useState(0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <span style={{ fontFamily: font.mono, fontSize: 34, color: color.text }}>
        <NumberTicker value={TICKS[i]} format={(v) => fmtNum.inr(v, 2)} />
      </span>
      <Button onClick={() => setI((x) => (x + 1) % TICKS.length)}>Next tick ↻</Button>
      <span style={{ fontSize: 12, color: color.text3 }}>
        instant on first paint · tweens on change · instant under reduced-motion
      </span>
    </div>
  );
}

/* Toast needs the provider above it — tiny demo child so the hook is legal. */
function ToastDemo() {
  const toast = useToast();
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <Button onClick={() => toast("Watchlist updated")}>Info toast</Button>
      <Button onClick={() => toast("Scenario saved", { tone: "success" })}>Success toast</Button>
      <Button variant="danger" onClick={() => toast("Export failed — retry", { tone: "error" })}>Error toast</Button>
    </div>
  );
}

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
  const reduce = useReducedMotion();
  const v = pick(reduce);
  const [replay, setReplay] = useState(0);
  const typeRamp = [
    ["display", 34, 600], ["3xl", 28, 600], ["2xl", 23, 600], ["xl", 19, 500],
    ["lg", 16, 500], ["md (body)", 13, 400], ["sm", 12, 400], ["xs", 11, 400],
  ];
  const verdicts = ["BUY", "ACCUMULATE", "HOLD", "REDUCE", "AVOID", "LOW CONF"];
  return (
    <TooltipProvider><ToastProvider>
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
                borderRadius: 6 }} title={`${k}=${v}`} />
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

        <Section title="Motion — presets (transforms/opacity only · reduced-motion aware)">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <button onClick={() => setReplay(r => r + 1)} style={{ fontFamily: font.ui,
              fontSize: 12, fontWeight: 600, background: "transparent", color: color.accent,
              border: `1px solid ${color.accent}55`, borderRadius: radius.md,
              padding: "7px 14px", cursor: "pointer" }}>Replay ↻</button>
            <span style={{ fontSize: 12, color: color.text3 }}>
              prefers-reduced-motion:{" "}
              <strong style={{ color: reduce ? color.reduce : color.buy }}>
                {reduce ? "ON — instant" : "off"}</strong>
            </span>
          </div>
          <motion.div key={replay} variants={v.stagger} initial="hidden" animate="show"
            style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["fade", "slideUp", "scaleIn", "stagger", "hoverLift"].map(name => (
              <motion.div key={name} variants={v.staggerItem}
                whileHover={reduce ? undefined : { y: -1 }}
                style={{ background: color.bgRaise, border: `1px solid ${color.line}`,
                  borderRadius: radius.md, padding: "12px 16px", fontFamily: font.mono,
                  fontSize: 12, color: color.text2, cursor: "default" }}>
                {name}</motion.div>
            ))}
          </motion.div>
          <p style={{ fontSize: 12, color: color.text3, marginTop: 12, lineHeight: 1.55 }}>
            fade · slideUp (spring) · scaleIn (spring) · stagger 0.03s/item · hoverLift ≤2px.
            Consumers call <code style={{ fontFamily: font.mono, color: color.text2 }}>pick(useReducedMotion())</code> —
            the same hidden→show→exit graph collapses to opacity-only instant under reduced-motion.
          </p>
        </Section>

        <Section title="Data-viz palette (chart chrome from the system; series stay on-brand)">
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
            {chart.series.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: c,
                  boxShadow: `0 0 0 1px ${color.line2}` }} />
                <code style={{ fontFamily: font.mono, fontSize: 11, color: color.text3 }}>series[{i}]</code>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 24, fontFamily: font.mono, fontSize: 12 }}>
            <span style={{ color: chart.up }}>▲ up = buy</span>
            <span style={{ color: chart.down }}>▼ down = avoid</span>
            <span style={{ color: color.text3 }}>grid · axis = tertiary text</span>
          </div>
        </Section>

        <Section title="Stacking order (z-index scale — overlays never guess)">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(zIndex).filter(([k]) => k !== "base" && k !== "grain").map(([k, z]) => (
              <span key={k} style={{ fontFamily: font.mono, fontSize: 11, color: color.text3,
                border: `1px solid ${color.line}`, borderRadius: radius.sm, padding: "3px 9px" }}>
                {k} <span style={{ color: color.text2 }}>{z}</span></span>
            ))}
          </div>
        </Section>

        <Section title="Phase 1 · Button — variants × sizes × states">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <Button variant="primary">Primary</Button>
            <Button variant="quiet">Quiet</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="quiet" size="sm">Small quiet</Button>
            <Button variant="primary" disabled>Disabled</Button>
            <Button variant="primary" loading>Loading</Button>
            <Button variant="quiet" loading>Loading</Button>
          </div>
        </Section>

        <Section title="Phase 1 · Input — default / affix+mono / error / disabled">
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", maxWidth: 760 }}>
            <Input label="Search company" placeholder="TCS, Infosys…" hint="⌘K works anywhere" />
            <Input label="Growth rate" mono defaultValue="12.0" suffix="%" prefix="g" />
            <Input label="Email" defaultValue="not-an-email" error="Enter a valid email address" />
            <Input label="Locked field" placeholder="Managed by admin" disabled />
          </div>
        </Section>

        <Section title="Phase 1 · Badge + VerdictBadge (glyph — never color alone)">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <Badge>NEUTRAL</Badge>
            <Badge tone="accent">LIVE</Badge>
            <Badge tone="accent" fill>F&amp;O</Badge>
            <Badge tone="up" fill>+3.9%</Badge>
            <Badge tone="down" fill>−2.1%</Badge>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["BUY", "ACCUMULATE", "HOLD", "REDUCE", "AVOID", "LOW CONF"].map(v => (
              <VerdictBadge key={v} verdict={v} />
            ))}
          </div>
        </Section>

        <Section title="Phase 1 · Card / StatTile">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Card style={{ width: 250 }}>
              <div style={{ fontSize: 13, color: color.text2, marginBottom: 6 }}>Static card</div>
              <div style={{ fontSize: 12, color: color.text3 }}>bg-raise · elev-1 · r-lg</div>
            </Card>
            <Card interactive style={{ width: 250 }} onClick={() => {}}>
              <div style={{ fontSize: 13, color: color.text2, marginBottom: 6 }}>Interactive card</div>
              <div style={{ fontSize: 12, color: color.text3 }}>hover: elev-2 + 1px lift</div>
            </Card>
          </div>
          <div style={{ display: "flex", gap: 40, flexWrap: "wrap", marginTop: 20 }}>
            <StatTile label="Nifty 50" value={fmtNum.inr(24837.2, 1)} delta={0.0112} />
            <StatTile label="Portfolio" value={fmtNum.cr(4.21)} delta={-0.0087} />
            <StatTile label="Coverage" value="1,001" delta={null} />
          </div>
        </Section>

        <Section title="Phase 1 · Tabs (Radix — arrow keys, ARIA)">
          <Tabs
            tabs={[
              { id: "ov", label: "Overview", content: <p style={{ fontSize: 13, color: color.text2, margin: 0 }}>Underline style; accent marks active.</p> },
              { id: "fin", label: "Financials", content: <p style={{ fontSize: 13, color: color.text2, margin: 0 }}>Content swaps without height jumps.</p> },
              { id: "val", label: "Valuation", content: <p style={{ fontSize: 13, color: color.text2, margin: 0 }}>Third pane.</p> },
            ]}
          />
        </Section>

        <Section title="Phase 1 · Tooltip / Modal / Toast (overlay stack in action)">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <Tooltip content="Margin of safety = (fair value − price) / fair value">
              <Button variant="ghost">Hover: what is MoS?</Button>
            </Tooltip>
            <Modal
              title="Save scenario?"
              description="Your DCF overrides become a shareable link. Nothing about the base model changes."
              trigger={<Button variant="primary">Open modal</Button>}
            >
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <Button variant="ghost">Cancel</Button>
                <Button variant="primary">Save</Button>
              </div>
            </Modal>
          </div>
          <ToastDemo />
        </Section>

        <Section title="Phase 1 · Skeleton (reduced-motion: shimmer stops, block stays)">
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ width: 220 }}><SkeletonText lines={3} /></div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Skeleton width={36} height={36} radius={999} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Skeleton width={120} />
                <Skeleton width={80} height={10} />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Phase 1 · Table (numbers right-aligned tabular mono)">
          <Table
            sticky
            columns={[
              { key: "name", label: "Company" },
              { key: "verdict", label: "Verdict" },
              { key: "price", label: "Price", num: true },
              { key: "mos", label: "MoS", num: true },
            ]}
            rows={[
              { id: 1, name: "Tata Consultancy Services", verdict: "HOLD", price: 3418.6, mos: 0.04 },
              { id: 2, name: "HDFC Bank", verdict: "ACCUMULATE", price: 1712.4, mos: 0.18 },
              { id: 3, name: "Vedanta", verdict: "REDUCE", price: 452.1, mos: -0.21 },
            ]}
            renderCell={(row, c) =>
              c.key === "verdict" ? <VerdictBadge verdict={row.verdict} fill={false} />
              : c.key === "price" ? fmtNum.inr(row.price, 1)
              : c.key === "mos" ? fmtNum.signedPct(row.mos)
              : row[c.key]}
            onRowClick={() => {}}
          />
        </Section>

        <Section title="Phase 2 · AlphaScore (number-first; band rides the verdict ladder)">
          <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
            <AlphaScore score={82} />
            <AlphaScore score={58} />
            <AlphaScore score={43} />
            <AlphaScore score={17} />
            <AlphaScore score={null} />
          </div>
        </Section>

        <Section title="Phase 2 · ValuationPanel (verdict story + bear/base/bull rail)">
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", maxWidth: 880 }}>
            <Card>
              <ValuationPanel
                price={1712.4} fair={2020} verdict="ACCUMULATE" confidence="HIGH" mos={0.18}
                band={{ bear: 1490, base: 2020, bull: 2340 }}
              />
            </Card>
            <Card>
              <ValuationPanel
                price={452.1} fair={374} verdict="LOW CONF" confidence="LOW" mos={-0.21}
                band={null}
                footnote="Band withheld — inputs failed the integrity gate. No number beats a wrong number."
              />
            </Card>
          </div>
        </Section>

        <Section title="Phase 2 · FinancialsTable (emphasis rows · negatives in red)">
          <FinancialsTable
            years={["FY23", "FY24", "FY25"]}
            rows={[
              { label: "Revenue", values: [225458, 240893, 255324], emph: true },
              { label: "EBIT", values: [54873, 58312, 61505] },
              { label: "EBIT margin", values: [0.243, 0.242, 0.241], format: "pct" },
              { label: "Other income", values: [4212, -318, 3894] },
              { label: "PAT", values: [42303, 45908, 48553], emph: true },
              { label: "P/E (year-end)", values: [27.4, 29.1, 26.2], format: "x" },
            ]}
          />
        </Section>

        <Section title="Phase 2 · CompanyRow + Sparkline (screener/watchlist row)">
          <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 14 }}>
            <Sparkline data={SPARK_UP} width={140} height={40} ariaLabel="Ten-day trend, rising" />
            <Sparkline data={SPARK_DOWN} width={140} height={40} ariaLabel="Ten-day trend, falling" />
            <code style={{ fontFamily: font.mono, fontSize: 11, color: color.text3 }}>
              pure SVG · up=buy · down=avoid</code>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 720 }}>
            <CompanyRow ticker="HDFCBANK" name="HDFC Bank" sector="BANK"
              price={1712.4} delta={0.0112} verdict="ACCUMULATE" spark={SPARK_UP} onOpen={() => {}} />
            <CompanyRow ticker="VEDL" name="Vedanta" sector="METALS"
              price={452.1} delta={-0.0187} verdict="REDUCE" spark={SPARK_DOWN} onOpen={() => {}} />
            <CompanyRow ticker="TCS" name="Tata Consultancy Services" sector="IT"
              price={3418.6} delta={0.0039} verdict="HOLD" spark={SPARK_UP.map(v => 3300 + v / 4)} onOpen={() => {}} />
          </div>
        </Section>

        <Section title="Phase 3 · NumberTicker (motion explains the change — live prices tween)">
          <TickerDemo />
        </Section>

        <Section title="Later composites">
          <p style={{ fontSize: 12, color: color.text3 }}>
            CommandPalette (⌘K nav spine) and full PriceChart theming land with the
            screens pass — each with every state and a reduced-motion variant, or it
            doesn't ship.
          </p>
        </Section>
      </div>
    </div>
    </ToastProvider></TooltipProvider>
  );
}
