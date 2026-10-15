"use client";
import { api } from "@drink/backend/api";
import type { Id } from "@drink/backend/dataModel";
import { formatDateShort, formatEAT, formatKes, formatPhone, LOCATION_LABEL, waLink } from "@drink/shared";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Camera, Flag, AtSign, MessageCircle, Phone, Plus } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNewBooking } from "@/components/booking/new-booking-context";
import { useCan, useIsArtist } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/field";
import { Empty, Skeleton } from "@/components/ui/misc";
import { PhoneInput } from "@/components/ui/money-input";
import { Segmented } from "@/components/ui/segmented";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/cn";
import { toAppError } from "@/lib/errors";

type Tab = "tattoos" | "bookings" | "payments" | "consent" | "feedback";

export default function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isArtist = useIsArtist();
  const canEdit = useCan("clients.edit");
  const canBook = useCan("bookings.manage");
  const { open: openNewBooking } = useNewBooking();
  const data = useQuery(api.clients.get, { clientId: id as Id<"clients"> });
  const update = useMutation(api.clients.update);
  const setFlag = useMutation(api.clients.setFlag);
  const setOptOut = useMutation(api.clients.setMarketingOptOut);
  const archive = useMutation(api.clients.archive);
  const erase = useMutation(api.clients.erase);
  const [tab, setTab] = useState<Tab>("bookings");
  const [notes, setNotes] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"edit" | "flag" | "erase" | null>(null);

  useEffect(() => {
    if (data && notes === null) setNotes(data.client.notes ?? "");
  }, [data, notes]);

  if (data === undefined)
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  if (data === null) return <Empty text="This client doesn't exist." action={<Button onClick={() => router.push("/clients")}>All clients</Button>} />;

  const { client, stats } = data;
  const erased = !!client.erasedAt;

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast(ok);
      return true;
    } catch (e) {
      toast(toAppError(e).message);
      return false;
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <button onClick={() => router.back()} className="tap -ml-2 mb-4 flex items-center gap-1 rounded-md px-2 py-2 text-label font-medium text-fg-2 hover:bg-hover">
        <ArrowLeft className="size-4" /> Back
      </button>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-display leading-tight lg:text-[36px]">{client.fullName}</h1>
          {!erased && canEdit && (
            <Button size="sm" onClick={() => setSheet("edit")}>
              Edit
            </Button>
          )}
        </div>
        {!erased && (
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`tel:${client.phone}`} className="flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-label font-medium tabular hover:bg-hover">
              <Phone className="size-3.5" aria-hidden /> {formatPhone(client.phone)}
            </a>
            <a href={waLink(client.phone)} target="_blank" rel="noopener" className="flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-label font-medium hover:bg-hover">
              <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
            </a>
            {client.instagram && (
              <a href={`https://instagram.com/${client.instagram}`} target="_blank" rel="noopener" className="flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-label font-medium hover:bg-hover">
                <AtSign className="size-3.5" aria-hidden /> @{client.instagram}
              </a>
            )}
          </div>
        )}
        {client.flagged && (
          <p className="mt-3 flex items-start justify-between gap-2 rounded-md bg-warning-subtle p-3 text-label text-warning">
            <span className="flex items-start gap-2">
              <Flag className="mt-0.5 size-4 shrink-0" aria-hidden /> {client.flagged}
            </span>
            {canEdit && (
              <button className="font-semibold underline underline-offset-4" onClick={() => act(() => setFlag({ clientId: client._id }), "Flag removed")}>
                Remove
              </button>
            )}
          </p>
        )}
        {erased && <p className="mt-2 text-label text-fg-2">Personal data erased on {formatDateShort(client.erasedAt!)}. Payment amounts kept for accounting.</p>}
      </header>

      {/* Stats row */}
      <dl className="mb-6 grid grid-cols-3 gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
        <div>
          <dt className="text-caption text-fg-2">Sessions</dt>
          <dd className="text-heading font-semibold tabular">{stats.sessions}</dd>
        </div>
        {stats.lifetimeSpend !== null && (
          <div>
            <dt className="text-caption text-fg-2">Lifetime spend</dt>
            <dd className="money text-heading">{formatKes(stats.lifetimeSpend)}</dd>
          </div>
        )}
        <div>
          <dt className="text-caption text-fg-2">Last visit</dt>
          <dd className="text-subhead font-semibold">{stats.lastVisitAt ? formatDateShort(stats.lastVisitAt) : "—"}</dd>
        </div>
      </dl>

      {!erased && canBook && (
        <Button variant="primary" block className="mb-6" onClick={() => openNewBooking({ clientId: client._id })}>
          <Plus className="size-4" /> Book {client.fullName.split(" ")[0]}
        </Button>
      )}

      {!erased && (
        <div className="mb-6">
          <Textarea
            label="Notes"
            rows={3}
            value={notes ?? ""}
            readOnly={!canEdit}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (client.notes ?? "") && act(() => update({ clientId: client._id, notes: notes ?? "" }), "Notes saved")}
            placeholder="Allergies, preferences, sensitive spots…"
          />
        </div>
      )}

      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented
          label="Client records"
          size="sm"
          value={tab}
          onChange={setTab}
          className="min-w-[440px]"
          options={[
            { value: "tattoos", label: "Tattoos" },
            { value: "bookings", label: "Bookings" },
            { value: "payments", label: "Payments" },
            { value: "consent", label: "Consent" },
            { value: "feedback", label: "Feedback" },
          ]}
        />
      </div>

      {tab === "tattoos" &&
        (data.photos.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {data.photos.map((p, i) => (
              <Link key={p.id} href={`/bookings/${p.bookingId}`} className="group relative aspect-square overflow-hidden rounded-md bg-hover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url!} alt={`${p.placement} tattoo ${p.kind} ${i + 1}`} className="size-full object-cover" />
                <span className="absolute bottom-1 left-1 rounded-sm bg-black/70 px-1.5 text-caption text-white capitalize">{p.kind}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 py-6 text-fg-2">
            <Camera className="size-4" aria-hidden /> No photos yet.
          </p>
        ))}

      {tab === "bookings" && (
        <ul className="flex flex-col divide-y divide-line">
          {data.bookings.map((b) => (
            <li key={b._id}>
              <Link href={`/bookings/${b._id}`} className="flex items-center justify-between gap-3 px-1 py-3 hover:bg-hover">
                <div className="min-w-0">
                  <p className="font-medium">
                    {formatDateShort(b.startAt)} · {LOCATION_LABEL[b.location]}
                  </p>
                  <p className="truncate text-label text-fg-2">{b.tattooShort}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusChip kind={b.status} />
                  <span className="money text-label">{formatKes(b.finalPriceKes)}</span>
                </div>
              </Link>
            </li>
          ))}
          {!data.bookings.length && <p className="py-6 text-fg-2">No bookings.</p>}
        </ul>
      )}

      {tab === "payments" && (
        <ul className="flex flex-col divide-y divide-line">
          {data.payments.map((p) => (
            <li key={p._id} className="flex items-center justify-between gap-3 px-1 py-3 text-label">
              <div>
                <p className="font-medium capitalize">
                  {p.type} · {p.method === "mpesa" ? <span className="normal-case tracking-wide">{p.mpesaCode}</span> : "Cash"}
                </p>
                <p className="text-caption text-fg-3">{formatEAT(p.paidAt, "d MMM yyyy HH:mm")}</p>
              </div>
              <span className="money">{formatKes(p.amountKes)}</span>
            </li>
          ))}
          {!data.payments.length && <p className="py-6 text-fg-2">No payments.</p>}
        </ul>
      )}

      {tab === "consent" && (
        <ul className="flex flex-col divide-y divide-line">
          {data.consents.map((c) => (
            <li key={c._id} className="px-1 py-3 text-label">
              <Link href={`/bookings/${c.bookingId}`} className="font-medium hover:underline">
                Signed {formatEAT(c.signedAt, "d MMM yyyy HH:mm")}
              </Link>
              <p className="text-fg-2">
                “{c.signatureName}” · photos {c.photoPermission ? "allowed" : "not allowed"} · data consent {c.dataProcessingConsent ? "given" : "—"}
              </p>
            </li>
          ))}
          {!data.consents.length && <p className="py-6 text-fg-2">No consent forms signed.</p>}
        </ul>
      )}

      {tab === "feedback" && (
        <ul className="flex flex-col divide-y divide-line">
          {data.feedback.map((f) => (
            <li key={f._id} className="px-1 py-3 text-label">
              <p className="font-semibold tabular">
                {f.rating}/5 <span className="font-normal text-fg-3">· {formatDateShort(f.submittedAt)}</span>
              </p>
              {f.comment && <p className="text-fg-2">“{f.comment}”</p>}
            </li>
          ))}
          {!data.feedback.length && <p className="py-6 text-fg-2">No feedback yet.</p>}
        </ul>
      )}

      {!erased && (canEdit || isArtist) && (
        <section className="mt-10 flex flex-col gap-3 border-t border-line pt-6">
          <SectionLabel>Record settings</SectionLabel>
          <label className={cn("flex items-center gap-3 text-label", !canEdit && "hidden")}>
            <input
              type="checkbox"
              className="size-4 accent-[var(--text)]"
              checked={client.marketingOptOut}
              onChange={(e) => act(() => setOptOut({ clientId: client._id, optOut: e.target.checked }), e.target.checked ? "Opted out of promo SMS" : "Promo SMS on")}
            />
            Opted out of promotional SMS (touch-up reminders)
          </label>
          <div className="flex flex-wrap gap-2">
            {!client.flagged && canEdit && (
              <Button size="sm" onClick={() => setSheet("flag")}>
                <Flag className="size-3.5" /> Flag client
              </Button>
            )}
            {isArtist && (
              <>
                <Button size="sm" onClick={() => act(() => archive({ clientId: client._id, archived: !client.archived }), client.archived ? "Client restored" : "Client archived")}>
                  {client.archived ? "Unarchive" : "Archive"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSheet("erase")}>
                  Erase personal data
                </Button>
              </>
            )}
          </div>
        </section>
      )}

      <EditClientSheet
        key={client._id + String(sheet === "edit")}
        open={sheet === "edit"}
        onOpenChange={(o) => !o && setSheet(null)}
        client={client}
        onSave={async (patch) => (await act(() => update({ clientId: client._id, ...patch }), "Client updated")) && setSheet(null)}
      />
      <FlagSheet
        open={sheet === "flag"}
        onOpenChange={(o) => !o && setSheet(null)}
        onSave={async (reason) => (await act(() => setFlag({ clientId: client._id, reason }), "Client flagged")) && setSheet(null)}
      />
      <EraseSheet
        open={sheet === "erase"}
        onOpenChange={(o) => !o && setSheet(null)}
        name={client.fullName}
        onConfirm={async (confirmName) => (await act(() => erase({ clientId: client._id, confirmName }), "Personal data erased")) && setSheet(null)}
      />
    </div>
  );
}

function EditClientSheet({
  open,
  onOpenChange,
  client,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client: { fullName: string; phone: string; email?: string; instagram?: string; dateOfBirth?: string };
  onSave: (p: { fullName: string; phone: string; email: string; instagram: string; dateOfBirth: string }) => Promise<unknown>;
}) {
  const [f, setF] = useState({
    fullName: client.fullName,
    phone: client.phone.replace(/^\+254/, "0"),
    email: client.email ?? "",
    instagram: client.instagram ?? "",
    dateOfBirth: client.dateOfBirth ?? "",
  });
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit client"
      footer={
        <Button
          variant="primary"
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await onSave(f);
            setBusy(false);
          }}
        >
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Full name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
        <PhoneInput label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Input label="Email" optional type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input label="AtSign" optional prefix="@" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} />
        <Input label="Date of birth" optional type="date" value={f.dateOfBirth} onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })} />
      </div>
    </Sheet>
  );
}

function FlagSheet({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (r: string) => Promise<unknown> }) {
  const [reason, setReason] = useState("");
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Flag client"
      description="Flagged clients show a warning when booked."
      footer={
        <Button block variant="primary" disabled={reason.trim().length < 3} onClick={() => onSave(reason)}>
          Flag client
        </Button>
      }
    >
      <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="No-show history" autoFocus />
    </Sheet>
  );
}

function EraseSheet({
  open,
  onOpenChange,
  name,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  onConfirm: (n: string) => Promise<unknown>;
}) {
  const [typed, setTyped] = useState("");
  return (
    <ConfirmSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Erase personal data"
      body="Kenya DPA right to erasure. Removes name, phone, contact details, photos, signatures and comments. Payment amounts stay for accounting. This can't be undone."
      confirmLabel="Erase permanently"
      disabled={typed.trim().toLowerCase() !== name.trim().toLowerCase()}
      onConfirm={() => onConfirm(typed)}
    >
      <div className="mt-4">
        <Input label={`Type “${name}” to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} />
      </div>
    </ConfirmSheet>
  );
}
