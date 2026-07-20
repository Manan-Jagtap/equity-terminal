/* Phase 1 primitive — Button. Variants: primary (accent fill, at most one per
   view), quiet (hairline), ghost (bare), danger. States: hover/active/focus/
   disabled/loading all live in ui.css. */
import "./ui.css";

export default function Button({
  variant = "quiet", size = "md", loading = false, disabled = false,
  type = "button", className = "", children, ...rest
}) {
  return (
    <button
      type={type}
      data-variant={variant}
      data-size={size}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`evc-btn${loading ? " is-loading" : ""}${className ? " " + className : ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}
