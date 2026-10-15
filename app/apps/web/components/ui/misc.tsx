import { WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

/** §9: one sentence + one action. No illustration. */
export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 py-8">
      <p className="text-fg-2">{text}</p>
      {action}
    </div>
  );
}

/** The logo always sits on black; in light mode it's a #000 rounded tile (never recoloured). */
export function LogoTile({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-md bg-logo", className)}
      style={{ width: size, height: size }}
      aria-label="Dr.Ink"
      role="img"
    >
      {/* Stand-in wordmark until the real logo file is added (public/logo.svg). */}
      <span className="font-display flex flex-col items-center leading-[0.95] text-[#F5F5F5]" style={{ fontSize: size * 0.24 }}>
        <span>
          DR<span className="text-[#DF2531]">.</span>
        </span>
        <span>INK</span>
      </span>
    </div>
  );
}

export function OfflineBar() {
  return (
    <div role="status" className="flex items-center gap-2 bg-warning-subtle px-4 py-1.5 text-caption font-medium text-warning">
      <WifiOff className="size-3.5" aria-hidden /> Reconnecting…
    </div>
  );
}

export function PageTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h1 className="font-display text-display leading-none lg:text-[36px]">{children}</h1>
      {right}
    </div>
  );
}
