/* Phase 1 primitive — Button. Variants: primary (accent fill, at most one per
   view), quiet (hairline), ghost (bare), danger. Sizes xs/sm/md/lg are
   24/28/34/40px tall; see ui.css for which real control set each end.
   States: hover/active/focus/disabled/loading all live in ui.css.

   `tone="muted"` drops the resting ink to --ev-text-3 for secondary chrome — a
   Cancel, a row action, an unselected segment — without inventing a variant.
   `iconOnly` makes the control square at whatever size step it is on.
   `pressed` drives aria-pressed, so a selected segment in a toolbar is
   ANNOUNCED as selected and not merely tinted; pass it only for toggles. */
import "./ui.css";

export default function Button({
  variant = "quiet", size = "md", tone, iconOnly = false, pressed,
  loading = false, disabled = false,
  type = "button", className = "", children, ...rest
}) {
  return (
    <button
      type={type}
      data-variant={variant}
      data-size={size}
      data-tone={tone}
      data-icon={iconOnly || undefined}
      aria-pressed={pressed}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`evc-btn${loading ? " is-loading" : ""}${className ? " " + className : ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}
