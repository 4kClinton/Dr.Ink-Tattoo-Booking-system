# Dr.Ink Tattoos — Booking System
## Technical Requirements Document (TRD)

| | |
|---|---|
| **Version** | 1.0 — 14 Oct 2026 |
| **Companion docs** | PRD.md, UI-UX-SPEC.md |
| **Stack** | Next.js (App Router) · Convex · Africa's Talking SMS · Vercel |

---

## 1. Architecture

```
┌──────────────────────────┐      ┌──────────────────────────┐
│ apps/web (Next.js)       │      │ apps/mobile (Expo) — v2  │
│ - Staff dashboard        │      │ - Artist + Manager       │
│ - Public token pages     │      │                          │
└────────────┬─────────────┘      └────────────┬─────────────┘
             │  Convex React client (realtime) │
             └────────────────┬────────────────┘
                              ▼
            ┌───────────────────────────────────┐
            │ packages/backend (Convex)         │
            │ queries · mutations · actions     │
            │ scheduler · file storage · HTTP   │
            └───────┬───────────────────┬───────┘
                    ▼                   ▼
          Africa's Talking SMS    (v2) Safaricom Daraja C2B
          + delivery-report webhook
```

**Principle:** all business logic lives in Convex. The web app and the future Expo app are thin clients over the same functions. No business rules in React components.

### Repo layout (Turborepo + pnpm)

```
drink-booking/
├─ apps/
│  ├─ web/                 # Next.js
│  └─ mobile/              # Expo (v2, empty placeholder)
├─ packages/
│  ├─ backend/             # convex/ lives here — shared by both apps
│  ├─ shared/              # zod schemas, money/time helpers, mpesa parser, SMS templates
│  └─ ui-tokens/           # design tokens (CSS vars + RN theme object)
└─ turbo.json
```

---

## 2. Tech Choices

| Concern | Choice | Why / trade-off |
|---|---|---|
| Framework | Next.js App Router, TypeScript strict | Your stack. Server components for public pages. |
| Backend / DB | Convex | Realtime calendar for 2 users, scheduler built in, file storage built in. |
| Auth | **Convex Auth** (email + password, 2 staff accounts) | Free, no extra vendor. Trade-off: fewer features than Clerk — irrelevant for 2 users. |
| Styling | Tailwind CSS v4 + CSS variables | Tokens shared with Expo via `packages/ui-tokens`. |
| Components | shadcn/ui (Radix) restyled to tokens | Accessible primitives, no lock-in. |
| Icons | Lucide | Matches clean sans aesthetic. |
| Forms | react-hook-form + zod (schemas in `packages/shared`) | Same validation client + server. |
| Dates | date-fns + date-fns-tz, zone `Africa/Nairobi` | |
| SMS | Africa's Talking | Kenyan, cheap, delivery reports, sender ID. |
| Hosting | Vercel (web) + Convex Cloud | Both free tiers cover this load. |
| Errors | Sentry (free tier) | |

---

## 3. Data Model (Convex schema)

Money is stored as **integer KES** (no decimals). Timestamps are **epoch ms (UTC)**, rendered in EAT.

```ts
// packages/backend/convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  staff: defineTable({
    userId: v.id("users"),
    name: v.string(),
    phone: v.string(),                       // for artist/manager SMS
    role: v.union(v.literal("artist"), v.literal("manager")),
    active: v.boolean(),
  }).index("by_user", ["userId"]),

  settings: defineTable({                    // singleton
    depositPercent: v.number(),              // 20
    minDepositKes: v.optional(v.number()),
    rescheduleLimit: v.number(),             // 1
    reminderHourDayBefore: v.number(),       // 18
    artistDigestHour: v.number(),            // 8
    quietHoursStart: v.number(),             // 21
    quietHoursEnd: v.number(),               // 7
    businessWhatsapp: v.string(),            // 2547XXXXXXXX
    googleReviewUrl: v.optional(v.string()),
    instagramHandle: v.optional(v.string()),
    currentTermsId: v.optional(v.id("terms")),
  }),

  terms: defineTable({
    version: v.number(),
    body: v.string(),                        // markdown
    publishedAt: v.number(),
    publishedBy: v.id("staff"),
  }).index("by_version", ["version"]),

  clients: defineTable({
    fullName: v.string(),
    phone: v.string(),                       // E.164 +2547...
    email: v.optional(v.string()),
    instagram: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),     // YYYY-MM-DD
    notes: v.optional(v.string()),
    flagged: v.optional(v.string()),         // reason
    marketingOptOut: v.boolean(),
    dataConsentAt: v.optional(v.number()),
    archived: v.boolean(),
  })
    .index("by_phone", ["phone"])
    .searchIndex("search_name", { searchField: "fullName" }),

  projects: defineTable({                    // multi-session pieces (P1)
    clientId: v.id("clients"),
    title: v.string(),                       // "Left sleeve"
    plannedSessions: v.optional(v.number()),
  }).index("by_client", ["clientId"]),

  bookings: defineTable({
    artistId: v.id("staff"),
    clientId: v.id("clients"),
    projectId: v.optional(v.id("projects")),
    startAt: v.number(),
    durationMin: v.number(),
    location: v.union(v.literal("nairobi"), v.literal("kericho"), v.literal("other")),
    locationNote: v.optional(v.string()),
    status: v.union(
      v.literal("confirmed"),
      v.literal("completed"),
      v.literal("no_show"),
      v.literal("cancelled"),
    ),
    cancelReason: v.optional(v.string()),
    cancelledBy: v.optional(v.union(v.literal("client"), v.literal("artist"))),
    source: v.optional(v.string()),
    quotedPriceKes: v.number(),
    finalPriceKes: v.number(),               // = quoted until adjusted
    depositPercent: v.number(),              // SNAPSHOT
    depositRequiredKes: v.number(),          // SNAPSHOT
    paidTotalKes: v.number(),                // denormalised sum of payments
    rescheduleCount: v.number(),
    termsId: v.id("terms"),                  // SNAPSHOT of T&Cs version
    scheduledJobs: v.array(v.id("_scheduled_functions")),
    createdBy: v.id("staff"),
    completedAt: v.optional(v.number()),
  })
    .index("by_start", ["startAt"])
    .index("by_status_start", ["status", "startAt"])
    .index("by_client", ["clientId"])
    .index("by_project", ["projectId"]),

  tattoos: defineTable({                     // 1:1 with booking
    bookingId: v.id("bookings"),
    clientId: v.id("clients"),
    description: v.string(),
    placement: v.string(),                   // "left forearm, inner"
    widthCm: v.optional(v.number()),
    heightCm: v.optional(v.number()),
    style: v.optional(v.string()),           // fine line, realism, tribal…
    colour: v.union(v.literal("black_grey"), v.literal("colour")),
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
    method: v.union(v.literal("mpesa"), v.literal("cash")),
    amountKes: v.number(),                   // negative for reversal
    mpesaCode: v.optional(v.string()),       // UPPERCASE, unique
    mpesaRawMessage: v.optional(v.string()), // evidence
    payerName: v.optional(v.string()),
    payerPhone: v.optional(v.string()),
    paidAt: v.number(),
    recordedBy: v.id("staff"),
    reversesPaymentId: v.optional(v.id("payments")),
  })
    .index("by_booking", ["bookingId"])
    .index("by_mpesa_code", ["mpesaCode"])
    .index("by_paid_at", ["paidAt"]),

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
    healthAnswers: v.any(),                  // validated by zod in shared/
    aftercareAck: v.boolean(),
    photoPermission: v.boolean(),
    dataProcessingConsent: v.boolean(),
    signatureName: v.string(),
    signedAt: v.number(),
    userAgent: v.optional(v.string()),
  }).index("by_booking", ["bookingId"]),

  feedback: defineTable({
    bookingId: v.id("bookings"),
    clientId: v.id("clients"),
    rating: v.number(),                      // 1–5
    comment: v.optional(v.string()),
    submittedAt: v.number(),
  }).index("by_booking", ["bookingId"]),

  accessTokens: defineTable({                // public tokenised links
    token: v.string(),                       // 32-byte base64url
    purpose: v.union(v.literal("consent"), v.literal("feedback"), v.literal("terms")),
    bookingId: v.id("bookings"),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_token", ["token"]),

  messageTemplates: defineTable({
    key: v.string(),                         // booking_created_client, reminder_client…
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
      v.literal("queued"), v.literal("sent"), v.literal("delivered"),
      v.literal("failed"), v.literal("cancelled"),
    ),
    providerId: v.optional(v.string()),      // AT messageId
    error: v.optional(v.string()),
    attempts: v.number(),
    sendAt: v.number(),
  })
    .index("by_booking", ["bookingId"])
    .index("by_provider_id", ["providerId"])
    .index("by_status", ["status"]),

  availability: defineTable({
    kind: v.union(v.literal("weekly"), v.literal("block"), v.literal("tour")),
    weekday: v.optional(v.number()),         // 0–6 for weekly
    startMin: v.optional(v.number()),        // minutes from midnight EAT
    endMin: v.optional(v.number()),
    from: v.optional(v.number()),            // epoch for block/tour
    to: v.optional(v.number()),
    location: v.optional(v.string()),        // tour location
    note: v.optional(v.string()),
  }),

  auditLog: defineTable({
    actor: v.id("staff"),
    entity: v.string(),
    entityId: v.string(),
    action: v.string(),
    diff: v.optional(v.any()),
    at: v.number(),
  }).index("by_entity", ["entity", "entityId"]),
});
```

---

## 4. Core Functions

### 4.1 Auth helper

Every staff function starts with:

```ts
export async function requireStaff(ctx, roles?: ("artist" | "manager")[]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("UNAUTHENTICATED");
  const staff = await ctx.db.query("staff").withIndex("by_user", q => q.eq("userId", userId)).unique();
  if (!staff?.active) throw new ConvexError("FORBIDDEN");
  if (roles && !roles.includes(staff.role)) throw new ConvexError("FORBIDDEN");
  return staff;
}
```

### 4.2 Permission matrix

| Function | Artist | Manager |
|---|---|---|
| bookings.create / reschedule / cancel / markNoShow | ✅ | ✅ |
| bookings.overrideOverlap | ✅ | ❌ |
| payments.record | ✅ | ✅ |
| payments.reverse | ✅ | ❌ |
| bookings.adjustFinalPrice | ✅ | ✅ (reason required) |
| clients.* (create, update, flag) | ✅ | ✅ |
| clients.archive | ✅ | ❌ |
| settings.* · terms.publish · templates.* | ✅ | ❌ |
| reports.revenue · exports.* | ✅ | ❌ |
| messages.resend | ✅ | ✅ |

### 4.3 `bookings.create` (mutation) — the critical path

Single transaction (Convex mutations are atomic):

1. `requireStaff(ctx)`
2. Validate input with shared zod schema.
3. Upsert client by `phone` (`by_phone` index).
4. Load `settings`; compute `depositRequiredKes = max(ceil(quoted × pct / 100), minDepositKes ?? 0)`.
5. **Deposit gate:** `deposit.amountKes >= depositRequiredKes`, else throw `DEPOSIT_INSUFFICIENT`.
6. **M-Pesa uniqueness:** if method = mpesa, normalise code to uppercase, query `by_mpesa_code`; if found, throw `MPESA_CODE_USED`.
7. **Overlap check:** query `by_start` for `[startAt − 12h, startAt + durationMin]`, filter `status = confirmed`, test interval overlap. If overlap and caller isn't artist with `override: true`, throw `SLOT_OVERLAP`.
8. Insert `bookings` (with snapshots), `tattoos`, `payments` (deposit), `accessTokens` (consent, terms).
9. Schedule messages (see §5) and store job IDs on `booking.scheduledJobs`.
10. Write `auditLog`.

Returns `bookingId`.

### 4.4 Other mutations

| Function | Key logic |
|---|---|
| `bookings.reschedule` | Overlap check; `rescheduleCount++`; if > limit, warn (deposit forfeit flag); cancel all `scheduledJobs` with `ctx.scheduler.cancel`; mark their `messages` as cancelled; reschedule; send M-2. |
| `bookings.cancel` | Reason + `cancelledBy` required; cancel jobs; send M-3. |
| `bookings.markNoShow` | Only after `startAt`; cancel post-session jobs. |
| `payments.record` (balance) | Same M-Pesa uniqueness; update `paidTotalKes`; **if `paidTotalKes >= finalPriceKes` → status `completed`, `completedAt = now`, schedule M-6, M-7, M-8.** |
| `bookings.adjustFinalPrice` | Insert `priceAdjustments`; re-evaluate completion. |
| `public.submitConsent` | Validate token (exists, purpose, not expired, not used); insert `consents`; set `usedAt`; set `client.dataConsentAt`. |
| `public.submitFeedback` | Same token rules; if rating ≤ 3, SMS the artist. |

### 4.5 M-Pesa message parser (`packages/shared/mpesa.ts`)

Manager pastes the confirmation SMS **received on the business line**. Example:

```
TJ4AB12XYZ Confirmed. You have received Ksh2,000.00 from JOHN DOE 0712345678 on 14/10/26 at 3:41 PM. New M-PESA balance is Ksh...
```

```ts
const RE = /^([A-Z0-9]{10})\s+Confirmed\.\s+You have received Ksh([\d,]+\.\d{2}) from (.+?)\s+(\d{10}|\+?254\d{9}|[\d*]{6,})\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2})\s+at\s+(\d{1,2}:\d{2}\s?[AP]M)/i;

export function parseMpesa(raw: string) {
  const m = raw.trim().match(RE);
  if (!m) return null;                       // fall back to manual entry
  return {
    code: m[1].toUpperCase(),
    amountKes: Math.round(parseFloat(m[2].replace(/,/g, ""))),
    payerName: m[3].trim(),
    payerPhone: m[4],
    paidAt: toEpochEAT(m[5], m[6]),
  };
}
```

- Safaricom masks phone digits on some till messages (`0712***678`) — regex tolerates `*`.
- Paybill / till variants differ slightly; keep a **fixture file of real messages** and unit-test every format you actually receive.
- Parsing never blocks: if it fails, manager types code and amount manually.

---

## 5. Scheduling & SMS

### 5.1 Schedule on booking creation

| Job | When | Function |
|---|---|---|
| M-1 confirmation | now | `sms.send` (client + artist) |
| M-4 reminder | day before at `reminderHourDayBefore` EAT; if that is in the past, skip | `sms.sendReminder` |
| M-5 artist digest | daily cron at `artistDigestHour` (not per booking) | `crons.ts` |

### 5.2 Schedule on completion

| Job | When |
|---|---|
| M-6 aftercare + feedback | completedAt + 1 day at 10:00 EAT |
| M-7 healed photo | + 21 days at 10:00 EAT |
| M-8 touch-up | + 42 days at 10:00 EAT (skip if `marketingOptOut`) |

### 5.3 Rules

- **Quiet hours:** any computed `sendAt` in 21:00–07:00 EAT is moved to 07:00.
- Each job re-reads the booking before sending; if status changed (cancelled, rescheduled), it exits. Belt-and-braces with `scheduler.cancel`.
- Templates rendered in `packages/shared/templates.ts`. Keep client SMS ≤ **160 chars** where possible (one segment = cheaper; 2 segments doubles cost).

### 5.4 Africa's Talking integration

```ts
// convex/sms.ts — internalAction
export const send = internalAction({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const msg = await ctx.runQuery(internal.messages.get, { messageId });
    if (!msg || msg.status !== "queued") return;
    const res = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        apiKey: process.env.AT_API_KEY!,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        username: process.env.AT_USERNAME!,
        to: msg.to,
        message: msg.body,
        from: process.env.AT_SENDER_ID!,      // e.g. "DR_INK"
      }),
    });
    // parse SMSMessageData.Recipients[0] → status, messageId, cost
    // on failure: attempts++, retry once in 5 min, then status=failed
  },
});
```

**Delivery reports:** Convex HTTP action at `POST /sms/delivery` (registered in AT dashboard). Updates `messages.status` by `providerId`. Verify with a shared secret query param since AT callbacks are unsigned.

**Cost (verify current AT rates):** roughly **~KES 1 per SMS segment**. About 7 SMS per completed booking (incl. artist copies) → **≈ KES 7–10 per booking**. 100 bookings/month ≈ KES 1,000.

**Sender ID:** registering an alphanumeric sender (e.g. `DR_INK`) with Safaricom via AT takes ~1–2 weeks and company documents. Start this on day 1. Until approved, use AT's shared shortcode.

---

## 6. Public Token Pages

Routes in Next.js (no auth), all server-rendered, `noindex`:

| Route | Purpose | Token expiry |
|---|---|---|
| `/c/[token]` | Consent form | booking start + 1 day |
| `/t/[token]` | Terms snapshot for the booking | 1 year |
| `/f/[token]` | Feedback | 30 days |

- Tokens: 32 random bytes, base64url (~43 chars). Never sequential IDs.
- A token only grants access to its own purpose + booking. Pages show first name only, never phone or price.
- Rate-limit public mutations (Convex rate-limiter component): 10 req/min per token.

---

## 7. Files (Convex Storage)

- Upload flow: `generateUploadUrl` mutation → client `POST` → save storage ID on the tattoo record.
- Client-side compress before upload: max 2048px long edge, JPEG 0.8 (`browser-image-compression`). Phone photos drop from ~4 MB to ~400 KB.
- Serve via `ctx.storage.getUrl()` only from staff-authenticated queries. Never expose URLs on public pages.
- Limit: 10 images per tattoo record; JPEG/PNG/HEIC/WebP only.

---

## 8. Security & Data Protection (Kenya DPA 2019)

| Requirement | Implementation |
|---|---|
| Lawful basis + consent | `dataProcessingConsent` checkbox on consent form; recorded with timestamp |
| Minimisation | No ID numbers stored. DOB only for 18+ check. |
| Access control | Role checks in every Convex function, not only in UI |
| Encryption | TLS in transit; Convex encrypts at rest |
| Right to erasure | Artist-only `clients.erase` — anonymises client fields, deletes images, keeps payment amounts for accounting |
| Breach readiness | Audit log + Sentry; ODPC requires notification within 72h |
| Registration | Check ODPC registration threshold for data controllers — confirm before launch |
| Secrets | `AT_API_KEY` etc. only in Convex env vars, never in Next.js public env |

---

## 9. Time Handling

- Store all instants as UTC epoch ms.
- One helper module: `toEAT()`, `fromEATParts()`, `startOfDayEAT()`. Never use the server's local time (Convex runs in UTC).
- Kenya has no DST, which simplifies everything — still use the tz library so the code stays correct.

---

## 10. Future: Expo App (v2)

Designed in from day one:
- Convex functions are the API; Expo uses `convex/react` identically.
- Zod schemas, M-Pesa parser, templates, money/time helpers in `packages/shared`.
- Design tokens exported as both CSS variables and a TS object from `packages/ui-tokens`.
- Push notifications (Expo) can replace artist SMS later — add `staff.expoPushToken`.
- Daraja C2B: add `POST /mpesa/c2b` HTTP action; auto-insert `payments` with `mpesaCode`; manager then **links** a payment to a booking instead of typing it. The uniqueness index already supports this.

---

## 11. Environments & Deployment

| Env | Web | Convex | SMS |
|---|---|---|---|
| dev | localhost | dev deployment | AT **sandbox** |
| prod | Vercel | prod deployment | AT live |

Env vars (Convex): `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID`, `SMS_WEBHOOK_SECRET`, `PUBLIC_BASE_URL`.
Env vars (Next.js): `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY` (CI).

CI (GitHub Actions): typecheck → lint → unit tests → `npx convex deploy` → Vercel deploy.

---

## 12. Testing

| Layer | What | Tool |
|---|---|---|
| Unit | M-Pesa parser (real message fixtures), deposit maths, quiet-hours shift, overlap detection, template rendering | Vitest |
| Convex | `bookings.create` gates (deposit, duplicate code, overlap), completion rule, reschedule cancels jobs, role checks | `convex-test` |
| E2E | Create booking → SMS queued → record balance → completed → feedback page | Playwright |
| Manual | SMS on real Safaricom + Airtel lines | — |

**Must-pass before launch:** duplicate M-Pesa code rejected; underpaid deposit rejected; manager cannot reach artist-only functions; cancelled booking sends no reminders.

---

## 13. Performance Targets

| Metric | Target |
|---|---|
| Dashboard first load (4G) | < 2.5 s LCP |
| Calendar update after booking created | < 500 ms (Convex realtime) |
| Create booking end-to-end | < 90 s user time |
| Public consent page | < 1.5 s LCP, < 100 KB JS |
