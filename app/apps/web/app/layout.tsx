import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { cormorant, dmSans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Dr.Ink Booking", template: "%s · Dr.Ink" },
  description: "Bookings, payments and client records for Dr.Ink Tattoos.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  applicationName: "Dr.Ink Booking",
  appleWebApp: { capable: true, title: "Dr.Ink", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-KE" suppressHydrationWarning className={`${dmSans.variable} ${cormorant.variable}`}>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
