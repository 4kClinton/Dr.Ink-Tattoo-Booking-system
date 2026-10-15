"use client";
import { X } from "lucide-react";
import { Drawer } from "vaul";
import { cn } from "@/lib/cn";
import { useIsDesktop } from "@/lib/hooks";
import { Button } from "./button";

/**
 * §4.5 bottom sheet on mobile (radius-xl top, drag handle, drag-to-dismiss) and a 480px right
 * panel on desktop. vaul handles focus trap, Esc, aria-modal and focus return to the trigger.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  full,
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  full?: boolean;
  dismissible?: boolean;
}) {
  const desktop = useIsDesktop();
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction={desktop ? "right" : "bottom"}
      closeThreshold={0.3}
      dismissible={dismissible}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-[var(--backdrop)]" />
        <Drawer.Content
          className={cn(
            "fixed z-50 flex flex-col bg-surface shadow-sheet outline-none",
            desktop
              ? "inset-y-0 right-0 w-[480px] max-w-full border-l border-line"
              : cn(
                  "inset-x-0 bottom-0 mx-auto max-w-[640px] rounded-t-xl border-t border-line",
                  full ? "h-[96dvh]" : "max-h-[92dvh]",
                ),
          )}
        >
          {!desktop && <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong" aria-hidden />}
          <div className="flex items-start justify-between gap-4 px-4 pt-3 pb-2 sm:px-6 lg:pt-6">
            <div>
              <Drawer.Title className="text-heading font-semibold tracking-[-0.01em]">{title}</Drawer.Title>
              {description ? (
                <Drawer.Description className="mt-0.5 text-label text-fg-2">{description}</Drawer.Description>
              ) : (
                <Drawer.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</Drawer.Description>
              )}
            </div>
            <Drawer.Close className="tap -mr-2 flex size-11 items-center justify-center rounded-md text-fg-2 hover:bg-hover" aria-label="Close">
              <X className="size-5" />
            </Drawer.Close>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6" data-vaul-no-drag>
            {children}
          </div>
          {footer && <div className="pb-safe border-t border-line px-4 pt-3 pb-3 sm:px-6">{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Confirmation sheet for destructive actions — the confirm uses the Danger-confirm style. */
export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  loading,
  children,
  disabled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <div className="flex gap-3">
          <Button block onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button block variant="danger" onClick={onConfirm} loading={loading} disabled={disabled}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {body && <p className="text-fg-2">{body}</p>}
      {children}
    </Sheet>
  );
}
