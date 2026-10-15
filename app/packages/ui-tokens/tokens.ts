/** Design tokens as a TS object — consumed by the Expo app (v2). Mirrors tokens.css. */
export const palette = {
  light: {
    bg: "#FFFFFF",
    bgElevated: "#F7F7F8",
    surface: "#FFFFFF",
    surfaceHover: "#F2F2F3",
    border: "#E6E6E8",
    borderStrong: "#D1D1D6",
    text: "#0A0A0A",
    text2: "#5C5C61",
    text3: "#8E8E93",
    accent: "#DF2531",
    accentPress: "rgba(223, 37, 49, 0.65)",
    accentText: "#C81E2A",
    accentSubtle: "rgba(223, 37, 49, 0.08)",
    onAccent: "#FFFFFF",
    success: "#16A34A",
    successSubtle: "rgba(22, 163, 74, 0.10)",
    warning: "#B45309",
    warningSubtle: "rgba(245, 158, 11, 0.12)",
  },
  dark: {
    bg: "#000000",
    bgElevated: "#0B0B0C",
    surface: "#141416",
    surfaceHover: "#1C1C1F",
    border: "#232326",
    borderStrong: "#2E2E33",
    text: "#F5F5F5",
    text2: "#A1A1A6",
    text3: "#6E6E73",
    accent: "#DF2531",
    accentPress: "rgba(223, 37, 49, 0.65)",
    accentText: "#F0454F",
    accentSubtle: "rgba(223, 37, 49, 0.14)",
    onAccent: "#FFFFFF",
    success: "#22C55E",
    successSubtle: "rgba(34, 197, 94, 0.14)",
    warning: "#F59E0B",
    warningSubtle: "rgba(245, 158, 11, 0.14)",
  },
} as const;

export const spacing = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const;
export const motion = {
  spring: { stiffness: 400, damping: 32 },
  micro: 150,
  std: 200,
  sheet: 300,
} as const;
export const type = {
  display: { family: "Mokoto", weight: "700", sizeMobile: 28, sizeDesktop: 36, letterSpacing: 0.02 },
  heading: { family: "Open Sans", weight: "600", size: 20, lineHeight: 28 },
  subhead: { family: "Open Sans", weight: "600", size: 16, lineHeight: 24 },
  body: { family: "Open Sans", weight: "400", size: 15, lineHeight: 24 },
  label: { family: "Open Sans", weight: "500", size: 13, lineHeight: 18 },
  caption: { family: "Open Sans", weight: "400", size: 12, lineHeight: 16 },
} as const;

export type ThemeName = keyof typeof palette;
export type Palette = (typeof palette)[ThemeName];
