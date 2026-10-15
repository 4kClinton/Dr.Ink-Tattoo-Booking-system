"use client";
import { cn } from "@/lib/cn";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: React.ReactNode }[];
  label: string;
  className?: string;
  size?: "md" | "sm";
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex rounded-md border border-line bg-elevated p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-sm px-3 font-semibold transition-colors duration-150",
              size === "md" ? "h-10 text-label" : "h-8 text-caption",
              active ? "bg-surface text-fg shadow-card ring-1 ring-line-strong" : "text-fg-2 hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Quick-pick chips (placement, style, duration, filters). Selected = solid --text, not red. */
export function ChoiceChips<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly { value: T; label: React.ReactNode }[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "tap h-9 rounded-full border px-3.5 text-label font-medium transition-colors duration-150",
              active ? "border-fg bg-fg text-bg" : "border-line-strong bg-surface text-fg hover:bg-hover",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
