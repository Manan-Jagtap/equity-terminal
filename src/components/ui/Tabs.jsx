/* Phase 1 primitive — Tabs (Radix headless: roving focus, arrow keys, ARIA).
   Underline style — terminal feel, accent marks the active trigger.
   Usage: <Tabs tabs={[{id,label,content}]} defaultId="x" onChange={fn} /> */
import * as RTabs from "@radix-ui/react-tabs";
import "./ui.css";

export default function Tabs({ tabs = [], defaultId, value, onChange, className = "" }) {
  return (
    <RTabs.Root
      className={className || undefined}
      defaultValue={defaultId || tabs[0]?.id}
      value={value}
      onValueChange={onChange}
    >
      <RTabs.List className="evc-tabs-list">
        {tabs.map((t) => (
          <RTabs.Trigger key={t.id} value={t.id} className="evc-tabs-trigger">
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {tabs.map((t) => (
        <RTabs.Content key={t.id} value={t.id} className="evc-tabs-content">
          {t.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}
