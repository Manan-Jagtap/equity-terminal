/* pdfImport.js — turn a broker orders/tradebook PDF into tradebook CSV text.

   Parsed ENTIRELY in the browser (pdf.js, Apache-2.0) — a financial document
   never leaves the machine. Groww's "Orders" print-to-PDF is the reference
   layout: date section headers ("24 Apr '26"), then per order a company line
   ("Infosys Delivery 10:58") followed by the fill line ("Buy 5 ₹1,175.00").
   The output feeds the same FIFO tradebook engine as pasted order history,
   recovering true quantities, weighted costs and purchase dates.
   Verified against a real 14-page Groww export: 119/119 orders, all dated. */

const MON = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
              jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

async function pdfLines(file) {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const all = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const lines = new Map();
    for (const it of tc.items) {
      const y = Math.round(it.transform[5] / 2) * 2;   // cluster fragments per visual line
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y).push({ x: it.transform[4], s: it.str });
    }
    all.push(...[...lines.entries()].sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.s).join(" ")
        .replace(/\s+/g, " ").trim())
      .filter(Boolean));
  }
  return all;
}

/* → CSV text in the tradebook shape brokerImport already understands,
   or null when the PDF doesn't look like an orders export. */
export async function pdfToTradebookCsv(file) {
  const lines = await pdfLines(file);
  let curDate = null, lastCompany = null;
  const orders = [];
  for (const l of lines) {
    const dm = l.match(/(\d{1,2}) ([A-Za-z]{3}) '(\d{2})/);
    if (dm && l.length < 20) {
      curDate = `20${dm[3]}-${MON[dm[2].toLowerCase()]}-${dm[1].padStart(2, "0")}`;
      lastCompany = null;
      continue;
    }
    const cm = l.match(/^(.*?) Delivery\b/);
    if (cm && cm[1].trim() && !/^(Buy|Sell)\b/.test(cm[1].trim())) {
      lastCompany = cm[1].trim().replace(/\s*\.\s*/g, ". ").replace(/\s+/g, " ");
    }
    const om = l.match(/\b(Buy|Sell) (\d[\d,]*) ₹\s?([\d,]+\.?\d*)/);
    if (om && lastCompany) {
      orders.push([lastCompany, om[1], om[2].replace(/,/g, ""),
                   om[3].replace(/,/g, ""), curDate || ""]);
      lastCompany = null;
    }
  }
  if (!orders.length) return null;
  const esc = v => (`${v}`.includes(",") ? `"${v}"` : `${v}`);
  return ["Company,Buy/Sell,Qty,Price,Trade date",
          ...orders.map(o => o.map(esc).join(","))].join("\n");
}
