"use client";
import { api } from "@drink/backend/api";
import { formatDateShort, formatEAT, formatKes, formatTime24 } from "@drink/shared";
import { useMutation, useQuery } from "convex/react";
import { AlertCircle, Circle, FileWarning, Scale } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SessionRow } from "@/components/booking/session-row";
import { useCan } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Divider, SectionLabel } from "@/components/ui/card";
import { Empty, ListSkeleton, PageTitle } from "@/components/ui/misc";
import { toAppError } from "@/lib/errors";
import { useNow } from "@/lib/hooks";

export default function TodayPage() {
  useNow(60_000); // keeps "now" current
  const data = useQuery(api.dashboard.today);
  const resend = useMutation(api.messages.resend);
  const router = useRouter();
  const canResend = useCan("messages.resend");
  const [busy, setBusy] = useState<string | null>(null);

  if (!data) {
    return (
      <>
        <PageTitle>Today</PageTitle>
        <ListSkeleton rows={3} />
      </>
    );
  }

  const { sessions, attention, week, currentId } = data;
  const attentionCount =
    attention.failed.length + attention.unclosed.length + attention.missingConsentTomorrow.length + attention.unsettledDeposits.length;

  async function onResend(id: string, who: string) {
    setBusy(id);
    try {
      await resend({ messageId: id as never });
      toast(`SMS resent to ${who}`);
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <PageTitle right={<span className="text-label text-fg-2">{formatEAT(data.now, "EEE d MMM")}</span>}>
        <span className="hidden lg:inline">Today</span>
      </PageTitle>

      <section aria-label="Sessions today" className="flex flex-col gap-1">
        {sessions.length === 0 ? (
          <Empty text="No sessions today." action={<Button onClick={() => router.push("/calendar")}>View calendar</Button>} />
        ) : (
          sessions.map((s, i) => <SessionRow key={s._id} s={s} highlight={s._id === currentId} index={i} />)
        )}
      </section>

      {attentionCount > 0 && (
        <>
          <Divider className="my-6" />
          <section aria-labelledby="attention">
            <SectionLabel id="attention" className="mb-3">
              Attention
            </SectionLabel>
            <ul className="flex flex-col gap-1">
              {attention.failed.map((f) => (
                <li key={f.messageId} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex items-start gap-2 text-label">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-accent-fg" aria-hidden />
                    <span>
                      SMS failed — {f.who} {f.label.toLowerCase()}
                      {f.error && <span className="block text-caption text-fg-3">{f.error}</span>}
                    </span>
                  </span>
                  {canResend && (
                    <Button size="sm" loading={busy === f.messageId} onClick={() => onResend(f.messageId, f.who)}>
                      Resend
                    </Button>
                  )}
                </li>
              ))}
              {attention.unclosed.length > 0 && (
                <li className="flex items-center justify-between gap-3 py-2">
                  <span className="flex items-center gap-2 text-label">
                    <Circle className="size-4 text-fg-2" aria-hidden />
                    {attention.unclosed.length} past session{attention.unclosed.length > 1 ? "s" : ""} not closed
                  </span>
                  <Button size="sm" onClick={() => router.push(`/bookings/${attention.unclosed[0]!.bookingId}`)}>
                    Review
                  </Button>
                </li>
              )}
              {attention.missingConsentTomorrow.map((m) => (
                <li key={m.bookingId} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex items-center gap-2 text-label">
                    <FileWarning className="size-4 text-warning" aria-hidden />
                    Consent missing — {m.clientName}, tomorrow {formatTime24(m.startAt)}
                  </span>
                  <Button size="sm" onClick={() => router.push(`/bookings/${m.bookingId}`)}>
                    Open
                  </Button>
                </li>
              ))}
              {attention.unsettledDeposits.map((u) => (
                <li key={u.bookingId} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex items-center gap-2 text-label">
                    <Scale className="size-4 text-warning" aria-hidden />
                    Deposit to settle — cancelled {formatDateShort(u.startAt)}
                  </span>
                  <Button size="sm" onClick={() => router.push(`/bookings/${u.bookingId}`)}>
                    Decide
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {week && (
        <>
          <Divider className="my-6" />
          <p className="flex flex-wrap items-baseline gap-x-3 text-label">
            <SectionLabel className="inline">This week</SectionLabel>
            <span>
              {week.sessions} session{week.sessions === 1 ? "" : "s"} · <span className="money">{formatKes(week.bookedKes)}</span> booked
            </span>
          </p>
        </>
      )}
      <p className="mt-10 text-caption text-fg-3">
        <Link href="/calendar" className="underline-offset-4 hover:underline">
          Full calendar →
        </Link>
      </p>
    </div>
  );
}
