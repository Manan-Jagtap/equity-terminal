/* UX-05 / #117 — dynamic sitemap listing every covered company's public SEO page,
 * plus the landing page. Served at /sitemap.xml via a vercel.json rewrite. */

const API = "https://equityverdict.com";

export default async function handler(req, res) {
  let tickers = [];
  try {
    const r = await fetch("https://api.equityverdict.com/api/companies", {
      headers: { accept: "application/json" },
    });
    if (r.ok) {
      const d = await r.json();
      const rows = Array.isArray(d) ? d : (d.companies || []);
      tickers = rows
        .map((c) => (c.ticker || "").toString().toUpperCase())
        .filter((t) => /^[A-Z0-9&-]+$/.test(t));
    }
  } catch { /* fall back to just the landing page */ }

  const urls = [
    `<url><loc>${API}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...tickers.map(
      (t) =>
        `<url><loc>${API}/stock/${encodeURIComponent(t)}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  res.status(200);
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=86400");
  return res.end(xml);
}
