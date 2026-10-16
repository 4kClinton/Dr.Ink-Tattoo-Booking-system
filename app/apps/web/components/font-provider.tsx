"use client";
import { api } from "@drink/backend/api";
import { DEFAULT_SETTINGS, FONT_OPTIONS } from "@drink/shared";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect } from "react";

const byFamily = (family: string) => FONT_OPTIONS.find((o) => o.family === family);

/**
 * Applies the studio's chosen fonts at runtime. The defaults (DM Sans + Cormorant
 * Garamond) are already loaded at build time via next/font for a flash-free first
 * paint, so this only does work when a non-default face has been picked in Settings:
 * it injects that Google Fonts stylesheet and overrides --font-sans / --font-display.
 * That's what lets fonts change from the UI without a redeploy.
 */
export function FontProvider() {
  // settings.get requires a signed-in staff member — skip it on the sign-in page
  // (and before auth resolves) so it never throws UNAUTHENTICATED; defaults apply.
  const { isAuthenticated } = useConvexAuth();
  const settings = useQuery(api.settings.get, isAuthenticated ? {} : "skip");
  const bodyFont = settings?.bodyFont ?? DEFAULT_SETTINGS.bodyFont;
  const headingFont = settings?.headingFont ?? DEFAULT_SETTINGS.headingFont;

  useEffect(() => {
    const root = document.documentElement.style;
    const link = () => document.getElementById("dynamic-fonts") as HTMLLinkElement | null;
    const isDefault = bodyFont === DEFAULT_SETTINGS.bodyFont && headingFont === DEFAULT_SETTINGS.headingFont;

    if (isDefault) {
      // Fall back to the build-time next/font faces.
      link()?.remove();
      root.removeProperty("--font-sans");
      root.removeProperty("--font-display");
      return;
    }

    const body = byFamily(bodyFont);
    const heading = byFamily(headingFont);
    const families = [...new Set([body, heading].filter(Boolean))]
      .map((o) => `family=${o!.family.replace(/ /g, "+")}:${o!.weights}`)
      .join("&");

    let el = link();
    if (!el) {
      el = document.createElement("link");
      el.id = "dynamic-fonts";
      el.rel = "stylesheet";
      document.head.appendChild(el);
    }
    el.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;

    if (body) root.setProperty("--font-sans", body.stack);
    if (heading) root.setProperty("--font-display", heading.stack);
  }, [bodyFont, headingFont]);

  return null;
}
