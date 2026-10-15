import type { api } from "@drink/backend/api";
import type { FunctionReturnType } from "convex/server";
import { formatKes, formatTime24, LOCATION_LABEL } from "@drink/shared";
import { CheckCircle2, FileWarning, Flag } from "lucide-react";
import Link from "next/link";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/cn";

export type BookingSummary = FunctionReturnType<typeof api.bookings.range>[number];

export function locationLabel(s: Pick<BookingSummary, "location" | "locationNote">) {
  return s.location === "other" && s.locationNote ? s.locationNote : LOCATION_LABEL[s.location];
}

/** Consent + balance indicators — icon + text, never colour alone. */
export function SessionBadges({ s }: { s: BookingSummary }) {
  if (s.status !== "confirmed") return <StatusChip kind={s.status} />;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {s.consentSigned ? (
        <span className="inline-flex items-center gap-1 text-caption font-medium text-fg-2">
          <CheckCircle2 className="size-3.5 text-success" aria-hidden /> Consent
        </span>
      ) : (
        <StatusChip kind="consent" icon={FileWarning}>
          Consent not signed
        </StatusChip>
      )}
      {s.balanceKes > 0 && <StatusChip kind="balance">{formatKes(s.balanceKes)} due</StatusChip>}
    </div>
  );
}

export function SessionRow({ s, highlight, index = 0 }: { s: BookingSummary; highlight?: boolean; index?: number }) {
  return (
    <Link
      href={`/bookings/${s._id}`}
      className={cn(
        "enter tap block rounded-lg transition-colors duration-150",
        highlight
          ? "border border-line border-l-[3px] border-l-accent bg-surface p-4 shadow-card hover:bg-hover lg:p-5"
          : "px-1 py-3 hover:bg-hover",
        s.status === "completed" && "opacity-60",
      )}
      style={{ animationDelay: `${Math.min(index, 5) * 30}ms` }}
    >
      {highlight && <p className="mb-1 text-caption font-semibold tracking-wider text-accent-fg uppercase">Now</p>}
      <p className="text-label text-fg-2 tabular">
        {formatTime24(s.startAt)} – {formatTime24(s.endAt)} · {locationLabel(s)}
      </p>
      <p className={cn("flex items-center gap-2 font-semibold", highlight ? "text-subhead" : "")}>
        {s.clientName}
        {s.clientFlagged && <Flag className="size-3.5 text-warning" aria-label="Flagged client" />}
      </p>
      {s.tattooShort && <p className="truncate text-label text-fg-2">{s.tattooShort}</p>}
      <div className="mt-2">
        <SessionBadges s={s} />
      </div>
    </Link>
  );
}
