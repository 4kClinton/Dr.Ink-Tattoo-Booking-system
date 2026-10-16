"use client";
import { api } from "@drink/backend/api";
import type { Doc, Id } from "@drink/backend/dataModel";
import {
  COLOUR_LABEL, dateKeyEAT, firstName, fromDateKey, formatDateShort, formatEAT, formatKes, formatPhone, formatTime24, LOCATION_LABEL,
  SOURCES, TEMPLATES, waLink, type TemplateKey,
} from "@drink/shared";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft, CheckCircle2, ChevronDown, Clock, Copy, ExternalLink, FileWarning, Flag, MessageCircle, Phone,
  RotateCcw, Send, XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdjustPriceSheet, CancelSheet, NoShowSheet, RecordPaymentSheet, RescheduleSheet, ResolveDepositSheet,
  ReversePaymentSheet,
} from "@/components/booking/booking-sheets";
import { ImageUploader } from "@/components/booking/image-uploader";
import { useCan, useIsArtist } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { Card, Divider, SectionLabel } from "@/components/ui/card";
import { Empty, Skeleton } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/cn";
import { toAppError } from "@/lib/errors";

type SheetName = "pay" | "adjust" | "reschedule" | "cancel" | "noshow" | "more" | "phone" | "reverse" | "resolve" | null;

const MSG_STATUS: Record<Doc<"messages">["status"], { icon: typeof CheckCircle2; label: string; cls: string }> = {
  queued: { icon: Clock, label: "Scheduled", cls: "text-fg-2" },
  sent: { icon: Send, label: "Sent", cls: "text-fg-2" },
  delivered: { icon: CheckCircle2, label: "Delivered", cls: "text-success" },
  failed: { icon: XCircle, label: "Failed", cls: "text-accent-fg" },
  cancelled: { icon: XCircle, label: "Cancelled", cls: "text-fg-3" },
};

const DEPOSIT_OUTCOME: Record<string, string> = {
  forfeited: "Deposit kept (forfeited)",
  carried: "Deposit carried to a new date",
  refunded: "Deposit refunded",
  pending: "Deposit decision pending",
};

export default function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isArtist = useIsArtist();
  const canManage = useCan("bookings.manage");
  const canCancel = useCan("bookings.cancel");
  const canPay = useCan("payments.record");
  const canAdjust = useCan("bookings.adjustPrice");
  const canResend = useCan("messages.resend");
  const data = useQuery(api.bookings.get, { bookingId: id as Id<"bookings"> });
  const settings = useQuery(api.settings.get);
  const resend = useMutation(api.messages.resend);
  const complete = useMutation(api.bookings.complete);
  const addImages = useMutation(api.tattoos.addImages);
  const removeImage = useMutation(api.tattoos.removeImage);
  const setPortfolio = useMutation(api.tattoos.setPortfolioApproved);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [reversing, setReversing] = useState<Doc<"payments"> | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [showMsgs, setShowMsgs] = useState(true);

  if (data === undefined) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (data === null) return <Empty text="This booking doesn't exist." action={<Button onClick={() => router.push("/calendar")}>View calendar</Button>} />;

  const { booking: b, client, tattoo, consent, payments, messages, audit, balanceKes, project, feedback } = data;
  const first = firstName(client.fullName);
  const confirmed = b.status === "confirmed";
  const endAt = b.startAt + b.durationMin * 60000;
  const consentUrl = data.consentToken ? `${window.location.origin}/c/${data.consentToken.token}` : null;
  const paidInFull = b.paidTotalKes >= b.finalPriceKes;
  const canComplete = confirmed && paidInFull && Date.now() >= fromDateKey(dateKeyEAT(b.startAt));
  const close = (o: boolean) => !o && setSheet(null);

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(toAppError(e).message);
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="tap -ml-2 flex items-center gap-1 rounded-md px-2 py-2 text-label font-medium text-fg-2 hover:bg-hover">
          <ArrowLeft className="size-4" /> Back
        </button>
      </div>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-display leading-tight lg:text-[36px]">
            <Link href={`/clients/${client._id}`} className="hover:underline">
              {client.fullName}
            </Link>
          </h1>
          <StatusChip kind={b.status} className="mt-1.5" />
        </div>
        <p className="mt-2 text-fg-2 tabular">
          {formatDateShort(b.startAt)} · {formatTime24(b.startAt)}–{formatTime24(endAt)} ·{" "}
          {b.location === "other" ? b.locationNote : LOCATION_LABEL[b.location]}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-label">
          <button onClick={() => setSheet("phone")} className="flex items-center gap-1.5 font-medium tabular underline-offset-4 hover:underline">
            <Phone className="size-3.5" aria-hidden /> {formatPhone(client.phone)}
          </button>
          {project && (
            <span className="text-fg-2">
              {project.title} · session {project.sessionNumber}
              {project.sessionTotal ? ` of ${project.sessionTotal}` : ""}
            </span>
          )}
          {b.source && <span className="text-fg-2">{SOURCES.find((s) => s.value === b.source)?.label ?? b.source}</span>}
        </div>
        {client.flagged && (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-warning-subtle p-3 text-label text-warning">
            <Flag className="mt-0.5 size-4 shrink-0" aria-hidden /> {client.flagged}
          </p>
        )}
        {(b.status === "cancelled" || b.status === "no_show") && (
          <p className="mt-3 text-label text-fg-2">
            {b.cancelReason && <>“{b.cancelReason}” · </>}
            {b.depositOutcome && DEPOSIT_OUTCOME[b.depositOutcome]}
            {b.depositOutcome === "pending" && isArtist && (
              <button onClick={() => setSheet("resolve")} className="ml-2 font-semibold text-fg underline underline-offset-4">
                Decide
              </button>
            )}
          </p>
        )}
        {b.rescheduleCount > 0 && (
          <p className="mt-1 text-caption text-fg-3">
            Rescheduled {b.rescheduleCount}×{b.depositOutcome === "forfeited" && confirmed ? " · deposit forfeited (over limit)" : ""}
          </p>
        )}
      </header>

      {/* PAYMENT */}
      <Card className="mb-6">
        <SectionLabel className="mb-3">Payment</SectionLabel>
        <dl className="flex flex-col gap-2">
          <div className="flex justify-between">
            <dt className="text-fg-2">Final price</dt>
            <dd className="money">{formatKes(b.finalPriceKes)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-fg-2">Paid</dt>
            <dd className="money">{formatKes(b.paidTotalKes)}</dd>
          </div>
          <Divider className="my-1" />
          <div className="flex justify-between">
            <dt className={cn("font-semibold", balanceKes > 0 ? "text-warning" : "text-success")}>
              {balanceKes > 0 ? "Balance due" : "Paid in full"}
            </dt>
            <dd className={cn("money text-[17px]", balanceKes > 0 ? "text-warning" : "text-success")}>{formatKes(balanceKes)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-caption text-fg-3">
          Deposit {b.depositPercent}% · {formatKes(b.depositRequiredKes)} required
          {b.quotedPriceKes !== b.finalPriceKes && <> · quoted {formatKes(b.quotedPriceKes)}</>}
        </p>
        {b.expectedExpensesKes ? (
          <p className="mt-1 text-caption text-fg-3">
            Expected expenses: <span className="money">{formatKes(b.expectedExpensesKes)}</span>
            {b.expectedExpensesNote ? ` · ${b.expectedExpensesNote}` : ""}
          </p>
        ) : null}
        {confirmed && balanceKes > 0 && canPay && (
          <Button variant="primary" block className="mt-4" onClick={() => setSheet("pay")}>
            Record payment
          </Button>
        )}
        {canComplete && canManage && (
          <Button variant="primary" block className="mt-4" onClick={() => act(() => complete({ bookingId: b._id }), "Session complete · aftercare SMS goes out tomorrow 10:00")}>
            Complete session
          </Button>
        )}
        {payments.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
            {payments.map((p) => (
              <li key={p._id} className="flex items-start justify-between gap-3 text-label">
                <div className="min-w-0">
                  <p className={cn("font-medium capitalize", p.reversedAt && "text-fg-3 line-through")}>
                    {p.type} · {p.method === "mpesa" ? <span className="tracking-wide normal-case">{p.mpesaCode}</span> : "Cash"}
                  </p>
                  <p className="text-caption text-fg-3">
                    {formatEAT(p.paidAt, "d MMM HH:mm")}
                    {p.payerName && <> · {p.payerName}</>}
                    {p.recordedByName && <> · by {p.recordedByName}</>}
                    {p.note && <> · {p.note}</>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn("money", p.amountKes < 0 && "text-fg-2")}>{formatKes(p.amountKes)}</span>
                  {isArtist && p.type !== "reversal" && !p.reversedAt && (
                    <button
                      onClick={() => {
                        setReversing(p);
                        setSheet("reverse");
                      }}
                      className="rounded-sm p-1 text-fg-3 hover:bg-hover hover:text-fg"
                      aria-label="Reverse payment"
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {data.adjustments.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-caption text-fg-2">
            {data.adjustments.map((a) => (
              <li key={a._id}>
                Price {formatKes(a.fromKes)} → {formatKes(a.toKes)} · “{a.reason}” · {a.byName}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* TATTOO */}
      <section className="mb-6">
        <SectionLabel className="mb-2">Tattoo</SectionLabel>
        {tattoo && (
          <>
            <p>
              {tattoo.description} · {tattoo.placement}
              {tattoo.size && <> · {tattoo.size}</>}
              {tattoo.style && <> · {tattoo.style}</>} · {COLOUR_LABEL[tattoo.colour]}
            </p>
            {(["reference", "final", "healed"] as const).map((kind) => {
              const urls = kind === "reference" ? tattoo.referenceUrls : kind === "final" ? tattoo.finalUrls : tattoo.healedUrls;
              if (kind === "healed" && b.status !== "completed" && !urls.length) return null;
              if (kind === "final" && b.status === "cancelled" && !urls.length) return null;
              return (
                <div key={kind} className="mt-3">
                  <p className="mb-1.5 text-caption text-fg-2 capitalize">{kind === "reference" ? "References" : `${kind} photos`}</p>
                  <ImageUploader
                    thumbs={urls.map((u) => ({ id: u.id, url: u.url }))}
                    altPrefix={`${tattoo.placement} tattoo ${kind}`}
                    canRemove={isArtist}
                    readOnly={!canManage}
                    onUploaded={(ids) => act(() => addImages({ tattooId: tattoo._id, kind, storageIds: ids }), "Photo saved")}
                    onRemove={(sid) => act(() => removeImage({ tattooId: tattoo._id, kind, storageId: sid }), "Photo removed")}
                  />
                </div>
              );
            })}
            {consent?.photoPermission && (tattoo.finalUrls.length > 0 || tattoo.healedUrls.length > 0) && (
              <label className="mt-3 flex items-center gap-2 text-label">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--text)]"
                  checked={tattoo.portfolioApproved}
                  onChange={(e) =>
                    act(
                      () => setPortfolio({ tattooId: tattoo._id, approved: e.target.checked }),
                      e.target.checked ? "Approved for portfolio" : "Removed from portfolio",
                    )
                  }
                />
                Portfolio-approved (client gave photo permission)
              </label>
            )}
          </>
        )}
      </section>

      {/* CONSENT + TERMS */}
      <section className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SectionLabel className="w-20">Consent</SectionLabel>
          {consent ? (
            <span className="flex items-center gap-1.5 text-label">
              <CheckCircle2 className="size-4 text-success" aria-hidden /> Signed {formatEAT(consent.signedAt, "d MMM HH:mm")} · “
              {consent.signatureName}”{consent.photoPermission ? " · photos OK" : " · no photos"}
            </span>
          ) : (
            <>
              <StatusChip kind="consent" icon={FileWarning}>
                Not signed
              </StatusChip>
              {consentUrl && confirmed && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(consentUrl);
                      toast("Consent link copied");
                    }}
                  >
                    <Copy className="size-3.5" /> Copy link
                  </Button>
                  <Button size="sm" onClick={() => window.open(consentUrl, "_blank", "noopener")}>
                    <ExternalLink className="size-3.5" /> Open here
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        {consent && (
          <HealthSummary answers={consent.healthAnswers as Record<string, unknown> | null} />
        )}
        <div className="flex items-center gap-3">
          <SectionLabel className="w-20">Terms</SectionLabel>
          <span className="text-label text-fg-2">
            v{data.terms?.version} · sent {formatDateShort(b._creationTime)}
            {data.termsToken && (
              <a href={`/t/${data.termsToken}`} target="_blank" rel="noopener" className="ml-2 font-medium text-fg underline-offset-4 hover:underline">
                View
              </a>
            )}
          </span>
        </div>
        {feedback && (
          <div className="flex items-center gap-3">
            <SectionLabel className="w-20">Feedback</SectionLabel>
            <span className="text-label">
              <span className="font-semibold tabular">{feedback.rating}/5</span>
              {feedback.comment && <span className="text-fg-2"> · “{feedback.comment}”</span>}
            </span>
          </div>
        )}
      </section>

      {/* MESSAGES */}
      <section className="mb-6">
        <button onClick={() => setShowMsgs((s) => !s)} className="mb-2 flex items-center gap-1" aria-expanded={showMsgs}>
          <SectionLabel>Messages</SectionLabel>
          <ChevronDown className={cn("size-4 text-fg-2 transition-transform", showMsgs && "rotate-180")} />
        </button>
        {showMsgs && (
          <ul className="flex flex-col gap-2">
            {messages.map((m) => {
              const st = MSG_STATUS[m.status];
              return (
                <li key={m._id} className="flex items-start justify-between gap-3 text-label">
                  <span className="flex min-w-0 items-start gap-2">
                    <st.icon className={cn("mt-0.5 size-4 shrink-0", st.cls)} aria-hidden />
                    <span className="min-w-0">
                      <span className={cn("font-medium", st.cls)}>{st.label}</span>{" "}
                      {TEMPLATES[m.templateKey as TemplateKey]?.label ?? m.templateKey} ·{" "}
                      <span className="tabular text-fg-2">{formatEAT(m.sentAt ?? m.sendAt, "d MMM HH:mm")}</span>
                      {m.error && m.status !== "queued" && <span className="block truncate text-caption text-fg-3">{m.error}</span>}
                    </span>
                  </span>
                  {m.status !== "queued" && canResend && (
                    <Button size="sm" variant="ghost" onClick={() => act(() => resend({ messageId: m._id }), `SMS resent to ${m.recipient === "client" ? first : "artist"}`)}>
                      Resend
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* HISTORY */}
      <section className="mb-8">
        <button onClick={() => setShowAudit((s) => !s)} className="mb-2 flex items-center gap-1" aria-expanded={showAudit}>
          <SectionLabel>History</SectionLabel>
          <ChevronDown className={cn("size-4 text-fg-2 transition-transform", showAudit && "rotate-180")} />
        </button>
        {showAudit && (
          <ul className="flex flex-col gap-1.5 text-label">
            {audit.map((a) => (
              <li key={a._id} className="flex justify-between gap-3">
                <span>
                  {a.action.replace(/_/g, " ")} <span className="text-fg-2">· {a.actorName}</span>
                </span>
                <span className="shrink-0 text-fg-3 tabular">{formatEAT(a.at, "d MMM HH:mm")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirmed && (canManage || canCancel || canAdjust) && (
        <div className="flex gap-3 border-t border-line pt-4">
          {canManage && (
            <Button block onClick={() => setSheet("reschedule")}>
              Reschedule
            </Button>
          )}
          {(canCancel || canAdjust) && (
            <Button block onClick={() => setSheet("more")}>
              More <ChevronDown className="size-4" />
            </Button>
          )}
        </div>
      )}

      {/* Sheets */}
      <Sheet open={sheet === "more"} onOpenChange={close} title="More actions">
        <div className="flex flex-col gap-1 pb-4">
          {canAdjust && <MenuItem onClick={() => setSheet("adjust")}>Adjust price</MenuItem>}
          {canCancel && (
            <>
              <MenuItem onClick={() => setSheet("noshow")} disabled={Date.now() < b.startAt}>
                Mark no-show{Date.now() < b.startAt && <span className="text-caption text-fg-3"> · after start time</span>}
              </MenuItem>
              <MenuItem onClick={() => setSheet("cancel")}>Cancel booking</MenuItem>
            </>
          )}
        </div>
      </Sheet>
      <Sheet open={sheet === "phone"} onOpenChange={close} title={formatPhone(client.phone)} description={client.fullName}>
        <div className="flex flex-col gap-1 pb-4">
          <a href={`tel:${client.phone}`} className="flex h-12 items-center gap-3 rounded-md px-2 font-medium hover:bg-hover">
            <Phone className="size-5 text-fg-2" aria-hidden /> Call
          </a>
          <a href={`sms:${client.phone}`} className="flex h-12 items-center gap-3 rounded-md px-2 font-medium hover:bg-hover">
            <Send className="size-5 text-fg-2" aria-hidden /> SMS
          </a>
          <a href={waLink(client.phone)} target="_blank" rel="noopener" className="flex h-12 items-center gap-3 rounded-md px-2 font-medium hover:bg-hover">
            <MessageCircle className="size-5 text-fg-2" aria-hidden /> WhatsApp
          </a>
        </div>
      </Sheet>
      {confirmed && (
        <>
          <RecordPaymentSheet
            open={sheet === "pay"}
            onOpenChange={close}
            booking={b}
            balanceKes={balanceKes}
            firstName={first}
            onAdjustPrice={() => setSheet("adjust")}
          />
          <AdjustPriceSheet key={`adj-${b.finalPriceKes}`} open={sheet === "adjust"} onOpenChange={close} booking={b} />
          <RescheduleSheet key={`rs-${b.startAt}`} open={sheet === "reschedule"} onOpenChange={close} booking={b} rescheduleLimit={settings?.rescheduleLimit ?? 1} />
          <CancelSheet open={sheet === "cancel"} onOpenChange={close} bookingId={b._id} firstName={first} />
          <NoShowSheet open={sheet === "noshow"} onOpenChange={close} bookingId={b._id} firstName={first} />
        </>
      )}
      <ReversePaymentSheet open={sheet === "reverse"} onOpenChange={close} payment={reversing} />
      <ResolveDepositSheet open={sheet === "resolve"} onOpenChange={close} bookingId={b._id} />
    </div>
  );
}

function MenuItem({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="flex h-12 items-center gap-1 rounded-md px-2 text-left font-medium hover:bg-hover disabled:opacity-40" {...rest}>
      {children}
    </button>
  );
}

const HEALTH_LABELS: Record<string, string> = {
  bloodDisorder: "Blood disorder / thinners",
  skinCondition: "Skin condition",
  allergies: "Allergies",
  diabetesHeart: "Diabetes / epilepsy / heart",
  pregnant: "Pregnant / breastfeeding",
  alcoholDrugs: "Alcohol / drugs (24h)",
};

function HealthSummary({ answers }: { answers: Record<string, unknown> | null }) {
  if (!answers) return null;
  const yes = Object.entries(HEALTH_LABELS).filter(([k]) => answers[k] === true);
  if (!yes.length) return <p className="pl-[92px] text-caption text-fg-2">No health flags declared.</p>;
  return (
    <div className="rounded-md bg-warning-subtle p-3 text-label text-warning">
      <p className="font-semibold">Health declarations: {yes.map(([, l]) => l).join(", ")}</p>
      {typeof answers.details === "string" && answers.details && <p className="mt-1">“{answers.details}”</p>}
    </div>
  );
}
