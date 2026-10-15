"use client";
import { api } from "@drink/backend/api";
import {
  addDaysEAT, dateKeyEAT, formatEAT, formatTime24, fromDateKey, LOCATION_LABEL, minutesOfDayEAT,
  startOfDayEAT, toEAT,
} from "@drink/shared";
import { useQuery } from "convex/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
    for (const r of rows ?? []) {
      const k = dateKeyEAT(r.startAt);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  }, [rows]);

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
                  ]
            }
          />
        </div>
      </div>

      {!desktop && <DateStrip anchor={anchor} onPick={setAnchor} marked={byDay} />}

      {rows === undefined ? (
        <ListSkeleton rows={5} />
      ) : view === "agenda" ? (
        <Agenda from={from} days={14} byDay={byDay} rangeFor={rangeFor} onEmpty={canBook ? (d) => openNewBooking({ startAt: d + 10 * 3600_000 }) : undefined} />
      ) : view === "month" ? (
        <MonthView
          from={from}
          anchor={anchor}
          byDay={byDay}
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
}: {
  anchor: number;
  onPick: (d: number) => void;
  marked: Map<string, BookingSummary[]>;
}) {
  const start = mondayOf(anchor);
  const todayKey = dateKeyEAT(Date.now());
  return (
    <div className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 sm:-mx-6 sm:px-6" aria-label="Pick a day">
      {Array.from({ length: 7 }, (_, i) => addDaysEAT(start, i)).map((d) => {
        const key = dateKeyEAT(d);
        const sel = key === dateKeyEAT(anchor);
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
            <span
              className={cn("size-1 rounded-full", marked.get(key)?.length ? (sel ? "bg-bg" : "bg-fg-2") : "bg-transparent")}
              aria-hidden
            />
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

function Agenda({
  from,
  days,
  byDay,
  rangeFor,
  onEmpty,
}: {
  from: number;
  days: number;
  byDay: Map<string, BookingSummary[]>;
  rangeFor: (d: number) => Range | undefined;
  onEmpty?: (d: number) => void;
}) {
  const list = Array.from({ length: days }, (_, i) => addDaysEAT(from, i));
  return (
    <ol className="flex flex-col gap-6">
      {list.map((d) => {
        const key = dateKeyEAT(d);
        const items = [...(byDay.get(key) ?? [])].sort((a, b) => a.startAt - b.startAt);
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
            {items.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {items.map((s, i) => (
                  <li key={s._id}>
                    <SessionRow s={s} index={i} />
                  </li>
                ))}
              </ul>
            ) : (
              !r &&
              onEmpty && (
                <button
                  onClick={() => onEmpty(d)}
                  className="w-full rounded-md border border-dashed border-line px-3 py-3 text-left text-label text-fg-3 hover:bg-hover"
                >
                  Free · tap to book
                </button>
              )
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
  now,
  rangeFor,
  onSlot,
}: {
  days: number[];
  byDay: Map<string, BookingSummary[]>;
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
          return (
            <div key={key} className="border-b border-l border-line bg-elevated px-2 py-2 text-center">
              <span className="text-caption text-fg-2">{formatEAT(d, "EEE")}</span>{" "}
              <span
                className={cn("text-label font-semibold tabular", key === todayKey && "rounded-full bg-accent px-1.5 text-on-accent")}
              >
                {formatEAT(d, "d")}
              </span>
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
  rangeFor,
  onPick,
}: {
  from: number;
  anchor: number;
  byDay: Map<string, BookingSummary[]>;
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
        const inMonth = toEAT(d).month === month;
        const r = rangeFor(d);
        return (
          <button
            key={key}
            onClick={() => onPick(d)}
            className={cn(
              "flex min-h-28 flex-col gap-1 border-b border-l border-line p-1.5 text-left hover:bg-hover",
              !inMonth && "opacity-40",
              r && "hatched",
            )}
          >
            <span className={cn("self-end px-1 text-caption tabular", key === todayKey && "rounded-full bg-accent text-on-accent")}>
              {formatEAT(d, "d")}
            </span>
            {r && <span className="truncate text-caption text-fg-2">{rangeLabel(r)}</span>}
            {items.slice(0, 3).map((s) => (
              <span
                key={s._id}
                className={cn("truncate rounded-sm bg-surface px-1 text-caption", s.status === "cancelled" && "text-fg-3 line-through")}
              >
                {formatTime24(s.startAt)} {s.clientName}
              </span>
            ))}
            {items.length > 3 && <span className="text-caption text-fg-3">+{items.length - 3} more</span>}
          </button>
        );
      })}
    </div>
  );
}
