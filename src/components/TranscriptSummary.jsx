/* TranscriptSummary.jsx — on-demand RULES-BASED summary of the latest earnings
   call (no AI). Calls /transcript-summary, which assembles a research-note
   narrative deterministically from the transcript text — management tone,
   guidance, margins, capex, demand, risks, cited KPIs + a quarter-over-quarter
   tone shift. Renders the "unavailable" state honestly when no transcript text
   could be extracted (never a fabricated summary). */
import { useState } from "react";
import { AlertTriangle, FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";
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
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = () => {
    if (!API || busy) return;
    setBusy(true); setErr(null);
    fetch(`${API}/api/companies/${ticker}/transcript-summary`)
      .then(r => {
        /* The hand-written .catch below had honest copy and never ran: the
           route answers 4xx/5xx as JSON, so r.json() RESOLVED and the error
           envelope became `data`. With `available` undefined it fell to the
           unavailable branch and rendered `data.message` — printing whatever
           string the server's error body happened to carry as if it were our
           own explanation of a missing transcript. Failure is now tracked apart
           from the payload, so `data` only ever holds a 2xx body. */
        if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { kind: "status" });
        return r.json().catch(() => {
          throw Object.assign(new Error("unreadable"), { kind: "parse" });
        });
      })
      .then(d => { setData(d); setBusy(false); })
      .catch(e => { setErr({ kind: e.kind || "network" }); setBusy(false); });
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
            {busy ? <Loader2 size={13} className="spin" />
              : err ? <RefreshCw size={13} /> : <Sparkles size={13} />}
            {err ? "Try again" : "Summarize latest call"}
          </button>
        )}
      </div>
      {busy && !data && (
        <div style={{ ...sans, fontSize: 12, color: C.dim, marginTop: 10 }}>
          Fetching the transcript and summarizing — the first run can take ~20s.
        </div>
      )}
      {err && !busy && (
        /* A quiet line inside the card, not ui/ErrorState: this widget is one
           opt-in block on the company page, and the button above it is already
           the retry — nothing here should imply the page failed. The copy makes
           no claim about the transcript, because a failed request tells us
           nothing about whether one exists. */
        <div role="status" style={{ ...sans, fontSize: 12, color: C.dim, lineHeight: 1.6,
                                    marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
          <AlertTriangle size={12} color={C.gold} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>
            Couldn't fetch the summary — {err.kind === "status" ? "the data service refused the request"
              : err.kind === "parse" ? "the response came back unreadable"
              : "the request didn't get through"}. Nothing was learned about the transcript either way.
          </span>
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
