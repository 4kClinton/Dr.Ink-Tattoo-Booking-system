"use client";
import { api } from "@drink/backend/api";
import { addDaysEAT, formatDateShort, formatKes, LEAD_STATUS_LABEL, SOURCES, startOfDayEAT, waLink, type LeadStatus } from "@drink/shared";
import { usePaginatedQuery, useQuery } from "convex/react";
import { AtSign, CalendarClock, Music2, Phone, Plus, Search, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { LeadSheet, type LeadRow } from "@/components/leads/lead-sheet";
import { AddLeadSheet } from "@/components/leads/add-lead-sheet";
import { Button } from "@/components/ui/button";
import { Empty, ListSkeleton, PageTitle } from "@/components/ui/misc";
import { StatusChip, type ChipKind } from "@/components/ui/status-chip";
import { cn } from "@/lib/cn";
import { useDebounced } from "@/lib/hooks";

const STATUS_CHIP: Record<LeadStatus, ChipKind> = {
  new: "confirmed",
  contacted: "neutral",
  converted: "success",
  lost: "cancelled",
};

const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCES.map((s) => [s.value, s.label]));

function igUrl(h: string) {
  return `https://instagram.com/${h}`;
}
function tiktokUrl(h: string) {
  return `https://www.tiktok.com/@${h}`;
}

/** Small round quick-action link inside a card — stops the card click from opening the sheet. */
function Action({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      className="tap flex size-9 items-center justify-center rounded-full border border-line-strong bg-surface text-fg-2 hover:bg-hover hover:text-fg"
    >
      {children}
    </a>
  );
}

interface Row extends LeadRow {
  createdAt: number;
  phoneDisplay: string | null;
  lastContactedAt: number | null;
}

function LeadCard({ l, i, onOpen }: { l: Row; i: number; onOpen: () => void }) {
  const title = l.name || l.phoneDisplay || (l.instagram ? `@${l.instagram}` : "Lead");
  const sub = l.name && l.phoneDisplay ? l.phoneDisplay : null;
  const handles = [l.instagram ? `@${l.instagram}` : null, l.tiktok ? `TT @${l.tiktok}` : null].filter(Boolean).join(" · ");
  // A promise to book is "due" once that day has started (today or earlier) and isn't yet converted.
  const remindDue = l.remindAt != null && l.status !== "converted" && l.remindAt < addDaysEAT(startOfDayEAT(Date.now()), 1);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="enter tap flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-left shadow-card hover:bg-hover"
      style={{ animationDelay: `${Math.min(i, 5) * 30}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate font-semibold">{title}</span>
        <StatusChip kind={STATUS_CHIP[l.status]}>{LEAD_STATUS_LABEL[l.status]}</StatusChip>
      </div>

      <div className="min-w-0 space-y-0.5 text-label text-fg-2 tabular">
        {sub && <p className="truncate">{sub}</p>}
        {handles && <p className="truncate">{handles}</p>}
        <p className="text-caption text-fg-3">
          {l.source ? `${SOURCE_LABEL[l.source] ?? l.source} · ` : ""}
          {formatDateShort(l.createdAt)}
        </p>
      </div>

      {(l.price != null || l.remindAt != null) && (
        <div className="flex flex-wrap gap-1.5">
          {l.price != null && (
            <span className="money inline-flex w-fit items-center rounded-full border border-line-strong px-2.5 py-1 text-caption font-semibold text-fg">
              {formatKes(l.price)}
            </span>
          )}
          {l.remindAt != null && (
            <span
              className={cn(
                "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium",
                remindDue ? "bg-accent-subtle text-accent-fg" : "border border-line-strong text-fg-2",
              )}
            >
              <CalendarClock className="size-3.5" aria-hidden />
              Books {formatDateShort(l.remindAt)}
            </span>
          )}
        </div>
      )}

      {l.note && (
        <p className="line-clamp-2 rounded-lg rounded-tl-sm bg-hover px-3 py-2 text-caption text-fg-2">
          {l.note}
        </p>
      )}

      {l.images.length > 0 && (
        <div className="flex gap-1.5">
          {l.images.slice(0, 4).map((img, idx) => (
            <div key={img.id} className="relative size-11 overflow-hidden rounded-md border border-line bg-hover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={`${title} reference ${idx + 1}`} className="size-full object-cover" />
              {idx === 3 && l.images.length > 4 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-caption font-semibold text-white">
                  +{l.images.length - 4}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 pt-1">
        {l.phone && (
          <>
            <Action href={`tel:${l.phone}`} label="Call">
              <Phone className="size-4" />
            </Action>
            <Action href={waLink(l.phone)} label="WhatsApp">
              <Send className="size-4" />
            </Action>
          </>
        )}
        {l.instagram && (
          <Action href={igUrl(l.instagram)} label="Instagram">
            <AtSign className="size-4" />
          </Action>
        )}
        {l.tiktok && (
          <Action href={tiktokUrl(l.tiktok)} label="TikTok">
            <Music2 className="size-4" />
          </Action>
        )}
      </div>
    </button>
  );
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
] as const;

export default function LeadsPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [active, setActive] = useState<Row | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const dq = useDebounced(q, 200);
  const searching = dq.trim().length >= 2;

  const counts = useQuery(api.leads.counts, {});
  const results = useQuery(api.leads.search, searching ? { q: dq } : "skip");
  const listArgs = useMemo(
    () => (searching ? "skip" : filter === "all" ? {} : { status: filter }),
    [searching, filter],
  );
  const { results: all, status, loadMore } = usePaginatedQuery(api.leads.list, listArgs, { initialNumItems: 30 });
  const rows = (searching ? results : status === "LoadingFirstPage" ? undefined : all) as Row[] | undefined;

  function openLead(l: Row) {
    setActive(l);
    setSheetKey((k) => k + 1);
    setSheetOpen(true);
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="hidden lg:block">
        <PageTitle right={<Button onClick={() => setAddOpen(true)}><Plus className="size-4" /> Add lead</Button>}>Leads</PageTitle>
      </div>

      <div className="sticky top-14 z-20 -mx-4 bg-bg px-4 pb-3 sm:-mx-6 sm:px-6 lg:top-0 lg:pt-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone or @handle"
              aria-label="Search leads"
              className="h-12 w-full rounded-md border border-line bg-surface pr-4 pl-11 placeholder:text-fg-3 focus:border-line-strong focus:outline-none"
            />
          </div>
          <Button onClick={() => setAddOpen(true)} className="h-12 shrink-0 lg:hidden" aria-label="Add lead">
            <Plus className="size-4" /> <span className="hidden sm:inline">Add lead</span>
          </Button>
        </div>
        {!searching && (
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {FILTERS.map((ff) => {
              const n = counts?.[ff.value];
              const on = filter === ff.value;
              return (
                <button
                  key={ff.value}
                  type="button"
                  onClick={() => setFilter(ff.value)}
                  aria-pressed={on}
                  className={cn(
                    "tap h-9 shrink-0 rounded-full border px-3.5 text-label font-medium transition-colors",
                    on ? "border-fg bg-fg text-bg" : "border-line-strong bg-surface text-fg-2 hover:bg-hover",
                  )}
                >
                  {ff.label}
                  {n ? <span className={cn("ml-1.5", on ? "text-bg/70" : "text-fg-3")}>{n}</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <AddLeadSheet open={addOpen} onOpenChange={setAddOpen} />

      <div className="mt-2">
        {rows === undefined ? (
          <ListSkeleton rows={4} />
        ) : rows.length === 0 ? (
          searching ? (
            <Empty text={`No lead matches “${dq}”.`} />
          ) : (
            <Empty text="No leads yet." action={<Button onClick={() => setAddOpen(true)}><Plus className="size-4" /> Add lead</Button>} />
          )
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {rows.map((l, i) => (
              <li key={l._id} className="contents">
                <LeadCard l={l} i={i} onOpen={() => openLead(l)} />
              </li>
            ))}
          </ul>
        )}
        {!searching && status === "CanLoadMore" && (
          <Button block className="mt-4" onClick={() => loadMore(30)}>
            Load more
          </Button>
        )}
      </div>

      <LeadSheet key={sheetKey} open={sheetOpen} onOpenChange={setSheetOpen} lead={active} />
    </div>
  );
}
