import { formatTime24 } from "@drink/shared";
import { CheckCircle2, UserX, XCircle } from "lucide-react";
import Link from "next/link";
import type { BookingSummary } from "@/components/booking/session-row";
import { cn } from "@/lib/cn";

/** 3px left bar coloured by location: Nairobi = --text, Kericho = --text-2 dashed, other = --text-3. */
export function locationBar(loc: string) {
  return loc === "nairobi" ? "border-l-fg" : loc === "kericho" ? "border-l-fg-2 border-dashed" : "border-l-fg-3";
}

export function SessionBlock({ s, compact, style }: { s: BookingSummary; compact?: boolean; style?: React.CSSProperties }) {
  return (
    <Link
      href={`/bookings/${s._id}`}
      style={style}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "pop-in block overflow-hidden rounded-sm border border-line border-l-[3px] bg-surface px-2 py-1 text-caption hover:bg-hover",
        locationBar(s.location),
        s.status === "completed" && "opacity-60",
        s.status === "cancelled" && "text-fg-3 line-through opacity-60",
      )}
    >
      <span className="flex items-center gap-1 font-semibold text-fg">
        {s.status === "completed" && <CheckCircle2 className="size-3 shrink-0 text-success" aria-label="Completed" />}
        {s.status === "no_show" && <UserX className="size-3 shrink-0 text-warning" aria-label="No-show" />}
        {s.status === "cancelled" && <XCircle className="size-3 shrink-0" aria-label="Cancelled" />}
        <span className="truncate">{s.clientName}</span>
      </span>
      {!compact && (
        <span className="block truncate text-fg-2 tabular">
          {formatTime24(s.startAt)}–{formatTime24(s.endAt)}
        </span>
      )}
    </Link>
  );
}
