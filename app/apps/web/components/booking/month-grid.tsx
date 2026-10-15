"use client";
import { addDaysEAT, dateKeyEAT, formatEAT, fromEATParts, toEAT } from "@drink/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

/** Month grid date picker (spec: no native wheel). Value is an EAT date key "YYYY-MM-DD". */
export function MonthGrid({
  value,
  onChange,
  minKey,
  markedKeys,
  blockedKeys,
}: {
  value: string | null;
  onChange: (key: string) => void;
  minKey?: string;
  markedKeys?: Set<string>;
  blockedKeys?: Set<string>;
}) {
  const init = value ? toEAT(fromEATParts(...(value.split("-").map(Number) as [number, number, number]))) : toEAT(Date.now());
  const [ym, setYm] = useState({ y: init.year, m: init.month });
  const first = fromEATParts(ym.y, ym.m, 1, 12);
  const lead = (toEAT(first).weekday + 6) % 7; // Monday-first
  const daysInMonth = new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
  const todayKey = dateKeyEAT(Date.now());
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => dateKeyEAT(addDaysEAT(first, i))),
  ];
  const shift = (d: number) => setYm(({ y, m }) => (m + d < 1 ? { y: y - 1, m: 12 } : m + d > 12 ? { y: y + 1, m: 1 } : { y, m: m + d }));

  return (
    <div className="rounded-md border border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="tap rounded-md p-2 hover:bg-hover" aria-label="Previous month">
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-subhead font-semibold">{formatEAT(first, "MMMM yyyy")}</span>
        <button type="button" onClick={() => shift(1)} className="tap rounded-md p-2 hover:bg-hover" aria-label="Next month">
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="py-1 text-caption text-fg-3" aria-hidden>
            {d}
          </span>
        ))}
        {cells.map((key, i) =>
          key ? (
            <button
              key={key}
              type="button"
              disabled={!!minKey && key < minKey}
              onClick={() => onChange(key)}
              aria-pressed={key === value}
              aria-label={formatEAT(fromEATParts(...(key.split("-").map(Number) as [number, number, number]), 12), "EEEE d MMMM")}
              className={cn(
                "relative flex h-11 items-center justify-center rounded-md text-label tabular transition-colors duration-150 disabled:opacity-30",
                key === value ? "bg-fg font-semibold text-bg" : "hover:bg-hover",
                blockedKeys?.has(key) && key !== value && "hatched text-fg-3",
                key === todayKey && key !== value && "font-semibold text-accent-fg",
              )}
            >
              {Number(key.slice(8))}
              {markedKeys?.has(key) && (
                <span className={cn("absolute bottom-1.5 size-1 rounded-full", key === value ? "bg-bg" : "bg-fg-2")} aria-hidden />
              )}
            </button>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  );
}
