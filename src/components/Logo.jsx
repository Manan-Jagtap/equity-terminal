/* Logo.jsx — the company's REAL logo via the backend proxy (vendor CDN,
   cached server-side). Owner directive: original artwork or nothing — when a
   logo can't be fetched we render a quiet neutral tile, never invented
   monogram initials. */
import { useState } from "react";
import { C, sectorAccent } from "../lib/theme.js";

const API = import.meta.env.VITE_API_URL;

export default function Logo({ ticker, size = 28, radius = 7, sector }) {
  const [failed, setFailed] = useState(false);
  const box = {
    width: size, height: size, borderRadius: radius, flexShrink: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden", background: C.bg800, border: `1px solid ${C.line}`,
  };
  if (failed || !API || !ticker) {
    const accent = sectorAccent(sector);
    return (
      <span aria-hidden style={{ ...box }}>
        <span style={{ width: size * 0.28, height: size * 0.28, borderRadius: "50%",
                       background: accent + "40", display: "inline-block" }} />
      </span>
    );
  }
  return (
    <span style={box}>
      <img src={`${API}/api/logo/${encodeURIComponent(ticker)}`} alt=""
        width={size} height={size} loading="lazy" onError={() => setFailed(true)}
        style={{ width: size, height: size, objectFit: "contain", padding: 2, boxSizing: "border-box", background: "#fff" }} />
    </span>
  );
}
