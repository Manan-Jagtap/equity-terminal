/* IPOBoard.jsx — the IPO desk: tabbed pipeline (open/upcoming/closed/listed)
   with full detail per issue, from the licensed vendor feed.

   GMP is deliberately absent: grey-market premium is unregulated rumor data
   no licensed source publishes. The honest analogues shown instead are the
   subscription rate (real demand) and listing gains (realised outcome). */
import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { useIsMobile } from "../lib/useResponsive.js";
import { selStyle } from "../lib/listControls.jsx";
import PageHeader from "./ui/PageHeader.jsx";
import useResource from "../lib/useResource.js";
import ErrorState from "./ui/ErrorState.jsx";
import { buttonReset, useEscape } from "../lib/a11y.js";

const API = import.meta.env.VITE_API_URL;

const inr = v => (v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 }));
// reservation.* are SHARE COUNTS (shares reserved per category), not percentages —
// the old code appended "%" to the raw count (→ "54125280%"). Show them as shares.
const fmtShares = v => {
  if (v == null) return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  if (n >= 1e7) return (n / 1e7).toFixed(2) + " Cr sh";
  if (n >= 1e5) return (n / 1e5).toFixed(2) + " L sh";
  return n.toLocaleString("en-IN") + " sh";
};
const bandOf = r => (r.min_price != null && r.max_price != null ? `${inr(r.min_price)}–${inr(r.max_price)}` : inr(r.issue_price));
const dt = v => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v).slice(0, 10)
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
};
const minInvest = r => {
  const px = r.max_price ?? r.issue_price;
  return (r.lot_size && px) ? r.lot_size * px : null;
};

function Detail({ label, value, tone }) {
  if (value == null || value === "—") return null;
  return (
    <span style={{ ...sans, fontSize: 11, color: C.faint, whiteSpace: "nowrap" }}>
      {label} <span style={{ ...mono, color: tone || C.text200 }}>{value}</span>
    </span>
  );
}

function Card({ r, onOpen }) {
  const g = r.listing_gains;
  const clickable = !!r.detail_id;
  return (
    <button type="button" onClick={() => clickable && onOpen(r.detail_id)}
      onMouseEnter={e => { if (clickable) e.currentTarget.style.background = C.bg800; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      style={{ ...buttonReset,  padding: "13px 16px", borderTop: `1px solid ${C.line}`, cursor: clickable ? "pointer" : "default"  }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ ...sans, fontSize: 14, fontWeight: 500, color: C.text }}>{r.name}</span>
        {r.is_sme && <span style={{ ...sans, fontSize: 9, fontWeight: 700, color: "#E8B054",
          background: "#E8B0541a", borderRadius: 6, padding: "2px 6px" }}>SME</span>}
        <span style={{ ...mono, fontSize: 10, color: C.faint }}>{r.symbol || ""}</span>
        {r.industry && <span style={{ ...sans, fontSize: 10, color: C.dim }}>{r.industry}</span>}
        {r.nse_enabled && <span style={{ ...sans, fontSize: 9, color: C.gold, border: `1px solid ${C.gold}44`, borderRadius: 6, padding: "1px 5px" }}>NSE</span>}
        {r.bse_enabled && <span style={{ ...sans, fontSize: 9, color: "#8FB4D8", border: "1px solid #8FB4D844", borderRadius: 6, padding: "1px 5px" }}>BSE</span>}
        {r.document_url && (
          <a href={r.document_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            style={{ ...sans, fontSize: 11, color: C.gold, textDecoration: "none",
                     display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
            RHP <ExternalLink size={10} />
          </a>
        )}
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 6 }}>
        <Detail label="Band" value={bandOf(r)} tone={C.text} />
        <Detail label="Lot" value={r.lot_size} />
        <Detail label="Min invest" value={minInvest(r) != null ? inr(minInvest(r)) : null} />
        <Detail label="Bidding" value={`${dt(r.bidding_start_date)} → ${dt(r.bidding_end_date)}`} />
        <Detail label="Allotment" value={dt(r.allotment_date)} />
        <Detail label="Listing" value={dt(r.listing_date)} />
        {r.total_subscription_rate != null && (
          <Detail label="Subscribed" value={`${Number(r.total_subscription_rate).toFixed(1)}×`}
            tone={r.total_subscription_rate >= 1 ? C.green : "#E8B054"} />
        )}
        {r.listing_price != null && <Detail label="Listed at" value={inr(r.listing_price)} />}
        {g != null && (
          <Detail label="Listing gain" value={`${g >= 0 ? "+" : ""}${Number(g).toFixed(1)}%`}
            tone={g >= 0 ? C.green : C.red} />
        )}
      </div>
      {r.additional_text && (
        <div style={{ ...sans, fontSize: 11, color: C.dim, marginTop: 5 }}>{r.additional_text}</div>
      )}
    </button>
  );
}

const TABS = [
  ["open", "Open & closing"],
  ["upcoming", "Upcoming"],
  ["listed", "Recently listed"],
  ["all", "All"],
];

export default function IPOBoard() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("open");
  const [sme, setSme] = useState("all");   // all | mainboard | sme
  const [openId, setOpenId] = useState(null);

  /* The board fetched once on mount, with no r.ok check and no listener, then
     rendered "The IPO feed is unreachable right now — it retries automatically."
     Both halves of that sentence were false. The .catch never fired on an API
     4xx/5xx (the API answers errors with JSON, so r.json() resolves and the
     error envelope became `data`), and nothing retried — there was no interval,
     no reconnect handler, nothing.

     useResource fixes the sentence by making it true: it treats a status code
     as a failure, and it re-fetches when the browser comes back online or the
     tab becomes visible again while in the error state. ErrorState's "it retries
     by itself when the connection returns" is now a description of the code. */
  const { data, error, retry } = useResource(API ? `${API}/api/ipo` : null);

  /* Same hook for the per-issue detail: `openId` null ⇒ no request at all, and
     switching issues re-runs it because the URL changes. Previously a 500 here
     parsed into `ipoDetail`, `available` read undefined, and the modal said "No
     extra detail for this IPO yet" — the vendor blamed for our own outage. */
  const detailRes = useResource(
    (API && openId) ? `${API}/api/ipo/detail/${encodeURIComponent(openId)}` : null);

  const groups = useMemo(() => {
    const d = data || {};
    return {
      open: [...(d.active || []), ...(d.closed || [])],
      upcoming: d.upcoming || [],
      listed: d.listed || [],
      all: [...(d.active || []), ...(d.closed || []), ...(d.upcoming || []), ...(d.listed || [])],
    };
  }, [data]);

  const rows = useMemo(() => {
    let r = groups[tab] || [];
    if (sme === "mainboard") r = r.filter(x => !x.is_sme);
    if (sme === "sme") r = r.filter(x => x.is_sme);
    return [...r].sort((a, b) => (a.is_sme === b.is_sme ? 0 : a.is_sme ? 1 : -1));
  }, [groups, tab, sme]);

  // A failed request is not an empty pipeline.
  if (error) return (
    <div className="fadein" style={{ padding: isMobile ? "20px 14px 40px" : "24px 32px 48px", maxWidth: 1100 }}>
      <PageHeader title="IPOs">
        Live pipeline from the verified feed — bands, lots, minimum investment, bidding/allotment/listing dates,
        subscription demand and realised listing gains.
      </PageHeader>
      <ErrorState error={error} onRetry={retry} what="the IPO board" />
    </div>
  );

  if (!data) return (
    <div style={{ ...sans, padding: 48, color: C.dim, fontSize: 13 }}>Loading the IPO desk…</div>
  );

  return (
    <div className="fadein" style={{ padding: isMobile ? "20px 14px 40px" : "24px 32px 48px", maxWidth: 1100 }}>
      <PageHeader title="IPOs" meta={data.as_of ? `as of ${data.as_of}` : null}>
        Live pipeline from the verified feed — bands, lots, minimum investment, bidding/allotment/listing dates,
        subscription demand and realised listing gains. We don't publish GMP: grey-market premium is unregulated
        rumor with no accountable source; subscription and listing outcomes are what can be verified.
      </PageHeader>

      {/* Tabs + mainboard/SME filter */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            ...sans, fontSize: 12, padding: "6px 13px", borderRadius: 8, cursor: "pointer",
            border: `1px solid ${tab === id ? C.gold + "66" : C.line2}`,
            background: tab === id ? C.gold + "0d" : "transparent",
            color: tab === id ? C.gold : C.dim }}>
            {label} <span style={{ color: C.faint }}>{(groups[id] || []).length}</span>
          </button>
        ))}
        <select value={sme} onChange={e => setSme(e.target.value)} style={{ ...selStyle, marginLeft: "auto" }}
          title="Mainboard vs SME">
          <option value="all">All boards</option>
          <option value="mainboard">Mainboard</option>
          <option value="sme">SME</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div style={{ ...sans, fontSize: 13, color: C.dim, border: `1px solid ${C.line}`,
                      borderRadius: 12, padding: 32, textAlign: "center" }}>
          {/* available:false is a 200 (app/ipo_routes.py returns it when the
              upstream vendor gave the server nothing), so it is the server's own
              report and NOT the unreachable-feed case handled by ErrorState
              above. It also isn't retried by anything, which is why the old
              "it retries automatically" is gone rather than reworded. */}
          {data.available === false ? (
            <>
              The IPO feed returned no issues — that&apos;s the server&apos;s own report on the vendor
              pipeline, not a request that failed.{" "}
              <button type="button" onClick={retry}
                style={{ ...sans, fontSize: 13, color: C.gold, background: "transparent", border: "none",
                         padding: 0, cursor: "pointer", textDecoration: "underline" }}>
                Check again
              </button>
            </>
          ) : "Nothing in this tab right now."}
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, overflow: "hidden" }}>
          {rows.map((r, i) => <Card key={(r.symbol || r.name || "") + i} r={r} onOpen={setOpenId} />)}
        </div>
      )}
      {tab === "listed" && (
        <div style={{ ...sans, fontSize: 10.5, color: C.faint, marginTop: 10 }}>
          Mainboard graduates that clear the universe's size floor auto-join the terminal each month.
        </div>
      )}
      {openId && <IPODetailModal detail={detailRes} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function KV({ label, value }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderTop: `1px solid ${C.line}` }}>
      <span style={{ ...sans, fontSize: 12, color: C.dim }}>{label}</span>
      <span style={{ ...mono, fontSize: 12.5, color: C.text200, textAlign: "right" }}>{value}</span>
    </div>
  );
}

// `detail` is the whole useResource handle, not just its data: this modal needs
// the error and the retry too. (`res` is already spoken for below — it is the
// issue's share RESERVATION block.)
function IPODetailModal({ detail, onClose }) {
  const d = detail.data;
  const basic = d?.basic || {}, pricing = d?.pricing || {}, issue = d?.issue || {};
  const dates = d?.dates || {}, res = d?.reservation || {}, sub = d?.subscription || {};
  const reg = d?.registrar || {}, links = d?.links || {};
  const pr = pricing.priceRange || {};
  const bidding = dates.bidding || {};
  /* Escape closes it. The backdrop's onClick is a MOUSE affordance and the
     backdrop stays a div — a backdrop is not a control, and a button there
     would add a tab stop announcing nothing. Without this a keyboard user
     could open the overlay and had no way out: a keyboard trap. */
  useEscape(onClose);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "var(--ev-scrim)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, background: C.bg900,
        border: `1px solid ${C.line2}`, borderRadius: 14, padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
          <span style={{ ...serif, fontSize: 18, color: C.text, flex: 1 }}>{basic.name || "IPO detail"}</span>
          <button onClick={onClose} style={{ ...sans, fontSize: 12, color: C.dim, background: "transparent",
            border: `1px solid ${C.line2}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Close</button>
        </div>
        {/* The detail IS this modal's content, so a full ErrorState belongs here.
            It also keeps the two outcomes apart: `available === false` is a 200
            saying the vendor carries no filing breakdown for this issue, while
            `res.error` means we never got an answer we could read. */}
        {detail.error ? <ErrorState error={detail.error} onRetry={detail.retry} what="this issue's detail" />
          : !d ? <div style={{ ...sans, color: C.dim, fontSize: 13, padding: "20px 0" }}>Loading…</div>
          : d.available === false ? <div style={{ ...sans, color: C.dim, fontSize: 13, padding: "20px 0" }}>The feed carries no extra detail for this IPO.</div>
          : (
          <div>
            <KV label="Type" value={basic.type} />
            <KV label="Industry" value={basic.industry} />
            <KV label="Status" value={basic.status} />
            <KV label="Price range" value={pr.min != null && pr.max != null ? `₹${pr.min}–₹${pr.max}` : (pr.value || null)} />
            <KV label="Lot size" value={issue.lotSize || issue.lot_size} />
            <KV label="Issue size" value={issue.size || issue.totalSize || issue.issueSize} />
            <KV label="Bidding opens" value={bidding.start || bidding.open} />
            <KV label="Bidding closes" value={bidding.end || bidding.close} />
            <KV label="Allotment" value={(dates.allotment || {}).date || dates.allotment} />
            <KV label="Listing" value={(dates.listing || {}).date || dates.listing} />
            <KV label="Overall subscription" value={sub.overallFormatted || sub.overall} />
            <KV label="Retail reserved" value={fmtShares(res.retail)} />
            <KV label="NII reserved" value={fmtShares(res.nonInstitutional)} />
            <KV label="QIB reserved" value={fmtShares(res.qualifiedInstitutional)} />
            <KV label="Registrar" value={reg.name} />
            <KV label="Exchanges" value={[basic && d.exchanges?.nse && "NSE", d.exchanges?.bse && "BSE"].filter(Boolean).join(" · ") || null} />
            {(sub.daily || []).length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.dim, marginBottom: 6 }}>Day-by-day subscription</div>
                {sub.daily.map((day, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", ...mono, fontSize: 12, color: C.text200 }}>
                    <span style={{ color: C.dim }}>{day.date || `Day ${i + 1}`}</span>
                    <span>{day.subscriptionFormatted || day.subscription || day.times || "—"}</span>
                  </div>
                ))}
              </div>
            )}
            {(links.prospectus?.rhp || links.prospectus?.drhp) && (
              <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
                {links.prospectus.rhp && <a href={links.prospectus.rhp} target="_blank" rel="noopener noreferrer" style={{ ...sans, fontSize: 12, color: C.gold, display: "inline-flex", alignItems: "center", gap: 4 }}>RHP <ExternalLink size={11} /></a>}
                {links.prospectus.drhp && <a href={links.prospectus.drhp} target="_blank" rel="noopener noreferrer" style={{ ...sans, fontSize: 12, color: C.gold, display: "inline-flex", alignItems: "center", gap: 4 }}>DRHP <ExternalLink size={11} /></a>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
