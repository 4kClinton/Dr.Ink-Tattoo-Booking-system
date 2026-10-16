"use client";
import { api } from "@drink/backend/api";
import type { Id } from "@drink/backend/dataModel";
import {
  clientInputSchema, COLOUR_LABEL, computeDepositRequired, dateKeyEAT, DURATION_CHIPS_MIN, firstName,
  formatDateShort, formatDuration, formatEAT, formatKes, formatTime24, fromDateKey, LOCATION_LABEL,
  minutesOfDayEAT, PLACEMENT_CHIPS, reminderTime, applyQuietHours, SIZES, SOURCES, STYLE_CHIPS, tattooInputSchema,
  type Colour, type Location, type Size,
} from "@drink/shared";
import { useMutation, useQuery } from "convex/react";
import { AlertCircle, AlertTriangle, ArrowLeft, Check, ChevronDown, Flag, MessageSquare, Search, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCan, useIsArtist } from "@/components/shell/viewer";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput, PhoneInput } from "@/components/ui/money-input";
import { ChoiceChips, Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { toAppError } from "@/lib/errors";
import { useDebounced } from "@/lib/hooks";
import { ImageUploader, type Thumb } from "./image-uploader";
import { MonthGrid } from "./month-grid";
import { MpesaPaste, type PaymentState } from "./mpesa-paste";
import type { NewBookingPrefill } from "./new-booking-context";

const STEPS = ["Client", "Tattoo", "Schedule", "Deposit", "Review"] as const;

interface PickedClient {
  _id: Id<"clients">;
  fullName: string;
  phoneDisplay: string;
  flagged?: string;
  lastTattoo: string | null;
}

const TIME_OPTIONS = Array.from({ length: (22 - 7) * 4 + 1 }, (_, i) => 7 * 60 + i * 15);
const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function NewBookingSheet({
  open,
  onOpenChange,
  prefill,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prefill?: NewBookingPrefill;
}) {
  const isArtist = useIsArtist();
  const canOverride = useCan("bookings.overrideOverlap");
  const settings = useQuery(api.settings.get, open ? {} : "skip");
  const create = useMutation(api.bookings.create);
  const discard = useMutation(api.tattoos.discardUpload);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // Step 1 — client
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<PickedClient | null>(null);
  const [newClient, setNewClient] = useState<{ fullName: string; phone: string; instagram: string; dateOfBirth: string } | null>(null);
  const prefillClient = useQuery(api.clients.get, prefill?.clientId ? { clientId: prefill.clientId as Id<"clients"> } : "skip");
  useEffect(() => {
    if (prefillClient && !picked) {
      const c = prefillClient.client;
      setPicked({ _id: c._id, fullName: c.fullName, phoneDisplay: c.phone, flagged: c.flagged, lastTattoo: prefillClient.bookings[0]?.tattooShort ?? null });
    }
  }, [prefillClient, picked]);

  // Step 2 — tattoo
  const [description, setDescription] = useState("");
  const [placement, setPlacement] = useState("");
  const [size, setSize] = useState<Size | "">("");
  const [style, setStyle] = useState("");
  const [colour, setColour] = useState<Colour>("black_grey");
  const [refs, setRefs] = useState<Thumb[]>([]);

  // Step 3 — schedule & price
  const [dateKey, setDateKey] = useState<string | null>(prefill?.startAt ? dateKeyEAT(prefill.startAt) : null);
  const [startMin, setStartMin] = useState<number>(prefill?.startAt ? minutesOfDayEAT(prefill.startAt) : 10 * 60);
  const [durationMin, setDurationMin] = useState(180);
  const [customDuration, setCustomDuration] = useState(false);
  const [location, setLocation] = useState<Location>("nairobi");
  const [locationTouched, setLocationTouched] = useState(false);
  const [locationNote, setLocationNote] = useState("");
  const [quoted, setQuoted] = useState<number | null>(null);
  const [moreDetails, setMoreDetails] = useState(false);
  const [source, setSource] = useState("");
  const [projectId, setProjectId] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [plannedSessions, setPlannedSessions] = useState("");
  const [override, setOverride] = useState(false);

  // Step 4 — deposit
  const [payment, setPayment] = useState<PaymentState>({ value: null, blocking: null });
  const [depositVisited, setDepositVisited] = useState(false);
  useEffect(() => {
    if (step === 3) setDepositVisited(true);
  }, [step]);

  const startAt = dateKey ? fromDateKey(dateKey, startMin) : null;
  const depositRequired = quoted && settings ? computeDepositRequired(quoted, settings.depositPercent, settings.minDepositKes) : 0;

  const debouncedQ = useDebounced(q, 200);
  const results = useQuery(api.clients.search, open && step === 0 && !picked && !newClient && debouncedQ.trim().length >= 2 ? { q: debouncedQ } : "skip");
  const overlaps = useQuery(api.bookings.overlaps, startAt && step >= 2 ? { startAt, durationMin } : "skip");
  const slot = useQuery(api.availability.checkSlot, startAt && step >= 2 ? { startAt, durationMin } : "skip");
  const projects = useQuery(api.clients.projects, picked && step >= 2 ? { clientId: picked._id } : "skip");
  const monthBookings = useQuery(api.bookings.range, open && step === 2 ? { from: Date.now() - 86400000, to: Date.now() + 120 * 86400000 } : "skip");
  const marked = useMemo(() => new Set((monthBookings ?? []).map((b) => dateKeyEAT(b.startAt))), [monthBookings]);

  // A-3: tour block sets the default location
  useEffect(() => {
    if (!locationTouched && slot?.tourLocation && ["nairobi", "kericho", "other"].includes(slot.tourLocation)) {
      setLocation(slot.tourLocation as Location);
    }
  }, [slot?.tourLocation, locationTouched]);

  const hasOverlap = !!overlaps?.length;
  useEffect(() => setOverride(false), [startAt, durationMin]);

  // ─── per-step validation ───
  const clientCheck = newClient ? clientInputSchema.safeParse(newClient) : null;
  const tattooCheck = tattooInputSchema.safeParse({
    description, placement, colour, style: style || undefined,
    size: size || undefined,
  });
  const stepError = (s: number): string | null => {
    if (s === 0) {
      if (picked) return null;
      if (!newClient) return "Search for the client or add a new one.";
      return clientCheck?.success ? null : (clientCheck?.error.issues[0]?.message ?? "Check the client details.");
    }
    if (s === 1) return tattooCheck.success ? null : (tattooCheck.error.issues[0]?.message ?? "Check the tattoo details.");
    if (s === 2) {
      if (!dateKey) return "Pick a date.";
      if (startAt! < Date.now()) return "That time has already passed.";
      if (!quoted) return "Enter the quoted price.";
      if (hasOverlap && !(canOverride && override)) return "Pick a time that doesn't overlap.";
      if (location === "other" && !locationNote.trim()) return "Where is the session?";
      return null;
    }
    if (s === 3) return payment.blocking ?? (payment.value ? null : "Record the deposit.");
    return null;
  };
  const currentError = stepError(step);

  function next() {
    if (currentError) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((s) => Math.min(4, s + 1));
  }

  function close(o: boolean) {
    if (!o && !submitting) {
      // discard any uploads that never got attached to a booking
      refs.forEach((r) => void discard({ storageId: r.id as Id<"_storage"> }).catch(() => {}));
    }
    onOpenChange(o);
  }

  async function confirm() {
    if (!startAt || !quoted || !payment.value) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const name = picked?.fullName ?? newClient!.fullName;
      await create({
        clientId: picked?._id,
        client: picked
          ? undefined
          : {
              fullName: newClient!.fullName,
              phone: newClient!.phone,
              instagram: newClient!.instagram || undefined,
              dateOfBirth: newClient!.dateOfBirth || undefined,
            },
        tattoo: {
          description, placement, colour, style: style || undefined,
          size: size || undefined,
          referenceImages: refs.map((r) => r.id as Id<"_storage">),
        },
        startAt,
        durationMin,
        location,
        locationNote: location === "other" ? locationNote : undefined,
        quotedPriceKes: quoted,
        source: source || undefined,
        projectId: projectId && projectId !== "new" ? (projectId as Id<"projects">) : undefined,
        newProject:
          projectId === "new" && newProjectTitle.trim()
            ? { title: newProjectTitle.trim(), plannedSessions: plannedSessions ? Number(plannedSessions) : undefined }
            : undefined,
        deposit: payment.value,
        overrideOverlap: override || undefined,
      });
      setRefs([]);
      onOpenChange(false);
      toast(`Booking confirmed · SMS sent to ${firstName(name)}`);
    } catch (e) {
      const err = toAppError(e);
      setSubmitError(err.message);
      if (err.code === "SLOT_OVERLAP") setStep(2);
      if (err.code === "MPESA_CODE_USED" || err.code === "DEPOSIT_INSUFFICIENT") setStep(3);
    } finally {
      setSubmitting(false);
    }
  }

  // Message preview for Review
  const preview = useMemo(() => {
    if (!startAt || !settings) return [];
    const now = Date.now();
    const sendNow = applyQuietHours(now, settings.quietHoursStart, settings.quietHoursEnd);
    const when = sendNow - now < 60_000 ? "now" : `${formatDateShort(sendNow)} ${formatTime24(sendNow)}`;
    const rows = [`Confirmation to client ${when}`, `Confirmation to ${isArtist ? "you" : "the artist"} ${when}`];
    const r = reminderTime(startAt, settings.reminderHourDayBefore, now);
    if (r) rows.push(`Reminder ${formatEAT(r, "EEE HH:mm")}`);
    return rows;
  }, [startAt, settings, isArtist]);

  const clientName = picked?.fullName ?? newClient?.fullName ?? "";

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      full
      title="New booking"
      description={`Step ${Math.min(step + 1, 4)} of 4 · ${STEPS[step]}`}
      footer={
        <div className="flex flex-col gap-2">
          {showErrors && currentError && step < 4 && (
            <p className="flex items-center gap-2 text-label text-accent-fg" role="alert">
              <AlertCircle className="size-4 shrink-0" aria-hidden /> {currentError}
            </p>
          )}
          <div className="flex gap-3">
            {step > 0 && (
              <Button onClick={() => setStep((s) => s - 1)} aria-label="Back" className="px-4">
                <ArrowLeft className="size-4" />
              </Button>
            )}
            {step < 4 ? (
              <Button variant="primary" block onClick={next}>
                {step === 3 ? "Review" : "Continue"}
              </Button>
            ) : (
              <Button variant="primary" block onClick={confirm} loading={submitting} disabled={!payment.value}>
                Confirm booking
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* Stepper: 4 segments, done = --text, current = --accent */}
      <div className="mb-6 flex gap-1.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn("h-1 flex-1 rounded-full transition-colors duration-200", i < step ? "bg-fg" : i === step ? "bg-accent" : "bg-line")}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-4">
          {picked ? (
            <div className="rounded-md border border-line bg-elevated p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{picked.fullName}</p>
                  <p className="text-label text-fg-2 tabular">{picked.phoneDisplay}</p>
                  {picked.lastTattoo && <p className="mt-1 text-label text-fg-2">Last: {picked.lastTattoo}</p>}
                </div>
                <LinkButton onClick={() => setPicked(null)}>Change</LinkButton>
              </div>
              {picked.flagged && (
                <p className="mt-3 flex items-start gap-2 rounded-sm bg-warning-subtle p-2 text-label text-warning">
                  <Flag className="mt-0.5 size-4 shrink-0" aria-hidden /> {picked.flagged}
                </p>
              )}
            </div>
          ) : newClient ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-subhead font-semibold">New client</p>
                <LinkButton onClick={() => setNewClient(null)}>Search instead</LinkButton>
              </div>
              <Input
                label="Full name"
                autoComplete="off"
                value={newClient.fullName}
                onChange={(e) => setNewClient({ ...newClient, fullName: e.target.value })}
                error={showErrors && newClient.fullName.trim().length < 2 ? "Enter the client's full name" : null}
                autoFocus
              />
              <PhoneInput
                label="Phone"
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                hint="0712…, 712… or +254712… all work."
              />
              <Input
                label="Instagram"
                optional
                prefix="@"
                autoCapitalize="none"
                value={newClient.instagram}
                onChange={(e) => setNewClient({ ...newClient, instagram: e.target.value })}
              />
              <Input
                label="Date of birth"
                optional
                type="date"
                value={newClient.dateOfBirth}
                onChange={(e) => setNewClient({ ...newClient, dateOfBirth: e.target.value })}
                hint="Used only for the 18+ check."
              />
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Phone or name"
                  aria-label="Phone or name"
                  className="h-12 w-full rounded-md border border-line bg-surface pr-4 pl-11 placeholder:text-fg-3 focus:border-line-strong focus:outline-none"
                />
              </div>
              <ul className="flex flex-col">
                {(results ?? []).map((c) => (
                  <li key={c._id}>
                    <button
                      onClick={() => setPicked(c)}
                      className="tap flex w-full items-start justify-between gap-3 rounded-md px-2 py-3 text-left hover:bg-hover"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold">{c.fullName}</p>
                        <p className="truncate text-label text-fg-2">
                          <span className="tabular">{c.phoneDisplay}</span>
                          {c.lastTattoo && <> · {c.lastTattoo}</>}
                        </p>
                      </div>
                      {c.flagged && <Flag className="mt-1 size-4 shrink-0 text-warning" aria-label="Flagged" />}
                    </button>
                  </li>
                ))}
              </ul>
              {debouncedQ.trim().length >= 2 && results && results.length === 0 && <p className="text-label text-fg-2">No match for “{debouncedQ}”.</p>}
              <Button
                onClick={() => {
                  const looksLikePhone = /^[+\d\s]+$/.test(q.trim());
                  setNewClient({ fullName: looksLikePhone ? "" : q.trim(), phone: looksLikePhone ? q.trim() : "", instagram: "", dateOfBirth: "" });
                }}
              >
                <UserPlus className="size-4" /> New client
              </Button>
            </>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-5">
          <Textarea label="Description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Fine-line rose with stem" autoFocus />
          <div className="flex flex-col gap-2">
            <Input label="Placement" value={placement} onChange={(e) => setPlacement(e.target.value)} placeholder="Left forearm, inner" />
            <ChoiceChips
              label="Placement quick picks"
              options={PLACEMENT_CHIPS.map((p) => ({ value: p, label: p }))}
              value={PLACEMENT_CHIPS.find((p) => p.toLowerCase() === placement.toLowerCase()) ?? null}
              onChange={(v) => setPlacement(v)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-label font-medium">Size <span className="font-normal text-fg-3">(optional)</span></span>
            <ChoiceChips
              label="Size"
              options={SIZES.map((s) => ({ value: s, label: s }))}
              value={size}
              onChange={(v) => setSize(v === size ? "" : (v as Size))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-label font-medium">Style <span className="font-normal text-fg-3">(optional)</span></span>
            <ChoiceChips label="Style" options={STYLE_CHIPS.map((s) => ({ value: s, label: s }))} value={style} onChange={(v) => setStyle(v === style ? "" : v)} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-label font-medium">Colour</span>
            <Segmented label="Colour" value={colour} onChange={setColour} options={(["black_grey", "colour"] as const).map((c) => ({ value: c, label: COLOUR_LABEL[c] }))} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-label font-medium">Reference images <span className="font-normal text-fg-3">(optional)</span></span>
            <ImageUploader
              thumbs={refs}
              altPrefix={`${placement || "Tattoo"} tattoo reference`}
              onUploaded={(ids, previews) => setRefs((r) => [...r, ...previews.map((p, i) => ({ id: ids[i]!, url: p.url }))])}
              onRemove={(id) => {
                setRefs((r) => r.filter((x) => x.id !== id));
                void discard({ storageId: id });
              }}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          <MonthGrid value={dateKey} onChange={setDateKey} minKey={dateKeyEAT(Date.now())} markedKeys={marked} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Start time" value={startMin} onChange={(e) => setStartMin(Number(e.target.value))} className="tabular">
              {TIME_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {fmtMin(m)}
                </option>
              ))}
            </Select>
            {customDuration && (
              <Input
                label="Duration (minutes)"
                inputMode="numeric"
                value={String(durationMin)}
                onChange={(e) => setDurationMin(Math.max(15, Math.min(720, Number(e.target.value.replace(/\D/g, "")) || 0)))}
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-label font-medium">Duration</span>
            <ChoiceChips
              label="Duration"
              options={[...DURATION_CHIPS_MIN.map((m) => ({ value: String(m), label: formatDuration(m) })), { value: "custom", label: "Custom" }]}
              value={customDuration ? "custom" : String(durationMin)}
              onChange={(v) => {
                if (v === "custom") setCustomDuration(true);
                else {
                  setCustomDuration(false);
                  setDurationMin(Number(v));
                }
              }}
            />
          </div>

          {hasOverlap && overlaps && (
            <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning-subtle p-4 text-warning" role="alert">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="flex-1 text-label">
                <p className="font-semibold">
                  Overlaps {overlaps.map((o) => `${o.clientName} ${formatTime24(o.startAt)}–${formatTime24(o.endAt)}`).join(", ")}.
                </p>
                {canOverride ? (
                  override ? (
                    <p className="mt-1">You&apos;ll book it anyway.</p>
                  ) : (
                    <button type="button" className="mt-1 font-semibold underline underline-offset-4" onClick={() => setOverride(true)}>
                      Book anyway
                    </button>
                  )
                ) : (
                  <p className="mt-1">Change the time to continue.</p>
                )}
              </div>
            </div>
          )}
          {slot?.warnings.length ? (
            <p className="flex items-center gap-2 text-label text-warning">
              <AlertTriangle className="size-4 shrink-0" aria-hidden /> {slot.warnings.join(" ")}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <span className="text-label font-medium">Location</span>
            <Segmented
              label="Location"
              value={location}
              onChange={(v) => {
                setLocation(v);
                setLocationTouched(true);
              }}
              options={(["nairobi", "kericho", "other"] as const).map((l) => ({ value: l, label: LOCATION_LABEL[l] }))}
            />
            {slot?.tourLocation && <p className="text-caption text-fg-2">Tour block: {slot.tourNote || LOCATION_LABEL[slot.tourLocation as Location]}</p>}
            {location === "other" && <Input aria-label="Where" placeholder="Town or venue" value={locationNote} onChange={(e) => setLocationNote(e.target.value)} />}
          </div>

          <div className="flex flex-col gap-2">
            <MoneyInput label="Quoted price" value={quoted} onValueChange={setQuoted} />
            {settings && (
              <p className="flex items-center justify-between text-label text-fg-2" aria-live="polite">
                <span>Deposit required ({settings.depositPercent}%)</span>
                <span className="money text-[17px] text-fg">{formatKes(depositRequired)}</span>
              </p>
            )}
          </div>

          <button type="button" onClick={() => setMoreDetails((m) => !m)} className="flex items-center gap-1 self-start text-label font-semibold" aria-expanded={moreDetails}>
            More details <ChevronDown className={cn("size-4 transition-transform", moreDetails && "rotate-180")} />
          </button>
          {moreDetails && (
            <div className="flex flex-col gap-4">
              <Select label="Source" optional value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">Not set</option>
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
              {picked || newClient ? (
                <Select label="Multi-session project" optional value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">Single session</option>
                  {(projects ?? []).map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.title} · {p.sessionsBooked} booked{p.plannedSessions ? ` of ${p.plannedSessions}` : ""}
                    </option>
                  ))}
                  <option value="new">New project…</option>
                </Select>
              ) : null}
              {projectId === "new" && (
                <div className="grid grid-cols-[1fr_120px] gap-3">
                  <Input label="Project" placeholder="Left sleeve" value={newProjectTitle} onChange={(e) => setNewProjectTitle(e.target.value)} />
                  <Input label="Sessions" inputMode="numeric" value={plannedSessions} onChange={(e) => setPlannedSessions(e.target.value.replace(/\D/g, ""))} optional />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* kept mounted after first visit so going Back doesn't lose the pasted message */}
      {depositVisited && (
        <div hidden={step !== 3}>
          <MpesaPaste requiredKes={depositRequired} defaultAmount={depositRequired} onChange={setPayment} amountLabel="Deposit received" />
        </div>
      )}

      {step === 4 && startAt && quoted && payment.value && (
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-line bg-elevated p-4">
            <p className="text-subhead font-semibold">{clientName}</p>
            <p className="text-label text-fg-2">
              {description} · {placement}
            </p>
            <p className="mt-2 text-label">
              {formatDateShort(startAt)} · {formatTime24(startAt)}–{formatTime24(startAt + durationMin * 60000)} ·{" "}
              {location === "other" ? locationNote : LOCATION_LABEL[location]}
            </p>
            <dl className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3 text-label">
              <div className="flex justify-between">
                <dt className="text-fg-2">Quote</dt>
                <dd className="money">{formatKes(quoted)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-2">Deposit paid · {payment.value.method === "mpesa" ? payment.value.mpesaCode : "Cash"}</dt>
                <dd className="money">{formatKes(payment.value.amountKes)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-2">Balance</dt>
                <dd className="money text-warning">{formatKes(Math.max(0, quoted - payment.value.amountKes))}</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="mb-2 text-label font-semibold">Messages that will send</p>
            <ul className="flex flex-col gap-2">
              {preview.map((p) => (
                <li key={p} className="flex items-center gap-2 text-label text-fg-2">
                  <Check className="size-4 text-success" aria-hidden /> {p}
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-center gap-2 text-caption text-fg-3">
              <MessageSquare className="size-3.5" aria-hidden /> Consent + terms link is in the client&apos;s confirmation.
            </p>
          </div>
          {override && (
            <p className="flex items-center gap-2 text-label text-warning">
              <AlertTriangle className="size-4" aria-hidden /> Overlap override on.
            </p>
          )}
          {submitError && (
            <p className="flex items-start gap-2 text-label text-accent-fg" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {submitError}
            </p>
          )}
        </div>
      )}
      {submitError && step !== 4 && (
        <p className="mt-4 flex items-start gap-2 text-label text-accent-fg" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {submitError}
        </p>
      )}
    </Sheet>
  );
}
