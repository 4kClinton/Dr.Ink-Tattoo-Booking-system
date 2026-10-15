import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** §4.3: surface, radius-lg, 16/24 padding, border in dark, soft shadow in light. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-line bg-surface p-4 shadow-card lg:p-6", className)}
      {...rest}
    />
  );
}

export function SectionLabel({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-caption font-semibold uppercase tracking-wider text-fg-2", className)} {...rest} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}
