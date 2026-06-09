/* Logo.jsx — company logo via the backend proxy, with a graceful monogram
   fallback when no logo exists. */
import { useState } from "react";
import { C, sans } from "../lib/theme.js";

const API = import.meta.env.VITE_API_URL;

function monogram(name = "", ticker = "") {
  const src = (name || ticker || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "?";
  const b = parts.length > 1 ? parts[1][0] : "";
  return (a + b).toUpperCase();
}

export default function Logo({ ticker, name, size = 28, radius = 7 }) {
  const [failed, setFailed] = useState(false);
  const box = {
    width: size, height: size, borderRadius: radius, flexShrink: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden", background: C.bg800, border: `1px solid ${C.line}`,
  };
  if (failed || !API || !ticker) {
    return (
      <span style={{ ...box, ...sans, fontSize: size * 0.38, fontWeight: 600, color: C.gold, letterSpacing: "0.02em" }}>
        {monogram(name, ticker)}
      </span>
    );
  }
  return (
    <span style={box}>
      <img src={`${API}/api/logo/${encodeURIComponent(ticker)}`} alt=""
        width={size} height={size} loading="lazy" onError={() => setFailed(true)}
        style={{ width: size, height: size, objectFit: "contain" }} />
    </span>
  );
}
