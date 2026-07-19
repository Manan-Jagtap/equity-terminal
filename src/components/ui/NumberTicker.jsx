/* Phase 3 composite — NumberTicker. Tweens the DISPLAYED number when `value`
   changes (live prices, recomputed fair values) so the eye tracks the change
   instead of a jump cut. Motion explains, never decorates:
   - first render is instant (nothing to explain yet)
   - prefers-reduced-motion → instant swap, always
   - transforms nothing; only text content updates (compositor-cheap)
   Formatter is read through a ref so an inline arrow never restarts a tween. */
import { useLayoutEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";
import { motionTokens } from "../../design/tokens.js";
import "./ui.css";

export default function NumberTicker({ value, format = (v) => String(Math.round(v)), className = "", ...rest }) {
  const ref = useRef(null);
  const prev = useRef(null);
  const fmtRef = useRef(format);
  const reduce = useReducedMotion();

  // Layout effects (not plain effects): they run BEFORE paint, so on a value
  // change the tween's starting frame is written before the browser shows
  // React's freshly-rendered final value — no one-frame flash. This one runs
  // every render, ahead of the tween below (declaration order), keeping the
  // formatter current.
  useLayoutEffect(() => { fmtRef.current = format; });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || value == null || !isFinite(value)) { prev.current = null; return; }
    const from = prev.current;
    prev.current = value;
    if (from == null || from === value || reduce) {
      el.textContent = fmtRef.current(value);
      return;
    }
    el.textContent = fmtRef.current(from);   // starting frame, synchronously pre-paint
    const ctrl = animate(from, value, {
      duration: motionTokens.duration.slow,
      ease: motionTokens.ease,
      onUpdate: (v) => { el.textContent = fmtRef.current(v); },
    });
    return () => ctrl.stop();
  }, [value, reduce]);

  return (
    <span ref={ref} className={`ev-num${className ? " " + className : ""}`} {...rest}>
      {value == null || !isFinite(value) ? "—" : format(value)}
    </span>
  );
}
