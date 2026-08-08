/* Skeleton loaders — perceived-speed layer.
 *
 * Views used to show a spinner + text while their data loaded; a skeleton that
 * mirrors the page's real shape reads as "already almost there" instead of
 * "waiting". Shimmer keyframes (`ev-shimmer`) live in index.html's global
 * <style> so inline-styled components can reference them.
 *
 * `label` keeps the old loading copy for screen readers / long waits — shown
 * small under the skeleton, so slow connections still see what's happening.
 */
import { C, sans } from "../lib/theme.js";

/* The highlight stop MUST be lighter than the two base stops or there is no
   shimmer — the animation still runs, it just has nothing to move.
   This bit me: replacing the retired Aurora navy #16223A with
   `var(--ev-bg-over)` looked like the right on-palette swap, but --ev-bg-over
   IS #1a1713, the exact value C.panel2 already resolves to, so the gradient
   became a flat colour and the skeleton silently stopped animating.
   C.bg700 is one step up the warm ramp: contrast 1.093 against the base,
   against 1.126 for the navy it replaces — same intensity, right hue. */
const sheen = {
  background: `linear-gradient(90deg, ${C.panel2} 25%, ${C.bg700} 50%, ${C.panel2} 75%)`,
  backgroundSize: "200% 100%",
  animation: "ev-shimmer 1.3s ease-in-out infinite",
  borderRadius: 8,
};

export const SkBar = ({ w = "100%", h = 14, r = 8, style }) => (
  <div style={{ ...sheen, width: w, height: h, borderRadius: r, ...style }} />
);

export const SkCard = ({ h = 92, style }) => (
  <div style={{ ...sheen, height: h, borderRadius: 12, border: `1px solid ${C.line}`, ...style }} />
);

/* Generic page skeleton: title, a stat-card strip, then table-ish rows. */
export default function PageSkeleton({ label = "Loading…", cards = 4, rows = 7 }) {
  return (
    <div style={{ padding: "24px 28px", maxWidth: 1400 }} aria-busy="true" aria-label={label}>
      <SkBar w={220} h={26} style={{ marginBottom: 20 }} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))`, gap: 14, marginBottom: 24 }}>
        {Array.from({ length: cards }).map((_, i) => <SkCard key={i} />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: 14, marginBottom: 12, alignItems: "center" }}>
          <SkBar w={34} h={34} r={17} style={{ flexShrink: 0 }} />
          <SkBar w={`${58 - (i % 3) * 9}%`} h={13} />
          <SkBar w="12%" h={13} />
          <SkBar w="9%" h={13} />
        </div>
      ))}
      <div style={{ ...sans, fontSize: 11, color: C.faint, marginTop: 18 }}>{label}</div>
    </div>
  );
}
