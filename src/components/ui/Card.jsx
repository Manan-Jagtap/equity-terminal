/* Phase 1 primitive — Card. The app's default surface: a raised panel with a
   real 1px hairline at --ev-r-card. Interactive cards lift on hover (elev-2 +
   1px translate — feedback, not motion).

   `surface` picks the layer (raise | over | base), `tone` the hairline
   (default | strong | active). Both exist because the first eight real frames
   asked for them; see ui.css for what each replaces. Anything the primitive
   does not own — margin, grid placement, flex layout of the CONTENTS — stays
   the caller's business and rides through `style`/`className`. */
import "./ui.css";

export default function Card({
  pad = "md", surface = "raise", tone = "default",
  interactive = false, as: Tag = "div", className = "", children, ...rest
}) {
  return (
    <Tag
      className={`evc-card${className ? " " + className : ""}`}
      data-pad={pad}
      data-surface={surface}
      data-tone={tone}
      data-interactive={interactive}
      {...(interactive ? { tabIndex: 0, role: rest.onClick ? "button" : undefined } : {})}
      {...rest}
    >
      {children}
    </Tag>
  );
}
