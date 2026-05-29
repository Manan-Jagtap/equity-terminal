/* Financial Statements tab — fetches 5Y historicals when API is configured,
   falls back to projected statements derived from the DCF rows otherwise.
   Tabs: P&L | Balance Sheet | Cash Flow. */

import { useEffect, useMemo, useState } from "react";
import { C, mono, sans } from "../lib/theme.js";
import { fmt, pct, cr } from "../lib/formatters.js";
import { currentFY, fyLabel } from "../lib/fyHelpers.js";
import { valuate } from "../lib/valuation.js";
import { MTable, TH, TR } from "./primitives.jsx";

export default function FinancialStatements({ co, a, API }) {
  const [tab, setTab] = useState("pl");
  const [histData, setHistData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!API || !co.ticker) return;
    setLoading(true);
    fetch(`${API}/api/companies/${co.ticker}/financials`)
      .then(r => r.json())
      .then(d => setHistData(d))
      .catch(() => setHistData(null))
      .finally(() => setLoading(false));
  }, [co.ticker, API]);

  const isF = co.type === "financial";
  const lastActualFY = currentFY() - 1;

  const { pl, bs, cf, years, hasReal } = useMemo(() => {
    if (histData && Object.keys(histData.statements || {}).length >= 2) {
      const stmts = histData.statements;
      const sortedYears = [...histData.years_available].sort();
      const pl = sortedYears.map(y => ({
        y, isActual: true, label: fyLabel(y, lastActualFY),
        revenue: stmts[y]?.PL?.revenue, nii: stmts[y]?.PL?.nii,
        ebit: stmts[y]?.PL?.ebit, ebitda: stmts[y]?.PL?.ebitda,
        pbt: stmts[y]?.PL?.pbt, tax: stmts[y]?.PL?.tax,
        pat: stmts[y]?.PL?.pat,
        interest_income: stmts[y]?.PL?.interest_income,
        ebitMargin: stmts[y]?.PL?.ebit && stmts[y]?.PL?.revenue
          ? stmts[y].PL.ebit / stmts[y].PL.revenue : null,
      }));
      const bs = sortedYears.map(y => ({
        y, isActual: true, label: fyLabel(y, lastActualFY),
        equity: stmts[y]?.BS?.equity,
        borrowings: stmts[y]?.BS?.borrowings || stmts[y]?.BS?.total_debt,
        lt_debt: stmts[y]?.BS?.lt_debt,
        cash: stmts[y]?.BS?.cash,
        total_assets: stmts[y]?.BS?.total_assets,
      }));
      const cf = sortedYears.map(y => ({
        y, isActual: true, label: fyLabel(y, lastActualFY),
        pat: stmts[y]?.PL?.pat,
        operating_cf: stmts[y]?.CF?.operating_cf,
        capex: stmts[y]?.CF?.capex,
        fcf: stmts[y]?.CF?.fcf,
        dividends: stmts[y]?.CF?.dividends,
      }));
      return { pl, bs, cf, years: sortedYears, hasReal: true };
    }

    // Fallback: project from DCF
    const v = valuate(co, a);
    const FY0 = lastActualFY;
    const projYears = [...v.rows.map(r => FY0 + r.t)].slice(0, 5);
    const rev0 = co.revenue || co.fcff?.revenue || co.equity * 2;

    const pl = isF
      ? [
          { y: FY0, isActual: false, label: fyLabel(FY0, lastActualFY),
            nii: co.equity * (co.nbfc?.nim ?? 0.09),
            pat: co.netProfit,
            roe: co.netProfit ? co.netProfit / co.equity : null },
          ...v.rows.slice(0, 4).map((r, i) => ({
            y: FY0 + r.t, isActual: false, label: fyLabel(FY0 + r.t, lastActualFY),
            nii: r.bv * co.shares * (co.nbfc?.nim ?? 0.09) * Math.pow(1.08, i),
            pat: r.eps * co.shares, roe: r.roe,
          })),
        ]
      : [
          { y: FY0, isActual: false, label: fyLabel(FY0, lastActualFY),
            revenue: rev0,
            ebit: rev0 * a.ebitMargin,
            tax: rev0 * a.ebitMargin * a.taxRate,
            pat: co.netProfit, ebitMargin: a.ebitMargin },
          ...v.rows.slice(0, 4).map(r => ({
            y: FY0 + r.t, isActual: false, label: fyLabel(FY0 + r.t, lastActualFY),
            revenue: r.rev, ebit: r.ebit, tax: r.tax, pat: r.nopat,
            ebitMargin: a.ebitMargin,
          })),
        ];

    const bs = [
      { y: FY0, isActual: false, label: fyLabel(FY0, lastActualFY),
        equity: co.equity, borrowings: co.netDebt || co.fcff?.netDebt,
        total_assets: co.equity + (co.netDebt || co.fcff?.netDebt || 0) },
      ...v.rows.slice(0, 4).map(r => ({
        y: FY0 + r.t, isActual: false, label: fyLabel(FY0 + r.t, lastActualFY),
        equity: isF ? r.bv * co.shares : co.equity * (1 + a.revGrowth * r.t * 0.3),
        borrowings: co.netDebt, total_assets: null,
      })),
    ];

    const cf = [
      { y: FY0, isActual: false, label: fyLabel(FY0, lastActualFY),
        pat: co.netProfit,
        operating_cf: co.netProfit ? co.netProfit * 1.2 : null,
        capex: null, fcf: null },
      ...v.rows.slice(0, 4).map(r => ({
        y: FY0 + r.t, isActual: false, label: fyLabel(FY0 + r.t, lastActualFY),
        pat: isF ? r.eps * co.shares : r.nopat,
        operating_cf: isF ? r.eps * co.shares * 1.1 : r.nopat + r.reinv * 0.3,
        capex: isF ? null : -r.reinv,
        fcf: isF ? r.dps * co.shares : r.fcff,
      })),
    ];

    return { pl, bs, cf, years: [FY0, ...projYears], hasReal: false };
  }, [histData, co, a, isF, lastActualFY]);

  const StmtTab = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      ...sans,
      background: tab === id ? C.gold + "22" : "transparent",
      border: `1px solid ${tab === id ? C.gold + "55" : C.line}`,
      color: tab === id ? C.gold : C.dim,
      padding: "7px 14px",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 500,
      cursor: "pointer",
    }}>{label}</button>
  );

  if (loading) {
    return <div style={{ ...sans, color: C.faint, padding: 40, textAlign: "center" }}>Loading financial statements…</div>;
  }

  const cols = [" ", ...(pl || []).map(r => r.label)];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
          ...sans, fontSize: 11,
          color: hasReal ? C.green : C.gold,
          border: `1px solid ${hasReal ? C.green + "55" : C.gold + "55"}`,
          background: hasReal ? C.green + "14" : C.gold + "14",
          padding: "3px 10px", borderRadius: 20,
        }}>
          {hasReal ? `✓ Actual data · ${years.length} years` : "⚠ Projected — run XBRL ingester for actuals"}
        </div>
        <div style={{ ...sans, fontSize: 11, color: C.faint }}>
          A = Actual · E = Estimated · All values ₹ crore
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <StmtTab id="pl" label={isF ? "P&L" : "Income Statement"} />
        <StmtTab id="bs" label="Balance Sheet" />
        <StmtTab id="cf" label="Cash Flow" />
      </div>

      {tab === "pl" && (
        <MTable>
          <thead><TH cols={cols} /></thead>
          <tbody>
            {isF ? (
              <>
                <TR cells={["Net Interest Income", ...pl.map(r => cr(r.nii))]} bg={C.panel2 + "80"} />
                <TR cells={["Interest Income", ...pl.map(r => cr(r.interest_income))]} />
                <TR cells={["PBT", ...pl.map(r => cr(r.pbt))]} />
                <TR cells={["Tax", ...pl.map(r => r.tax ? cr(-Math.abs(r.tax)) : cr(null))]} />
                <TR cells={["PAT", ...pl.map(r => cr(r.pat))]} bold color={C.green} bg={C.panel2 + "80"} />
                <TR cells={["ROE", ...pl.map(r => pct(r.roe))]} />
              </>
            ) : (
              <>
                <TR cells={["Revenue", ...pl.map(r => cr(r.revenue))]} bg={C.panel2 + "80"} />
                <TR cells={["EBIT", ...pl.map(r => cr(r.ebit))]} />
                <TR cells={["EBIT Margin", ...pl.map(r => pct(r.ebitMargin))]} />
                <TR cells={["EBITDA", ...pl.map(r => cr(r.ebitda))]} />
                <TR cells={["PBT", ...pl.map(r => cr(r.pbt))]} />
                <TR cells={["Tax", ...pl.map(r => r.tax ? cr(-Math.abs(r.tax)) : cr(null))]} />
                <TR cells={["PAT", ...pl.map(r => cr(r.pat))]} bold color={C.green} bg={C.panel2 + "80"} />
              </>
            )}
          </tbody>
        </MTable>
      )}

      {tab === "bs" && (
        <MTable>
          <thead><TH cols={cols} /></thead>
          <tbody>
            <TR cells={["Shareholders' Equity", ...bs.map(r => cr(r.equity))]} bold color={C.green} bg={C.panel2 + "80"} />
            <TR cells={["Borrowings / Debt", ...bs.map(r => cr(r.borrowings))]} />
            <TR cells={["Long-term Debt", ...bs.map(r => cr(r.lt_debt))]} />
            <TR cells={["Cash", ...bs.map(r => cr(r.cash))]} bg={C.panel2 + "80"} />
            <TR cells={["Total Assets", ...bs.map(r => cr(r.total_assets))]} bold />
            <TR cells={["Debt/Equity", ...bs.map(r => r.equity && r.borrowings ? fmt(r.borrowings / r.equity, 2) + "x" : "—")]} />
          </tbody>
        </MTable>
      )}

      {tab === "cf" && (
        <MTable>
          <thead><TH cols={cols} /></thead>
          <tbody>
            <TR cells={["PAT", ...cf.map(r => cr(r.pat))]} bg={C.panel2 + "80"} />
            <TR cells={["Operating CF", ...cf.map(r => cr(r.operating_cf))]} bold color={C.green} />
            <TR cells={["Capex", ...cf.map(r => r.capex ? cr(-Math.abs(r.capex)) : cr(null))]} color={C.red} />
            <TR cells={["Free Cash Flow", ...cf.map(r => cr(r.fcf))]} bold color={C.blue} bg={C.panel2 + "80"} />
            <TR cells={["Dividends", ...cf.map(r => r.dividends ? cr(-Math.abs(r.dividends)) : cr(null))]} />
          </tbody>
        </MTable>
      )}
    </div>
  );
}
