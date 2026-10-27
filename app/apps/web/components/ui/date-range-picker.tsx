"use client";
import { addDaysEAT, dateKeyEAT, formatEAT, fromDateKey, fromEATParts, startOfDayEAT, toEAT } from "@drink/shared";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Inclusive range of EAT "YYYY-MM-DD" keys. */
export interface DateRange {
  from: string;
  to: string;
}

export const RANGE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "3-months", label: "Last 3 months" },
  { id: "year", label: "This year" },
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number]["id"];

function monthStart(year: number, month: number) {
  return fromEATParts(year, month, 1);
}

export function presetRange(id: RangePreset, now = Date.now()): DateRange {
  const today = startOfDayEAT(now);
  const t = toEAT(today);
  const key = dateKeyEAT;
  switch (id) {
    case "today":
      return { from: key(today), to: key(today) };
    case "week": {
      const mon = addDaysEAT(today, -((t.weekday + 6) % 7));
      return { from: key(mon), to: key(addDaysEAT(mon, 6)) };
    }
    case "month": {
      const next = t.month === 12 ? monthStart(t.year + 1, 1) : monthStart(t.year, t.month + 1);
      return { from: key(monthStart(t.year, t.month)), to: key(addDaysEAT(next, -1)) };
    }
    case "last-month": {
      const first = t.month === 1 ? monthStart(t.year - 1, 12) : monthStart(t.year, t.month - 1);
      return { from: key(first), to: key(addDaysEAT(monthStart(t.year, t.month), -1)) };
    }
    case "3-months":
      return { from: key(addDaysEAT(today, -89)), to: key(today) };
    case "year":
      return { from: key(monthStart(t.year, 1)), to: key(fromEATParts(t.year, 12, 31)) };
  }
}

export function matchPreset(r: DateRange): RangePreset | null {
  return RANGE_PRESETS.find((p) => {
    const pr = presetRange(p.id);
    return pr.from === r.from && pr.to === r.to;
  })?.id ?? null;
}

export function formatRange(r: DateRange) {
  const a = fromDateKey(r.from);
  const b = fromDateKey(r.to);
  if (r.from === r.to) return formatEAT(a, "d MMM yyyy");
  const sameYear = toEAT(a).year === toEAT(b).year;
  return `${formatEAT(a, sameYear ? "d MMM" : "d MMM yyyy")} – ${formatEAT(b, "d MMM yyyy")}`;
}

/** The Sunday-aligned 42-cell (6-week) grid of epoch-ms for the month containing `view`. */
function monthGrid(view: { year: number; month: number }) {
  const firstMs = monthStart(view.year, view.month);
  const gridStart = addDaysEAT(firstMs, -toEAT(firstMs).weekday);
  return Array.from({ length: 42 }, (_, i) => addDaysEAT(gridStart, i));
}

/**
 * Period selector for reports: quick presets plus a calendar where you tap a start day then an
 * end day. Nothing changes until Apply, so half-picked ranges never hit the server.
 */
export function DateRangePicker({ value, onChange, className }: { value: DateRange; onChange: (r: DateRange) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from: string; to: string | null }>(value);
  const [view, setView] = useState(() => toEAT(fromDateKey(value.to)));

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    setView(toEAT(fromDateKey(value.to)));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.month - 1 + delta;
      return { ...v, year: v.year + Math.floor(m / 12), month: (((m % 12) + 12) % 12) + 1 };
    });
  }

  function pickDay(key: string) {
    if (draft.to !== null) return setDraft({ from: key, to: null });
    setDraft(key < draft.from ? { from: key, to: draft.from } : { from: draft.from, to: key });
  }

  function apply(r: DateRange) {
    onChange(r);
    setOpen(false);
  }

  const preset = matchPreset(value);
  const draftPreset = draft.to ? matchPreset({ from: draft.from, to: draft.to }) : null;
  const todayKey = dateKeyEAT(Date.now());
  const cells = monthGrid(view);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "tap flex h-12 items-center gap-3 rounded-md border border-line bg-surface px-4 text-left transition-shadow hover:border-line-strong focus-visible:shadow-[var(--focus-ring)] focus:outline-none lg:h-10",
          className,
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-fg-3" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          {preset && <span className="font-semibold">{RANGE_PRESETS.find((p) => p.id === preset)?.label} · </span>}
          <span className="tabular text-fg-2">{formatRange(value)}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-fg-3" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Choose dates" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-[var(--backdrop)]" aria-hidden />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[360px] rounded-xl border border-line bg-surface p-4 shadow-sheet">
            <div className="mb-4 flex flex-wrap gap-2">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => apply(presetRange(p.id))}
                  aria-pressed={draftPreset === p.id}
                  className={cn(
                    "tap h-8 rounded-full border px-3 text-caption font-medium transition-colors",
                    draftPreset === p.id ? "border-fg bg-fg text-bg" : "border-line-strong bg-surface text-fg hover:bg-hover",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="tap flex size-9 items-center justify-center rounded-md text-fg-2 hover:bg-hover hover:text-fg">
                <ChevronLeft className="size-5" />
              </button>
              <span className="font-display text-heading">
                {MONTHS[view.month - 1]} {view.year}
              </span>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="tap flex size-9 items-center justify-center rounded-md text-fg-2 hover:bg-hover hover:text-fg">
                <ChevronRight className="size-5" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 text-center text-caption font-medium text-fg-3">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1">
              {cells.map((ms) => {
                const p = toEAT(ms);
                const key = dateKeyEAT(ms);
                const inMonth = p.month === view.month;
                const isStart = key === draft.from;
                const isEnd = key === draft.to;
                const inRange = draft.to !== null && key > draft.from && key < draft.to;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pickDay(key)}
                    aria-current={key === todayKey ? "date" : undefined}
                    aria-pressed={isStart || isEnd}
                    className={cn(
                      "tap flex h-10 items-center justify-center text-label tabular transition-colors",
                      !inMonth && "text-fg-3/50",
                      inRange && "bg-hover",
                      (isStart || isEnd) ? "rounded-md bg-accent font-semibold text-on-accent" : inMonth && "text-fg hover:bg-hover",
                      !isStart && !isEnd && !inRange && "rounded-md",
                      key === todayKey && !isStart && !isEnd && "font-semibold text-accent-fg",
                    )}
                  >
                    {p.day}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-caption text-fg-2" aria-live="polite">
              {draft.to === null ? "Now tap the end date." : formatRange({ from: draft.from, to: draft.to })}
            </p>

            <div className="mt-3 flex gap-3 border-t border-line pt-3">
              <Button block size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                block
                size="sm"
                variant="primary"
                onClick={() => apply({ from: draft.from, to: draft.to ?? draft.from })}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
