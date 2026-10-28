"use client";
import { api } from "@drink/backend/api";
import type { Id } from "@drink/backend/dataModel";
import { DAY_MS, firstName, formatDateShort, startOfDayEAT, waLink } from "@drink/shared";
import type { FunctionReturnType } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { CalendarClock, CheckCircle2, MessageCircle, Phone, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button, LinkButton } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { Empty, ListSkeleton, PageTitle } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { toAppError } from "@/lib/errors";

type Data = FunctionReturnType<typeof api.reminders.list>;
type Reminder = Data["due"][number];

const TABS = [
  { value: "open", label: "To do" },
  { value: "checked", label: "Checked" },
] as const;

function dueLabel(dueAt: number) {
  const days = Math.round((startOfDayEAT(Date.now()) - dueAt) / DAY_MS);
  if (days === 0) return "Due today";
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} overdue`;
  if (days === -1) return "Due tomorrow";
  return `Due ${formatDateShort(dueAt)}`;
}

export default function RemindersPage() {
  const [tab, setTab] = useState<"open" | "checked">("open");
  const data = useQuery(api.reminders.list, {});
  const [checking, setChecking] = useState<Reminder | null>(null);
  const [sheetKey, setSheetKey] = useState(0);

  function openCheck(r: Reminder) {
    setChecking(r);
    setSheetKey((k) => k + 1);
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="hidden lg:block">
        <PageTitle>Reminders</PageTitle>
      </div>
      <p className="mb-4 text-label text-fg-2">Check on every client 7 days after their tattoo to see how it&rsquo;s healing.</p>

      <div className="sticky top-14 z-20 -mx-4 bg-bg px-4 pb-3 sm:-mx-6 sm:px-6 lg:top-0 lg:pt-2">
        <Segmented
          label="Show"
          value={tab}
          onChange={setTab}
          options={TABS.map((t) => ({
            ...t,
            label: t.value === "open" && data?.due.length ? `${t.label} · ${data.due.length}` : t.label,
          }))}
        />
      </div>

      <div className="mt-2">
        {data === undefined ? (
          <ListSkeleton rows={4} />
        ) : tab === "open" ? (
          <>
            <SectionLabel className="mb-3">Due now</SectionLabel>
            {data.due.length === 0 ? (
              <Empty text="No check-ins due. Everyone's healing on schedule." />
            ) : (
              <ul className="flex flex-col gap-3">
                {data.due.map((r, i) => (
                  <ReminderCard key={r.bookingId} r={r} i={i} onCheck={() => openCheck(r)} />
                ))}
              </ul>
            )}

            {data.upcoming.length > 0 && (
              <>
                <SectionLabel className="mt-8 mb-3">Coming up</SectionLabel>
                <ul className="flex flex-col gap-3">
                  {data.upcoming.map((r, i) => (
                    <ReminderCard key={r.bookingId} r={r} i={i} onCheck={() => openCheck(r)} />
                  ))}
                </ul>
              </>
            )}
          </>
        ) : data.checked.length === 0 ? (
          <Empty text="No check-ins done in the last 30 days." />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.checked.map((r, i) => (
              <ReminderCard key={r.bookingId} r={r} i={i} />
            ))}
          </ul>
        )}
      </div>

      <CheckSheet key={sheetKey} reminder={checking} onClose={() => setChecking(null)} />
    </div>
  );
}

function ReminderCard({ r, i, onCheck }: { r: Reminder; i: number; onCheck?: () => void }) {
  const undo = useMutation(api.reminders.undoChecked);
  const today = startOfDayEAT(Date.now());
  const overdue = !r.checkedAt && r.dueAt < today;
  const dueNow = !r.checkedAt && r.dueAt <= today;
  const message = `Hi ${firstName(r.clientName)}, it's Dr.Ink. Just checking in on your new tattoo. How is it healing? Any redness, swelling or questions, let us know.`;

  async function onUndo() {
    try {
      await undo({ bookingId: r.bookingId as Id<"bookings"> });
      toast("Moved back to To do");
    } catch (e) {
      toast(toAppError(e).message);
    }
  }

  return (
    <li className="enter rounded-lg border border-line bg-surface p-4 shadow-card" style={{ animationDelay: `${Math.min(i, 5) * 30}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/clients/${r.clientId}`} className="font-semibold hover:underline">
            {r.clientName}
          </Link>
          <p className="mt-0.5 text-label text-fg-2">
            <Link href={`/bookings/${r.bookingId}`} className="hover:underline">
              Tattooed {formatDateShort(r.completedAt)}
            </Link>
            {r.tattooCount > 1 && <> · {r.tattooCount} tattoos</>}
          </p>
        </div>
        {r.checkedAt ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-subtle px-2.5 py-1 text-caption font-medium text-success">
            <CheckCircle2 className="size-3.5" aria-hidden /> Checked {formatDateShort(r.checkedAt)}
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium",
              overdue ? "bg-accent-subtle text-accent-fg" : dueNow ? "bg-warning-subtle text-warning" : "border border-line-strong text-fg-2",
            )}
          >
            <CalendarClock className="size-3.5" aria-hidden /> {dueLabel(r.dueAt)}
          </span>
        )}
      </div>

      {r.checkedAt && (r.note || r.checkedBy) && (
        <p className="mt-2 text-label text-fg-2 whitespace-pre-wrap">
          {r.note}
          {r.checkedBy && <span className="text-fg-3">{r.note ? " — " : ""}{r.checkedBy}</span>}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {r.phone && (
          <>
            <a href={`tel:${r.phone}`} className="tap inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-label font-semibold hover:bg-hover">
              <Phone className="size-4" aria-hidden /> Call
            </a>
            <a
              href={waLink(r.phone, message)}
              target="_blank"
              rel="noreferrer"
              className="tap inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-label font-semibold hover:bg-hover"
            >
              <MessageCircle className="size-4" aria-hidden /> WhatsApp
            </a>
          </>
        )}
        {onCheck && (
          <Button size="sm" variant={dueNow ? "primary" : "secondary"} onClick={onCheck} className="ml-auto">
            <CheckCircle2 className="size-4" /> Mark checked
          </Button>
        )}
        {r.checkedAt && (
          <LinkButton onClick={onUndo} className="ml-auto inline-flex items-center gap-1 text-fg-2">
            <RotateCcw className="size-3.5" /> Undo
          </LinkButton>
        )}
      </div>
    </li>
  );
}

function CheckSheet({ reminder, onClose }: { reminder: Reminder | null; onClose: () => void }) {
  const markChecked = useMutation(api.reminders.markChecked);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!reminder) return;
    setBusy(true);
    try {
      await markChecked({ bookingId: reminder.bookingId as Id<"bookings">, note: note.trim() || undefined });
      toast(`${firstName(reminder.clientName)} checked`);
      onClose();
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={!!reminder}
      onOpenChange={(o) => !o && onClose()}
      title="Mark check-in done"
      description={reminder ? `${reminder.clientName} · tattooed ${formatDateShort(reminder.completedAt)}` : undefined}
      footer={
        <Button variant="primary" block onClick={save} loading={busy}>
          Mark checked
        </Button>
      }
    >
      <Textarea
        label="How is it healing?"
        optional
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Healing well, slight peeling. Reminded about aftercare."
      />
    </Sheet>
  );
}
