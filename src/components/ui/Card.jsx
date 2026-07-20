/* Phase 1 primitive — Card. Raised surface with hairline elevation; interactive
   cards lift on hover (elev-2 + 1px translate — feedback, not motion). */
import "./ui.css";

export default function Card({
  pad = "md", interactive = false, as: Tag = "div", className = "", children, ...rest
}) {
  return (
    <Tag
      className={`evc-card${className ? " " + className : ""}`}
      data-pad={pad}
      data-interactive={interactive}
      {...(interactive ? { tabIndex: 0, role: rest.onClick ? "button" : undefined } : {})}
      {...rest}
    >
      {children}
    </Tag>
  );
}
