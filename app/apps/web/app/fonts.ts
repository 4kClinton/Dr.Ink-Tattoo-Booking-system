import { Cormorant_Garamond, DM_Sans } from "next/font/google";

// Defaults, loaded at build time for zero layout shift. The actual face shown
// can be overridden at runtime from Settings → Appearance (see FontProvider),
// which injects the chosen Google Font and swaps --font-sans / --font-display.
export const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});
