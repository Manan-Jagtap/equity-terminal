/* brokerImport.js — parse broker holdings exports into portfolio rows.

   Handles Zerodha Console ("Symbol", "Quantity Available", "Average Price"),
   Groww ("Stock Name"/"Symbol", "Quantity", "Average buying price"), Upstox /
   INDmoney and any reasonable CSV that has a symbol, a quantity and an average
   cost column. Header names are matched fuzzily; preamble/title rows above the
   header are skipped; quoted commas are handled. Also accepts PASTED text —
   tab-separated tables copied from a broker page or spreadsheet, and bare
   "SYMBOL qty avg" lines — so no file upload is ever required.
   Pure functions — no DOM. */

export function parseCsv(text, delim = ",") {
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
    else if (ch === delim) { row.push(cell); cell = ""; }
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
  // Pasted tables (broker page, Excel) arrive tab-separated; files are CSV.
  const delim = ((text.match(/\t/g) || []).length > (text.match(/,/g) || []).length) ? "\t" : ",";
  const rows = parseCsv(text, delim).filter(r => r.some(c => c && c.trim() !== ""));
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

  // Headerless paste: lines like "INFY 100 1450.5" / "NSE:TCS, 12, 3200".
  // First token that looks like a symbol, then the next two numbers as
  // quantity and average cost.
  const holdings = [], skipped = [];
  for (const r of rows) {
    const cells = (r.length > 1 ? r : r[0].split(/\s+/)).map(c => c.trim()).filter(Boolean);
    if (!cells.length) continue;
    const ticker = normalizeTicker(cells[0]);
    if (!/^[A-Z][A-Z0-9&-]{0,23}$/.test(ticker) || /^\d/.test(cells[0])) { skipped.push(cells[0]); continue; }
    const nums = cells.slice(1).map(toNum).filter(n => n != null && n > 0);
    if (nums.length < 2) { skipped.push(ticker); continue; }
    holdings.push({ ticker, qty: nums[0], avg_cost: nums[1] });
  }
  if (holdings.length) return { holdings, skipped, error: null };
  return { holdings: [], skipped: [],
           error: "Nothing parseable — paste rows like \"INFY 100 1450.50\" (symbol, quantity, avg cost) or your broker's holdings table." };
}
