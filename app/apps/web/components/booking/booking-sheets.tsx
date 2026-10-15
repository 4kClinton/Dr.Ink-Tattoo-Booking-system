"use client";
import { api } from "@drink/backend/api";
import type { Doc, Id } from "@drink/backend/dataModel";
import {
  dateKeyEAT, DURATION_CHIPS_MIN, formatDuration, formatKes, formatTime24, fromDateKey, LOCATION_LABEL,
  minutesOfDayEAT, type Location,
} from "@drink/shared";
import { useMutation, useQuery } from "convex/react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCan, useIsArtist } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { ChoiceChips, Segmented } from "@/components/ui/segmented";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { toAppError } from "@/lib/errors";
import { MonthGrid } from "./month-grid";
import { MpesaPaste, type PaymentState } from "./mpesa-paste";

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="mt-3 flex items-start gap-2 text-label text-accent-fg" role="alert">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {text}
    </p>
  );
}

/** §3.6 — paste-to-parse balance payment; "Record & complete session" when it clears the balance. */
export function RecordPaymentSheet({
  open,
  onOpenChange,
  booking,
  balanceKes,
  firstName,
  onAdjustPrice,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  booking: Doc<"bookings">;
  balanceKes: number;
  firstName: string;
  onAdjustPrice: () => void;
}) {
  const record = useMutation(api.payments.record);
  const canAdjust = useCan("bookings.adjustPrice");
  const [state, setState] = useState<PaymentState>({ value: null, blocking: null });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionDayReached = Date.now() >= fromDateKey(dateKeyEAT(booking.startAt));
  const clears = (state.value?.amountKes ?? 0) >= balanceKes;

  async function submit() {
    if (!state.value) return;
    setBusy(true);
    setError(null);
    try {
      const r = await record({ bookingId: booking._id, payment: state.value });
      onOpenChange(false);
      toast(
        r.completed
          ? "Session complete · aftercare SMS goes out tomorrow 10:00"
          : `${formatKes(state.value.amountKes)} recorded${r.balanceKes ? ` · ${formatKes(r.balanceKes)} still due` : ""}`,
      );
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Record payment"
      description={`${firstName} · ${formatKes(balanceKes)} due`}
      footer={
        <Button variant="primary" block onClick={submit} loading={busy} disabled={!state.value}>
          {clears && sessionDayReached ? "Record & complete session" : "Record payment"}
        </Button>
      }
    >
      {canAdjust && (
        <button type="button" onClick={onAdjustPrice} className="mb-4 text-label font-semibold underline-offset-4 hover:underline">
          Adjust final price ({formatKes(booking.finalPriceKes)})
        </button>
      )}
      {open && <MpesaPaste requiredKes={0} balanceKes={balanceKes} defaultAmount={balanceKes} onChange={setState} />}
      {clears && !sessionDayReached && (
        <p className="mt-3 text-label text-fg-2">Paid in full early — you can complete the session on the day.</p>
      )}
      <ErrorLine text={error} />
    </Sheet>
  );
}

export function AdjustPriceSheet({
  open,
  onOpenChange,
  booking,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  booking: Doc<"bookings">;
}) {
  const adjust = useMutation(api.bookings.adjustFinalPrice);
  const [price, setPrice] = useState<number | null>(booking.finalPriceKes);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!price) return;
    setBusy(true);
    setError(null);
    try {
      const r = await adjust({ bookingId: booking._id, finalPriceKes: price, reason });
      onOpenChange(false);
      toast(r.completed ? "Price updated · session complete" : `Final price now ${formatKes(price)}`);
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Adjust final price"
      description={`Quoted ${formatKes(booking.quotedPriceKes)}`}
      footer={
        <Button variant="primary" block onClick={submit} loading={busy} disabled={!price || reason.trim().length < 3}>
          Save price
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <MoneyInput label="Final price" value={price} onValueChange={setPrice} autoFocus />
        <Textarea label="Reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Design grew — added shading" />
      </div>
      <ErrorLine text={error} />
    </Sheet>
  );
}

const TIME_OPTIONS = Array.from({ length: (22 - 7) * 4 + 1 }, (_, i) => 7 * 60 + i * 15);
const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function RescheduleSheet({
  open,
  onOpenChange,
  booking,
  rescheduleLimit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  booking: Doc<"bookings">;
  rescheduleLimit: number;
}) {
  const canOverride = useCan("bookings.overrideOverlap");
  const reschedule = useMutation(api.bookings.reschedule);
  const [dateKey, setDateKey] = useState(dateKeyEAT(booking.startAt));
  const [startMin, setStartMin] = useState(minutesOfDayEAT(booking.startAt));
  const [durationMin, setDurationMin] = useState(booking.durationMin);
  const [location, setLocation] = useState<Location>(booking.location);
  const [override, setOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startAt = fromDateKey(dateKey, startMin);
  const overlaps = useQuery(api.bookings.overlaps, open ? { startAt, durationMin, excludeId: booking._id } : "skip");
  const overLimit = booking.rescheduleCount + 1 > rescheduleLimit;
  const unchanged = startAt === booking.startAt && durationMin === booking.durationMin && location === booking.location;
  const blocked = !!overlaps?.length && !(canOverride && override);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await reschedule({ bookingId: booking._id, startAt, durationMin, location, overrideOverlap: override || undefined });
      onOpenChange(false);
      toast(r.depositForfeited ? "Rescheduled · deposit marked forfeited" : "Rescheduled · client and artist notified");
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      full
      title="Reschedule"
      description={`Rescheduled ${booking.rescheduleCount} of ${rescheduleLimit} allowed`}
      footer={
        <Button variant="primary" block onClick={submit} loading={busy} disabled={unchanged || blocked || startAt < Date.now()}>
          Reschedule
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {overLimit && (
          <p className="flex items-start gap-2 rounded-md bg-warning-subtle p-3 text-label text-warning" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            This is over the reschedule limit. Per the terms, the deposit will be forfeited.
          </p>
        )}
        <MonthGrid value={dateKey} onChange={setDateKey} minKey={dateKeyEAT(Date.now())} />
        <Select label="Start time" value={startMin} onChange={(e) => setStartMin(Number(e.target.value))}>
          {TIME_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {fmtMin(m)}
            </option>
          ))}
        </Select>
        <ChoiceChips
          label="Duration"
          options={[...new Set([...DURATION_CHIPS_MIN, booking.durationMin])].sort((a, b) => a - b).map((m) => ({ value: m, label: formatDuration(m) }))}
          value={durationMin}
          onChange={setDurationMin}
        />
        <Segmented
          label="Location"
          value={location}
          onChange={setLocation}
          options={(["nairobi", "kericho", "other"] as const).map((l) => ({ value: l, label: LOCATION_LABEL[l] }))}
        />
        {!!overlaps?.length && (
          <div className="flex items-start gap-3 rounded-md bg-warning-subtle p-4 text-label text-warning" role="alert">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">
                Overlaps {overlaps.map((o) => `${o.clientName} ${formatTime24(o.startAt)}–${formatTime24(o.endAt)}`).join(", ")}.
              </p>
              {canOverride && !override && (
                <button className="mt-1 font-semibold underline underline-offset-4" onClick={() => setOverride(true)}>
                  Book anyway
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <ErrorLine text={error} />
    </Sheet>
  );
}

export function CancelSheet({
  open,
  onOpenChange,
  bookingId,
  firstName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bookingId: Id<"bookings">;
  firstName: string;
}) {
  const isArtist = useIsArtist();
  const cancel = useMutation(api.bookings.cancel);
  const [by, setBy] = useState<"client" | "artist">("client");
  const [reason, setReason] = useState("");
  const [depositAction, setDepositAction] = useState<"carried" | "refunded">("carried");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await cancel({
        bookingId,
        reason,
        cancelledBy: by,
        artistDepositAction: by === "artist" && isArtist ? depositAction : undefined,
      });
      onOpenChange(false);
      toast(`Booking cancelled · SMS sent to ${firstName}`);
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ConfirmSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Cancel booking"
      confirmLabel="Cancel booking"
      onConfirm={submit}
      loading={busy}
      disabled={reason.trim().length < 3}
    >
      <div className="flex flex-col gap-4">
        <Segmented
          label="Who cancelled"
          value={by}
          onChange={setBy}
          options={[
            { value: "client", label: "Client cancelled" },
            { value: "artist", label: "We cancelled" },
          ]}
        />
        <p className="text-label text-fg-2">
          {by === "client"
            ? "The deposit is non-refundable and will be kept."
            : isArtist
              ? "Choose what happens to the deposit."
              : "The artist will decide whether the deposit carries over or is refunded."}
        </p>
        {by === "artist" && isArtist && (
          <Segmented
            label="Deposit"
            value={depositAction}
            onChange={setDepositAction}
            options={[
              { value: "carried", label: "Carry to new date" },
              { value: "refunded", label: "Refund" },
            ]}
          />
        )}
        <Textarea label="Reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Client travelling" />
        <p className="text-caption text-fg-3">{firstName} gets a cancellation SMS. Pending reminders are cancelled.</p>
      </div>
      <ErrorLine text={error} />
    </ConfirmSheet>
  );
}

export function NoShowSheet({
  open,
  onOpenChange,
  bookingId,
  firstName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bookingId: Id<"bookings">;
  firstName: string;
}) {
  const markNoShow = useMutation(api.bookings.markNoShow);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await markNoShow({ bookingId, reason: note || undefined });
      onOpenChange(false);
      toast(`${firstName} marked as a no-show · deposit kept`);
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ConfirmSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Mark no-show"
      body={`The deposit is kept and ${firstName}'s record is flagged for future bookings.`}
      confirmLabel="Mark no-show"
      onConfirm={submit}
      loading={busy}
    >
      <div className="mt-4">
        <Input label="Note" optional value={note} onChange={(e) => setNote(e.target.value)} placeholder="Didn't answer calls" />
      </div>
      <ErrorLine text={error} />
    </ConfirmSheet>
  );
}

export function ReversePaymentSheet({
  open,
  onOpenChange,
  payment,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  payment: Doc<"payments"> | null;
}) {
  const reverse = useMutation(api.payments.reverse);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!payment) return null;
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await reverse({ paymentId: payment!._id, reason });
      onOpenChange(false);
      toast(r.message);
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ConfirmSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Reverse payment"
      body={`Payments are never edited. This adds a reversing entry of −${formatKes(payment.amountKes)}.`}
      confirmLabel="Reverse payment"
      onConfirm={submit}
      loading={busy}
      disabled={reason.trim().length < 3}
    >
      <div className="mt-4">
        <Textarea label="Reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Recorded on the wrong booking" />
      </div>
      <ErrorLine text={error} />
    </ConfirmSheet>
  );
}

export function ResolveDepositSheet({
  open,
  onOpenChange,
  bookingId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bookingId: Id<"bookings">;
}) {
  const resolve = useMutation(api.bookings.resolveDeposit);
  const [busy, setBusy] = useState<string | null>(null);
  async function pick(outcome: "carried" | "refunded" | "forfeited") {
    setBusy(outcome);
    try {
      await resolve({ bookingId, outcome });
      onOpenChange(false);
      toast(`Deposit marked ${outcome}`);
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Settle deposit" description="This booking was cancelled by the studio.">
      <div className="flex flex-col gap-3 pb-4">
        <Button block loading={busy === "carried"} onClick={() => pick("carried")}>
          Carry to a new date
        </Button>
        <Button block loading={busy === "refunded"} onClick={() => pick("refunded")}>
          Refunded to client
        </Button>
        <Button block variant="ghost" loading={busy === "forfeited"} onClick={() => pick("forfeited")}>
          Kept (forfeited)
        </Button>
      </div>
    </Sheet>
  );
}
