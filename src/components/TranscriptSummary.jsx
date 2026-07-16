/* TranscriptSummary.jsx — on-demand RULES-BASED summary of the latest earnings
   call (no AI). Calls /transcript-summary, which assembles a research-note
   narrative deterministically from the transcript text — management tone,
   guidance, margins, capex, demand, risks, cited KPIs + a quarter-over-quarter
   tone shift. Renders the "unavailable" state honestly when no transcript text
   could be extracted (never a fabricated summary). */
import { useState } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";

function renderMd(text) {
  return (text || "").split("\n").map((line, i) => {
    if (line.startsWith("## "))
      return <div key={i} style={{ ...serif, fontSize: 15, color: C.gold, marginTop: 12, marginBottom: 4 }}>{line.slice(3)}</div>;
    if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
    return <div key={i} style={{ ...sans, fontSize: 13, color: C.text200, lineHeight: 1.65 }}>{line}</div>;
  });
}

export default function TranscriptSummary({ API, ticker }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = () => {
    if (!API || busy) return;
    setBusy(true);
    fetch(`${API}/api/companies/${ticker}/transcript-summary`)
      .then(r => r.json())
      .then(d => { setData(d); setBusy(false); })
      .catch(() => { setData({ available: false, message: "Could not reach the backend." }); setBusy(false); });
  };

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ ...sans, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim, display: "flex", alignItems: "center", gap: 6 }}>
          <FileText size={13} color={C.gold} /> Earnings-call summary
        </span>
        {!data && (
          <button onClick={run} disabled={busy} style={{
            ...sans, marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 500, padding: "7px 13px", borderRadius: 8,
            cursor: busy ? "wait" : "pointer", border: `1px solid ${C.gold}66`, color: C.gold, background: C.gold + "0d",
          }}>
            {busy ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />}
            Summarize latest call
          </button>
        )}
      </div>
      {busy && !data && (
        <div style={{ ...sans, fontSize: 12, color: C.dim, marginTop: 10 }}>
          Fetching the transcript and summarizing — the first run can take ~20s.
        </div>
      )}
      {data && data.available && (
        <div style={{ marginTop: 8 }}>
          <div style={{ ...mono, fontSize: 10, color: C.faint, marginBottom: 6 }}>
            {data.quarter || ""}{data.has_prior ? " · incl. quarter-over-quarter shift" : ""}{data.cached ? " · cached" : ""}
          </div>
          {renderMd(data.summary)}
          <div style={{ ...sans, fontSize: 10, color: C.faint, marginTop: 10 }}>
            Extracted deterministically from the transcript text (no AI) — verify against the source document.
          </div>
        </div>
      )}
      {data && !data.available && (
        <div style={{ ...sans, fontSize: 12, color: C.dim, marginTop: 10 }}>{data.message || "Transcript summary unavailable."}</div>
      )}
    </div>
  );
}
