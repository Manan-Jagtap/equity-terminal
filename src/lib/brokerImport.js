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
                  "stock symbol", "stock name", "name of the instrument",
                  "company", "company name"];
const QTY_COLS = ["quantity available", "total quantity", "quantity", "qty", "shares", "units"];
const AVG_COLS = ["average price", "avg price", "avg. price", "average buying price",
                  "average buy price", "avg buy price", "avg. buy price", "buy price",
                  "avg cost", "average cost", "buy average", "buy avg price",
                  "purchase price", "avg. cost price"];
const ISIN_COLS = ["isin", "isin code"];
const SIDE_COLS = ["buy/sell", "side", "transaction type", "trade type", "order type"];
const isIsin = v => /^IN[A-Z0-9]{10}$/.test((v || "").toString().trim().toUpperCase());
const DATE_COLS = ["buy date", "purchase date", "date of purchase", "trade date",
                   "first buy date", "date"];

// "2024-05-13", "13-05-2024", "13/05/2024", "13 May 2024" → ISO or null.
export function parseBuyDate(raw) {
  const s = (raw || "").toString().trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const MON = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (m && MON[m[2].slice(0, 3).toLowerCase()])
    return `${m[3]}-${String(MON[m[2].slice(0, 3).toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

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

/* Tradebook import — the fix for "holdings exports carry no dates".
   Brokers' ORDER-HISTORY/tradebook exports (Groww, Zerodha console) list every
   fill with its date. We replay them FIFO per scrip: buys open lots, sells
   consume the oldest lots, and what survives IS the current position — true
   quantity, true weighted average cost, and the earliest OPEN lot's date
   (the conservative anchor for the 12-month LTCG clock). */
export function parseTradebook(text) {
  const delim = ((text.match(/\t/g) || []).length > (text.match(/,/g) || []).length) ? "\t" : ",";
  const rows = parseCsv(text, delim).filter(r => r.some(c => c && c.trim() !== ""));
  for (let h = 0; h < Math.min(rows.length, 12); h++) {
    const si = findCol(rows[h], SYM_COLS);
    const qi = findCol(rows[h], QTY_COLS);
    const ai = findCol(rows[h], [...AVG_COLS, "price", "trade price", "execution price"]);
    const di = findCol(rows[h], [...DATE_COLS, "execution time", "trade time", "order time", "time"]);
    const bi = findCol(rows[h], SIDE_COLS);
    const ii = findCol(rows[h], ISIN_COLS);
    if (si === -1 || qi === -1 || ai === -1 || bi === -1) continue;

    const trades = [];
    for (const r of rows.slice(h + 1)) {
      const side = (r[bi] || "").toString().trim().toLowerCase();
      if (side !== "buy" && side !== "sell" && !/\b(buy|sell)\b/.test(side)) continue;
      const qty = toNum(r[qi]);
      const price = toNum(r[ai]);
      if (!qty || qty <= 0 || price == null || price <= 0) continue;
      const rawSym = (r[si] || "").toString().trim();
      const ticker = normalizeTicker(rawSym);
      const tickerLike = ticker && /^[A-Z0-9&-]{1,24}$/.test(ticker) && !/\s/.test(rawSym.trim());
      const isin = ii !== -1 && isIsin(r[ii]) ? r[ii].toString().trim().toUpperCase() : null;
      const key = isin || (tickerLike ? ticker : rawSym.toUpperCase());
      trades.push({ key, isin, ticker: tickerLike ? ticker : null, label: rawSym,
                    sell: /sell/.test(side), qty, price,
                    date: di !== -1 ? parseBuyDate(r[di]) : null });
    }
    if (!trades.length) continue;

    trades.sort((a, b) => (a.date || "0000") < (b.date || "0000") ? -1 : 1);
    const books = new Map();
    for (const t of trades) {
      if (!books.has(t.key)) books.set(t.key, { meta: t, lots: [] });
      const b = books.get(t.key);
      if (!t.sell) {
        b.lots.push({ qty: t.qty, price: t.price, date: t.date });
      } else {
        let left = t.qty;
        while (left > 0 && b.lots.length) {
          const lot = b.lots[0];
          const take = Math.min(lot.qty, left);
          lot.qty -= take; left -= take;
          if (lot.qty <= 0) b.lots.shift();
        }
      }
    }
    const holdings = [], skipped = [];
    for (const { meta, lots } of books.values()) {
      const qty = lots.reduce((s2, l) => s2 + l.qty, 0);
      if (qty <= 0) continue;              // fully exited — not a holding
      const cost = lots.reduce((s2, l) => s2 + l.qty * l.price, 0);
      const row = { qty, avg_cost: +(cost / qty).toFixed(2) };
      if (meta.ticker) row.ticker = meta.ticker;
      if (meta.isin) row.isin = meta.isin;
      if (!meta.ticker && meta.label) row.label = meta.label;
      const first = lots.find(l => l.date);
      if (first) row.buy_date = first.date;
      if (lots.filter(l => l.date).length > 1) row.mixed_lots = true;
      holdings.push(row);
    }
    return { holdings, skipped, error: null, source: "tradebook" };
  }
  return null;   // not a tradebook — caller falls through to holdings parse
}

/* → { holdings: [{ticker, qty, avg_cost}], skipped: [rawSymbol…], error } */
export function parseHoldings(text) {
  // A tradebook (has a buy/sell column) beats a holdings snapshot — it
  // carries the DATES holdings exports lack.
  const tb = parseTradebook(text);
  if (tb && tb.holdings.length) return tb;
  // Pasted tables (broker page, Excel) arrive tab-separated; files are CSV.
  const delim = ((text.match(/\t/g) || []).length > (text.match(/,/g) || []).length) ? "\t" : ",";
  const rows = parseCsv(text, delim).filter(r => r.some(c => c && c.trim() !== ""));
  // The header may sit below preamble/title lines — scan the first rows for
  // one that yields both a symbol and a quantity column.
  for (let h = 0; h < Math.min(rows.length, 12); h++) {
    const si = findCol(rows[h], SYM_COLS);
    const qi = findCol(rows[h], QTY_COLS);
    const ai = findCol(rows[h], AVG_COLS);
    const di = findCol(rows[h], DATE_COLS);
    const ii = findCol(rows[h], ISIN_COLS);
    if (si === -1 || qi === -1) continue;
    const holdings = [], skipped = [];
    for (const r of rows.slice(h + 1)) {
      const rawSym = (r[si] || "").toString().trim();
      const ticker = normalizeTicker(rawSym);
      const isin = ii !== -1 && isIsin(r[ii]) ? r[ii].toString().trim().toUpperCase() : null;
      const qty = toNum(r[qi]);
      const avg = ai !== -1 ? toNum(r[ai]) : null;
      const tickerLike = ticker && /^[A-Z0-9&-]{1,24}$/.test(ticker);
      // Groww exports display NAMES ("ADIT BIRL SUN LIF AMC LTD"), not
      // tickers — the ISIN column is the identifier there.
      if (!tickerLike && !isin) { if (rawSym) skipped.push(rawSym); continue; }
      if (!qty || qty <= 0 || avg == null || avg <= 0) { skipped.push(rawSym || isin); continue; }
      const buy_date = di !== -1 ? parseBuyDate(r[di]) : null;
      const row = tickerLike ? { ticker, qty, avg_cost: avg } : { qty, avg_cost: avg };
      if (isin) row.isin = isin;
      if (rawSym && !tickerLike) row.label = rawSym;
      if (buy_date) row.buy_date = buy_date;
      holdings.push(row);
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
    // Optional trailing date token: "INFY 100 1450.50 2024-05-13"
    const buy_date = cells.slice(1).map(parseBuyDate).find(Boolean) || null;
    holdings.push(buy_date ? { ticker, qty: nums[0], avg_cost: nums[1], buy_date }
                           : { ticker, qty: nums[0], avg_cost: nums[1] });
  }
  if (holdings.length) return { holdings, skipped, error: null };
  return { holdings: [], skipped: [],
           error: "Nothing parseable — paste rows like \"INFY 100 1450.50\" (symbol, quantity, avg cost) or your broker's holdings table." };
}
