import type { MetadataRoute } from "next";

/** Served at /manifest.webmanifest — makes the app installable (Add to Home Screen). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dr.Ink Booking",
    short_name: "Dr.Ink",
    description: "Bookings, payments and client records for Dr.Ink Tattoos.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
