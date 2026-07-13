/* IPOBoard.jsx — the IPO desk: tabbed pipeline (open/upcoming/closed/listed)
   with full detail per issue, from the licensed vendor feed.

   GMP is deliberately absent: grey-market premium is unregulated rumor data
   no licensed source publishes. The honest analogues shown instead are the
   subscription rate (real demand) and listing gains (realised outcome). */
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Rocket } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import { useIsMobile } from "../lib/useResponsive.js";
import { selStyle } from "../lib/listControls.jsx";

const API = import.meta.env.VITE_API_URL;

const inr = v => (v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 }));
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

function Card({ r }) {
  const g = r.listing_gains;
  return (
    <div style={{ padding: "13px 16px", borderTop: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ ...sans, fontSize: 14, fontWeight: 500, color: C.text }}>{r.name}</span>
        {r.is_sme && <span style={{ ...sans, fontSize: 9, fontWeight: 700, color: "#E8B054",
          background: "#E8B0541a", borderRadius: 4, padding: "2px 6px" }}>SME</span>}
        <span style={{ ...mono, fontSize: 10, color: C.faint }}>{r.symbol || ""}</span>
        {r.industry && <span style={{ ...sans, fontSize: 10, color: C.dim }}>{r.industry}</span>}
        {r.nse_enabled && <span style={{ ...sans, fontSize: 9, color: C.gold, border: `1px solid ${C.gold}44`, borderRadius: 4, padding: "1px 5px" }}>NSE</span>}
        {r.bse_enabled && <span style={{ ...sans, fontSize: 9, color: "#8FB4D8", border: "1px solid #8FB4D844", borderRadius: 4, padding: "1px 5px" }}>BSE</span>}
        {r.document_url && (
          <a href={r.document_url} target="_blank" rel="noopener noreferrer"
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
    </div>
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
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("open");
  const [sme, setSme] = useState("all");   // all | mainboard | sme

  useEffect(() => {
    if (!API) return;
    let dead = false;
    fetch(`${API}/api/ipo`).then(r => r.json())
      .then(d => { if (!dead) setData(d); })
      .catch(() => { if (!dead) setData({ available: false }); });
    return () => { dead = true; };
  }, []);

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

  if (!data) return (
    <div style={{ ...sans, padding: 48, color: C.dim, fontSize: 13 }}>Loading the IPO desk…</div>
  );

  return (
    <div className="fadein" style={{ padding: isMobile ? "20px 14px 40px" : "24px 32px 48px", maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <Rocket size={20} color={C.gold} />
        <span style={{ ...serif, fontSize: 30, color: C.text }}>IPOs</span>
        {data.as_of && <span style={{ ...mono, fontSize: 11, color: C.faint }}>as of {data.as_of}</span>}
      </div>
      <div style={{ ...sans, fontSize: 12, color: C.faint, marginBottom: 16, lineHeight: 1.6, maxWidth: 760 }}>
        Live pipeline from the verified feed — bands, lots, minimum investment, bidding/allotment/listing dates,
        subscription demand and realised listing gains. We don't publish GMP: grey-market premium is unregulated
        rumor with no accountable source; subscription and listing outcomes are what can be verified.
      </div>

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
          {data.available === false
            ? "The IPO feed is unreachable right now — it retries automatically."
            : "Nothing in this tab right now."}
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, overflow: "hidden" }}>
          {rows.map((r, i) => <Card key={(r.symbol || r.name || "") + i} r={r} />)}
        </div>
      )}
      {tab === "listed" && (
        <div style={{ ...sans, fontSize: 10.5, color: C.faint, marginTop: 10 }}>
          Mainboard graduates that clear the universe's size floor auto-join the terminal each month.
        </div>
      )}
    </div>
  );
}
