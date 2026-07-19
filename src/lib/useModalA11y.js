/* UX-06: accessible-dialog behaviour for our overlays (AuthModal, CommandPalette,
   PrivacyPolicy). Returns a ref to spread onto the dialog container; while the
   dialog is `open` it:
     - traps Tab / Shift+Tab inside the dialog (focus can't leak to the page behind),
     - restores focus to whatever was focused before it opened, on close.
   Pair it with role="dialog" aria-modal="true" and an aria-label on the container.
   Esc-to-close and initial autofocus are left to the callers (they already do it). */
import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function useModalA11y(open) {
  const ref = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement;

    const onKey = (e) => {
      if (e.key !== "Tab" || !ref.current) return;
      const nodes = ref.current.querySelectorAll(FOCUSABLE);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !ref.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      // Restore focus to the trigger element when the dialog closes.
      const el = restoreRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [open]);

  return ref;
}
