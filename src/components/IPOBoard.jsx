/* IPOBoard.jsx — the IPO desk: open/closing issues, the upcoming pipeline and
   recent listings with realised gains, from the licensed vendor feed.

   GMP is deliberately absent: grey-market premium is unregulated rumor data
   no licensed source publishes. The honest analogues shown instead are the
   subscription rate (real demand) and listing gains (realised outcome). */
import { useEffect, useState } from "react";
import { ExternalLink, Rocket } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { useIsMobile } from "../lib/useResponsive.js";

const API = import.meta.env.VITE_API_URL;

const inr = v => (v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 }));
const band = r => (r.min_price != null && r.max_price != null ? `${inr(r.min_price)}–${inr(r.max_price)}` : inr(r.issue_price));
const dt = v => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v).slice(0, 10)
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

function Row({ r, isMobile }) {
  const g = r.listing_gains;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap",
                  padding: "12px 16px", borderTop: `1px solid ${C.line}` }}>
      <div style={{ minWidth: isMobile ? "100%" : 230 }}>
        <span style={{ ...sans, fontSize: 13.5, fontWeight: 500, color: C.text }}>{r.name}</span>
        {r.is_sme && <span style={{ ...sans, fontSize: 9, fontWeight: 700, color: "#E8B054",
          background: "#E8B0541a", borderRadius: 4, padding: "2px 6px", marginLeft: 8 }}>SME</span>}
        <div style={{ ...mono, fontSize: 10, color: C.faint }}>{r.symbol || ""}</div>
      </div>
      <span style={{ ...mono, fontSize: 12, color: C.text200 }} title="Price band / issue price">{band(r)}</span>
      {r.lot_size != null && <span style={{ ...mono, fontSize: 11, color: C.dim }} title="Lot size">lot {r.lot_size}</span>}
      <span style={{ ...mono, fontSize: 11, color: C.dim }} title="Bidding window">
        {dt(r.bidding_start_date)} → {dt(r.bidding_end_date)}
      </span>
      {r.total_subscription_rate != null && (
        <span style={{ ...mono, fontSize: 11.5, color: r.total_subscription_rate >= 1 ? C.green : "#E8B054" }}
          title="Total subscription (× the offer)">{Number(r.total_subscription_rate).toFixed(1)}× subscribed</span>
      )}
      {r.listing_price != null && (
        <span style={{ ...mono, fontSize: 11.5, color: C.text200 }} title="Listing price">listed {inr(r.listing_price)}</span>
      )}
      {g != null && (
        <span style={{ ...mono, fontSize: 11.5, fontWeight: 600, color: g >= 0 ? C.green : C.red }}
          title="Gain vs issue price on listing">{g >= 0 ? "+" : ""}{Number(g).toFixed(1)}%</span>
      )}
      {r.additional_text && <span style={{ ...sans, fontSize: 11, color: C.dim }}>{r.additional_text}</span>}
      {r.document_url && (
        <a href={r.document_url} target="_blank" rel="noopener noreferrer"
          style={{ ...sans, fontSize: 11, color: C.gold, textDecoration: "none",
                   display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
          RHP <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}

function Section({ title, rows, note, isMobile }) {
  if (!rows?.length) return null;
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel,
                  overflow: "hidden", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "14px 16px 10px" }}>
        <span style={{ ...serif, fontSize: 18, color: C.text }}>{title}</span>
        <span style={{ ...mono, fontSize: 11, color: C.faint }}>{rows.length}</span>
        {note && <span style={{ ...sans, fontSize: 11, color: C.dim }}>{note}</span>}
      </div>
      {rows.map((r, i) => <Row key={(r.symbol || r.name || "") + i} r={r} isMobile={isMobile} />)}
    </div>
  );
}

export default function IPOBoard() {
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!API) return;
    let dead = false;
    fetch(`${API}/api/ipo`).then(r => r.json())
      .then(d => { if (!dead) setData(d); })
      .catch(() => { if (!dead) setData({ available: false }); });
    return () => { dead = true; };
  }, []);

  if (!data) return (
    <div style={{ ...sans, padding: 48, color: C.dim, fontSize: 13 }}>Loading the IPO desk…</div>
  );

  const mainboardFirst = rows => [...(rows || [])].sort((a, b) => (a.is_sme === b.is_sme ? 0 : a.is_sme ? 1 : -1));

  return (
    <div className="fadein" style={{ padding: isMobile ? "20px 14px 40px" : "24px 32px 48px", maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <Rocket size={20} color={C.gold} />
        <span style={{ ...serif, fontSize: 30, color: C.text }}>IPOs</span>
        {data.as_of && <span style={{ ...mono, fontSize: 11, color: C.faint }}>as of {data.as_of}</span>}
      </div>
      <div style={{ ...sans, fontSize: 12, color: C.faint, marginBottom: 20, lineHeight: 1.6, maxWidth: 760 }}>
        Live pipeline from the verified feed — bands, lots, bidding windows, subscription demand and realised
        listing gains. We don't publish GMP: grey-market premium is unregulated rumor data with no accountable
        source; subscription and listing outcomes are the numbers that can be verified.
      </div>

      <Section title="Open & closing" isMobile={isMobile}
        rows={mainboardFirst([...(data.active || []), ...(data.closed || [])])}
        note="bidding live or awaiting listing" />
      <Section title="Upcoming" isMobile={isMobile} rows={mainboardFirst(data.upcoming)}
        note="announced pipeline" />
      <Section title="Recently listed" isMobile={isMobile} rows={mainboardFirst(data.listed)}
        note="mainboard graduates that clear our size floor join the universe automatically each month" />

      {!data.available && !(data.upcoming || []).length && (
        <div style={{ ...sans, fontSize: 13, color: C.dim, border: `1px solid ${C.line}`,
                      borderRadius: 12, padding: 32, textAlign: "center" }}>
          The IPO feed is unreachable right now — it retries automatically.
        </div>
      )}
    </div>
  );
}
