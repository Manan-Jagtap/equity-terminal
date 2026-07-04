/* brokerImport.js — parse broker holdings exports into portfolio rows.

   Handles Zerodha Console ("Symbol", "Quantity Available", "Average Price"),
   Groww ("Stock Name"/"Symbol", "Quantity", "Average buying price"), Upstox /
   INDmoney and any reasonable CSV that has a symbol, a quantity and an average
   cost column. Header names are matched fuzzily; preamble/title rows above the
   header are skipped; quoted commas are handled. Pure functions — no DOM. */

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; }
        else inQ = false;
      } else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const SYM_COLS = ["symbol", "tradingsymbol", "ticker", "scrip", "instrument",
                  "stock symbol", "stock name", "name of the instrument"];
const QTY_COLS = ["quantity available", "total quantity", "quantity", "qty", "shares", "units"];
const AVG_COLS = ["average price", "avg price", "avg. price", "average buying price",
                  "avg cost", "average cost", "buy average", "buy avg price",
                  "purchase price", "avg. cost price"];

const norm = s => (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");

function findCol(headers, candidates) {
  const h = headers.map(norm);
  for (const c of candidates) {                       // exact name wins
    const i = h.indexOf(c);
    if (i !== -1) return i;
  }
  for (const c of candidates) {                       // then substring
    const i = h.findIndex(x => x.includes(c));
    if (i !== -1) return i;
  }
  return -1;
}

export function normalizeTicker(raw) {
  let t = (raw || "").toString().trim().toUpperCase();
  t = t.replace(/^(NSE|BSE):\s*/, "");
  t = t.replace(/-(EQ|BE|BZ|SM|ST)$/, "");            // series suffixes
  return t;
}

const toNum = v => {
  const n = parseFloat((v || "").toString().replace(/[",₹\s]/g, ""));
  return isFinite(n) ? n : null;
};

/* → { holdings: [{ticker, qty, avg_cost}], skipped: [rawSymbol…], error } */
export function parseHoldings(text) {
  const rows = parseCsv(text).filter(r => r.some(c => c && c.trim() !== ""));
  // The header may sit below preamble/title lines — scan the first rows for
  // one that yields both a symbol and a quantity column.
  for (let h = 0; h < Math.min(rows.length, 12); h++) {
    const si = findCol(rows[h], SYM_COLS);
    const qi = findCol(rows[h], QTY_COLS);
    const ai = findCol(rows[h], AVG_COLS);
    if (si === -1 || qi === -1) continue;
    const holdings = [], skipped = [];
    for (const r of rows.slice(h + 1)) {
      const ticker = normalizeTicker(r[si]);
      const qty = toNum(r[qi]);
      const avg = ai !== -1 ? toNum(r[ai]) : null;
      if (!ticker || !/^[A-Z0-9&-]{1,24}$/.test(ticker)) { if (r[si]) skipped.push(r[si]); continue; }
      if (!qty || qty <= 0 || avg == null || avg <= 0) { skipped.push(ticker); continue; }
      holdings.push({ ticker, qty, avg_cost: avg });
    }
    return { holdings, skipped, error: null };
  }
  return { holdings: [], skipped: [],
           error: "No symbol/quantity columns found — export the holdings CSV from your broker (e.g. Zerodha Console → Holdings → Download)." };
}
