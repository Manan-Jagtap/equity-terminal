/* Phase 1 primitive — Modal (Radix Dialog: focus trap, scroll lock, ESC/overlay
   close, aria-labelledby/-describedby wired automatically).
   Controlled: <Modal open={o} onOpenChange={setO} title="…" description="…">…</Modal> */
import * as RDialog from "@radix-ui/react-dialog";
import "./ui.css";

export default function Modal({ open, onOpenChange, title, description, children, trigger }) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay className="evc-modal-overlay" />
        <RDialog.Content className="evc-modal">
          {title && <RDialog.Title className="evc-modal-title">{title}</RDialog.Title>}
          {description
            ? <RDialog.Description className="evc-modal-desc">{description}</RDialog.Description>
            : <RDialog.Description style={{ display: "none" }} />}
          {children}
          <RDialog.Close asChild>
            <button className="evc-modal-x" aria-label="Close">✕</button>
          </RDialog.Close>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
