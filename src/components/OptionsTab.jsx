/* OptionsTab.jsx — option chain (Dhan-backed): OI, IV, LTP, greeks + PCR.
   Degrades to an honest empty state when Dhan isn't configured or the name
   isn't in F&O. Centers the view on the at-the-money strike. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Layers } from "lucide-react";
import { C, sans, serif, mono } from "../lib/theme.js";

const num = v => v == null ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const f2 = v => v == null ? "—" : Number(v).toFixed(2);
const inr = v => v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: v >= 100 ? 0 : 2 });

function Empty({ msg }) {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <Layers size={26} color={C.faint} style={{ marginBottom: 12 }} />
      <div style={{ ...sans, fontSize: 13, color: C.dim, maxWidth: 460, margin: "0 auto", lineHeight: 1.6 }}>{msg}</div>
    </div>
  );
}

export default function OptionsTab({ co, API }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expiry, setExpiry] = useState(null);
  const atmRef = useRef(null);

  useEffect(() => {
    if (!API) { setLoading(false); return; }
    let live = true; setLoading(true);
    const url = `${API}/api/companies/${co.ticker}/options` + (expiry ? `?expiry=${encodeURIComponent(expiry)}` : "");
    fetch(url).then(r => r.json())
      .then(d => { if (live) { setData(d); setLoading(false); if (!expiry && d.expiry) setExpiry(d.expiry); } })
      .catch(() => { if (live) { setData(null); setLoading(false); } });
    return () => { live = false; };
  }, [co.ticker, API, expiry]);

  const strikes = data?.strikes || [];
  const spot = data?.last_price;
  const atmIdx = useMemo(() => {
    if (!strikes.length || spot == null) return -1;
    let best = 0, bd = Infinity;
    strikes.forEach((s, i) => { const d = Math.abs(s.strike - spot); if (d < bd) { bd = d; best = i; } });
    return best;
  }, [strikes, spot]);
  const maxOI = useMemo(() => Math.max(1, ...strikes.flatMap(s => [s.ce?.oi || 0, s.pe?.oi || 0])), [strikes]);

  useEffect(() => { if (atmRef.current) atmRef.current.scrollIntoView({ block: "center" }); }, [atmIdx, expiry]);

  if (loading) return (
    <div style={{ padding: 40, display: "flex", alignItems: "center", gap: 10, color: C.dim, ...sans, fontSize: 13 }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading option chain…
    </div>
  );
  if (!data || data.configured === false) return <Empty msg={data?.message || "Options require Dhan to be connected."} />;
  if (!data.available) return <Empty msg={data.message || "No option chain available for this name."} />;

  const th = { ...sans, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: C.dim, padding: "7px 8px", textAlign: "right", whiteSpace: "nowrap" };
  const td = { ...mono, fontSize: 11.5, padding: "5px 8px", textAlign: "right", whiteSpace: "nowrap" };
  const oiBar = (v, side) => (
    <div style={{ height: 3, background: C.bg600, borderRadius: 2, marginTop: 2 }}>
      <div style={{ height: "100%", marginLeft: side === "ce" ? "auto" : 0, width: `${Math.min(100, (v / maxOI) * 100)}%`, background: side === "ce" ? C.red : C.green, opacity: 0.6, borderRadius: 2 }} />
    </div>
  );

  return (
    <div className="fadein" style={{ padding: "6px 2px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ ...serif, fontSize: 20, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
          <Layers size={17} color={C.gold} /> Option Chain
        </span>
        <span style={{ ...mono, fontSize: 13, color: C.text200 }}>Spot {inr(spot)}</span>
        <span style={{ ...sans, fontSize: 12, color: C.dim }}>PCR{" "}
          <b style={{ ...mono, color: (data.pcr || 0) > 1 ? C.green : C.red }}>{data.pcr != null ? data.pcr.toFixed(2) : "—"}</b>
          <span style={{ color: C.faint }}> · {(data.pcr || 0) > 1 ? "put-heavy (support)" : "call-heavy (resistance)"}</span>
        </span>
        <select value={expiry || ""} onChange={e => setExpiry(e.target.value)}
          style={{ ...mono, marginLeft: "auto", fontSize: 12, background: C.panel2, color: C.text, border: `1px solid ${C.line2}`, borderRadius: 7, padding: "5px 9px" }}>
          {(data.expiries || []).map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>

      <div style={{ overflow: "auto", maxHeight: 560, border: `1px solid ${C.line}`, borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead style={{ position: "sticky", top: 0, background: C.bg900, zIndex: 1 }}>
            <tr>
              <th style={{ ...th, textAlign: "left", color: C.red }}>CALL OI</th>
              <th style={th}>IV</th><th style={th}>LTP</th>
              <th style={{ ...th, textAlign: "center", color: C.gold }}>STRIKE</th>
              <th style={{ ...th, textAlign: "left" }}>LTP</th><th style={{ ...th, textAlign: "left" }}>IV</th>
              <th style={{ ...th, textAlign: "left", color: C.green }}>PUT OI</th>
            </tr>
          </thead>
          <tbody>
            {strikes.map((s, i) => {
              const atm = i === atmIdx;
              return (
                <tr key={s.strike} ref={atm ? atmRef : null}
                    style={{ borderTop: `1px solid ${C.line}`, background: atm ? C.bg800 : "transparent" }}>
                  <td style={{ ...td, textAlign: "left" }}>{num(s.ce?.oi)}{oiBar(s.ce?.oi || 0, "ce")}</td>
                  <td style={{ ...td, color: C.dim }}>{f2(s.ce?.iv)}</td>
                  <td style={{ ...td, color: C.text }}>{f2(s.ce?.ltp)}</td>
                  <td style={{ ...td, textAlign: "center", color: atm ? C.gold : C.text200, fontWeight: atm ? 700 : 400 }}>{num(s.strike)}</td>
                  <td style={{ ...td, textAlign: "left", color: C.text }}>{f2(s.pe?.ltp)}</td>
                  <td style={{ ...td, textAlign: "left", color: C.dim }}>{f2(s.pe?.iv)}</td>
                  <td style={{ ...td, textAlign: "left" }}>{num(s.pe?.oi)}{oiBar(s.pe?.oi || 0, "pe")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ ...sans, fontSize: 10, color: C.faint, marginTop: 8 }}>
        Live option chain via Dhan · IV/greeks from Dhan · {data.expiry}. Highlighted row = at-the-money. Data aid, not advice.
      </div>
    </div>
  );
}
