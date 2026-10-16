import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * TRD §3. Money = integer KES. Timestamps = epoch ms UTC, rendered in EAT.
 * Additions beyond the TRD are marked "+".
 */
export const locationV = v.union(v.literal("nairobi"), v.literal("kericho"), v.literal("other"));
export const statusV = v.union(
  v.literal("confirmed"),
  v.literal("completed"),
  v.literal("no_show"),
  v.literal("cancelled"),
);
export const roleV = v.union(v.literal("artist"), v.literal("manager"));
export const methodV = v.union(v.literal("mpesa"), v.literal("cash"));
export const colourV = v.union(v.literal("black_grey"), v.literal("colour"));

export default defineSchema({
  ...authTables,

  // Convex Auth users table, extended with a one-time invite token the sign-up form passes through
  // so the auth callback can check it (it's cleared as soon as the account is created).
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    inviteToken: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  staff: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.optional(v.string()), // +
    phone: v.string(), // for artist/manager SMS
    role: roleV,
    active: v.boolean(),
    // + access control: what a manager may do (artist always has everything). See @drink/shared permissions.
    permissions: v.optional(v.array(v.string())),
    // + set when the artist issues a temporary password; the app forces a new one at next sign-in
    mustChangePassword: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_role", ["role"]),

  // + manager invites — sign-up is closed except for the first artist and invited emails
  invites: defineTable({
    email: v.string(),
    name: v.string(),
    phone: v.string(),
    role: roleV,
    invitedBy: v.id("staff"),
    acceptedAt: v.optional(v.number()),
    token: v.optional(v.string()), // + one-time link token (32 random bytes)
    expiresAt: v.optional(v.number()), // + 7 days
    permissions: v.optional(v.array(v.string())), // + granted on accept
  })
    .index("by_email", ["email"])
    .index("by_token", ["token"]),

  settings: defineTable({
    depositPercent: v.number(),
    minDepositKes: v.optional(v.number()),
    rescheduleLimit: v.number(),
    reminderHourDayBefore: v.number(),
    artistDigestHour: v.number(),
    quietHoursStart: v.number(),
    quietHoursEnd: v.number(),
    businessWhatsapp: v.string(),
    googleReviewUrl: v.optional(v.string()),
    instagramHandle: v.optional(v.string()),
    currentTermsId: v.optional(v.id("terms")),
    // + Appearance — Google Fonts chosen in Settings, applied at runtime (no redeploy).
    bodyFont: v.optional(v.string()),
    headingFont: v.optional(v.string()),
  }),

  terms: defineTable({
    version: v.number(),
    body: v.string(), // markdown
    publishedAt: v.number(),
    publishedBy: v.id("staff"),
  }).index("by_version", ["version"]),

  clients: defineTable({
    fullName: v.string(),
    phone: v.string(), // E.164 +2547…
    email: v.optional(v.string()),
    instagram: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()), // YYYY-MM-DD
    notes: v.optional(v.string()),
    flagged: v.optional(v.string()), // reason
    marketingOptOut: v.boolean(),
    dataConsentAt: v.optional(v.number()),
    archived: v.boolean(),
    erasedAt: v.optional(v.number()), // + KDPA erasure
    lastVisitAt: v.optional(v.number()), // + denormalised for list
    sessionCount: v.optional(v.number()), // + completed sessions
  })
    .index("by_phone", ["phone"])
    .index("by_instagram", ["instagram"]) // +
    .index("by_last_visit", ["lastVisitAt"]) // +
    .searchIndex("search_name", { searchField: "fullName", filterFields: ["archived"] }),

  projects: defineTable({
    clientId: v.id("clients"),
    title: v.string(),
    plannedSessions: v.optional(v.number()),
  }).index("by_client", ["clientId"]),

  bookings: defineTable({
    artistId: v.id("staff"),
    clientId: v.id("clients"),
    projectId: v.optional(v.id("projects")),
    startAt: v.number(),
    durationMin: v.number(),
    location: locationV,
    locationNote: v.optional(v.string()),
    status: statusV,
    cancelReason: v.optional(v.string()),
    cancelledBy: v.optional(v.union(v.literal("client"), v.literal("artist"))),
    // + what happened to the deposit on cancel / no-show / reschedule over limit
    depositOutcome: v.optional(
      v.union(v.literal("forfeited"), v.literal("carried"), v.literal("refunded"), v.literal("pending")),
    ),
    source: v.optional(v.string()),
    // + estimated session logistics cost (transport, food, etc.) — separate from studio `expenses`
    expectedExpensesKes: v.optional(v.number()),
    expectedExpensesNote: v.optional(v.string()),
    quotedPriceKes: v.number(),
    finalPriceKes: v.number(),
    depositPercent: v.number(), // SNAPSHOT
    depositRequiredKes: v.number(), // SNAPSHOT
    paidTotalKes: v.number(),
    rescheduleCount: v.number(),
    termsId: v.id("terms"), // SNAPSHOT
    scheduledJobs: v.array(v.id("_scheduled_functions")),
    createdBy: v.id("staff"),
    completedAt: v.optional(v.number()),
  })
    .index("by_start", ["startAt"])
    .index("by_status_start", ["status", "startAt"])
    .index("by_client", ["clientId"])
    .index("by_project", ["projectId"]),

  tattoos: defineTable({
    bookingId: v.id("bookings"),
    clientId: v.id("clients"),
    description: v.string(),
    placement: v.string(),
    size: v.optional(v.string()),
    style: v.optional(v.string()),
    colour: colourV,
    referenceImages: v.array(v.id("_storage")),
    finalImages: v.array(v.id("_storage")),
    healedImages: v.array(v.id("_storage")),
    portfolioApproved: v.boolean(),
  })
    .index("by_booking", ["bookingId"])
    .index("by_client", ["clientId"]),

  payments: defineTable({
    bookingId: v.id("bookings"),
    clientId: v.id("clients"),
    type: v.union(v.literal("deposit"), v.literal("balance"), v.literal("reversal")),
    method: methodV,
    amountKes: v.number(), // negative for reversal
    mpesaCode: v.optional(v.string()), // UPPERCASE, unique
    mpesaRawMessage: v.optional(v.string()),
    payerName: v.optional(v.string()),
    payerPhone: v.optional(v.string()),
    paidAt: v.number(),
    recordedBy: v.id("staff"),
    reversesPaymentId: v.optional(v.id("payments")),
    reversedAt: v.optional(v.number()), // +
    note: v.optional(v.string()), // + reversal reason
  })
    .index("by_booking", ["bookingId"])
    .index("by_client", ["clientId"]) // +
    .index("by_mpesa_code", ["mpesaCode"])
    .index("by_paid_at", ["paidAt"]),

  // + R-7 studio expenses (cost side of profitability)
  expenses: defineTable({
    category: v.string(),
    amountKes: v.number(),
    incurredAt: v.number(), // epoch ms, EAT day the cost landed
    vendor: v.optional(v.string()),
    note: v.optional(v.string()),
    method: v.optional(methodV),
    bookingId: v.optional(v.id("bookings")), // + set when auto-created from a booking's expected expenses
    recordedBy: v.id("staff"),
  })
    .index("by_incurred_at", ["incurredAt"])
    .index("by_category", ["category"])
    .index("by_booking", ["bookingId"]),

  priceAdjustments: defineTable({
    bookingId: v.id("bookings"),
    fromKes: v.number(),
    toKes: v.number(),
    reason: v.string(),
    by: v.id("staff"),
  }).index("by_booking", ["bookingId"]),

  consents: defineTable({
    bookingId: v.id("bookings"),
    clientId: v.id("clients"),
    confirmedAdult: v.boolean(),
    healthAnswers: v.any(), // validated by zod in @drink/shared
    aftercareAck: v.boolean(),
    photoPermission: v.boolean(),
    dataProcessingConsent: v.boolean(),
    signatureName: v.string(),
    signedAt: v.number(),
    userAgent: v.optional(v.string()),
  })
    .index("by_booking", ["bookingId"])
    .index("by_client", ["clientId"]),

  feedback: defineTable({
    bookingId: v.id("bookings"),
    clientId: v.id("clients"),
    rating: v.number(),
    comment: v.optional(v.string()),
    submittedAt: v.number(),
  })
    .index("by_booking", ["bookingId"])
    .index("by_client", ["clientId"]),

  accessTokens: defineTable({
    token: v.string(), // 32-byte base64url
    purpose: v.union(v.literal("consent"), v.literal("feedback"), v.literal("terms")),
    bookingId: v.id("bookings"),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_booking", ["bookingId"]),

  messageTemplates: defineTable({
    key: v.string(),
    body: v.string(),
    enabled: v.boolean(),
  }).index("by_key", ["key"]),

  messages: defineTable({
    bookingId: v.optional(v.id("bookings")),
    clientId: v.optional(v.id("clients")),
    to: v.string(),
    recipient: v.union(v.literal("client"), v.literal("artist"), v.literal("manager")),
    templateKey: v.string(),
    body: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
    attempts: v.number(),
    sendAt: v.number(),
    sentAt: v.optional(v.number()), // +
    jobId: v.optional(v.id("_scheduled_functions")), // +
    resentAt: v.optional(v.number()), // + a failed message that was resent leaves the dashboard
  })
    .index("by_booking", ["bookingId"])
    .index("by_provider_id", ["providerId"])
    .index("by_status", ["status"])
    .index("by_send_at", ["sendAt"]), // +

  availability: defineTable({
    kind: v.union(v.literal("weekly"), v.literal("block"), v.literal("tour")),
    weekday: v.optional(v.number()),
    startMin: v.optional(v.number()),
    endMin: v.optional(v.number()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    location: v.optional(v.string()),
    note: v.optional(v.string()),
  }).index("by_kind", ["kind"]),

  auditLog: defineTable({
    actor: v.id("staff"),
    entity: v.string(),
    entityId: v.string(),
    action: v.string(),
    diff: v.optional(v.any()),
    at: v.number(),
  })
    .index("by_entity", ["entity", "entityId"])
    .index("by_at", ["at"]), // +

  // + fixed-window limiter for public token mutations (TRD §6: 10 req/min per token)
  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),
});
