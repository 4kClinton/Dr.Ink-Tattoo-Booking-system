import { z } from "zod";
import { BOOKING_EXTRA_VALUES, COLOURS, EXPENSE_CATEGORY_VALUES, HEALTH_QUESTIONS, LOCATIONS, MAX_TATTOOS_PER_BOOKING, SIZES, SOURCES } from "./constants";
import { isValidMpesaCode } from "./mpesa";
import { normalizePhone } from "./phone";

/**
 * Shared validation — the same schemas run in the browser (react-hook-form)
 * and inside Convex mutations, so the server is never more lenient than the UI.
 */

const kes = z.number().int("Whole shillings only").nonnegative();
const positiveKes = z.number().int("Whole shillings only").positive("Enter an amount");

/** Add-ons (red ink, numbing cream, …) selected on a lead or booking. Unknown values are dropped. */
export const extrasSchema = z
  .array(z.enum(BOOKING_EXTRA_VALUES))
  .max(20)
  .optional()
  .transform((v) => (v && v.length ? [...new Set(v)] : undefined));

/** Whole number of tattoos on a booking (≥1), capped so a typo can't run away. */
export const tattooCountSchema = z.number().int().min(1, "At least one tattoo").max(MAX_TATTOOS_PER_BOOKING);

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Enter a valid phone number, e.g. 0712 345 678 or +44 7911 123456" });
      return z.NEVER;
    }
    return n;
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const clientInputSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the client's full name").max(80),
  phone: phoneSchema,
  email: z.union([z.literal(""), z.email("Enter a valid email")]).optional().transform((v) => v || undefined),
  instagram: optionalText(40).transform((v) => v?.replace(/^@/, "").toLowerCase()),
  dateOfBirth: z.union([z.literal(""), dateOfBirthSchema]).optional().transform((v) => v || undefined),
  notes: optionalText(2000),
});
export type ClientInput = z.input<typeof clientInputSchema>;

/**
 * A lead is a prospect captured from anywhere (DMs, walk-up, referral) before they're
 * a client. Everything is optional except that *something* identifying must be present —
 * a phone, an Instagram/TikTok handle, or at least a name. Phone is normalised to E.164
 * when it's a valid number, otherwise the typed digits are kept as-is so partial numbers
 * aren't rejected.
 */
const handle = optionalText(80).transform((v) => v?.replace(/^@/, "").replace(/^https?:\/\/\S+\//, "").replace(/\/$/, ""));
export const leadInputSchema = z
  .object({
    name: optionalText(80),
    phone: z
      .string()
      .trim()
      .max(24)
      .optional()
      .transform((v) => {
        if (!v) return undefined;
        return normalizePhone(v) ?? v.replace(/[^\d+]/g, "");
      }),
    instagram: handle,
    tiktok: handle,
    source: z.enum(SOURCES.map((s) => s.value) as [string, ...string[]]).optional(),
    note: optionalText(2000),
    remindAt: z.number().int().positive().optional(),
    price: z.number().int("Whole shillings only").nonnegative().optional(),
    extras: extrasSchema,
    // Set to spawn a follow-up task due this day; the mutation keeps the task in sync.
    followUpAt: z.number().int().positive().optional(),
  })
  .refine((d) => !!(d.name || d.phone || d.instagram || d.tiktok), {
    message: "Add a phone, an @handle or a name",
    path: ["phone"],
  });
export type LeadInput = z.input<typeof leadInputSchema>;

/**
 * A studio to-do. Needs a title; everything else is optional. `due` is epoch ms (EAT day start),
 * `clientIds` are the clients the task is about (rendered as @chips), and `checklist` is an
 * ordered list of sub-steps that can each be ticked off.
 */
export const taskInputSchema = z.object({
  title: z.string().trim().min(2, "What needs doing?").max(200),
  note: optionalText(2000),
  due: z.number().int().positive().optional(),
  clientIds: z.array(z.string()).max(20).optional(),
  leadIds: z.array(z.string()).max(20).optional(),
  checklist: z
    .array(z.object({ text: z.string().trim().min(1).max(200), done: z.boolean() }))
    .max(50)
    .optional(),
});
export type TaskInput = z.input<typeof taskInputSchema>;

export const tattooInputSchema = z.object({
  description: z.string().trim().min(2, "Describe the tattoo").max(500),
  // placement is free text — one or more spots, comma-separated (e.g. "Left forearm, Right calf")
  placement: z.string().trim().min(2, "Where on the body?").max(160),
  // one or more sizes from the list, comma-separated
  size: optionalText(160).refine(
    (v) => !v || v.split(",").every((s) => (SIZES as readonly string[]).includes(s.trim())),
    "Pick sizes from the list",
  ),
  style: optionalText(40),
  colour: z.enum(COLOURS),
});
export type TattooInput = z.input<typeof tattooInputSchema>;

export const paymentMethodSchema = z.enum(["mpesa", "cash"]);

export const paymentInputSchema = z
  .object({
    method: paymentMethodSchema,
    amountKes: positiveKes,
    mpesaCode: z.string().trim().toUpperCase().optional(),
    mpesaRawMessage: z.string().max(1000).optional(),
    payerName: optionalText(80),
    payerPhone: optionalText(20),
    paidAt: z.number().optional(),
  })
  .superRefine((p, ctx) => {
    if (p.method === "mpesa") {
      if (!p.mpesaCode || !isValidMpesaCode(p.mpesaCode)) {
        ctx.addIssue({ code: "custom", path: ["mpesaCode"], message: "M-Pesa codes are 10 letters and numbers" });
      }
    }
  });
export type PaymentInput = z.input<typeof paymentInputSchema>;

/** R-7 — a studio expense. `incurredAt` is epoch ms (EAT day the cost landed). */
export const expenseInputSchema = z.object({
  category: z.enum(EXPENSE_CATEGORY_VALUES),
  amountKes: positiveKes,
  incurredAt: z.number().int().positive(),
  vendor: optionalText(80),
  note: optionalText(500),
  method: paymentMethodSchema.optional(),
});
export type ExpenseInput = z.input<typeof expenseInputSchema>;

export const scheduleInputSchema = z.object({
  startAt: z.number().int(),
  durationMin: z.number().int().min(15, "At least 15 minutes").max(12 * 60, "Max 12 hours"),
  location: z.enum(LOCATIONS),
  locationNote: optionalText(80),
});

export const bookingCreateSchema = z.object({
  clientId: z.string().optional(),
  client: clientInputSchema.optional(),
  tattoo: tattooInputSchema,
  schedule: scheduleInputSchema,
  quotedPriceKes: positiveKes,
  source: z.enum(SOURCES.map((s) => s.value) as [string, ...string[]]).optional(),
  extras: extrasSchema,
  tattooCount: tattooCountSchema.optional(),
  projectId: z.string().optional(),
  deposit: paymentInputSchema,
  overrideOverlap: z.boolean().optional(),
});

/** An offer / promo in the studio's marketing catalog (e.g. "KES 3000 for 3 mini tattoos"). */
export const promoInputSchema = z.object({
  title: z.string().trim().min(2, "Give the offer a title").max(120),
  priceKes: kes.optional(),
  details: optionalText(2000),
  active: z.boolean().optional(),
});
export type PromoInput = z.input<typeof promoInputSchema>;

export const healthAnswersSchema = z.object(
  Object.fromEntries(HEALTH_QUESTIONS.map((q) => [q.key, z.boolean()])) as Record<
    (typeof HEALTH_QUESTIONS)[number]["key"],
    z.ZodBoolean
  >,
).extend({ details: optionalText(1000) });
export type HealthAnswers = z.infer<typeof healthAnswersSchema>;

export const consentInputSchema = z.object({
  confirmedAdult: z.literal(true, { error: "You must be 18 or older" }),
  healthAnswers: healthAnswersSchema,
  aftercareAck: z.literal(true, { error: "Please confirm you've read the aftercare guide" }),
  photoPermission: z.boolean(),
  dataProcessingConsent: z.literal(true, { error: "We need your consent to store your details" }),
  signatureName: z.string().trim().min(3, "Type your full name").max(80),
});
export type ConsentInput = z.input<typeof consentInputSchema>;

export const feedbackInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: optionalText(2000),
});

export const settingsInputSchema = z.object({
  depositPercent: z.number().int().min(5).max(100),
  minDepositKes: kes.optional(),
  rescheduleLimit: z.number().int().min(0).max(10),
  reminderHourDayBefore: z.number().int().min(0).max(23),
  artistDigestHour: z.number().int().min(0).max(23),
  quietHoursStart: z.number().int().min(0).max(23),
  quietHoursEnd: z.number().int().min(0).max(23),
  businessWhatsapp: z.string().regex(/^254[17]\d{8}$/, "Use 2547XXXXXXXX"),
  googleReviewUrl: z.union([z.literal(""), z.url()]).optional().transform((v) => v || undefined),
  instagramHandle: optionalText(40).transform((v) => v?.replace(/^@/, "")),
});

/** Flatten zod issues into one readable sentence for ConvexError payloads. */
export function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? i.message : "Invalid input";
}
