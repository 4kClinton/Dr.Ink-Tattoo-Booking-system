"use client";
import { api } from "@drink/backend/api";
import type { Id } from "@drink/backend/dataModel";
import { BOOKING_EXTRAS, fromDateKey, MAX_IMAGES_PER_LEAD, SOURCES, type BookingExtra } from "@drink/shared";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { ImageUploader, type Thumb } from "@/components/booking/image-uploader";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FieldShell, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput, PhoneInput } from "@/components/ui/money-input";
import { MultiChoiceChips } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { toAppError } from "@/lib/errors";

const empty = { name: "", phone: "", instagram: "", tiktok: "", source: "", note: "", remindAt: "", followUp: "" };

/** Capture a new lead: who they are and where they came from. */
export function AddLeadSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useMutation(api.leads.create);
  const [f, setF] = useState(empty);
  const [price, setPrice] = useState<number | null>(null);
  const [extras, setExtras] = useState<BookingExtra[]>([]);
  const [images, setImages] = useState<Thumb[]>([]);
  const [busy, setBusy] = useState(false);
  const toggleExtra = (v: BookingExtra) => setExtras((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

  const canSave = !!(f.name.trim() || f.phone.trim() || f.instagram.trim() || f.tiktok.trim());

  function reset() {
    setF(empty);
    setPrice(null);
    setExtras([]);
    setImages([]);
  }

  async function submit() {
    setBusy(true);
    try {
      await create({
        name: f.name.trim() || undefined,
        phone: f.phone.trim() || undefined,
        instagram: f.instagram.trim() || undefined,
        tiktok: f.tiktok.trim() || undefined,
        source: f.source || undefined,
        note: f.note.trim() || undefined,
        remindAt: f.remindAt ? fromDateKey(f.remindAt) : undefined,
        price: price ?? undefined,
        extras: extras.length ? extras : undefined,
        followUpAt: f.followUp ? fromDateKey(f.followUp) : undefined,
        images: images.length ? images.map((t) => t.id as Id<"_storage">) : undefined,
      });
      toast("Lead saved");
      onOpenChange(false);
      reset();
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title="Add lead"
      description="Capture their details and where they came from. You can follow up later."
      footer={
        <Button variant="primary" block loading={busy} disabled={!canSave} onClick={submit}>
          Save lead
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Name" optional value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <PhoneInput label="Phone" optional value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Input label="Instagram" optional prefix="@" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} />
        <Input label="TikTok" optional prefix="@" value={f.tiktok} onChange={(e) => setF({ ...f, tiktok: e.target.value })} />
        <Select label="Where from?" optional value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
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
          hint="If they said they'd book on a certain day, set it here to follow up."
          value={f.remindAt}
          onChange={(remindAt) => setF({ ...f, remindAt })}
        />
        <DatePicker
          label="Follow up on"
          optional
          hint="Creates a task due this day so you don't forget to chase them."
          value={f.followUp}
          onChange={(followUp) => setF({ ...f, followUp })}
        />
        <Textarea label="Note" optional rows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <FieldShell label="Images" optional hint="Tattoo ideas or screenshots they sent. These carry over when you convert them to a client.">
          <ImageUploader
            thumbs={images}
            onUploaded={(_ids, previews) => setImages((prev) => [...prev, ...previews])}
            onRemove={(id) => setImages((prev) => prev.filter((t) => t.id !== id))}
            max={MAX_IMAGES_PER_LEAD}
            altPrefix="Lead image"
          />
        </FieldShell>
      </div>
    </Sheet>
  );
}
