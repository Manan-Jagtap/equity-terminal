/* Phase 1 primitive — Tooltip (Radix: hover+focus trigger, ESC dismiss, ARIA).
   Content is supporting context only — never the sole carrier of meaning.
   App-level <TooltipProvider> once; then <Tooltip content="…"><button/></Tooltip>. */
import * as RTooltip from "@radix-ui/react-tooltip";
import "./ui.css";

export function TooltipProvider({ children }) {
  return <RTooltip.Provider delayDuration={250}>{children}</RTooltip.Provider>;
}

export default function Tooltip({ content, side = "top", children }) {
  if (!content) return children;
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content className="evc-tooltip" side={side} sideOffset={6} collisionPadding={8}>
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}
