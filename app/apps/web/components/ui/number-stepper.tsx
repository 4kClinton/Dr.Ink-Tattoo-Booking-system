"use client";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

/** Compact −/value/+ stepper for small whole-number fields (e.g. number of tattoos). */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  busy = false,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  busy?: boolean;
  className?: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        aria-label="Decrease"
        disabled={busy || value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className="tap flex size-11 items-center justify-center rounded-md border border-line-strong bg-surface text-fg hover:bg-hover disabled:opacity-40"
      >
        <Minus className="size-4" />
      </button>
      <span className="w-10 text-center text-subhead font-semibold tabular" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase"
        disabled={busy || value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className="tap flex size-11 items-center justify-center rounded-md border border-line-strong bg-surface text-fg hover:bg-hover disabled:opacity-40"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
