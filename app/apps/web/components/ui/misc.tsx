import { WifiOff } from "lucide-react";
import Image from "next/image";
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

/** The circular Dr.Ink badge. It always sits on black; in light mode the tile stays #000 (never recoloured). */
export function LogoTile({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-logo", className)}
      style={{ width: size, height: size }}
    >
      <Image src="/logo.png" alt="Dr.Ink Tattoos" width={size} height={size} priority className="h-full w-full object-contain" />
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
