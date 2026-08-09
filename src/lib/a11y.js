/* Keyboard affordances for the two cases where a real <button> is not available.
 *
 * A sweep of the app found 44 interactive <div>/<span>/<td>/<tr>/<li> carrying
 * onClick with no onKeyDown, no role and no tabIndex — reachable by MOUSE ONLY.
 * Most of those become real buttons, which is always the better answer: native
 * buttons get focus, Enter, Space and :focus-visible for free, and cannot drift
 * out of sync with a hand-rolled key handler.
 *
 * These helpers are for the residue where that is genuinely impossible:
 *
 *   rowActivate  — a clickable <tr>. A table row cannot contain a button that
 *                  wraps the whole row (a <button> is not valid inside <tr>
 *                  outside a cell), and wrapping each CELL turns one control
 *                  into eight tab stops for the same action.
 *   useEscape    — a modal backdrop. A backdrop is NOT a control: making it a
 *                  button adds a meaningless tab stop announcing nothing. The
 *                  correct affordance for "dismiss this overlay" is Escape,
 *                  which is also what a screen-reader user will reach for.
 *
 * Space needs preventDefault or the page scrolls underneath the activation,
 * which is the single most common bug in hand-rolled versions of this.
 */
import { useEffect } from "react";

/* Spread onto a clickable <tr>. `label` becomes the accessible name, since a
   row's own text is a column soup that reads poorly out of context. */
export function rowActivate(onActivate, label) {
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": label || undefined,
    onClick: onActivate,
    onKeyDown: (e) => {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      // Space scrolls the page by default; a row that scrolls the viewport out
      // from under the user on activation is worse than one that does nothing.
      e.preventDefault();
      onActivate(e);
    },
  };
}

/* Close an overlay on Escape. Pass the same handler the backdrop click uses.
   `active` lets a caller mount this unconditionally and still only listen while
   the overlay is open — a listener that fires when nothing is open would close
   the NEXT overlay the moment it appears. */
export function useEscape(onClose, active = true) {
  useEffect(() => {
    if (!active || typeof onClose !== "function") return;
    const onKey = (e) => { if (e.key === "Escape") onClose(e); };
    // capture: a focused input inside the overlay may stopPropagation on
    // keydown, and Escape must still dismiss.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, active]);
}

/* Chrome reset for a <div>/<span> that was really a control and is now a real
   <button>. Spread it AFTER the element's own style so the button defaults
   (grey background, border, centred text, inherited-but-not-really font) do not
   change how it looks. Kept here rather than repeated at 23 call sites, because
   the whole point of the conversion is that it must be invisible. */
export const buttonReset = {
  background: "none",
  border: "none",
  padding: 0,
  margin: 0,
  font: "inherit",
  color: "inherit",
  textAlign: "left",
  appearance: "none",
};
