/* Phase 2 composite — ValuationPanel. The verdict story in one calm block:
   verdict + confidence, price vs fair value with MoS, and the bear/base/bull
   rail. Honesty guardrails baked in: LOW CONF gets the nocall treatment, the
   footnote slot defaults to the model-output disclaimer, and a missing band
   renders no rail (never a wrong one — same rule as FvRange). */
import { color, fmtNum } from "../../design/tokens.js";
import { Badge, VerdictBadge } from "./Badge.jsx";
import StatTile from "./StatTile.jsx";
import "./ui.css";

const CONF_TONE = { HIGH: "buy", MEDIUM: "hold", MED: "hold", LOW: "nocall" };

/* price + bear/base/bull → % positions on the rail (5% margins keep marks inside) */
function railPos(price, band) {
  const lo = Math.min(band.bear, price), hi = Math.max(band.bull, price);
  const span = hi - lo || 1;
  const pos = (v) => 5 + ((v - lo) / span) * 90;
  return { bear: pos(band.bear), base: pos(band.base), bull: pos(band.bull), price: pos(price) };
}

export default function ValuationPanel({
  price, fair, verdict, confidence, mos, band,
  footnote = "Transparent model output — not investment advice.",
  className = "", ...rest
}) {
  const hasBand = band && [band.bear, band.base, band.bull].every((v) => v != null && isFinite(v))
    && band.bear < band.bull && price != null;
  const p = hasBand ? railPos(price, band) : null;
  const conf = (confidence || "").toUpperCase();

  return (
    <div className={`evc-vpanel${className ? " " + className : ""}`} {...rest}>
      <div className="evc-vpanel-head">
        <VerdictBadge verdict={verdict} />
        {conf && <Badge tone={CONF_TONE[conf] || "neutral"}>{conf} CONF</Badge>}
      </div>

      <div className="evc-vpanel-stats">
        <StatTile label="Price" value={fmtNum.inr(price, 2)} />
        <StatTile label="Fair value" value={fmtNum.inr(fair, 0)} />
        <StatTile label="Margin of safety"
          value={mos == null ? "—" : (
            <span style={{ color: mos >= 0 ? color.up : color.down }}>{fmtNum.signedPct(mos)}</span>
          )} />
      </div>

      {hasBand && (
        <div className="evc-rail" role="img"
          aria-label={`Fair-value range ${fmtNum.inr(band.bear, 0)} bear to ${fmtNum.inr(band.bull, 0)} bull; base ${fmtNum.inr(band.base, 0)}; price ${fmtNum.inr(price, 0)}`}>
          <div className="evc-rail-track" />
          <span className="evc-rail-mark" data-kind="price" style={{ left: `${p.price}%` }} />
          <span className="evc-rail-mark" data-kind="base" style={{ left: `${p.base}%` }} />
          <span className="evc-rail-lab" style={{ left: `${p.bear}%` }}>{fmtNum.inr(band.bear, 0)}</span>
          <span className="evc-rail-lab" data-kind="base" style={{ left: `${p.base}%` }}>{fmtNum.inr(band.base, 0)}</span>
          <span className="evc-rail-lab" style={{ left: `${p.bull}%` }}>{fmtNum.inr(band.bull, 0)}</span>
        </div>
      )}

      {footnote && <div className="evc-vpanel-foot">{footnote}</div>}
    </div>
  );
}
