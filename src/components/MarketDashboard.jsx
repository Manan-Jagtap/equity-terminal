/* MarketDashboard.jsx — live home screen.
   Index strip, top gainers/losers, most active, 52-week highs/lows.
   Pulls /api/market/snapshot (one round-trip, server-side cached). */

import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight, RefreshCw, ShieldCheck, ShieldAlert, ChevronDown } from "lucide-react";
import { C, mono, sans, serif } from "../lib/theme.js";
import PageSkeleton from "./Skeleton.jsx";
import { useIsMobile } from "../lib/useResponsive.js";
import { useLive, liveDotStyle } from "../lib/live.js";
import useResource from "../lib/useResource.js";
import ErrorState from "./ui/ErrorState.jsx";
import { buttonReset } from "../lib/a11y.js";

// Lazy: keeps recharts out of the eager dashboard bundle — the chart only
// loads the first time an index card is clicked.
const IndexChart = lazy(() => import("./IndexChart.jsx"));

const fmtN = (n, d = 2) => n == null || isNaN(n) ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtP = (n, d = 2) => n == null || isNaN(n) ? "—" : (n >= 0 ? "+" : "") + n.toFixed(d) + "%";
const toneOf = n => n == null ? C.dim : n >= 0 ? C.green : C.red;
const fmtVol = n => n == null ? "—" : n >= 1e7 ? (n / 1e7).toFixed(1) + " Cr" : n >= 1e5 ? (n / 1e5).toFixed(1) + " L" : Number(n).toLocaleString("en-IN");
// Most-active rows carry value_cr (₹ crore traded) — the meaningful "activity"
// measure. Show that; fall back to raw share volume for vendor rows without it.
const fmtActive = x => x?.value_cr != null
  ? "₹" + fmtN(x.value_cr, 0) + " Cr traded"
  : fmtVol(x?.volume) + " vol";
// Age of the live feed's last NEW tick — seconds stamped by the store on its
// own poll cadence (lib/live.js), so rendering it stays pure.
const fmtAge = s => s >= 3600 ? Math.floor(s / 3600) + "h" : s >= 60 ? Math.floor(s / 60) + "m" : Math.max(0, s | 0) + "s";

export default function MarketDashboard({ API, companies, onOpen }) {
  const isMobile = useIsMobile();
  const [idxChart, setIdxChart] = useState(null);   // index name whose chart is open
  const [activeEx, setActiveEx] = useState("NSE"); // NSE / BSE most-active toggle
  const liveFeed = useLive(API);

  /* useResource, not the old fetch(url).then(r => r.json()).catch(): there was
     no r.ok check, and the API answers errors with JSON (verified on prod —
     GET /api/definitely-not-a-route returns 404, content-type
     application/json, a {"detail":"Not Found"} body), so the promise RESOLVED
     on every 4xx/5xx and the .catch never ran. `data` became the error
     envelope, every list below read undefined off it, and the screen landed in
     the `empty` branch — which explains an empty market as "normal when the
     market is closed (weekends/holidays)". A backend outage was therefore
     reported to the user, on the home screen, as a quiet Sunday. */
  const { data: snap, error, loading, retry } = useResource(API ? `${API}/api/market/snapshot` : null);

  // Tickers in our universe → clickable through to the company page.
  const known = useMemo(() => new Set((companies || []).map(c => (c.ticker || "").toUpperCase())), [companies]);

  const PAD = isMobile ? 16 : 32;

  /* Skeleton on EVERY load, including a manual Refresh — the old guard was
     `loading && !data`, which kept the previous snapshot up while a refresh ran.
     That is not portable to useResource, which clears `data` for the duration of
     a re-fetch, and the naive port is worse than the flash it avoids: rendering
     with `data` null puts empty lists on screen under the "normal when the
     market is closed" copy, i.e. it reports a refresh in progress as a closed
     market. A skeleton says "loading" and nothing else. */
  if (loading) return (
    <PageSkeleton label="Loading market…" cards={6} rows={8} />
  );

  /* A failed REQUEST is not a closed market, and this branch handles it —
     ErrorState's promise that it retries on reconnect is backed by useResource's
     online/visibility listeners.

     What this branch does NOT catch is a failed UPSTREAM. The backend answers
     200 with empty lists when the vendor call fails, so that case renders as an
     empty panel, not an error. The empty-state copy no longer guesses at a
     cause for it — see Empty below. */
  if (error) return (
    <div style={{ padding: `22px ${PAD}px 60px` }}>
      <h1 style={{ ...serif, fontSize: isMobile ? 26 : 32, color: C.text, margin: "0 0 18px", fontWeight: 400 }}>Market Overview</h1>
      <ErrorState error={error} onRetry={retry} what="the market snapshot" />
    </div>
  );

  const indices = snap?.indices || [];
  const commodities = snap?.commodities || [];
  const gainers = snap?.movers?.gainers || [];
  const losers  = snap?.movers?.losers || [];
  const active  = snap?.active || [];
  const bseActive = snap?.bse_active || [];
  const highs   = snap?.high_low?.highs || [];
  const lows    = snap?.high_low?.lows || [];
  const empty = indices.length === 0 && gainers.length === 0 && active.length === 0;

  const openIf = ticker => { const t = (ticker || "").toUpperCase(); if (known.has(t)) onOpen(t); };

  return (
    <div style={{ padding: `22px ${PAD}px 60px` }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <h1 style={{ ...serif, fontSize: isMobile ? 26 : 32, color: C.text, margin: 0, fontWeight: 400 }}>Market Overview</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {liveFeed.live
            ? <span style={{ ...mono, fontSize: 11, color: C.green, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="blink" style={liveDotStyle(C.green)} />LIVE · {liveFeed.as_of}
              </span>
            /* A dead feed used to keep this badge pulsing green over frozen
               prices: `live` was only ever the server's claim from the last
               payload we managed to receive, and nothing ever retired it. The
               store (lib/live.js) now drops `live` and sets `stale` once no NEW
               tick has arrived for STALE_AFTER_MS, stamping the age on its own
               poll cadence — so this stays pure (no Date.now() at render) and
               the badge turns amber, stops blinking, and says how old the last
               tick is instead of claiming LIVE. */
            : liveFeed.stale
            ? <span style={{ ...mono, fontSize: 11, color: C.gold, display: "inline-flex", alignItems: "center", gap: 6 }}
                    title={`No new prices for ${fmtAge(liveFeed.stale_s)} — the live feed may be down. Prices shown are the last received (${liveFeed.as_of}).`}>
                <span style={liveDotStyle(C.gold)} />STALE {fmtAge(liveFeed.stale_s)} · {liveFeed.as_of}
              </span>
            /* Deliberately no client-side "N hours old" for the SNAPSHOT here.
               Computing it needs Date.now() at render, which is impure
               (react-hooks/purity), and moving it to an effect trips
               set-state-in-effect. (The live-feed age above is different: the
               store stamps it off the render path.) The snapshot age belongs on
               the server anyway — the backend knows when it actually fetched
               versus when it served cache, which the client can only guess at.
               Follow-up: return as_of_age_min from /api/market/snapshot. */
            : snap?.as_of && <span style={{ ...mono, fontSize: 11, color: C.dim }}>as of {snap.as_of}</span>}
          {/* No spin-while-loading class any more: the skeleton above returns
              before this button renders, so `loading` is provably false here and
              a conditional class would be dead code claiming otherwise. */}
          <button onClick={retry} title="Refresh"
            style={{ ...sans, display: "flex", alignItems: "center", gap: 6, background: C.bg800, border: `1px solid ${C.line}`, color: C.dim, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {empty && (
        <div style={{ ...sans, fontSize: 13, color: C.dim, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginBottom: 18 }}>
          Live market lists are empty right now — this is normal when the market is closed (weekends/holidays). Index levels below reflect the last session.
        </div>
      )}

      <DataHealth API={API} onOpen={openIf} />

      {/* Index strip — click a card for the index's full-history chart */}
      {indices.length > 0 && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, marginBottom: 22 }}>
          {indices.map((ix, i) => (
            <button type="button" key={i} onClick={() => ix.name && setIdxChart(ix.name)}
              title={`${ix.name} — open chart`}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold + "66"; e.currentTarget.style.background = C.bg800; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.background = C.bg900; }}
              style={{ ...buttonReset,  flex: "0 0 auto", minWidth: 150, border: `1px solid ${C.line}`, borderRadius: 10,
                       background: C.bg900, padding: "12px 14px", cursor: "pointer"  }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ ...sans, fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{ix.name}</span>
                {ix.exchange === "BSE" && (
                  <span style={{ ...mono, fontSize: 8, color: C.faint, border: `1px solid ${C.line2}`,
                                 borderRadius: 6, padding: "0 4px", letterSpacing: "0.03em" }}>BSE</span>
                )}
              </div>
              <div style={{ ...mono, fontSize: 18, color: C.text, marginTop: 4 }}>{fmtN(liveFeed.indices?.[ix.name] ?? ix.price)}</div>
              {(ix.pct != null || ix.net != null)
                ? <div style={{ ...mono, fontSize: 12, color: toneOf(ix.pct), marginTop: 2 }}>{fmtP(ix.pct)} <span style={{ color: C.faint }}>·</span> {ix.net >= 0 ? "+" : ""}{fmtN(ix.net)}</div>
                : <div style={{ ...sans, fontSize: 10.5, color: C.faint, marginTop: 3 }}>tap for full history</div>}
            </button>
          ))}
        </div>
      )}

      {commodities.length > 0 && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center",
                      padding: "8px 2px 4px", marginBottom: 16 }}>
          <span style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.faint }}>MCX</span>
          {commodities.map(c => (
            <span key={c.name} style={{ ...mono, fontSize: 12, color: C.dim, whiteSpace: "nowrap" }}>
              {c.name} <span style={{ color: C.text200 }}>{fmtN(c.price)}</span>
              {c.pct != null && <span style={{ color: toneOf(c.pct), marginLeft: 5 }}>{fmtP(c.pct)}</span>}
            </span>
          ))}
        </div>
      )}

      {idxChart && (
        <Suspense fallback={null}>
          <IndexChart API={API} name={idxChart} onClose={() => setIdxChart(null)} />
        </Suspense>
      )}

      {/* Movers */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <MoverList title="Top Gainers" icon={TrendingUp} tone={C.green} rows={gainers} openIf={openIf} known={known} />
        <MoverList title="Top Losers"  icon={TrendingDown} tone={C.red} rows={losers} openIf={openIf} known={known} />
      </div>

      {/* Most active + 52w */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card title={`Most Active (${activeEx})`} icon={Activity}
          action={
            <div style={{ display: "flex", gap: 4 }}>
              {["NSE", "BSE"].map(ex => (
                <button key={ex} onClick={() => setActiveEx(ex)} style={{
                  ...sans, fontSize: 10, padding: "3px 9px", borderRadius: 6, cursor: "pointer",
                  border: `1px solid ${activeEx === ex ? C.gold + "66" : C.line2}`,
                  background: activeEx === ex ? C.gold + "0d" : "transparent",
                  color: activeEx === ex ? C.gold : C.dim }}>{ex}</button>
              ))}
            </div>
          }>
          {(() => {
            const list = activeEx === "NSE" ? active : bseActive;
            return list.length ? list.map((x, i) => (
              <Row key={i} clickable={known.has((x.ticker || "").toUpperCase())} onClick={() => openIf(x.ticker)}
                left={x.name} sub={fmtActive(x)} right={fmtN(x.price)} rightTone={C.text} pct={x.pct} />
            )) : <Empty what="movers" />;
          })()}
        </Card>
        <Card title="52-Week Highs / Lows (NSE)" icon={ArrowUpRight}>
          {highs.length || lows.length ? (
            <>
              {highs.slice(0, 5).map((x, i) => (
                <Row key={"h" + i} clickable={known.has((x.ticker || "").toUpperCase())} onClick={() => openIf(x.ticker)}
                  left={x.name} sub="52w high" right={fmtN(x.price)} rightTone={C.green} icon={<ArrowUpRight size={13} color={C.green} />} />
              ))}
              {lows.slice(0, 3).map((x, i) => (
                <Row key={"l" + i} clickable={known.has((x.ticker || "").toUpperCase())} onClick={() => openIf(x.ticker)}
                  left={x.name} sub="52w low" right={fmtN(x.price)} rightTone={C.red} icon={<ArrowDownRight size={13} color={C.red} />} />
              ))}
            </>
          ) : <Empty what="names" />}
        </Card>
      </div>
    </div>
  );
}

/* Second-source data health (Dhan vs IndianAPI cross-check). Silent when clean —
   a one-line all-clear. Flagged names expand into a clickable list, so a stale
   or divergent price is never something the user finds out about the hard way. */
function DataHealth({ API, onOpen }) {
  const [health, setHealth] = useState(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [expand, setExpand] = useState(false);

  useEffect(() => {
    if (!API) return;
    let live = true;
    fetch(`${API}/api/quality/cross-check`)
      .then(r => {
        /* The r.ok check the old code did not have. A 404/5xx answers with a
           JSON envelope, so r.json() resolved, `health` became {"detail": …},
           health.count read undefined, and the strip returned null — the user
           could not tell "both price sources agree" from "we never checked".
           A status code is a failure, not a payload. */
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { if (live) { setHealth(d); setFailed(false); } })
      .catch(() => { if (live) { setHealth(null); setFailed(true); } });
    return () => { live = false; };
  }, [API, nonce]);

  /* A one-line strip above the dashboard, not the dashboard — ui/ErrorState is
     a full-width dashed panel with a headline and would shout louder than the
     health signal it stands in for. But rendering nothing (the old behaviour)
     reads as "nothing to report", and this widget's whole job is to say
     whether the two price feeds agree. So: same strip, one honest line. */
  if (failed) return (
    <div role="status" style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: C.bg900, padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <ShieldAlert size={14} color={C.faint} strokeWidth={1.7} aria-hidden="true" />
      <span style={{ ...sans, fontSize: 12, color: C.dim }}>
        Price cross-check unavailable — the data-quality service didn't answer. Treat this as unknown, not as an all-clear.
      </span>
      <button type="button" onClick={() => setNonce(n => n + 1)}
        style={{ ...sans, fontSize: 11.5, color: C.gold, background: "transparent", border: "none",
                 padding: 0, cursor: "pointer", textDecoration: "underline", marginLeft: "auto" }}>
        Check again
      </button>
    </div>
  );

  if (!health || !health.count) return null;
  // An expired price-feed token outranks everything: it's the one cause that
  // makes ALL other flags bloom, and the one fix that clears them.
  if (health.feed?.token_expired) {
    return (
      <div style={{ border: `1px solid ${C.red}55`, borderRadius: 10, background: C.red + "10", padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
        <ShieldAlert size={14} color={C.red} strokeWidth={1.7} />
        <span style={{ ...sans, fontSize: 12, color: C.text200 }}>
          Price-feed access token expired {health.feed.token_expires_utc?.slice(0, 10)} — daily history, live prices and options are paused until it's renewed. Valuations continue on last verified data.
        </span>
      </div>
    );
  }
  const flagged = health.flagged || [];
  const clean = flagged.length === 0;
  const tone = clean ? C.green : health.alerts > 0 ? C.red : C.gold;
  const Icon = clean ? ShieldCheck : ShieldAlert;

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: C.bg900, padding: "10px 14px", marginBottom: 18 }}>
      <button type="button" onClick={() => !clean && setExpand(e => !e)}
        /* full width or the `marginLeft:auto` below has no space to push into */
        style={{ ...buttonReset, width: "100%", boxSizing: "border-box",
                 display: "flex", alignItems: "center", gap: 8,
                 cursor: clean ? "default" : "pointer" }}>
        <Icon size={14} color={tone} strokeWidth={1.7} />
        <span style={{ ...sans, fontSize: 12, color: C.text200 }}>
          {clean
            ? `Data health: both price sources agree on all ${health.count} names`
            : `Data health: ${health.alerts} alert${health.alerts === 1 ? "" : "s"}, ${health.warnings} warning${health.warnings === 1 ? "" : "s"} across ${health.count} names`}
        </span>
        <span style={{ ...mono, fontSize: 10, color: C.faint, marginLeft: "auto" }}>Dhan × IndianAPI</span>
        {!clean && <ChevronDown size={13} color={C.dim} style={{ transform: expand ? "rotate(180deg)" : "none", transition: "transform .15s" }} />}
      </button>
      {expand && flagged.length > 0 && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
          {flagged.slice(0, 12).map((f, i) => (
            <button type="button" key={i} onClick={() => onOpen(f.ticker)}
              style={{ ...buttonReset, width: "100%", boxSizing: "border-box",
                       display: "flex", alignItems: "baseline", gap: 10,
                       padding: "4px 2px", cursor: "pointer" }}>
              <span style={{ ...mono, fontSize: 11.5, color: f.status === "alert" ? C.red : C.gold, minWidth: 90 }}>{f.ticker}</span>
              <span style={{ ...sans, fontSize: 11.5, color: C.dim }}>{(f.flags || []).map(x => x.message).join(" · ")}</span>
            </button>
          ))}
          {flagged.length > 12 && (
            <div style={{ ...sans, fontSize: 11, color: C.faint, padding: "4px 2px" }}>+{flagged.length - 12} more</div>
          )}
        </div>
      )}
    </div>
  );
}

const Card = ({ title, icon: Icon, children, action }) => (
  <section style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.bg900, overflow: "hidden" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${C.line}`, background: C.bg800 }}>
      {Icon && <Icon size={14} color={C.gold} strokeWidth={1.6} />}
      <span style={{ ...sans, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text200, fontWeight: 600 }}>{title}</span>
      {action && <span style={{ marginLeft: "auto" }}>{action}</span>}
    </header>
    <div style={{ padding: "6px 0" }}>{children}</div>
  </section>
);

const MoverList = ({ title, icon, tone, rows, openIf, known }) => (
  <Card title={title} icon={icon}>
    {rows.length ? rows.map((x, i) => (
      <Row key={i} clickable={known.has((x.ticker || "").toUpperCase())} onClick={() => openIf(x.ticker)}
        left={x.name} sub={x.rating} right={fmtN(x.price)} rightTone={C.text} pct={x.pct} />
    )) : <Empty what="names" />}
  </Card>
);

const Row = ({ left, sub, right, rightTone, pct, icon, clickable, onClick }) => (
  <button type="button" onClick={clickable ? onClick : undefined}
    /* width:100% because a <button> SHRINKS TO ITS CONTENT — unlike the <div>
       this used to be. Without it `flex:1` on the name divides a box only as
       wide as the text, so the price and % sat immediately after each name at a
       different x for every row instead of forming one right-hand column. */
    style={{ ...buttonReset, width: "100%", boxSizing: "border-box",
             display: "flex", alignItems: "center", gap: 10, padding: "8px 16px",
             cursor: clickable ? "pointer" : "default" }}
    onMouseEnter={e => clickable && (e.currentTarget.style.background = C.bg800)}
    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
    {icon}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ ...sans, fontSize: 13, color: clickable ? C.text : C.text200, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{left}</div>
      {sub && <div style={{ ...sans, fontSize: 10.5, color: C.dim }}>{sub}</div>}
    </div>
    <div style={{ textAlign: "right" }}>
      <div style={{ ...mono, fontSize: 13, color: rightTone || C.text }}>{right}</div>
      {pct != null && <div style={{ ...mono, fontSize: 11, color: toneOf(pct) }}>{fmtP(pct)}</div>}
    </div>
  </button>
);

/* This used to read "No data right now (market may be closed)." The comment
   above the error branch argued that routing failures elsewhere left this copy
   "attached to the one case where it is actually true". That reasoning has a
   hole, and it cost a day.

   The upstream feed failing does NOT reach the error branch. market_routes._get
   returns None on upstream failure, clean(None) yields [], and the route answers
   200 with {"gainers": [], "losers": []}. A dead feed and a closed market are
   byte-identical at this boundary — so the copy asserted a cause it had no way
   to check, and on 14 Aug 2026 a credential outage rendered for hours as a
   normal quiet evening across gainers, losers and 52-week highs. The panels
   were the only honest surfaces on the page and they were saying the wrong
   thing.

   State what is known — the list came back empty — and let the staleness note
   in the header carry the "how old is this" question, which is answerable. */
const Empty = ({ what = "data" }) => (
  <div style={{ ...sans, fontSize: 12, color: C.dim, padding: "14px 16px" }}>
    No {what} in the latest snapshot.
  </div>
);
