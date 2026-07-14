/* Logo.jsx — the company's REAL logo via the backend proxy (vendor CDN, cached
   server-side). When no original artwork can be fetched, we fall back to a
   clean initials monogram on the company's sector-accent colour — so every row
   has a legible mark instead of a blank dot. (Supersedes the earlier
   artwork-or-nothing rule, at the owner's request.) */
import { useState } from "react";
import { C, sectorAccent, mono } from "../lib/theme.js";

const API = import.meta.env.VITE_API_URL;

const _STOP = new Set(["ltd", "limited", "ltd.", "the", "and", "co", "co.",
  "company", "corporation", "corp", "corp.", "inc", "industries", "india",
  "of", "plc", "pvt", "private", "services", "enterprises", "group"]);

/* 1–2 letter monogram from the company name (falling back to the ticker). */
function initials(name, ticker) {
  const words = (name || "").replace(/[^A-Za-z0-9 &]/g, " ").trim().split(/\s+/)
    .filter(w => w && !_STOP.has(w.toLowerCase()));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (ticker || "?").slice(0, 2).toUpperCase();
}

export default function Logo({ ticker, name, size = 28, radius = 7, sector }) {
  const [failed, setFailed] = useState(false);
  const box = {
    width: size, height: size, borderRadius: radius, flexShrink: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  };

  if (failed || !API || !ticker) {
    const accent = sectorAccent(sector);
    const mark = initials(name, ticker);
    return (
      <span aria-hidden title={name || ticker} style={{
        ...box, background: `linear-gradient(140deg, ${accent}2e, ${accent}14)`,
        border: `1px solid ${accent}3a`,
      }}>
        <span style={{
          ...mono, fontSize: size * (mark.length > 1 ? 0.38 : 0.46),
          fontWeight: 600, color: accent, letterSpacing: "0.02em",
        }}>{mark}</span>
      </span>
    );
  }

  return (
    <span style={{ ...box, background: C.bg800, border: `1px solid ${C.line}` }}>
      <img src={`${API}/api/logo/${encodeURIComponent(ticker)}`} alt=""
        width={size} height={size} loading="lazy" onError={() => setFailed(true)}
        style={{ width: size, height: size, objectFit: "contain", padding: 2, boxSizing: "border-box", background: "#fff" }} />
    </span>
  );
}
