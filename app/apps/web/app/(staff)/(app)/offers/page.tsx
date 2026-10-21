"use client";
import { api } from "@drink/backend/api";
import type { Id } from "@drink/backend/dataModel";
import { formatKes } from "@drink/shared";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PromoSheet, type PromoRow } from "@/components/offers/promo-sheet";
import { Button } from "@/components/ui/button";
import { Empty, ListSkeleton, PageTitle } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { toAppError } from "@/lib/errors";

function PromoCard({ p, i, onEdit }: { p: PromoRow; i: number; onEdit: () => void }) {
  const setActive = useMutation(api.promos.setActive);
  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await setActive({ promoId: p._id as Id<"promos">, active: !p.active });
    } catch (err) {
      toast(toAppError(err).message);
    }
  }
  return (
    <button
      type="button"
      onClick={onEdit}
      className="enter tap flex flex-col overflow-hidden rounded-lg border border-line bg-surface text-left shadow-card hover:bg-hover"
      style={{ animationDelay: `${Math.min(i, 5) * 30}ms` }}
    >
      {p.imageUrl && (
        <div className="aspect-[4/5] w-full overflow-hidden bg-hover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imageUrl} alt={`${p.title} flyer`} className="size-full object-cover" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 font-semibold">{p.title}</span>
          <span
            onClick={toggle}
            role="switch"
            aria-checked={p.active}
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-caption font-medium",
              p.active ? "bg-success-subtle text-success" : "bg-hover text-fg-3",
            )}
          >
            {p.active ? "Active" : "Paused"}
          </span>
        </div>
        {p.priceKes != null && <span className="money text-heading">{formatKes(p.priceKes)}</span>}
        {p.details && <p className="line-clamp-3 text-label text-fg-2 whitespace-pre-wrap">{p.details}</p>}
      </div>
    </button>
  );
}

export default function OffersPage() {
  const promos = useQuery(api.promos.list, {}) as PromoRow[] | undefined;
  const [active, setActive] = useState<PromoRow | null>(null);
  const [sheetKey, setSheetKey] = useState(0);
  const [open, setOpen] = useState(false);

  function openNew() {
    setActive(null);
    setSheetKey((k) => k + 1);
    setOpen(true);
  }
  function openEdit(p: PromoRow) {
    setActive(p);
    setSheetKey((k) => k + 1);
    setOpen(true);
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="hidden lg:block">
        <PageTitle right={<Button onClick={openNew}><Plus className="size-4" /> New offer</Button>}>Offers &amp; promos</PageTitle>
      </div>
      <div className="mb-4 flex lg:hidden">
        <Button block onClick={openNew}><Plus className="size-4" /> New offer</Button>
      </div>

      {promos === undefined ? (
        <ListSkeleton rows={4} />
      ) : promos.length === 0 ? (
        <Empty text="No offers yet." action={<Button onClick={openNew}><Plus className="size-4" /> New offer</Button>} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {promos.map((p, i) => (
            <li key={p._id} className="contents">
              <PromoCard p={p} i={i} onEdit={() => openEdit(p)} />
            </li>
          ))}
        </ul>
      )}

      <PromoSheet key={sheetKey} open={open} onOpenChange={setOpen} promo={active} />
    </div>
  );
}
