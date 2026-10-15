"use client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = new ConvexReactClient(url ?? "http://127.0.0.1:3210");

export function StaffProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ConvexAuthProvider client={convex}>
        {children}
        <Toaster
          position="bottom-center"
          offset={{ bottom: 88 }}
          mobileOffset={{ bottom: 88 }}
          duration={4000}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "flex w-[calc(100vw-32px)] max-w-[420px] items-center gap-3 rounded-md bg-fg px-4 py-3 text-label font-medium text-bg shadow-sheet",
              actionButton: "ml-auto font-semibold underline underline-offset-4",
            },
          }}
        />
      </ConvexAuthProvider>
    </ThemeProvider>
  );
}
