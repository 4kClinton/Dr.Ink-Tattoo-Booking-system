"use client";
import { NewBookingProvider } from "@/components/booking/new-booking-context";
import { AppShell } from "@/components/shell/app-shell";
import { AuthGate } from "@/components/shell/viewer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <NewBookingProvider>
        <AppShell>{children}</AppShell>
      </NewBookingProvider>
    </AuthGate>
  );
}
