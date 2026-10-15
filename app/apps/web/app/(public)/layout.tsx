import type { Metadata } from "next";
import { LogoTile } from "@/components/ui/misc";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** §3.11 — black header band with the logo in both modes; content follows the system theme. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="pt-safe bg-[#000]">
        <div className="mx-auto flex h-16 max-w-[560px] items-center px-4">
          <LogoTile size={44} />
        </div>
      </header>
      <main className="mx-auto max-w-[560px] px-4 py-8 pb-16">{children}</main>
    </div>
  );
}
