"use client";
import { api } from "@drink/backend/api";
import {
  addDaysEAT, dateKeyEAT, formatEAT, formatTime24, fromDateKey, LOCATION_LABEL, minutesOfDayEAT,
  startOfDayEAT, toEAT,
} from "@drink/shared";
import { useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNewBooking } from "@/components/booking/new-booking-context";
import { SessionRow, type BookingSummary } from "@/components/booking/session-row";
import { SessionBlock } from "@/components/calendar/blocks";
import { useCan } from "@/components/shell/viewer";
import { Button } from "@/components/ui/button";
import { ListSkeleton, PageTitle } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { useIsDesktop, useNow } from "@/lib/hooks";

type View = "agenda" | "day" | "week" | "month";
type Entities = "both" | "clients" | "leads";

export interface LeadEntry {
  _id: string;
  name: string;
  remindAt: number;
  status: string;
}

const HOUR_START = 7;
const HOUR_END = 22;
const HOUR_PX = 56;

function mondayOf(ms: number) {
  const d = startOfDayEAT(ms);
  return addDaysEAT(d, -((toEAT(d).weekday + 6) % 7));
}

function firstOfMonth(ms: number) {
  const p = toEAT(ms);
  return fromDateKey(`${p.year}-${String(p.month).padStart(2, "0")}-01`);
}

interface Range {
  _id: string;
  kind: string;
  from?: number;
  to?: number;
  location?: string;
  note?: string;
}

function rangeLabel(r: Range) {
  return r.kind === "tour" ? `${LOCATION_LABEL[r.location as keyof typeof LOCATION_LABEL] ?? r.location} tour` : "Off";
}

export default function CalendarPage() {
  const desktop = useIsDesktop();
  const now = useNow(60_000);
  const { open: openBookingSheet } = useNewBooking();
  const canBook = useCan("bookings.manage");
  const openNewBooking = (p: { startAt: number }) => canBook && openBookingSheet(p);
  const [view, setView] = useState<View>("agenda");
  const [anchor, setAnchor] = useState(() => startOfDayEAT(Date.now()));
  const [showCancelled, setShowCancelled] = useState(false);
  const canLeads = useCan("clients.edit");
  const [entities, setEntities] = useState<Entities>("both");
  const showClients = entities !== "leads";
  const showLeads = canLeads && entities !== "clients";

  useEffect(() => setView(desktop ? "week" : "agenda"), [desktop]);

  const { from, to } = useMemo(() => {
    if (view === "day") return { from: anchor, to: addDaysEAT(anchor, 1) };
    if (view === "week") return { from: mondayOf(anchor), to: addDaysEAT(mondayOf(anchor), 7) };
    if (view === "month") {
      const gridStart = mondayOf(firstOfMonth(anchor));
      return { from: gridStart, to: addDaysEAT(gridStart, 42) };
    }
    return { from: anchor, to: addDaysEAT(anchor, 14) };
  }, [view, anchor]);

  const rows = useQuery(api.bookings.range, { from, to, includeCancelled: showCancelled });
  const leadRows = useQuery(api.leads.remindRange, showLeads ? { from, to } : "skip");
  const avail = useQuery(api.availability.list);
  const ranges: Range[] = useMemo(() => [...(avail?.blocks ?? []), ...(avail?.tours ?? [])] as Range[], [avail]);

  const step = useCallback(
    (dir: 1 | -1) =>
      setAnchor((a) => {
        if (view === "day") return addDaysEAT(a, dir);
        if (view === "week" || view === "agenda") return addDaysEAT(a, 7 * dir);
        const p = toEAT(a);
        const m = p.month + dir;
        const y = m < 1 ? p.year - 1 : m > 12 ? p.year + 1 : p.year;
        return fromDateKey(`${y}-${String(((m + 11) % 12) + 1).padStart(2, "0")}-01`);
      }),
    [view],
  );

  // Desktop keyboard navigation (§7): ← → move, T = today
  useEffect(() => {
    if (!desktop) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select,[role=dialog]")) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "t") setAnchor(startOfDayEAT(Date.now()));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [desktop, step]);

  const byDay = useMemo(() => {
    const m = new Map<string, BookingSummary[]>();
    if (!showClients) return m;
    for (const r of rows ?? []) {
      const k = dateKeyEAT(r.startAt);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  }, [rows, showClients]);

  const leadsByDay = useMemo(() => {
    const m = new Map<string, LeadEntry[]>();
    if (!showLeads) return m;
    for (const l of leadRows ?? []) {
      const k = dateKeyEAT(l.remindAt);
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return m;
  }, [leadRows, showLeads]);

  const rangeFor = useCallback(
    (dayStart: number) => ranges.find((r) => (r.from ?? 0) <= dayStart && dayStart < (r.to ?? 0)),
    [ranges],
  );

  const title =
    view === "month"
      ? formatEAT(firstOfMonth(anchor), "MMMM yyyy")
      : view === "day"
        ? formatEAT(anchor, "EEE d MMM")
        : `${formatEAT(from, "d MMM")} – ${formatEAT(addDaysEAT(to, -1), "d MMM")}`;

  return (
    <div>
      <div className="hidden lg:block">
        <PageTitle>Calendar</PageTitle>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className="tap rounded-md p-2 hover:bg-hover" aria-label="Previous">
            <ChevronLeft className="size-5" />
          </button>
          <button onClick={() => step(1)} className="tap rounded-md p-2 hover:bg-hover" aria-label="Next">
            <ChevronRight className="size-5" />
          </button>
          <span className="ml-1 text-subhead font-semibold tabular">{title}</span>
        </div>
        <Button size="sm" onClick={() => setAnchor(startOfDayEAT(Date.now()))}>
          Today
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {canLeads && (
            <Segmented
              label="Show"
              size="sm"
              value={entities}
              onChange={setEntities}
              className="w-auto"
              options={[
                { value: "both", label: "Both" },
                { value: "clients", label: "Clients" },
                { value: "leads", label: "Leads" },
              ]}
            />
          )}
          <label className="flex items-center gap-2 text-label text-fg-2">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
              className="size-4 accent-[var(--text)]"
            />
            Show cancelled
          </label>
          <Segmented
            label="Calendar view"
            size="sm"
            value={view}
            onChange={setView}
            className="w-auto"
            options={
              desktop
                ? [
                    { value: "day", label: "Day" },
                    { value: "week", label: "Week" },
                    { value: "month", label: "Month" },
                  ]
                : [
                    { value: "agenda", label: "Agenda" },
                    { value: "day", label: "Day" },
                    { value: "month", label: "Month" },
                  ]
            }
          />
        </div>
      </div>

      {!desktop && <DateStrip anchor={anchor} onPick={setAnchor} marked={byDay} leadMarked={leadsByDay} />}

      {rows === undefined ? (
        <ListSkeleton rows={5} />
      ) : view === "agenda" ? (
        <Agenda from={from} days={14} byDay={byDay} leadsByDay={leadsByDay} rangeFor={rangeFor} onEmpty={canBook ? (d) => openNewBooking({ startAt: d + 10 * 3600_000 }) : undefined} />
      ) : view === "month" ? (
        <MonthView
          from={from}
          anchor={anchor}
          byDay={byDay}
          leadsByDay={leadsByDay}
          rangeFor={rangeFor}
          onPick={(d) => {
            setAnchor(d);
            setView("day");
          }}
        />
      ) : (
        <TimeGrid
          days={view === "day" ? [anchor] : Array.from({ length: 7 }, (_, i) => addDaysEAT(from, i))}
          byDay={byDay}
          leadsByDay={leadsByDay}
          now={now}
          rangeFor={rangeFor}
          onSlot={(startAt) => openNewBooking({ startAt })}
        />
      )}
    </div>
  );
}

function DateStrip({
  anchor,
  onPick,
  marked,
  leadMarked,
}: {
  anchor: number;
  onPick: (d: number) => void;
  marked: Map<string, BookingSummary[]>;
  leadMarked: Map<string, LeadEntry[]>;
}) {
  const start = mondayOf(anchor);
  const todayKey = dateKeyEAT(Date.now());
  return (
    <div className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 sm:-mx-6 sm:px-6" aria-label="Pick a day">
      {Array.from({ length: 7 }, (_, i) => addDaysEAT(start, i)).map((d) => {
        const key = dateKeyEAT(d);
        const sel = key === dateKeyEAT(anchor);
        const hasBooking = !!marked.get(key)?.length;
        const hasLead = !!leadMarked.get(key)?.length;
        return (
          <button
            key={key}
            aria-pressed={sel}
            onClick={() => onPick(d)}
            className={cn("tap flex min-w-12 flex-1 flex-col items-center gap-0.5 rounded-md py-2", sel ? "bg-fg text-bg" : "hover:bg-hover")}
          >
            <span className={cn("text-caption", sel ? "text-bg" : "text-fg-2")}>{formatEAT(d, "EEE")}</span>
            <span className={cn("text-subhead font-semibold tabular", key === todayKey && !sel && "text-accent-fg")}>
              {formatEAT(d, "d")}
            </span>
            <span className="flex h-1 items-center gap-0.5" aria-hidden>
              {hasBooking && <span className={cn("size-1 rounded-full", sel ? "bg-bg" : "bg-fg-2")} />}
              {hasLead && <span className={cn("size-1 rounded-full", sel ? "bg-bg/70" : "bg-accent")} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RangeBand({ r }: { r: Range }) {
  return (
    <div className="hatched rounded-sm border border-line px-3 py-2 text-label text-fg-2">
      {rangeLabel(r)}
      {r.note && <span className="text-fg-3"> · {r.note}</span>}
    </div>
  );
}

function LeadAgendaRow({ l }: { l: LeadEntry }) {
  return (
    <Link href={`/leads/${l._id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-hover">
      <span className="flex min-w-0 items-center gap-2">
        <UserPlus className="size-4 shrink-0 text-accent" aria-hidden />
        <span className="truncate font-medium">{l.name}</span>
      </span>
      <span className="shrink-0 text-caption text-fg-3">Promised to book</span>
    </Link>
  );
}

function Agenda({
  from,
  days,
  byDay,
  leadsByDay,
  rangeFor,
  onEmpty,
}: {
  from: number;
  days: number;
  byDay: Map<string, BookingSummary[]>;
  leadsByDay: Map<string, LeadEntry[]>;
  rangeFor: (d: number) => Range | undefined;
  onEmpty?: (d: number) => void;
}) {
  const list = Array.from({ length: days }, (_, i) => addDaysEAT(from, i));
  return (
    <ol className="flex flex-col gap-6">
      {list.map((d) => {
        const key = dateKeyEAT(d);
        const items = [...(byDay.get(key) ?? [])].sort((a, b) => a.startAt - b.startAt);
        const leads = leadsByDay.get(key) ?? [];
        const r = rangeFor(d);
        return (
          <li key={key}>
            <h3 className="mb-2 flex items-baseline justify-between text-label font-semibold">
              <span>{formatEAT(d, "EEE d MMM")}</span>
              {items.length > 0 && (
                <span className="text-caption font-normal text-fg-3">
                  {items.length} session{items.length > 1 ? "s" : ""}
                </span>
              )}
            </h3>
            {r && (
              <div className="mb-2">
                <RangeBand r={r} />
              </div>
            )}
            {items.length > 0 && (
              <ul className="flex flex-col divide-y divide-line">
                {items.map((s, i) => (
                  <li key={s._id}>
                    <SessionRow s={s} index={i} />
                  </li>
                ))}
              </ul>
            )}
            {leads.length > 0 && (
              <ul className="flex flex-col divide-y divide-line">
                {leads.map((l) => (
                  <li key={l._id}>
                    <LeadAgendaRow l={l} />
                  </li>
                ))}
              </ul>
            )}
            {items.length === 0 && leads.length === 0 && !r && onEmpty && (
              <button
                onClick={() => onEmpty(d)}
                className="w-full rounded-md border border-dashed border-line px-3 py-3 text-left text-label text-fg-3 hover:bg-hover"
              >
                Free · tap to book
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function TimeGrid({
  days,
  byDay,
  leadsByDay,
  now,
  rangeFor,
  onSlot,
}: {
  days: number[];
  byDay: Map<string, BookingSummary[]>;
  leadsByDay: Map<string, LeadEntry[]>;
  now: number;
  rangeFor: (d: number) => Range | undefined;
  onSlot: (startAt: number) => void;
}) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const todayKey = dateKeyEAT(now);
  const nowMin = minutesOfDayEAT(now);
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <div
        className={cn("grid", days.length > 1 && "min-w-[720px]")}
        style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
      >
        <div className="border-b border-line bg-elevated" />
        {days.map((d) => {
          const key = dateKeyEAT(d);
          const leads = leadsByDay.get(key) ?? [];
          return (
            <div key={key} className="border-b border-l border-line bg-elevated px-2 py-2 text-center">
              <div>
                <span className="text-caption text-fg-2">{formatEAT(d, "EEE")}</span>{" "}
                <span
                  className={cn("text-label font-semibold tabular", key === todayKey && "rounded-full bg-accent px-1.5 text-on-accent")}
                >
                  {formatEAT(d, "d")}
                </span>
              </div>
              {leads.length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5">
                  {leads.map((l) => (
                    <Link
                      key={l._id}
                      href={`/leads/${l._id}`}
                      className="flex items-center gap-1 truncate rounded-sm border border-dashed border-line-strong px-1 py-0.5 text-caption text-fg-2 hover:bg-hover"
                    >
                      <UserPlus className="size-3 shrink-0 text-accent" aria-hidden />
                      <span className="truncate">{l.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div>
          {hours.map((h) => (
            <div key={h} className="pr-2 text-right text-caption text-fg-3 tabular" style={{ height: HOUR_PX }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((d) => {
          const key = dateKeyEAT(d);
          const items = byDay.get(key) ?? [];
          const r = rangeFor(d);
          return (
            <div
              key={key}
              className={cn("relative cursor-pointer border-l border-line", r && "hatched")}
              style={{ height: hours.length * HOUR_PX }}
              onClick={(e) => {
                const y = e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top;
                const min = HOUR_START * 60 + Math.floor((y / HOUR_PX) * 4) * 15;
                onSlot(fromDateKey(key, min));
              }}
              role="presentation"
            >
              {hours.map((h) => (
                <div key={h} className="border-b border-line/60" style={{ height: HOUR_PX }} />
              ))}
              {r && <span className="absolute top-1 left-1 rounded-sm bg-bg/80 px-1.5 text-caption text-fg-2">{rangeLabel(r)}</span>}
              {items.map((s) => {
                const top = ((minutesOfDayEAT(s.startAt) - HOUR_START * 60) / 60) * HOUR_PX;
                const height = Math.max(24, (s.durationMin / 60) * HOUR_PX - 2);
                return (
                  <div key={s._id} className="absolute inset-x-1" style={{ top: Math.max(0, top), height }}>
                    <SessionBlock s={s} compact={height < 40} style={{ height: "100%" }} />
                  </div>
                );
              })}
              {key === todayKey && nowMin >= HOUR_START * 60 && nowMin <= HOUR_END * 60 && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10"
                  style={{ top: ((nowMin - HOUR_START * 60) / 60) * HOUR_PX }}
                  aria-hidden
                >
                  <div className="relative h-px bg-accent">
                    <span className="absolute -top-[3px] -left-[3px] size-1.5 rounded-full bg-accent" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({
  from,
  anchor,
  byDay,
  leadsByDay,
  rangeFor,
  onPick,
}: {
  from: number;
  anchor: number;
  byDay: Map<string, BookingSummary[]>;
  leadsByDay: Map<string, LeadEntry[]>;
  rangeFor: (d: number) => Range | undefined;
  onPick: (d: number) => void;
}) {
  const month = toEAT(firstOfMonth(anchor)).month;
  const todayKey = dateKeyEAT(Date.now());
  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-line">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
        <div key={d} className="border-b border-line bg-elevated py-2 text-center text-caption text-fg-2">
          {d}
        </div>
      ))}
      {Array.from({ length: 42 }, (_, i) => addDaysEAT(from, i)).map((d) => {
        const key = dateKeyEAT(d);
        const items = [...(byDay.get(key) ?? [])].sort((a, b) => a.startAt - b.startAt);
        const leads = leadsByDay.get(key) ?? [];
        const inMonth = toEAT(d).month === month;
        const r = rangeFor(d);
        return (
          <button
            key={key}
            onClick={() => onPick(d)}
            className={cn(
              "flex min-h-20 flex-col gap-1 border-b border-l border-line p-1 text-left hover:bg-hover sm:min-h-28 sm:p-1.5",
              !inMonth && "opacity-40",
              r && "hatched",
            )}
          >
            <span className={cn("self-end px-1 text-caption tabular", key === todayKey && "rounded-full bg-accent text-on-accent")}>
              {formatEAT(d, "d")}
            </span>
            {r && <span className="truncate text-caption text-fg-2">{rangeLabel(r)}</span>}
            {/* On phones the 7-col grid is too narrow for text — show dots; full labels from sm up. */}
            {(items.length > 0 || leads.length > 0) && (
              <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                {items.slice(0, 4).map((s) => (
                  <span key={s._id} className={cn("size-1.5 rounded-full", s.status === "cancelled" ? "bg-fg-3" : "bg-fg-2")} />
                ))}
                {leads.slice(0, 2).map((l) => (
                  <span key={l._id} className="size-1.5 rounded-full bg-accent" />
                ))}
              </span>
            )}
            <span className="hidden flex-col gap-1 sm:flex">
              {items.slice(0, 3).map((s) => (
                <span
                  key={s._id}
                  className={cn("truncate rounded-sm bg-surface px-1 text-caption", s.status === "cancelled" && "text-fg-3 line-through")}
                >
                  {formatTime24(s.startAt)} {s.clientName}
                </span>
              ))}
              {items.length > 3 && <span className="text-caption text-fg-3">+{items.length - 3} more</span>}
              {leads.slice(0, 2).map((l) => (
                <span
                  key={l._id}
                  className="flex items-center gap-1 truncate rounded-sm border border-dashed border-line-strong px-1 text-caption text-fg-2"
                >
                  <UserPlus className="size-3 shrink-0 text-accent" aria-hidden />
                  <span className="truncate">{l.name}</span>
                </span>
              ))}
              {leads.length > 2 && <span className="text-caption text-fg-3">+{leads.length - 2} leads</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
