"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex } from "convex/react";
import {
  BarChart3, CalendarDays, Home, ListChecks, LogOut, MessageSquare, MoreHorizontal, Plus, Settings, Tag, UserPlus, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useNewBooking } from "@/components/booking/new-booking-context";
import { Button } from "@/components/ui/button";
import { LogoTile, OfflineBar } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import type { Permission } from "@drink/shared";
import { useCan, useViewer } from "./viewer";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
}

const NAV: NavItem[] = [
  { href: "/", label: "Today", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/leads", label: "Leads", icon: UserPlus, permission: "clients.edit" },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/offers", label: "Offers", icon: Tag },
  { href: "/reports", label: "Reports", icon: BarChart3, permission: "reports.view" },
  { href: "/expenses", label: "Expenses", icon: Wallet, permission: "expenses.manage" },
  { href: "/settings", label: "Settings", icon: Settings },
];

const TITLES: [RegExp, string][] = [
  [/^\/$/, "Today"],
  [/^\/calendar/, "Calendar"],
  [/^\/clients\/.+/, "Client"],
  [/^\/clients/, "Clients"],
  [/^\/leads/, "Leads"],
  [/^\/tasks/, "Tasks"],
  [/^\/bookings/, "Booking"],
  [/^\/messages/, "Messages"],
  [/^\/offers/, "Offers"],
  [/^\/reports/, "Reports"],
  [/^\/expenses/, "Expenses"],
  [/^\/settings/, "Settings"],
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

function useOnline() {
  const convex = useConvex();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      const s = convex.connectionState();
      setOffline(s.hasEverConnected && !s.isWebSocketConnected);
    }, 2000);
    return () => clearInterval(t);
  }, [convex]);
  return !offline;
}

function Initials({ name }: { name: string }) {
  const i = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className="flex size-9 items-center justify-center rounded-full border border-line-strong bg-surface text-caption font-semibold">
      {i}
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const viewer = useViewer();
  const { signOut } = useAuthActions();
  const { open: openNewBooking } = useNewBooking();
  const [more, setMore] = useState(false);
  const online = useOnline();
  const canBook = useCan("bookings.manage");
  const canReports = useCan("reports.view");
  const canExpenses = useCan("expenses.manage");
  const canEditClients = useCan("clients.edit");
  const grants: Partial<Record<Permission, boolean>> = {
    "reports.view": canReports,
    "expenses.manage": canExpenses,
    "clients.edit": canEditClients,
  };
  const nav = NAV.filter((n) => !n.permission || grants[n.permission]);
  const title = TITLES.find(([re]) => re.test(path))?.[1] ?? "";

  useEffect(() => setMore(false), [path]);

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-elevated p-4 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-3">
          <LogoTile size={40} />
          <span className="font-display text-label">Booking</span>
        </Link>
        {canBook && (
          <Button variant="primary" block onClick={() => openNewBooking()}>
            <Plus className="size-4" /> New booking
          </Button>
        )}
        <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(path, n.href) ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-label font-medium transition-colors duration-150",
                isActive(path, n.href) ? "bg-hover text-fg" : "text-fg-2 hover:bg-hover hover:text-fg",
              )}
            >
              <n.icon className="size-[18px]" aria-hidden />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 border-t border-line pt-4">
          <Initials name={viewer.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-label font-semibold">{viewer.name}</p>
            <p className="text-caption text-fg-2 capitalize">{viewer.role}</p>
          </div>
          <button onClick={() => void signOut()} className="tap rounded-md p-2 text-fg-2 hover:bg-hover" aria-label="Sign out">
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-accent" aria-hidden />
              <span className="font-display text-[20px] leading-none">{title}</span>
            </div>
            <Link href="/settings" aria-label="Your account">
              <Initials name={viewer.name} />
            </Link>
          </div>
          {!online && <OfflineBar />}
        </header>
        {!online && (
          <div className="sticky top-0 z-30 hidden lg:block">
            <OfflineBar />
          </div>
        )}

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>

        {/* Mobile bottom tabs */}
        <nav
          className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-elevated lg:hidden"
          aria-label="Main"
        >
          <div className="mx-auto flex h-16 max-w-[640px] items-stretch">
            <Tab item={NAV[0]!} path={path} />
            <Tab item={NAV[1]!} path={path} />
            {canBook && (
              <div className="flex flex-1 items-center justify-center">
                <button
                  onClick={() => openNewBooking()}
                  className="tap flex size-12 items-center justify-center rounded-full bg-accent text-on-accent active:bg-accent-press"
                  aria-label="New booking"
                >
                  <Plus className="size-6" />
                </button>
              </div>
            )}
            <Tab item={NAV[2]!} path={path} />
            <button
              onClick={() => setMore(true)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-caption font-medium",
                ["/leads", "/tasks", "/messages", "/offers", "/reports", "/expenses", "/settings"].some((p) => path.startsWith(p)) ? "text-fg" : "text-fg-3",
              )}
            >
              <MoreHorizontal className="size-[22px]" aria-hidden />
              More
            </button>
          </div>
        </nav>

        <Sheet open={more} onOpenChange={setMore} title="More">
          <div className="flex flex-col gap-1 pb-4">
            {nav.slice(3).map((n) => (
              <Link key={n.href} href={n.href} className="flex h-12 items-center gap-3 rounded-md px-2 font-medium hover:bg-hover">
                <n.icon className="size-5 text-fg-2" aria-hidden /> {n.label}
              </Link>
            ))}
            <button onClick={() => void signOut()} className="flex h-12 items-center gap-3 rounded-md px-2 text-left font-medium hover:bg-hover">
              <LogOut className="size-5 text-fg-2" aria-hidden /> Sign out
            </button>
          </div>
        </Sheet>
      </div>
    </div>
  );
}

function Tab({ item, path }: { item: NavItem; path: string }) {
  const active = isActive(path, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn("relative flex flex-1 flex-col items-center justify-center gap-1 text-caption font-medium", active ? "text-fg" : "text-fg-3")}
    >
      <item.icon className="size-[22px]" aria-hidden />
      {item.label}
      {active && <span className="absolute bottom-1.5 size-1 rounded-full bg-accent" aria-hidden />}
    </Link>
  );
}
