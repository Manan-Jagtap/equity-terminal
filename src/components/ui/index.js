/* Phase 1 primitives — single import surface. Importing anything here pulls
   ui.css once. Composites (ValuationPanel, PriceChart, CommandPalette…) join
   as Phase 2 builds them. */
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
export { default as AlphaScore } from "./AlphaScore.jsx";
export { default as ValuationPanel } from "./ValuationPanel.jsx";
export { default as FinancialsTable } from "./FinancialsTable.jsx";
export { default as Sparkline } from "./Sparkline.jsx";
export { default as CompanyRow } from "./CompanyRow.jsx";
export { default as NumberTicker } from "./NumberTicker.jsx";
