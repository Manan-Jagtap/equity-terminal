/* BrandMark — the EquityVerdict "Breakout Verdict": a gold seal (rounded
   coin) whose verdict check PIERCES the frame — the judgment that doesn't
   stay inside the box. A distinct silhouette that survives 16px; replaces
   the v1 zigzag tick (which read as a generic trend arrow at small sizes).

   boxed=true renders the SOLID-coin treatment (knockout check) for app-icon
   and tile contexts where a filled shape carries better.

   ORIGINAL WORK: geometry authored in-repo for EquityVerdict — no third-party
   assets, fonts, or traced marks. For registered protection, file a trademark
   (IP India, Class 36/42) via an attorney before commercial launch. */
export default function BrandMark({ size = 20, boxed = false }) {
  if (boxed) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-label="EquityVerdict">
        <defs>
          <linearGradient id="evbrand-b" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#c9a86a" />
            <stop offset="1" stopColor="#e8b45a" />
          </linearGradient>
        </defs>
        <rect x="5" y="5" width="54" height="54" rx="16" fill="url(#evbrand-b)" />
        <path d="M 17 33 L 27 43 L 48 19" fill="none" stroke="#14110c"
          strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="EquityVerdict">
      <defs>
        <linearGradient id="evbrand" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#c9a86a" />
          <stop offset="1" stopColor="#e8b45a" />
        </linearGradient>
      </defs>
      <rect x="4" y="12" width="48" height="48" rx="14" fill="none"
        stroke="url(#evbrand)" strokeWidth="4.5" />
      <path d="M 15 37 L 25 47 L 56 8" fill="none" stroke="url(#evbrand)"
        strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
