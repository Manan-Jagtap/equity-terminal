/* Phase 1 primitive — Skeleton. Shimmer placeholder; the animation is disabled
   under prefers-reduced-motion in ui.css (static block remains). Marked
   aria-hidden — loading state should be announced by the region, not each bone. */
import "./ui.css";

export default function Skeleton({ width = "100%", height = 14, radius, style, className = "", ...rest }) {
  return (
    <div
      aria-hidden="true"
      className={`evc-skeleton${className ? " " + className : ""}`}
      style={{ width, height, ...(radius != null ? { borderRadius: radius } : {}), ...style }}
      {...rest}
    />
  );
}

/* n stacked text lines; last line is shorter — reads as a paragraph. */
export function SkeletonText({ lines = 3, gap = 8 }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "62%" : "100%"} />
      ))}
    </div>
  );
}
