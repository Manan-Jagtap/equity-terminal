/* Framer/Motion variant presets — the ONLY entrance/interaction motions in the
   redesign. Grounded in tokens.js motionTokens: transforms & opacity ONLY, tight
   durations, the two house curves + two springs. Phase 0 of the redesign.

   Reduced-motion is a first-class contract: tokens.css already zeroes CSS
   durations under prefers-reduced-motion, but JS springs/variants must be
   swapped at the call site. Every consumer does:

     import { motion, useReducedMotion } from "motion/react";
     import { pick } from "../design/motion.js";
     const v = pick(useReducedMotion());        // full set, or opacity-only instant
     <motion.div variants={v.slideUp} initial="hidden" animate="show" exit="exit" />

   so the SAME state graph (hidden→show→exit) works with or without motion. */
import { motionTokens as M } from "./tokens.js";

const t = (d = M.duration.base, ease = M.ease) => ({ duration: d, ease });

/* Full-motion variants. slideUp/scaleIn use springs for a physical settle;
   fade uses a timed curve. Displacement stays ≤8px (entrances) / ≤2px (feedback). */
export const variants = {
  fade: {
    hidden: { opacity: 0 },
    show:   { opacity: 1, transition: t() },
    exit:   { opacity: 0, transition: t(M.duration.fast) },
  },
  slideUp: {                                   // cards, panels, page sections
    hidden: { opacity: 0, y: 8 },
    show:   { opacity: 1, y: 0, transition: M.springSoft },
    exit:   { opacity: 0, y: 4, transition: t(M.duration.fast) },
  },
  scaleIn: {                                   // popovers, tooltips, menus, toasts
    hidden: { opacity: 0, scale: 0.96 },
    show:   { opacity: 1, scale: 1, transition: M.spring },
    exit:   { opacity: 0, scale: 0.98, transition: t(M.duration.fast) },
  },
  /* List/table reveal: container orchestrates, child animates (0.03s/item per
     the motion guidance — keeps long lists from feeling sluggish). */
  stagger: {
    hidden: {},
    show: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
  },
  staggerItem: {
    hidden: { opacity: 0, y: 6 },
    show:   { opacity: 1, y: 0, transition: t(M.duration.base) },
  },
};

/* Interactive feedback for motion.* `whileHover` / `whileTap`.
   Lift is ≤2px so it reads as feedback, not motion. */
export const hoverLift = { y: -1, transition: M.spring };
export const tapPress  = { scale: 0.98, transition: t(M.duration.fast) };

/* Reduced-motion mirror: identical state names, opacity-only, instant — no
   transform, no duration. Honors prefers-reduced-motion at the component level. */
const instant = { duration: 0 };
export const reduced = {
  fade:        { hidden: { opacity: 0 }, show: { opacity: 1, transition: instant }, exit: { opacity: 0, transition: instant } },
  slideUp:     { hidden: { opacity: 0 }, show: { opacity: 1, transition: instant }, exit: { opacity: 0, transition: instant } },
  scaleIn:     { hidden: { opacity: 0 }, show: { opacity: 1, transition: instant }, exit: { opacity: 0, transition: instant } },
  stagger:     { hidden: {}, show: { transition: instant } },
  staggerItem: { hidden: { opacity: 0 }, show: { opacity: 1, transition: instant } },
};

/* Pick the right set for the current preference (pass useReducedMotion()'s value). */
export const pick = (reducedMotion) => (reducedMotion ? reduced : variants);
