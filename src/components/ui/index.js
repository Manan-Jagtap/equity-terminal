/* Phase 1 primitives — single import surface. Importing anything here pulls
   ui.css once. Composites (ValuationPanel, PriceChart, CommandPalette…) join
   as Phase 2 builds them.

   DO NOT import this barrel from a screen that App.jsx loads EAGERLY (Watchlist
   and the shell; everything else is behind lazyReload). One named import from
   here pulls the whole module graph — Modal and Tabs and Tooltip drag
   @radix-ui/react-dialog, -tabs and -tooltip — into the entry chunk, which is
   the one thing scripts/check-bundle-budget.mjs gates (175 kB gzip, currently
   132.9). Import the module directly instead:

       import Card from "./ui/Card.jsx";        // yes
       import { Card } from "./ui";             // no, from an eager screen

   Worth writing down because it is a plausible reason the primitives sat at
   zero call sites: the obvious import is the one that breaks the budget gate,
   and nothing said so. Lazy screens may use the barrel freely. */
import "./ui.css";

export { default as Button } from "./Button.jsx";
export { default as Input } from "./Input.jsx";
export { default as Badge, VerdictBadge } from "./Badge.jsx";
export { default as Card } from "./Card.jsx";
export { default as Tabs } from "./Tabs.jsx";
export { default as Tooltip, TooltipProvider } from "./Tooltip.jsx";
export { default as Modal } from "./Modal.jsx";
export { ToastProvider } from "./Toast.jsx";
export { useToast } from "./toast-context.js";
export { default as Skeleton, SkeletonText } from "./Skeleton.jsx";
export { default as Table } from "./Table.jsx";
export { default as StatTile } from "./StatTile.jsx";
export { default as PageHeader } from "./PageHeader.jsx";
export { default as ErrorState } from "./ErrorState.jsx";
export { default as AlphaScore } from "./AlphaScore.jsx";
export { default as ValuationPanel } from "./ValuationPanel.jsx";
export { default as FinancialsTable } from "./FinancialsTable.jsx";
export { default as Sparkline } from "./Sparkline.jsx";
export { default as CompanyRow } from "./CompanyRow.jsx";
export { default as NumberTicker } from "./NumberTicker.jsx";
