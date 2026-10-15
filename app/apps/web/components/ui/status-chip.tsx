import { CalendarCheck, CheckCircle2, FileWarning, UserX, Wallet, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type ChipKind = "confirmed" | "completed" | "no_show" | "cancelled" | "balance" | "consent" | "neutral" | "success" | "warning";

const styles: Record<ChipKind, { cls: string; icon?: LucideIcon; label?: string }> = {
  confirmed: { cls: "bg-hover text-fg", icon: CalendarCheck, label: "Confirmed" },
  completed: { cls: "bg-success-subtle text-success", icon: CheckCircle2, label: "Completed" },
  no_show: { cls: "bg-warning-subtle text-warning", icon: UserX, label: "No-show" },
  cancelled: { cls: "bg-transparent text-fg-3 line-through", icon: XCircle, label: "Cancelled" },
  balance: { cls: "bg-warning-subtle text-warning", icon: Wallet },
  consent: { cls: "bg-warning-subtle text-warning", icon: FileWarning, label: "Consent missing" },
  neutral: { cls: "bg-hover text-fg-2" },
  success: { cls: "bg-success-subtle text-success", icon: CheckCircle2 },
  warning: { cls: "bg-warning-subtle text-warning", icon: FileWarning },
};

/** §4.4 — height 24, radius-full, 12px/500, icon + text always (never colour alone). */
export function StatusChip({
  kind,
  children,
  icon,
  className,
}: {
  kind: ChipKind;
  children?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const s = styles[kind];
  const Icon = icon ?? s.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-caption font-medium whitespace-nowrap transition-colors duration-200",
        s.cls,
        className,
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children ?? s.label}
    </span>
  );
}
