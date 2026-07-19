/* UX-05 / #117 — server-side-rendered PUBLIC company page for SEO.
 *
 * A Vercel serverless function (auto-detected from /api). Crawlers and users
 * hitting https://equityverdict.com/stock/TCS get real server-rendered HTML with
 * proper <title>/meta/OG/canonical + JSON-LD, so the pages are indexable — the
 * hash-routed SPA never was.
 *
 * COMPLIANCE (registrations pending): this public page shows the company profile,
 * key data, and the model's fair-value RANGE + methodology with an unavoidable
 * "educational, not investment advice" disclaimer — but deliberately NOT a
 * standalone BUY/AVOID verdict or a single target price (those stay behind login,
 * so the public surface reads as an analytics tool, not published recommendations).
 */

const API = "https://api.equityverdict.com";

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const inr = (v) =>
  v == null || isNaN(v) ? "—"
    : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const prettySector = (s) =>
  !s ? "" : String(s).replace(/_/g, " ").replace(/\w\S*/g,
    (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

export default async function handler(req, res) {
  const raw = (req.query.ticker || "").toString().replace(/\.html?$/i, "");
  const ticker = raw.toUpperCase().replace(/[^A-Z0-9&-]/g, "");
  if (!ticker) {
    res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end("<!doctype html><meta charset=utf-8><title>Not found</title>Ticker not found.");
  }

  let co = null, rec = null;
  try {
    const r = await fetch(`${API}/api/companies/${encodeURIComponent(ticker)}`, {
      headers: { accept: "application/json" },
    });
    if (r.ok) {
      const d = await r.json();
      co = d.company || null;
      rec = d.recommendation || null;
    }
  } catch { /* fall through to the not-found page */ }

  const appUrl = `https://equityverdict.com/#/company/${encodeURIComponent(ticker)}`;
  const canonical = `https://equityverdict.com/stock/${encodeURIComponent(ticker)}`;

  if (!co) {
    res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=600");
    return res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ticker)} — not covered | EquityVerdict</title>
<meta name="robots" content="noindex"><link rel="canonical" href="https://equityverdict.com/">
</head><body style="font-family:system-ui;background:#060A13;color:#e8eefc;padding:40px;max-width:640px;margin:auto">
<p><strong>${esc(ticker)}</strong> isn't in our covered universe.</p>
<p><a style="color:#3EE6C1" href="https://equityverdict.com/">← EquityVerdict — Indian equity research</a></p>
</body></html>`);
  }

  const name = co.name || ticker;
  const sector = prettySector(co.sector);
  const price = co.price;
  const shares = co.shares;
  const mcap = price && shares ? price * shares : null;   // ₹ crore
  const iv = rec && rec.intrinsic;
  // A symmetric ±12% band around the model estimate — shown as a RANGE, never a
  // single "target", and never with the buy/sell label (that stays in-app).
  const lo = iv ? iv * 0.88 : null;
  const hi = iv ? iv * 1.12 : null;

  const title = `${name} (${ticker}) share price, valuation & fundamentals | EquityVerdict`;
  const desc = `${name} — ${sector ? sector + " · " : ""}independent DCF & residual-income fair-value range, key ratios and fundamentals. Educational research for Indian markets; not investment advice.`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "Corporation",
    name, tickerSymbol: ticker,
    ...(sector ? { industry: sector } : {}),
    url: canonical,
  };

  const row = (k, v) => `<div style="display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-top:1px solid #1a2740">
    <span style="color:#8aa0c6">${esc(k)}</span><span style="font-variant-numeric:tabular-nums">${v}</span></div>`;

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="EquityVerdict">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="https://equityverdict.com/icon-512.png">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#060A13;color:#e8eefc;margin:0}
  .wrap{max-width:720px;margin:0 auto;padding:32px 20px 64px}
  a{color:#3EE6C1;text-decoration:none} a:hover{text-decoration:underline}
  h1{font-size:26px;margin:6px 0 2px} .sub{color:#8aa0c6;font-size:14px;margin-bottom:22px}
  .card{background:#0d1526;border:1px solid #1a2740;border-radius:12px;padding:18px 20px;margin:16px 0}
  .cta{display:inline-block;background:#3EE6C1;color:#06231A;font-weight:600;padding:11px 18px;border-radius:9px;margin-top:8px}
  .disc{color:#6B7C9E;font-size:12px;line-height:1.6;margin-top:22px;border-top:1px solid #1a2740;padding-top:16px}
</style></head><body><div class="wrap">
  <div><a href="https://equityverdict.com/">EquityVerdict</a> · Independent equity research for Indian markets</div>
  <h1>${esc(name)} <span style="color:#8aa0c6;font-size:18px">(${esc(ticker)})</span></h1>
  <div class="sub">${sector ? esc(sector) + " · " : ""}NSE</div>

  <div class="card">
    ${row("Share price", inr(price))}
    ${row("Market capitalisation", mcap ? inr(mcap) + " cr" : "—")}
    ${co.pe != null ? row("P/E", Number(co.pe).toFixed(1) + "×") : ""}
    ${co.roe != null ? row("Return on equity", (Number(co.roe) * (Math.abs(co.roe) < 1 ? 100 : 1)).toFixed(1) + "%") : ""}
  </div>

  ${iv ? `<div class="card">
    <div style="color:#8aa0c6;font-size:13px;margin-bottom:6px">Independent model fair-value range</div>
    <div style="font-size:22px;font-weight:600">${inr(lo)} – ${inr(hi)}</div>
    <div style="color:#8aa0c6;font-size:12.5px;margin-top:8px">
      From a transparent two-stage DCF / residual-income model built on the company's own
      multi-year statements — not a broker target. The full workings, assumptions and the
      model's rating are in the app.</div>
  </div>` : ""}

  <a class="cta" href="${appUrl}">View the full analysis →</a>

  <p class="disc"><strong>Educational use only · Not investment advice · Not SEBI-registered advice.</strong>
  EquityVerdict is an independent research &amp; analytics tool. Figures are model estimates derived from
  publicly available data and may be delayed or imprecise; do your own diligence and consult a
  SEBI-registered adviser before investing. Nothing here is a recommendation to buy or sell any security.</p>
</div></body></html>`;

  res.status(200);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Cache at the edge for an hour; crawlers + repeat visitors hit the CDN, not
  // the API. The valuations only change on the daily recompute.
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.end(html);
}
