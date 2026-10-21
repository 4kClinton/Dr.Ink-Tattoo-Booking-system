import {
  ageOn, balanceDue, clientInputSchema, computeDepositRequired, DAY_MS, endOf, extrasSchema, firstIssue,
  formatKes, scheduleInputSchema, shortName, tattooCountSchema, tattooInputSchema,
} from "@drink/shared";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requirePermission, requireStaff } from "./lib/auth";
import { audit } from "./lib/audit";
import {
  assertNoOverlap, evaluateCompletion, extendConsentToken, findOverlapping, getConsent, getTattoo,
  scheduleCancelledMessages, scheduleCreatedMessages, scheduleRescheduledMessages,
} from "./lib/bookingLogic";
import { fail } from "./lib/errors";
import { cancelQueued } from "./lib/messaging";
import { findMpesaCode, insertPayment, paymentArgV, validatePayment } from "./lib/payments";
import { getSettings } from "./lib/settings";
import { createToken, tokenFor } from "./lib/tokens";
import { colourV, locationV } from "./schema";

const clientArgV = v.object({
  fullName: v.string(),
  phone: v.string(),
  email: v.optional(v.string()),
  instagram: v.optional(v.string()),
  dateOfBirth: v.optional(v.string()),
  notes: v.optional(v.string()),
});

const tattooArgV = v.object({
  description: v.string(),
  placement: v.string(),
  size: v.optional(v.string()),
  style: v.optional(v.string()),
  colour: colourV,
  referenceImages: v.optional(v.array(v.id("_storage"))),
});

/**
 * TRD §4.3 — the critical path. One Convex mutation = one transaction:
 * either the booking, tattoo, deposit, tokens, messages and audit all land, or none do.
 */
export const create = mutation({
  args: {
    clientId: v.optional(v.id("clients")),
    client: v.optional(clientArgV),
    tattoo: tattooArgV,
    startAt: v.number(),
    durationMin: v.number(),
    location: locationV,
    locationNote: v.optional(v.string()),
    venue: v.optional(v.union(v.literal("studio"), v.literal("house_call"))),
    quotedPriceKes: v.number(),
    expectedExpensesKes: v.optional(v.number()),
    expectedExpensesNote: v.optional(v.string()),
    source: v.optional(v.string()),
    extras: v.optional(v.array(v.string())),
    tattooCount: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
    newProject: v.optional(v.object({ title: v.string(), plannedSessions: v.optional(v.number()) })),
    deposit: paymentArgV,
    overrideOverlap: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // 1. auth
    const staff = await requirePermission(ctx, "bookings.manage");

    // 2. validate with the shared zod schemas
    const tattoo = tattooInputSchema.safeParse(args.tattoo);
    if (!tattoo.success) fail("INVALID", firstIssue(tattoo.error));
    const schedule = scheduleInputSchema.safeParse(args);
    if (!schedule.success) fail("INVALID", firstIssue(schedule.error));
    if (!Number.isInteger(args.quotedPriceKes) || args.quotedPriceKes <= 0) {
      fail("INVALID", "Enter the quoted price in whole shillings.");
    }
    if (args.expectedExpensesKes !== undefined && (!Number.isInteger(args.expectedExpensesKes) || args.expectedExpensesKes < 0)) {
      fail("INVALID", "Expected expenses must be whole shillings.");
    }
    const refs = args.tattoo.referenceImages ?? [];
    if (refs.length > 10) fail("LIMIT_REACHED", "Up to 10 reference images per tattoo.");
    const extrasParsed = extrasSchema.safeParse(args.extras);
    if (!extrasParsed.success) fail("INVALID", firstIssue(extrasParsed.error));
    const tattooCountParsed = tattooCountSchema.safeParse(args.tattooCount ?? 1);
    if (!tattooCountParsed.success) fail("INVALID", firstIssue(tattooCountParsed.error));
    const deposit = validatePayment(args.deposit);

    // 3. upsert client by phone
    let client: Doc<"clients">;
    if (args.clientId) {
      const c = await ctx.db.get(args.clientId);
      if (!c || c.archived) fail("NOT_FOUND", "That client record isn't available.");
      client = c;
    } else {
      if (!args.client) fail("INVALID", "Choose a client or add a new one.");
      const parsed = clientInputSchema.safeParse(args.client);
      if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
      const existing = await ctx.db
        .query("clients")
        .withIndex("by_phone", (q) => q.eq("phone", parsed.data.phone))
        .unique();
      if (existing) {
        client = existing; // C-2: phone is the key — reuse
      } else {
        const id = await ctx.db.insert("clients", {
          ...parsed.data,
          marketingOptOut: false,
          archived: false,
          sessionCount: 0,
        });
        await audit(ctx, staff._id, "clients", id, "created", parsed.data);
        client = (await ctx.db.get(id))!;
      }
    }
    if (client.dateOfBirth && ageOn(client.dateOfBirth, args.startAt) < 18) {
      fail("CLIENT_UNDERAGE", "Clients must be 18 or older on the session date.");
    }

    // 4. deposit maths, snapshotted
    const settings = await getSettings(ctx);
    if (!settings.currentTermsId) fail("INVALID", "Publish Terms & Conditions in Settings before booking.");
    const depositRequiredKes = computeDepositRequired(args.quotedPriceKes, settings.depositPercent, settings.minDepositKes);

    // 5. deposit gate
    if (deposit.amountKes < depositRequiredKes) {
      fail(
        "DEPOSIT_INSUFFICIENT",
        `Deposit is ${formatKes(depositRequiredKes - deposit.amountKes)} short. ${formatKes(depositRequiredKes)} is required.`,
        { requiredKes: depositRequiredKes },
      );
    }

    // 6. M-Pesa uniqueness (checked again on insert)
    if (deposit.method === "mpesa") {
      const used = await findMpesaCode(ctx, deposit.mpesaCode!);
      if (used) {
        fail("MPESA_CODE_USED", `This M-Pesa code is already recorded on ${used.clientName}'s booking (${used.bookingDate}).`, {
          bookingId: used.bookingId,
        });
      }
    }

    // 7. overlap
    await assertNoOverlap(ctx, staff, args.startAt, args.durationMin, args.overrideOverlap);

    // project (B-9)
    let projectId = args.projectId;
    if (projectId) {
      const p = await ctx.db.get(projectId);
      if (!p || p.clientId !== client._id) fail("INVALID", "That project belongs to another client.");
    } else if (args.newProject?.title.trim()) {
      projectId = await ctx.db.insert("projects", {
        clientId: client._id,
        title: args.newProject.title.trim(),
        plannedSessions: args.newProject.plannedSessions,
      });
    }

    // 8. inserts
    const artist =
      staff.role === "artist"
        ? staff
        : await ctx.db.query("staff").withIndex("by_role", (q) => q.eq("role", "artist")).first();
    if (!artist) fail("INVALID", "No artist account exists.");

    const bookingId = await ctx.db.insert("bookings", {
      artistId: artist._id,
      clientId: client._id,
      projectId,
      startAt: args.startAt,
      durationMin: args.durationMin,
      location: args.location,
      locationNote: schedule.data.locationNote,
      venue: args.venue ?? "studio",
      status: "confirmed",
      source: args.source || undefined,
      extras: extrasParsed.data,
      tattooCount: tattooCountParsed.data,
      expectedExpensesKes: args.expectedExpensesKes || undefined,
      expectedExpensesNote: args.expectedExpensesKes ? args.expectedExpensesNote?.trim() || undefined : undefined,
      quotedPriceKes: args.quotedPriceKes,
      finalPriceKes: args.quotedPriceKes,
      depositPercent: settings.depositPercent,
      depositRequiredKes,
      paidTotalKes: deposit.amountKes,
      rescheduleCount: 0,
      termsId: settings.currentTermsId,
      scheduledJobs: [],
      createdBy: staff._id,
    });
    await ctx.db.insert("tattoos", {
      bookingId,
      clientId: client._id,
      ...tattoo.data,
      referenceImages: refs,
      finalImages: [],
      healedImages: [],
      portfolioApproved: false,
    });
    await insertPayment(ctx, staff, { bookingId, clientId: client._id }, args.deposit, "deposit");

    // + session logistics (transport, food, …) estimated at booking time become a ledger expense,
    // dated to the session day so it lands in the same reporting period.
    if (args.expectedExpensesKes && args.expectedExpensesKes > 0) {
      await ctx.db.insert("expenses", {
        category: "session",
        amountKes: args.expectedExpensesKes,
        incurredAt: args.startAt,
        note: args.expectedExpensesNote?.trim() || undefined,
        bookingId,
        recordedBy: staff._id,
      });
    }

    const consentToken = await createToken(ctx, "consent", bookingId, args.startAt + DAY_MS);
    await createToken(ctx, "terms", bookingId, Date.now() + 365 * DAY_MS);

    // 9. messages (M-1 now, M-4 day before)
    await scheduleCreatedMessages(ctx, bookingId, consentToken);

    // 10. audit
    await audit(ctx, staff._id, "bookings", bookingId, "created", {
      startAt: args.startAt,
      quotedPriceKes: args.quotedPriceKes,
      depositRequiredKes,
      depositPaidKes: deposit.amountKes,
      overrideOverlap: args.overrideOverlap || undefined,
    });
    return bookingId;
  },
});

/** Live overlap check for Step 3 of the booking sheet. */
export const overlaps = query({
  args: { startAt: v.number(), durationMin: v.number(), excludeId: v.optional(v.id("bookings")) },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    return await findOverlapping(ctx, args.startAt, args.durationMin, args.excludeId);
  },
});

export const reschedule = mutation({
  args: {
    bookingId: v.id("bookings"),
    startAt: v.number(),
    durationMin: v.optional(v.number()),
    location: v.optional(locationV),
    locationNote: v.optional(v.string()),
    overrideOverlap: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const staff = await requirePermission(ctx, "bookings.manage");
    const b = await ctx.db.get(args.bookingId);
    if (!b) fail("NOT_FOUND", "Booking not found.");
    if (b.status !== "confirmed") fail("BAD_STATUS", "Only confirmed bookings can be rescheduled.");
    const durationMin = args.durationMin ?? b.durationMin;
    const parsed = scheduleInputSchema.safeParse({
      startAt: args.startAt,
      durationMin,
      location: args.location ?? b.location,
      locationNote: args.locationNote ?? b.locationNote,
    });
    if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
    await assertNoOverlap(ctx, staff, args.startAt, durationMin, args.overrideOverlap, b._id);

    const settings = await getSettings(ctx);
    const rescheduleCount = b.rescheduleCount + 1;
    const overLimit = rescheduleCount > settings.rescheduleLimit; // B-11
    await ctx.db.patch(b._id, {
      startAt: args.startAt,
      durationMin,
      location: parsed.data.location,
      locationNote: parsed.data.locationNote,
      rescheduleCount,
      ...(overLimit ? { depositOutcome: "forfeited" as const } : {}),
    });
    await extendConsentToken(ctx, b._id, args.startAt);
    await scheduleRescheduledMessages(ctx, b._id);
    await audit(ctx, staff._id, "bookings", b._id, "rescheduled", {
      from: { startAt: b.startAt, durationMin: b.durationMin, location: b.location },
      to: { startAt: args.startAt, durationMin, location: parsed.data.location },
      rescheduleCount,
      depositForfeited: overLimit || undefined,
    });
    return { rescheduleCount, depositForfeited: overLimit };
  },
});

export const cancel = mutation({
  args: {
    bookingId: v.id("bookings"),
    reason: v.string(),
    cancelledBy: v.union(v.literal("client"), v.literal("artist")),
    /** Rule 4: when the artist cancels, the artist decides carry vs refund. */
    artistDepositAction: v.optional(v.union(v.literal("carried"), v.literal("refunded"))),
  },
  handler: async (ctx, args) => {
    const staff = await requirePermission(ctx, "bookings.cancel");
    const b = await ctx.db.get(args.bookingId);
    if (!b) fail("NOT_FOUND", "Booking not found.");
    if (b.status !== "confirmed") fail("BAD_STATUS", "Only confirmed bookings can be cancelled.");
    const reason = args.reason.trim();
    if (reason.length < 3) fail("INVALID", "Add a reason for the cancellation.");
    const depositOutcome =
      args.cancelledBy === "client"
        ? ("forfeited" as const)
        : staff.role === "artist" && args.artistDepositAction
          ? args.artistDepositAction
          : ("pending" as const);
    await ctx.db.patch(b._id, { status: "cancelled", cancelReason: reason, cancelledBy: args.cancelledBy, depositOutcome });
    await scheduleCancelledMessages(ctx, b._id);
    await audit(ctx, staff._id, "bookings", b._id, "cancelled", { reason, cancelledBy: args.cancelledBy, depositOutcome });
  },
});

/** Artist settles a "pending" deposit after an artist-side cancellation. */
export const resolveDeposit = mutation({
  args: { bookingId: v.id("bookings"), outcome: v.union(v.literal("carried"), v.literal("refunded"), v.literal("forfeited")) },
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx, ["artist"]);
    const b = await ctx.db.get(args.bookingId);
    if (!b) fail("NOT_FOUND", "Booking not found.");
    await ctx.db.patch(b._id, { depositOutcome: args.outcome });
    await audit(ctx, staff._id, "bookings", b._id, "deposit_resolved", { from: b.depositOutcome, to: args.outcome });
  },
});

export const markNoShow = mutation({
  args: { bookingId: v.id("bookings"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const staff = await requirePermission(ctx, "bookings.cancel");
    const b = await ctx.db.get(args.bookingId);
    if (!b) fail("NOT_FOUND", "Booking not found.");
    if (b.status !== "confirmed") fail("BAD_STATUS", "Only confirmed bookings can be marked as a no-show.");
    if (Date.now() < b.startAt) fail("TOO_EARLY", "You can mark a no-show once the session start time has passed.");
    await ctx.db.patch(b._id, { status: "no_show", depositOutcome: "forfeited", cancelReason: args.reason?.trim() || undefined });
    await cancelQueued(ctx, b._id);
    const client = await ctx.db.get(b.clientId);
    if (client && !client.flagged) {
      await ctx.db.patch(client._id, { flagged: `No-show history (${new Date(b.startAt).toISOString().slice(0, 10)})` });
    }
    await audit(ctx, staff._id, "bookings", b._id, "no_show", { reason: args.reason });
  },
});

/** P-5: designs grow. Logged with a reason; completion re-evaluated. */
export const adjustFinalPrice = mutation({
  args: { bookingId: v.id("bookings"), finalPriceKes: v.number(), reason: v.string() },
  handler: async (ctx, args) => {
    const staff = await requirePermission(ctx, "bookings.adjustPrice");
    const b = await ctx.db.get(args.bookingId);
    if (!b) fail("NOT_FOUND", "Booking not found.");
    if (b.status !== "confirmed") fail("BAD_STATUS", "Prices can only change before the session is closed.");
    if (!Number.isInteger(args.finalPriceKes) || args.finalPriceKes <= 0) fail("INVALID", "Enter the new price in whole shillings.");
    if (args.finalPriceKes < b.depositRequiredKes) fail("INVALID", "The final price can't be below the deposit.");
    const reason = args.reason.trim();
    if (reason.length < 3) fail("INVALID", "Add a reason for the price change.");
    await ctx.db.insert("priceAdjustments", { bookingId: b._id, fromKes: b.finalPriceKes, toKes: args.finalPriceKes, reason, by: staff._id });
    await ctx.db.patch(b._id, { finalPriceKes: args.finalPriceKes });
    await audit(ctx, staff._id, "bookings", b._id, "price_adjusted", { from: b.finalPriceKes, to: args.finalPriceKes, reason });
    return { completed: await evaluateCompletion(ctx, b._id, staff._id) };
  },
});

/** Close a fully-paid session (e.g. client paid the full price before the day). */
export const complete = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const staff = await requirePermission(ctx, "bookings.manage");
    const b = await ctx.db.get(args.bookingId);
    if (!b) fail("NOT_FOUND", "Booking not found.");
    if (b.paidTotalKes < b.finalPriceKes) {
      fail("BAD_STATUS", `${formatKes(b.finalPriceKes - b.paidTotalKes)} is still due. Record the balance first.`);
    }
    const done = await evaluateCompletion(ctx, b._id, staff._id);
    if (!done) fail("TOO_EARLY", "Sessions can be completed from the morning of the session.");
  },
});

/** Bump the number of tattoos on a session (clients often add more once they're in the chair). */
export const setTattooCount = mutation({
  args: { bookingId: v.id("bookings"), count: v.number() },
  handler: async (ctx, { bookingId, count }) => {
    const staff = await requirePermission(ctx, "bookings.manage");
    const b = await ctx.db.get(bookingId);
    if (!b) fail("NOT_FOUND", "Booking not found.");
    const parsed = tattooCountSchema.safeParse(count);
    if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
    await ctx.db.patch(b._id, { tattooCount: parsed.data });
    await audit(ctx, staff._id, "bookings", b._id, "tattoo_count", { from: b.tattooCount ?? 1, to: parsed.data });
    return parsed.data;
  },
});

export const update = mutation({
  args: {
    bookingId: v.id("bookings"),
    source: v.optional(v.string()),
    extras: v.optional(v.array(v.string())),
    venue: v.optional(v.union(v.literal("studio"), v.literal("house_call"))),
    projectId: v.optional(v.union(v.id("projects"), v.null())),
    tattoo: v.optional(tattooArgV),
  },
  handler: async (ctx, args) => {
    const staff = await requirePermission(ctx, "bookings.manage");
    const b = await ctx.db.get(args.bookingId);
    if (!b) fail("NOT_FOUND", "Booking not found.");
    if (args.source !== undefined) await ctx.db.patch(b._id, { source: args.source || undefined });
    if (args.venue !== undefined) await ctx.db.patch(b._id, { venue: args.venue });
    if (args.extras !== undefined) {
      const parsed = extrasSchema.safeParse(args.extras);
      if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
      await ctx.db.patch(b._id, { extras: parsed.data });
    }
    if (args.projectId !== undefined) await ctx.db.patch(b._id, { projectId: args.projectId ?? undefined });
    if (args.tattoo) {
      const parsed = tattooInputSchema.safeParse(args.tattoo);
      if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
      const t = await getTattoo(ctx, b._id);
      if (t) await ctx.db.patch(t._id, parsed.data);
    }
    await audit(ctx, staff._id, "bookings", b._id, "updated", { source: args.source, projectId: args.projectId, tattoo: args.tattoo });
  },
});

// ───────────────────────────── queries ─────────────────────────────

export async function bookingSummary(ctx: QueryCtx, b: Doc<"bookings">) {
  const [client, tattoo, consent] = await Promise.all([ctx.db.get(b.clientId), getTattoo(ctx, b._id), getConsent(ctx, b._id)]);
  return {
    _id: b._id,
    startAt: b.startAt,
    endAt: endOf(b),
    durationMin: b.durationMin,
    location: b.location,
    locationNote: b.locationNote,
    status: b.status,
    clientId: b.clientId,
    clientName: client ? shortName(client.fullName) : "Unknown",
    clientFlagged: client?.flagged,
    tattooShort: tattoo ? `${tattoo.description} · ${tattoo.placement}` : "",
    consentSigned: !!consent,
    balanceKes: balanceDue(b.finalPriceKes, b.paidTotalKes),
    finalPriceKes: b.finalPriceKes,
  };
}
export type BookingSummary = Awaited<ReturnType<typeof bookingSummary>>;

/** Calendar range [from, to). Cancelled hidden unless asked. */
export const range = query({
  args: { from: v.number(), to: v.number(), includeCancelled: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_start", (q) => q.gte("startAt", args.from).lt("startAt", args.to))
      .collect();
    const visible = rows.filter((b) => args.includeCancelled || b.status !== "cancelled");
    return await Promise.all(visible.map((b) => bookingSummary(ctx, b)));
  },
});

export const get = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const staff = await requireStaff(ctx);
    const b = await ctx.db.get(bookingId);
    if (!b) return null;
    const [client, tattoo, consent, payments, adjustments, messages, auditRows, consentToken, termsToken, feedback, terms] =
      await Promise.all([
        ctx.db.get(b.clientId),
        getTattoo(ctx, b._id),
        getConsent(ctx, b._id),
        ctx.db.query("payments").withIndex("by_booking", (q) => q.eq("bookingId", b._id)).collect(),
        ctx.db.query("priceAdjustments").withIndex("by_booking", (q) => q.eq("bookingId", b._id)).collect(),
        ctx.db.query("messages").withIndex("by_booking", (q) => q.eq("bookingId", b._id)).collect(),
        ctx.db.query("auditLog").withIndex("by_entity", (q) => q.eq("entity", "bookings").eq("entityId", b._id)).collect(),
        tokenFor(ctx, b._id, "consent"),
        tokenFor(ctx, b._id, "terms"),
        ctx.db.query("feedback").withIndex("by_booking", (q) => q.eq("bookingId", b._id)).first(),
        ctx.db.get(b.termsId),
      ]);
    if (!client) return null;

    const staffNames = new Map<Id<"staff">, string>();
    for (const s of await ctx.db.query("staff").collect()) staffNames.set(s._id, s.name);

    const urls = async (ids: Id<"_storage">[]) =>
      (await Promise.all(ids.map(async (id) => ({ id, url: await ctx.storage.getUrl(id) })))).filter(
        (x): x is { id: Id<"_storage">; url: string } => !!x.url,
      );

    let project = null;
    if (b.projectId) {
      const p = await ctx.db.get(b.projectId);
      if (p) {
        const sessions = (await ctx.db.query("bookings").withIndex("by_project", (q) => q.eq("projectId", p._id)).collect())
          .filter((x) => x.status !== "cancelled")
          .sort((x, y) => x.startAt - y.startAt);
        project = { ...p, sessionNumber: sessions.findIndex((x) => x._id === b._id) + 1, sessionTotal: Math.max(p.plannedSessions ?? 0, sessions.length) };
      }
    }

    return {
      booking: b,
      viewerRole: staff.role,
      balanceKes: balanceDue(b.finalPriceKes, b.paidTotalKes),
      client,
      tattoo: tattoo && {
        ...tattoo,
        referenceUrls: await urls(tattoo.referenceImages),
        finalUrls: await urls(tattoo.finalImages),
        healedUrls: await urls(tattoo.healedImages),
      },
      consent,
      consentToken: consentToken && { token: consentToken.token, expiresAt: consentToken.expiresAt },
      termsToken: termsToken?.token ?? null,
      terms: terms && { version: terms.version, publishedAt: terms.publishedAt },
      payments: payments
        .sort((x, y) => x.paidAt - y.paidAt)
        .map((p) => ({ ...p, recordedByName: staffNames.get(p.recordedBy) ?? "" })),
      adjustments: adjustments.map((a) => ({ ...a, byName: staffNames.get(a.by) ?? "" })),
      messages: messages.sort((x, y) => x.sendAt - y.sendAt),
      audit: auditRows.sort((x, y) => y.at - x.at).map((a) => ({ ...a, actorName: staffNames.get(a.actor) ?? "" })),
      feedback,
      project,
    };
  },
});

