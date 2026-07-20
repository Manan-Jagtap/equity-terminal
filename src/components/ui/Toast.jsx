/* Phase 1 primitive — Toast. Deliberately small: context + aria-live region,
   auto-dismiss, max 3 visible (oldest drops). Tones map to the verdict palette.

     <ToastProvider>…</ToastProvider>          // once, app root
     const toast = useToast();
     toast("Saved", { tone: "success" });      // tone: info | success | error  */
import { useCallback, useRef, useState } from "react";
import { color } from "../../design/tokens.js";
import { ToastCtx } from "./toast-context.js";
import "./ui.css";

const TONE = { info: color.accent, success: color.buy, error: color.avoid };
const MAX_VISIBLE = 3;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message, { tone = "info", duration = 4000 } = {}) => {
    const id = nextId.current++;
    setToasts((ts) => [...ts.slice(-(MAX_VISIBLE - 1)), { id, message, tone }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="evc-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="evc-toast" style={{ "--evc-toast-c": TONE[t.tone] || TONE.info }}>
            <span>{t.message}</span>
            <button className="evc-toast-x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>✕</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
