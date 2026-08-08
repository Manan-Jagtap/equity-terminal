/* Phase 2c primitive — ErrorState.

   The counterpart to an empty state, and the reason it exists is that eleven
   screens had only the empty one. When the API was down they rendered "No
   ownership data yet — run a refresh to populate shareholding snapshots",
   which tells the user their data does not exist and then suggests a remedy
   that cannot work. For a research product that is the worst possible failure
   mode: silently confident, and wrong.

   The copy distinguishes what we actually know:
     status  — we reached the server and it refused; the data exists, we cannot
               read it right now
     network — we never reached it; could be them, could be the user's wifi
     parse   — we reached it and got something that was not the data

   No claim is made that the app is retrying unless it truly is. useResource
   re-fetches on `online` and on tab-visible while in the error state, so
   "it will retry when the connection returns" is a statement of fact. */
import { AlertTriangle, RefreshCw } from "lucide-react";
import "./ui.css";

const COPY = {
  status:  { head: "The data service is not responding",
             body: "Your data is safe — this terminal just can't reach the engine right now. Nothing below is missing; it simply hasn't loaded." },
  network: { head: "Can't reach the data service",
             body: "The request didn't get through. This is usually a connection drop rather than a problem with the engine." },
  parse:   { head: "The data service sent something unreadable",
             body: "The response came back in a shape this screen doesn't recognise. That's on us, not on your connection." },
};

/* `autoRetries` guards the one sentence in here that is a CLAIM about code
   rather than a description of state. It defaults true because useResource —
   which drives every call site but one — really does re-fetch on `online` and
   on tab-visible while in the error state.

   Portfolio is the exception, and it is the reason this prop exists: it drives
   ErrorState from a hand-rolled `reload` with no listeners, so the sentence was
   promising an automatic retry that no code performed. On the one screen in the
   app holding real money. That is exactly the defect class this component was
   written to eliminate, reintroduced by the component itself — a hardcoded
   sentence cannot stay true across call sites, so it has to be conditional. */
export default function ErrorState({ error, onRetry, what = "data", autoRetries = true, className = "" }) {
  const kind = error?.kind || "network";
  const { head, body } = COPY[kind] || COPY.network;
  return (
    <div className={`evc-errstate${className ? " " + className : ""}`} role="alert">
      <AlertTriangle className="evc-errstate-icon" size={20} aria-hidden="true" />
      <div className="evc-errstate-head">{head}</div>
      <p className="evc-errstate-body">
        {body}{autoRetries
          ? " It retries by itself when the connection returns."
          : " Use the button below once your connection is back."}
      </p>
      {onRetry && (
        <button type="button" className="evc-errstate-btn" onClick={onRetry}>
          <RefreshCw size={13} aria-hidden="true" /> Try {what} again
        </button>
      )}
      {error?.detail && (
        <span className="evc-errstate-detail ev-num">{error.detail}</span>
      )}
    </div>
  );
}
