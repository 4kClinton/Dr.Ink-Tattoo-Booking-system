import type { Metadata, Viewport } from "next";
import { openSans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Dr.Ink Booking", template: "%s · Dr.Ink" },
  description: "Bookings, payments and client records for Dr.Ink Tattoos.",
  robots: { index: false, follow: false },
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
    <html lang="en-KE" suppressHydrationWarning className={openSans.variable}>
      <body>{children}</body>
    </html>
  );
}
