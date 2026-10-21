"use client";
import { api } from "@drink/backend/api";
import type { Id } from "@drink/backend/dataModel";
import { BOOKING_EXTRA_LABEL, formatDateShort, formatKes, LEAD_STATUS_LABEL, SOURCES, waLink, type LeadStatus } from "@drink/shared";
import { useQuery } from "convex/react";
import { ArrowLeft, AtSign, CalendarClock, Music2, Phone, Send, UserCheck } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { LeadSheet, type LeadRow } from "@/components/leads/lead-sheet";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/card";
import { Empty, Skeleton } from "@/components/ui/misc";
import { StatusChip, type ChipKind } from "@/components/ui/status-chip";

const STATUS_CHIP: Record<LeadStatus, ChipKind> = {
  new: "confirmed",
  contacted: "neutral",
  converted: "success",
  lost: "cancelled",
};
const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCES.map((s) => [s.value, s.label]));

/** A contact shortcut pill — call, WhatsApp, Instagram, TikTok. */
function ContactPill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-label font-medium tabular hover:bg-hover"
    >
      {children}
    </a>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-fg-2">{label}</dt>
      <dd className="text-subhead font-semibold">{children}</dd>
    </div>
  );
}

export default function LeadProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const lead = useQuery(api.leads.get, { leadId: id as Id<"leads"> });
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);

  if (lead === undefined)
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  if (lead === null)
    return <Empty text="This lead doesn't exist." action={<Button onClick={() => router.push("/leads")}>All leads</Button>} />;

  const title = lead.name || lead.phoneDisplay || (lead.instagram ? `@${lead.instagram}` : lead.tiktok ? `@${lead.tiktok}` : "Lead");

  function openEdit() {
    setEditKey((k) => k + 1);
    setEditOpen(true);
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <button onClick={() => router.back()} className="tap -ml-2 mb-4 flex items-center gap-1 rounded-md px-2 py-2 text-label font-medium text-fg-2 hover:bg-hover">
        <ArrowLeft className="size-4" /> Back
      </button>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="min-w-0 truncate font-display text-display leading-tight lg:text-[36px]">{title}</h1>
            <StatusChip kind={STATUS_CHIP[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</StatusChip>
          </div>
          <Button size="sm" onClick={openEdit}>
            Edit
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {lead.phone && (
            <>
              <ContactPill href={`tel:${lead.phone}`}>
                <Phone className="size-3.5" aria-hidden /> {lead.phoneDisplay}
              </ContactPill>
              <ContactPill href={waLink(lead.phone)}>
                <Send className="size-3.5" aria-hidden /> WhatsApp
              </ContactPill>
            </>
          )}
          {lead.instagram && (
            <ContactPill href={`https://instagram.com/${lead.instagram}`}>
              <AtSign className="size-3.5" aria-hidden /> @{lead.instagram}
            </ContactPill>
          )}
          {lead.tiktok && (
            <ContactPill href={`https://www.tiktok.com/@${lead.tiktok}`}>
              <Music2 className="size-3.5" aria-hidden /> @{lead.tiktok}
            </ContactPill>
          )}
        </div>
        {lead.client && (
          <p className="mt-3 text-label text-fg-2">
            Returning client ·{" "}
            <Link href={`/clients/${lead.client._id}`} className="font-medium text-fg underline-offset-4 hover:underline">
              {lead.client.fullName}
            </Link>
          </p>
        )}
      </header>

      {lead.convertedClientId ? (
        <Button variant="primary" block className="mb-6" onClick={() => router.push(`/clients/${lead.convertedClientId}`)}>
          <UserCheck className="size-4" /> Open client
        </Button>
      ) : (
        <Button variant="primary" block className="mb-6" onClick={openEdit}>
          <UserCheck className="size-4" /> Convert to client
        </Button>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-x-3 gap-y-4 rounded-lg border border-line bg-surface p-4 shadow-card sm:grid-cols-3">
        <Detail label="Added">{formatDateShort(lead.createdAt)}</Detail>
        {lead.source && <Detail label="Source">{SOURCE_LABEL[lead.source] ?? lead.source}</Detail>}
        {lead.price != null && <Detail label="Price"><span className="money">{formatKes(lead.price)}</span></Detail>}
        {lead.remindAt != null && (
          <Detail label="Promised to book">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-3.5 text-fg-3" aria-hidden /> {formatDateShort(lead.remindAt)}
            </span>
          </Detail>
        )}
        {lead.followUpAt != null && (
          <Detail label="Follow up on">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-3.5 text-fg-3" aria-hidden /> {formatDateShort(lead.followUpAt)}
            </span>
          </Detail>
        )}
      </dl>

      {lead.extras.length > 0 && (
        <div className="mb-6">
          <SectionLabel className="mb-2">Extras</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {lead.extras.map((e) => (
              <span key={e} className="rounded-full border border-line-strong px-2.5 py-1 text-caption font-medium text-fg-2">
                {BOOKING_EXTRA_LABEL[e] ?? e}
              </span>
            ))}
          </div>
        </div>
      )}

      {lead.note && (
        <div className="mb-6">
          <SectionLabel className="mb-2">Note</SectionLabel>
          <p className="rounded-lg border border-line bg-surface p-4 text-label text-fg-2 whitespace-pre-wrap">{lead.note}</p>
        </div>
      )}

      {lead.images.length > 0 && (
        <div className="mb-6">
          <SectionLabel className="mb-2">Reference images</SectionLabel>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {lead.images.map((p, i) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="relative aspect-square overflow-hidden rounded-md bg-hover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Reference image ${i + 1}`} className="size-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      <LeadSheet key={editKey} open={editOpen} onOpenChange={setEditOpen} lead={lead as LeadRow} />
    </div>
  );
}
