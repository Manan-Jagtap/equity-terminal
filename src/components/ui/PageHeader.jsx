/* Phase 2c primitive — PageHeader.

   Why this exists: an audit of the 15 top-level screens found 11 with NO <h1>
   or <h2> anywhere. Screener, Portfolio, Sectors, Results, Watchlist, Compare
   and Ownership all open flush against the viewport edge with a filter bar and
   no name. That is two separate defects wearing one face:

     * Craft — every screen announced itself differently (or not at all), which
       is the specific thing that makes a product read as assembled rather than
       designed. MarketDashboard had a 32px serif h1; TrackRecord had its own;
       the rest had nothing.
     * Accessibility — a document with no heading gives a screen-reader user no
       structure to navigate by, and "skip to main heading" lands nowhere.
       WCAG 2.4.6 (Headings and Labels) and 1.3.1 (Info and Relationships).

   One <h1> per screen, mounted through here, fixes both at once.

   Slots, all optional except `title`:
     eyebrow  uppercase micro-label above the title (section/category)
     title    the <h1> — the only one on the page
     meta     right-aligned status line (as-of stamp, row count) — mono, dim
     actions  right-aligned controls (Refresh, Export…)
     children a subtitle/description paragraph under the title

   Motion: one 8px settle on mount via the house slideUp variant, swapped for an
   opacity-only instant under prefers-reduced-motion by pick(). Uses <m.*> and
   NOT <motion.*> — main.jsx wraps the tree in LazyMotion(domAnimation), so the
   <m.*> form keeps the full framer feature graph out of the entry chunk (the
   CI gate is 175 kB gzip). Using <motion.*> here would silently blow that. */
import { m, useReducedMotion } from "motion/react";
import { pick } from "../../design/motion.js";
import "./ui.css";

export default function PageHeader({
  eyebrow, title, meta, actions, children, className = "", ...rest
}) {
  const v = pick(useReducedMotion());
  return (
    <m.header
      variants={v.slideUp}
      initial="hidden"
      animate="show"
      className={`evc-pagehead${className ? " " + className : ""}`}
      {...rest}
    >
      <div className="evc-pagehead-main">
        {eyebrow && <span className="evc-pagehead-eyebrow">{eyebrow}</span>}
        <h1 className="evc-pagehead-title">{title}</h1>
        {children && <p className="evc-pagehead-sub">{children}</p>}
      </div>
      {(meta || actions) && (
        <div className="evc-pagehead-aside">
          {meta && <span className="evc-pagehead-meta ev-num">{meta}</span>}
          {actions}
        </div>
      )}
    </m.header>
  );
}
