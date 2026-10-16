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

export const DEFAULT_SETTINGS = {
  depositPercent: 20,
  rescheduleLimit: 1,
  reminderHourDayBefore: 18,
  artistDigestHour: 8,
  quietHoursStart: 21,
  quietHoursEnd: 7,
  businessWhatsapp: "254700000000",
} as const;

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;
