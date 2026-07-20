/* Phase 1 primitive — Input. Label + field + error/hint; prefix/suffix affixes;
   mono opts numeric fields into tabular figures. Error state wins over hint. */
import { useId } from "react";
import "./ui.css";

export default function Input({
  label, error, hint, prefix, suffix, mono = false, disabled = false,
  className = "", ...rest
}) {
  const id = useId();
  const msgId = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`evc-field${className ? " " + className : ""}`}>
      {label && <label className="evc-label" htmlFor={id}>{label}</label>}
      <div className="evc-input-wrap" data-invalid={!!error} data-disabled={disabled}>
        {prefix && <span className="evc-input-affix">{prefix}</span>}
        <input
          id={id} className="evc-input" data-mono={mono} disabled={disabled}
          aria-invalid={!!error || undefined} aria-describedby={msgId}
          {...rest}
        />
        {suffix && <span className="evc-input-affix">{suffix}</span>}
      </div>
      {error ? <span className="evc-error" id={msgId} role="alert">{error}</span>
        : hint ? <span className="evc-hint" id={msgId}>{hint}</span> : null}
    </div>
  );
}
