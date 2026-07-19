/* Phase 2 composite — CompanyRow. The list row for screener/watchlist/search:
   ticker + name | sector | sparkline | price + day delta | verdict.
   Keyboard-activatable (real button semantics via role+tabIndex+Enter/Space).
   Sparkline hides under 560px (ui.css) — numbers keep priority on mobile. */
import { color, fmtNum } from "../../design/tokens.js";
import { Badge, VerdictBadge } from "./Badge.jsx";
import Sparkline from "./Sparkline.jsx";
import "./ui.css";

export default function CompanyRow({
  ticker, name, sector, price, delta, verdict, spark, onOpen, className = "", ...rest
}) {
  const activate = onOpen ? {
    role: "button", tabIndex: 0, onClick: () => onOpen(ticker),
    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(ticker); } },
  } : {};
  return (
    <div className={`evc-crow${className ? " " + className : ""}`} {...activate} {...rest}>
      <div className="evc-crow-id">
        <div className="evc-crow-ticker">{ticker}</div>
        <div className="evc-crow-name">{name}</div>
      </div>
      {sector && <Badge>{sector}</Badge>}
      {spark && spark.length > 1 && <Sparkline data={spark} />}
      <div className="evc-crow-num">
        <div className="evc-crow-price">{fmtNum.inr(price, 2)}</div>
        <div className="evc-crow-delta"
          style={{ color: delta == null ? color.text3 : delta >= 0 ? color.up : color.down }}>
          {delta == null ? "—" : fmtNum.signedPct(delta)}
        </div>
      </div>
      {verdict && <VerdictBadge verdict={verdict} fill={false} />}
    </div>
  );
}
