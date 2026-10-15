"use client";
import { api } from "@drink/backend/api";
import type { Doc, Id } from "@drink/backend/dataModel";
import { formatEAT } from "@drink/shared";
import { useMutation, usePaginatedQuery } from "convex/react";
import { CheckCircle2, Clock, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Empty, ListSkeleton, PageTitle } from "@/components/ui/misc";
import { ChoiceChips } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { toAppError } from "@/lib/errors";

type Filter = "all" | "scheduled" | "delivered" | "failed";
const STATUS: Record<Doc<"messages">["status"], { icon: typeof Clock; label: string; cls: string }> = {
  queued: { icon: Clock, label: "Scheduled", cls: "text-fg-2" },
  sent: { icon: Send, label: "Sent", cls: "text-fg-2" },
  delivered: { icon: CheckCircle2, label: "Delivered", cls: "text-success" },
  failed: { icon: XCircle, label: "Failed", cls: "text-accent-fg" },
  cancelled: { icon: XCircle, label: "Cancelled", cls: "text-fg-3" },
};

export default function MessagesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const { results, status, loadMore } = usePaginatedQuery(api.messages.list, { filter }, { initialNumItems: 40 });
  const resend = useMutation(api.messages.resend);
  const canResend = useCan("messages.resend");
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function onResend(id: Id<"messages">, who: string) {
    setBusy(id);
    try {
      await resend({ messageId: id });
      toast(`SMS resent to ${who}`);
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="hidden lg:block">
        <PageTitle>Messages</PageTitle>
      </div>
      <ChoiceChips
        label="Filter messages"
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "scheduled", label: "Scheduled" },
          { value: "delivered", label: "Delivered" },
          { value: "failed", label: "Failed" },
        ]}
      />
      {status === "LoadingFirstPage" ? (
        <ListSkeleton rows={6} />
      ) : results.length === 0 ? (
        <Empty text={filter === "all" ? "No messages yet." : `No ${filter} messages.`} />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {results.map((m) => {
            const st = STATUS[m.status];
            const open = expanded === m._id;
            return (
              <li key={m._id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setExpanded(open ? null : m._id)} aria-expanded={open}>
                    <p className="truncate font-semibold">{m.recipientName}</p>
                    <p className="text-label text-fg-2">
                      {m.templateLabel} · <span className="tabular">{formatEAT(m.sentAt ?? m.sendAt, "d MMM HH:mm")}</span>
                    </p>
                    <p className={cn("mt-1 flex items-center gap-1.5 text-label font-medium", st.cls)}>
                      <st.icon className="size-3.5" aria-hidden /> {st.label}
                      {m.resentAt && <span className="font-normal text-fg-3">· resent</span>}
                    </p>
                  </button>
                  {canResend && (m.status === "failed" || m.status === "delivered" || m.status === "sent") && (
                    <Button
                      size="sm"
                      variant={m.status === "failed" ? "secondary" : "ghost"}
                      loading={busy === m._id}
                      onClick={() => onResend(m._id, m.recipientName)}
                    >
                      Resend
                    </Button>
                  )}
                </div>
                {open && (
                  <div className="mt-2 rounded-md bg-elevated p-3 text-label">
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-2 text-caption text-fg-3 tabular">
                      To {m.to}
                      {m.error && <> · {m.error}</>}
                      {m.bookingId && (
                        <>
                          {" · "}
                          <Link href={`/bookings/${m.bookingId}`} className="underline underline-offset-4">
                            Booking
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {status === "CanLoadMore" && (
        <Button block className="mt-4" onClick={() => loadMore(40)}>
          Load more
        </Button>
      )}
    </div>
  );
}
