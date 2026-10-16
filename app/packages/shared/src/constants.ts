export const TIME_ZONE = "Africa/Nairobi";

export const LOCATIONS = ["nairobi", "kericho", "other"] as const;
export type Location = (typeof LOCATIONS)[number];
export const LOCATION_LABEL: Record<Location, string> = {
  nairobi: "Nairobi",
  kericho: "Kericho",
  other: "Other",
};

export const BOOKING_STATUSES = ["confirmed", "completed", "no_show", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Expense categories for a tattoo studio (R-7). Stored by `value`; `label` is for display. */
export const EXPENSE_CATEGORIES = [
  { value: "supplies", label: "Supplies (ink, needles, cartridges)" },
  { value: "equipment", label: "Equipment" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities (power, water, internet)" },
  { value: "marketing", label: "Marketing & ads" },
  { value: "wages", label: "Wages & salaries" },
  { value: "travel", label: "Travel & tour" },
  { value: "session", label: "Session (transport, food)" },
  { value: "licenses", label: "Licenses & permits" },
  { value: "insurance", label: "Insurance" },
  { value: "software", label: "Software & subscriptions" },
  { value: "maintenance", label: "Repairs & maintenance" },
  { value: "other", label: "Other" },
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];
export const EXPENSE_CATEGORY_VALUES = EXPENSE_CATEGORIES.map((c) => c.value) as [ExpenseCategory, ...ExpenseCategory[]];
export const EXPENSE_CATEGORY_LABEL = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.label])) as Record<ExpenseCategory, string>;

export const SOURCES = [
  { value: "ig_ad", label: "IG ad" },
  { value: "tiktok", label: "TikTok" },
  { value: "ugc", label: "UGC" },
  { value: "referral", label: "Referral" },
  { value: "repeat", label: "Repeat" },
  { value: "walk_in", label: "Walk-in" },
  { value: "other", label: "Other" },
] as const;
export type Source = (typeof SOURCES)[number]["value"];

export const PLACEMENT_CHIPS = [
  "Forearm", "Upper arm", "Chest", "Back", "Ribs", "Thigh", "Calf", "Hand", "Neck",
] as const;

export const STYLE_CHIPS = [
  "Fine line", "Blackwork", "Realism", "Script", "Traditional", "Tribal", "Geometric", "Portrait",
] as const;

export const SIZES = [
  "Mini Tattoo", "Small Tattoo", "Medium Tattoo", "Large Tattoo",
  "Half Sleeve Leg", "Half Sleeve Arm", "Leg Sleeve", "Arm Sleeve", "Full Chest", "Full Back",
] as const;
export type Size = (typeof SIZES)[number];

export const COLOURS = ["black_grey", "colour"] as const;
export type Colour = (typeof COLOURS)[number];
export const COLOUR_LABEL: Record<Colour, string> = { black_grey: "Black & grey", colour: "Colour" };

export const DURATION_CHIPS_MIN = [60, 120, 180, 240, 360] as const;

/** Health declaration questions on the consent form (L-3). */
export const HEALTH_QUESTIONS = [
  { key: "bloodDisorder", label: "Do you have a blood disorder or take blood thinners?" },
  { key: "skinCondition", label: "Do you have a skin condition where you're getting tattooed?" },
  { key: "allergies", label: "Any allergies (latex, inks, ointments)?" },
  { key: "diabetesHeart", label: "Diabetes, epilepsy or a heart condition?" },
  { key: "pregnant", label: "Are you pregnant or breastfeeding?" },
  { key: "alcoholDrugs", label: "Have you had alcohol or drugs in the last 24 hours?" },
] as const;
export type HealthKey = (typeof HEALTH_QUESTIONS)[number]["key"];

export const MAX_IMAGES_PER_TATTOO = 10;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"];

/**
 * Fonts the studio can pick from Settings → Appearance. `family` is the exact
 * Google Fonts name; `weights` is the css2 axis spec used to build the stylesheet
 * URL; `stack` is what gets written to the --font-sans / --font-display CSS vars.
 * Add a row here (name + weights + fallback stack) to offer a new face — no other
 * code change is needed, and nothing has to be redeployed to switch between them.
 */
export const FONT_OPTIONS = [
  // Body-friendly sans
  { family: "DM Sans", category: "sans", weights: "opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700", stack: "'DM Sans', system-ui, sans-serif" },
  { family: "Inter", category: "sans", weights: "wght@400;500;600;700", stack: "'Inter', system-ui, sans-serif" },
  { family: "Open Sans", category: "sans", weights: "wght@400;500;600;700", stack: "'Open Sans', system-ui, sans-serif" },
  { family: "Work Sans", category: "sans", weights: "wght@400;500;600;700", stack: "'Work Sans', system-ui, sans-serif" },
  { family: "Poppins", category: "sans", weights: "wght@400;500;600;700", stack: "'Poppins', system-ui, sans-serif" },
  { family: "Space Grotesk", category: "sans", weights: "wght@400;500;600;700", stack: "'Space Grotesk', system-ui, sans-serif" },
  // Display / heading serifs
  { family: "Cormorant Garamond", category: "serif", weights: "wght@300;400;500;600", stack: "'Cormorant Garamond', Georgia, serif" },
  { family: "Playfair Display", category: "serif", weights: "wght@400;500;600;700", stack: "'Playfair Display', Georgia, serif" },
  { family: "Lora", category: "serif", weights: "wght@400;500;600;700", stack: "'Lora', Georgia, serif" },
  { family: "EB Garamond", category: "serif", weights: "wght@400;500;600;700", stack: "'EB Garamond', Georgia, serif" },
] as const;

export type FontFamily = (typeof FONT_OPTIONS)[number]["family"];
export const FONT_FAMILIES = FONT_OPTIONS.map((f) => f.family) as FontFamily[];

export const DEFAULT_SETTINGS = {
  depositPercent: 20,
  rescheduleLimit: 1,
  reminderHourDayBefore: 18,
  artistDigestHour: 8,
  quietHoursStart: 21,
  quietHoursEnd: 7,
  businessWhatsapp: "254700000000",
  bodyFont: "DM Sans",
  headingFont: "Cormorant Garamond",
} as const;

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;
