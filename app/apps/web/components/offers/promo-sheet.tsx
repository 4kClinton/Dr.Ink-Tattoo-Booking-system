"use client";
import { api } from "@drink/backend/api";
import type { Id } from "@drink/backend/dataModel";
import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ImageUploader, type Thumb } from "@/components/booking/image-uploader";
import { Button } from "@/components/ui/button";
import { FieldShell, Input, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Segmented } from "@/components/ui/segmented";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { toAppError } from "@/lib/errors";

export interface PromoRow {
  _id: string;
  title: string;
  priceKes: number | null;
  details: string | null;
  active: boolean;
  imageUrl: string | null;
}

// Sentinel marking the already-saved image, so we can tell "unchanged" from "replaced"/"cleared".
const EXISTING = "__existing__";

/** Create (promo = null) or edit an offer/promo. Remount via `key` to reset. */
export function PromoSheet({
  open,
  onOpenChange,
  promo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  promo: PromoRow | null;
}) {
  const create = useMutation(api.promos.create);
  const update = useMutation(api.promos.update);
  const remove = useMutation(api.promos.remove);
  const editing = !!promo;

  const [title, setTitle] = useState(promo?.title ?? "");
  const [price, setPrice] = useState<number | null>(promo?.priceKes ?? null);
  const [details, setDetails] = useState(promo?.details ?? "");
  const [active, setActive] = useState(promo?.active ?? true);
  const [thumbs, setThumbs] = useState<Thumb[]>(promo?.imageUrl ? [{ id: EXISTING, url: promo.imageUrl }] : []);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const promoId = promo?._id as Id<"promos"> | undefined;
  const canSave = title.trim().length >= 2;

  /** undefined = leave as-is, null = cleared, id = new upload. */
  function imageArg(): Id<"_storage"> | null | undefined {
    const t = thumbs[0];
    if (!t) return editing ? null : undefined;
    if (t.id === EXISTING) return undefined;
    return t.id as Id<"_storage">;
  }

  async function save() {
    setBusy(true);
    try {
      const base = {
        title: title.trim(),
        priceKes: price ?? undefined,
        details: details.trim() || undefined,
        active,
      };
      if (promoId) {
        await update({ promoId, ...base, image: imageArg() });
      } else {
        const img = imageArg();
        await create({ ...base, image: img ?? undefined });
      }
      toast(editing ? "Offer saved" : "Offer created");
      onOpenChange(false);
    } catch (e) {
      toast(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!promoId) return;
    setBusy(true);
    try {
      await remove({ promoId });
      toast("Offer deleted");
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
        title={editing ? "Edit offer" : "New offer"}
        description="A deal for the studio's marketing — title, price and an optional flyer."
        footer={
          <Button variant="primary" block loading={busy} disabled={!canSave} onClick={save}>
            {editing ? "Save" : "Create offer"}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Title" placeholder="3 mini tattoos" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <MoneyInput label="Price" optional hint="The offer price, e.g. KES 3,000." value={price} onValueChange={setPrice} />
          <Textarea label="Details" optional rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="For 3 mini tattoos. DM to book." />
          <Segmented
            label="Status"
            value={active ? "active" : "paused"}
            onChange={(v) => setActive(v === "active")}
            options={[
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
            ]}
          />
          <FieldShell label="Flyer image" optional hint="The promo graphic you share on socials.">
            <ImageUploader
              thumbs={thumbs}
              max={1}
              altPrefix="Offer flyer"
              onUploaded={(_ids, previews) => setThumbs((prev) => [...prev, ...previews])}
              onRemove={(id) => setThumbs((prev) => prev.filter((t) => t.id !== id))}
            />
          </FieldShell>

          {editing && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="tap mt-2 inline-flex items-center gap-2 self-start text-label font-medium text-accent-fg hover:underline"
            >
              <Trash2 className="size-4" /> Delete offer
            </button>
          )}
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this offer?"
        body="This removes the offer and its flyer permanently."
        confirmLabel="Delete"
        loading={busy}
        onConfirm={doDelete}
      />
    </>
  );
}
