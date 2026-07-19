/* BrandMark — the EquityVerdict "Verdict Tick": a rising price line whose
   final leg IS a checkmark (chart + judgment in one gesture). Replaces the
   generic lucide TrendingUp everywhere the BRAND (not a trend) is meant. */
export default function BrandMark({ size = 20, boxed = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="EquityVerdict">
      <defs>
        <linearGradient id="evbrand" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#c9a86a" />
          <stop offset="1" stopColor="#e8b45a" />
        </linearGradient>
      </defs>
      {boxed && <rect x="2" y="2" width="60" height="60" rx="14" fill="#12100d" />}
      <path d="M 12 44 L 24 31 L 30 37 L 52 14" fill="none"
        stroke="url(#evbrand)" strokeWidth="7"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="44" r="3.6" fill="#c9a86a" />
    </svg>
  );
}
