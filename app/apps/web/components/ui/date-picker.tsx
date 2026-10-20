"use client";
import { addDaysEAT, dateKeyEAT, formatDateLong, fromEATParts, startOfDayEAT, toEAT } from "@drink/shared";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FieldShell } from "@/components/ui/field";
import { cn } from "@/lib/cn";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The Sunday-aligned 42-cell (6-week) grid of epoch-ms for the month containing `view`. */
function monthGrid(view: { year: number; month: number }) {
  const firstMs = fromEATParts(view.year, view.month, 1);
  const firstWeekday = toEAT(firstMs).weekday; // 0 = Sun
  const gridStart = addDaysEAT(firstMs, -firstWeekday);
  return Array.from({ length: 42 }, (_, i) => addDaysEAT(gridStart, i));
}

/**
 * Date field with a custom popup-modal calendar. Values are EAT "YYYY-MM-DD" keys (same as a
 * native date input) so callers keep converting with fromDateKey — only the UI differs.
 */
export function DatePicker({
  label,
  value,
  onChange,
  optional,
  hint,
  placeholder = "Pick a date",
}: {
  label?: React.ReactNode;
  value: string;
  onChange: (key: string) => void;
  optional?: boolean;
  hint?: React.ReactNode;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedMs = value ? fromEATParts(...(value.split("-").map(Number) as [number, number, number])) : null;
  const [view, setView] = useState(() => {
    const base = toEAT(selectedMs ?? Date.now());
    return { year: base.year, month: base.month };
  });

  // When reopened, jump the calendar back to the selected month (or today).
  useEffect(() => {
    if (open) {
      const base = toEAT(selectedMs ?? Date.now());
      setView({ year: base.year, month: base.month });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.month - 1 + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 + 1 };
    });
  }

  function pick(ms: number) {
    onChange(dateKeyEAT(ms));
    setOpen(false);
  }

  const todayKey = dateKeyEAT(Date.now());
  const cells = monthGrid(view);

  return (
    <FieldShell label={label} optional={optional} hint={hint}>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap flex h-12 flex-1 items-center gap-3 rounded-md border border-line bg-surface px-4 text-left transition-shadow hover:border-line-strong focus-visible:shadow-[var(--focus-ring)] focus:outline-none"
        >
          <CalendarDays className="size-4 shrink-0 text-fg-3" aria-hidden />
          <span className={cn("truncate", value ? "text-fg" : "text-fg-3")}>
            {selectedMs ? formatDateLong(selectedMs) : placeholder}
          </span>
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear date"
            className="tap flex size-12 shrink-0 items-center justify-center rounded-md border border-line text-fg-3 hover:bg-hover hover:text-fg"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Choose a date"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-[var(--backdrop)]" aria-hidden />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[340px] rounded-xl border border-line bg-surface p-4 shadow-sheet"
          >
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="tap flex size-9 items-center justify-center rounded-md text-fg-2 hover:bg-hover hover:text-fg"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="font-display text-heading">
                {MONTHS[view.month - 1]} {view.year}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="tap flex size-9 items-center justify-center rounded-md text-fg-2 hover:bg-hover hover:text-fg"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-caption font-medium text-fg-3">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((ms) => {
                const p = toEAT(ms);
                const key = dateKeyEAT(ms);
                const inMonth = p.month === view.month;
                const isToday = key === todayKey;
                const isSelected = key === value;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pick(ms)}
                    aria-current={isToday ? "date" : undefined}
                    aria-pressed={isSelected}
                    className={cn(
                      "tap flex h-10 items-center justify-center rounded-md text-label tabular transition-colors",
                      !inMonth && "text-fg-3/50",
                      inMonth && !isSelected && "text-fg hover:bg-hover",
                      isToday && !isSelected && "font-semibold text-accent-fg",
                      isSelected && "bg-accent font-semibold text-on-accent",
                    )}
                  >
                    {p.day}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <button
                type="button"
                onClick={() => pick(startOfDayEAT(Date.now()))}
                className="tap rounded-md px-3 py-1.5 text-label font-medium text-fg-2 hover:bg-hover hover:text-fg"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="tap rounded-md px-3 py-1.5 text-label font-medium text-fg-2 hover:bg-hover hover:text-fg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </FieldShell>
  );
}
