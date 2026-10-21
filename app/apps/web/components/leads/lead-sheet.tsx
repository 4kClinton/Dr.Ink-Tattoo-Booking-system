"use client";
import { api } from "@drink/backend/api";
import type { Id } from "@drink/backend/dataModel";
import { BOOKING_EXTRAS, dateKeyEAT, fromDateKey, LEAD_STATUSES, LEAD_STATUS_LABEL, MAX_IMAGES_PER_LEAD, SOURCES, type BookingExtra, type LeadStatus } from "@drink/shared";
import { useMutation } from "convex/react";
import { Trash2, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ImageUploader, type Thumb } from "@/components/booking/image-uploader";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FieldShell, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput, PhoneInput } from "@/components/ui/money-input";
import { MultiChoiceChips, Segmented } from "@/components/ui/segmented";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { toAppError } from "@/lib/errors";

export interface LeadRow {
  _id: string;
  name: string | null;
  phone: string | null;
  instagram: string | null;
  tiktok: string | null;
  source: string | null;
  note: string | null;
  status: LeadStatus;
  convertedClientId: string | null;
  remindAt: number | null;
  price: number | null;
  followUpAt: number | null;
  extras: string[];
  images: { id: string; url: string }[];
}

/** Edit a lead, move it along the pipeline, convert to a client, or delete. Remount via `key` to reset. */
export function LeadSheet({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lead: LeadRow | null;
}) {
  const update = useMutation(api.leads.update);
  const setStatusM = useMutation(api.leads.setStatus);
  const convert = useMutation(api.leads.convert);
  const remove = useMutation(api.leads.remove);
  const router = useRouter();

  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? "new");
  const [name, setName] = useState(lead?.name ?? "");
  const [phone, setPhone] = useState(lead?.phone ?? "");
  const [instagram, setInstagram] = useState(lead?.instagram ?? "");
  const [tiktok, setTiktok] = useState(lead?.tiktok ?? "");
  const [source, setSource] = useState(lead?.source ?? "");
  const [note, setNote] = useState(lead?.note ?? "");
  const [remindAt, setRemindAt] = useState(lead?.remindAt ? dateKeyEAT(lead.remindAt) : "");
  const [price, setPrice] = useState<number | null>(lead?.price ?? null);
  const [followUp, setFollowUp] = useState(lead?.followUpAt ? dateKeyEAT(lead.followUpAt) : "");
  const [extras, setExtras] = useState<BookingExtra[]>((lead?.extras ?? []) as BookingExtra[]);
  const toggleExtra = (val: BookingExtra) => setExtras((cur) => (cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]));
  const [images, setImages] = useState<Thumb[]>(lead?.images ?? []);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const leadId = lead?._id as Id<"leads"> | undefined;

  async function save() {
    if (!leadId) return;
    setBusy(true);
    try {
      await update({
        leadId,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        instagram: instagram.trim() || undefined,
        tiktok: tiktok.trim() || undefined,
        source: source || undefined,
        note: note.trim() || undefined,
        remindAt: remindAt ? fromDateKey(remindAt) : undefined,
        price: price ?? undefined,
        extras: extras.length ? extras : undefined,
        followUpAt: followUp ? fromDateKey(followUp) : undefined,
        images: images.map((t) => t.id as Id<"_storage">),
      });
      toast("Lead saved");
      onOpenChange(false);
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(next: LeadStatus) {
    if (!leadId) return;
    setStatus(next);
    try {
      await setStatusM({ leadId, status: next });
    } catch (e) {
      toast(toAppError(e).message);
    }
  }

  async function doConvert() {
    if (!leadId) return;
    setBusy(true);
    try {
      const id = await convert({ leadId });
      toast("Converted to client");
      onOpenChange(false);
      router.push(`/clients/${id}`);
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!leadId) return;
    setBusy(true);
    try {
      await remove({ leadId });
      toast("Lead deleted");
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={name || phone || "Lead"}
        description="Update details, move it along the pipeline, or convert to a client."
        footer={
          <div className="flex gap-3">
            <Button block loading={busy} onClick={save}>
              Save
            </Button>
            {lead?.convertedClientId ? (
              <Button block variant="primary" onClick={() => router.push(`/clients/${lead.convertedClientId}`)}>
                <UserCheck className="size-4" /> Open client
              </Button>
            ) : (
              <Button block variant="primary" loading={busy} onClick={doConvert}>
                <UserCheck className="size-4" /> Convert
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Segmented
            label="Status"
            size="sm"
            value={status}
            onChange={changeStatus}
            options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }))}
          />
          <Input label="Name" optional value={name} onChange={(e) => setName(e.target.value)} />
          <PhoneInput label="Phone" optional value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Instagram" optional prefix="@" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
          <Input label="TikTok" optional prefix="@" value={tiktok} onChange={(e) => setTiktok(e.target.value)} />
          <Select label="Source" optional value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">—</option>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <MoneyInput label="Price" optional hint="Rough quote or expected spend." value={price} onValueChange={setPrice} />
          <FieldShell label="Extras" optional hint="Add-ons they're interested in (numbing cream, red ink, …).">
            <MultiChoiceChips label="Extras" options={BOOKING_EXTRAS.map((e) => ({ value: e.value, label: e.label }))} values={extras} onToggle={toggleExtra} />
          </FieldShell>
          <DatePicker
            label="Promised to book"
            optional
            hint="The day they said they'd book — shows on the lead card so you can follow up."
            value={remindAt}
            onChange={setRemindAt}
          />
          <DatePicker
            label="Follow up on"
            optional
            hint="Creates a task due this day so you don't forget to chase them. Clearing it removes the task."
            value={followUp}
            onChange={setFollowUp}
          />
          <Textarea label="Note" optional rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          <FieldShell label="Images" optional hint="Carry over to the client record when you convert this lead.">
            <ImageUploader
              thumbs={images}
              onUploaded={(_ids, previews) => setImages((prev) => [...prev, ...previews])}
              onRemove={(id) => setImages((prev) => prev.filter((t) => t.id !== id))}
              max={MAX_IMAGES_PER_LEAD}
              altPrefix="Lead image"
            />
          </FieldShell>

          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="tap mt-2 inline-flex items-center gap-2 self-start text-label font-medium text-accent-fg hover:underline"
          >
            <Trash2 className="size-4" /> Delete lead
          </button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this lead?"
        body="This removes the lead permanently. It won't affect any client you've already converted."
        confirmLabel="Delete"
        loading={busy}
        onConfirm={doDelete}
      />
    </>
  );
}
