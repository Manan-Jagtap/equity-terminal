/* StrategyLab.jsx — rule builder + point-in-time strategy backtester.

   Reads /api/strategy/list (available price strategies) and
   /api/strategy/backtest (a real, no-look-ahead simulation over the 5-yr
   history vs the NIFTY 50). Price strategies only — value/quality need
   historical fundamentals we don't store; that side lives in the verdict
   track record + factor snapshot ledger. A research tool, not advice. */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Info, ChevronRight, Play } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { C, sans, mono } from "../lib/theme.js";
import useResource from "../lib/useResource.js";
import ErrorState from "./ui/ErrorState.jsx";

const pct = (x, d = 1) => x == null ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;
const pctAbs = (x, d = 1) => x == null ? "—" : `${(x * 100).toFixed(d)}%`;

function Metric({ label, value, color, sub }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "11px 13px", background: "rgba(16,14,10,0.5)", minWidth: 0 }}>
      <div style={{ ...sans, fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.09em", color: C.dim, whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ ...mono, fontSize: 18, color: color || C.text, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ ...sans, fontSize: 9.5, color: C.faint, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

export default function StrategyLab({ API, onOpen }) {
  const [opts, setOpts] = useState(null);
  // "have we heard back about the strategy list, either way" — distinct from
  // `opts`, which is null both BEFORE the request and after it fails. See the
  // auto-run effect below for why the difference mattered.
  const [optsSettled, setOptsSettled] = useState(false);
  const [signal, setSignal] = useState("momentum");
  const [topN, setTopN] = useState(15);
  const [rebalance, setRebalance] = useState("M");
  const [years, setYears] = useState(5);
  const [query, setQuery] = useState(null);   // the backtest URL currently asked for

  useEffect(() => {
    if (!API) return;
    let live = true;
    /* This request deliberately fails OPEN: the dropdown falls back to the
       built-in Momentum entry and the lab stays usable, so there is nothing to
       report to the reader and no error state to render. The r.ok check is
       still required, because a non-2xx must not be parsed as data — a 404's
       {"detail":"Not Found"} used to land in `opts`, where it is truthy.

       That truthiness is not cosmetic. The auto-run effect below was gated on
       `opts` alone, so the two failure modes diverged: an API error left opts
       truthy and the backtest ran, while a network error left opts null, the
       auto-run never fired, and the panel sat on "Running backtest…" forever
       with nothing running. Settling a separate flag in .finally makes both
       paths reach the same place. */
    fetch(`${API}/api/strategy/list`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live) setOpts(Array.isArray(d?.strategies) ? d : null); })
      .catch(() => { if (live) setOpts(null); })
      .finally(() => { if (live) setOptsSettled(true); });
    return () => { live = false; };
  }, [API]);

  /* The backtest IS this panel's content, so it gets useResource: r.ok, the
     status/network/parse split, and a re-fetch when the browser comes back
     online. The old code was .then(r => r.json()) with a .catch that could not
     fire — a 500 resolved, `res` became {"detail": …}, res.ok read undefined,
     and the panel printed res.reason || "No result." An outage was reported as
     a backtest that ran fine and found nothing.

     Driving it off a URL rather than a click keeps that honesty: the request is
     a function of the chosen parameters, and re-running the SAME parameters is
     retry(), because the URL has not changed for the hook to react to. */
  const { data: res, error, loading, retry } = useResource(query);

  const run = () => {
    if (!API) return;
    const next = `${API}/api/strategy/backtest?signal=${signal}&top_n=${topN}&rebalance=${rebalance}&years=${years}`;
    if (next === query) retry(); else setQuery(next);
  };

  /* With no API there is nothing to wait for, so don't wait — a flag that can
     never settle is exactly how this panel used to spin forever. */
  const listSettled = optsSettled || !API;

  // Run once on first load (default momentum), whether or not the strategy list
  // arrived — a missing dropdown does not stop the default rule from running.
  useEffect(() => { if (API && listSettled && !query) run(); /* eslint-disable-line */ }, [API, listSettled]);

  const chartData = useMemo(() => {
    if (!res?.curve) return [];
    return res.curve.map(p => ({ date: p.date, Strategy: +(p.strategy * 100).toFixed(1), NIFTY: +(p.benchmark * 100).toFixed(1) }));
  }, [res]);

  const sel = { ...sans, fontSize: 12, color: C.text, background: C.bg800, border: `1px solid ${C.line2}`,
                borderRadius: 8, padding: "7px 10px", cursor: "pointer" };

  const s = res?.strategy, b = res?.benchmark;

  return (
    <div>
      <div style={{ ...sans, fontSize: 11.5, color: C.faint, lineHeight: 1.6, maxWidth: 820, marginBottom: 16, display: "flex", gap: 6 }}>
        <Info size={13} color={C.dim} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          A <b style={{ color: C.text200 }}>point-in-time</b> backtest of rule-based price strategies over the 5-year
          history — every signal uses only data available at each rebalance, equal-weight, benchmarked to the
          <b style={{ color: C.text200 }}> NIFTY 50</b>. Price factors only (value/quality need historical
          fundamentals we don't store). <b style={{ color: C.text200 }}>Survivorship caveat:</b> the pool is today's
          constituents, so returns — especially momentum — are flattered and may select illiquid microcaps; costs and
          taxes are excluded. <b style={{ color: C.text200 }}>Past simulated performance is not indicative of future
          results</b> — a research tool, not investment advice.
        </span>
      </div>

      {/* rule builder */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 18 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: C.dim }}>Strategy</span>
          <select value={signal} onChange={e => setSignal(e.target.value)} style={sel}>
            {(opts?.strategies || [{ id: "momentum", label: "Momentum" }]).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: C.dim }}>Hold top</span>
          <select value={topN} onChange={e => setTopN(+e.target.value)} style={sel}>
            {[5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n} names</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: C.dim }}>Rebalance</span>
          <select value={rebalance} onChange={e => setRebalance(e.target.value)} style={sel}>
            <option value="M">Monthly</option>
            <option value="Q">Quarterly</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: C.dim }}>Window</span>
          <select value={years} onChange={e => setYears(+e.target.value)} style={sel}>
            {[3, 5].map(y => <option key={y} value={y}>{y} years</option>)}
          </select>
        </label>
        <button onClick={run} disabled={loading} style={{
          ...sans, fontSize: 12.5, fontWeight: 600, padding: "9px 18px", borderRadius: 8, cursor: "pointer",
          border: `1px solid ${C.gold}`, background: C.gold + "18", color: C.gold,
          display: "flex", alignItems: "center", gap: 7,
        }}>
          {loading ? <Loader2 size={14} className="spin" /> : <Play size={13} />}
          Run backtest
        </button>
      </div>

      {error ? (
        /* Not the one-line "No result." — the backtest is the whole panel, and
           the distinction is the point: {ok:false, reason} on a 200 means the
           engine ran and explained itself (too few names, no price history),
           which is worth quoting verbatim below. `error` means we never got an
           answer we could read, which is not a fact about any strategy. */
        <ErrorState error={error} onRetry={retry} what="the backtest" />
      ) : res && !res.ok ? (
        <div style={{ ...sans, fontSize: 12.5, color: C.dim, padding: "24px 0" }}>{res.reason || "No result."}</div>
      ) : res && res.ok ? (
        <>
          <div style={{ ...sans, fontSize: 12.5, color: C.text200, marginBottom: 10 }}>
            <b style={{ color: C.gold }}>{res.label}</b> · {res.rule} <span style={{ color: C.faint }}>· {res.rebalance.toLowerCase()} rebalance, top {res.top_n}, {res.start} → {res.end}</span>
          </div>

          {/* equity curve */}
          <div style={{ height: 300, border: `1px solid ${C.line}`, borderRadius: 12, background: "rgba(16,14,10,0.5)", padding: "14px 10px 8px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 14, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 9.5 }} tickLine={false} axisLine={{ stroke: C.line }}
                       minTickGap={44} tickFormatter={d => (d || "").slice(0, 7)} />
                <YAxis domain={["auto", "auto"]} tick={{ fill: C.dim, fontSize: 9.5 }} tickLine={false} axisLine={false}
                       width={44} tickFormatter={v => "₹" + v} />
                <ReferenceLine y={100} stroke={C.line2} strokeDasharray="3 3" />
                <Tooltip contentStyle={{ background: C.bg900, border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 11 }}
                         labelStyle={{ color: C.dim }} formatter={(v, n) => ["₹" + v, n]} />
                <Line type="monotone" dataKey="Strategy" stroke={C.gold} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="NIFTY" stroke={C.dim} strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...sans, fontSize: 10.5, color: C.faint, margin: "6px 2px 16px" }}>
            Growth of ₹100 · <span style={{ color: C.gold }}>■</span> {res.label} &nbsp; <span style={{ color: C.dim }}>▨</span> {res.benchmark_name}
          </div>

          {/* metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 22 }}>
            <Metric label="Strategy CAGR" value={pct(s.cagr)} color={s.cagr >= 0 ? C.green : C.red} sub={`total ${pct(s.total_return, 0)}`} />
            <Metric label={`${res.benchmark_name} CAGR`} value={pct(b.cagr)} color={C.dim} sub={`total ${pct(b.total_return, 0)}`} />
            <Metric label="Excess CAGR" value={pct(res.excess_cagr)} color={res.excess_cagr >= 0 ? C.green : C.red} sub="vs benchmark" />
            <Metric label="Volatility" value={pctAbs(s.vol)} sub="annualised" />
            <Metric label="Sharpe" value={s.sharpe == null ? "—" : s.sharpe.toFixed(2)} color={s.sharpe >= 1 ? C.green : s.sharpe >= 0 ? C.text : C.red} sub="rf 6.5%" />
            <Metric label="Max drawdown" value={pctAbs(s.max_drawdown)} color={C.red} />
            <Metric label="Hit rate" value={pctAbs(res.hit_rate, 0)} sub={`beat bench · ${res.periods} periods`} />
          </div>

          {/* current holdings */}
          {res.holdings?.length > 0 && (
            <div>
              <div style={{ ...sans, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.09em", color: C.dim, marginBottom: 8 }}>
                What the rule holds today ({res.holdings.length})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 6 }}>
                {res.holdings.map(h => (
                  <div key={h.ticker} onClick={() => onOpen && onOpen(h.ticker)}
                       style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", border: `1px solid ${C.line}`, borderRadius: 8, cursor: onOpen ? "pointer" : "default" }}
                       onMouseEnter={e => (e.currentTarget.style.background = C.panel2)}
                       onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...sans, fontSize: 12, fontWeight: 500, color: C.gold, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.ticker}</div>
                      <div style={{ ...sans, fontSize: 9.5, color: C.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.sector || ""}</div>
                    </div>
                    <ChevronRight size={13} color={C.faint} style={{ marginLeft: "auto", flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (loading || query || !listSettled) ? (
        <div style={{ padding: 40, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
          <Loader2 size={16} className="spin" /> Running backtest…
        </div>
      ) : (
        /* Nothing is in flight and nothing has been asked for. The old code
           showed the spinner in this state too — a claim that a simulation is
           running when none is, and (with no API configured) a spinner that
           could never resolve. */
        <div style={{ padding: 40, color: C.dim, ...sans, fontSize: 13 }}>
          Choose a rule and press <b style={{ color: C.text200 }}>Run backtest</b>.
        </div>
      )}
    </div>
  );
}
