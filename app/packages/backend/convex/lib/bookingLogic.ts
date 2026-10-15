import {
  endOf, followUpTime, formatDateShort, formatTime24, intervalsOverlap, OVERLAP_LOOKBACK_MS,
  reminderTime, shortName, startOfDayEAT, DAY_MS,
} from "@drink/shared";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { can } from "./auth";
import { audit } from "./audit";
import { fail } from "./errors";
import { artistFor, bookingVars, cancelQueued, queueMessage } from "./messaging";
import { getSettings, type Settings } from "./settings";
import { createToken, tokenFor, tokenUrl } from "./tokens";

export async function getTattoo(ctx: QueryCtx, bookingId: Id<"bookings">) {
  return await ctx.db
    .query("tattoos")
    .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
    .unique();
}

export async function getConsent(ctx: QueryCtx, bookingId: Id<"bookings">) {
  return await ctx.db
    .query("consents")
    .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
    .first();
}

/** Confirmed sessions overlapping [startAt, startAt+durationMin). TRD §4.3 step 7. */
export async function findOverlapping(
  ctx: QueryCtx,
  startAt: number,
  durationMin: number,
  excludeId?: Id<"bookings">,
) {
  const end = startAt + durationMin * 60_000;
  const candidates = await ctx.db
    .query("bookings")
    .withIndex("by_status_start", (q) =>
      q.eq("status", "confirmed").gte("startAt", startAt - OVERLAP_LOOKBACK_MS).lt("startAt", end),
    )
    .collect();
  const hits = candidates.filter((b) => b._id !== excludeId && intervalsOverlap({ startAt, durationMin }, b));
  return await Promise.all(
    hits.map(async (b) => {
      const c = await ctx.db.get(b.clientId);
      return {
        bookingId: b._id,
        clientName: c ? shortName(c.fullName) : "another client",
        startAt: b.startAt,
        endAt: endOf(b),
      };
    }),
  );
}

export async function assertNoOverlap(
  ctx: QueryCtx,
  staff: Doc<"staff">,
  startAt: number,
  durationMin: number,
  override: boolean | undefined,
  excludeId?: Id<"bookings">,
) {
  const overlaps = await findOverlapping(ctx, startAt, durationMin, excludeId);
  if (!overlaps.length) return;
  if (override && can(staff, "bookings.overrideOverlap")) return; // B-5: artist (or a manager granted it) can override
  const o = overlaps[0]!;
  fail(
    "SLOT_OVERLAP",
    `Overlaps ${o.clientName} ${formatTime24(o.startAt)}–${formatTime24(o.endAt)}. Pick another time.`,
    { overlaps },
  );
}

async function clientAndArtist(ctx: QueryCtx, booking: Doc<"bookings">) {
  const client = await ctx.db.get(booking.clientId);
  if (!client) fail("NOT_FOUND", "Client not found.");
  const artist = await artistFor(ctx, booking.artistId);
  const tattoo = await getTattoo(ctx, booking._id);
  return { client, artist, tattoo };
}

/** M-4 reminders for client + artist, day before at settings hour (skipped if already past). */
export async function scheduleReminders(ctx: MutationCtx, booking: Doc<"bookings">, settings: Settings) {
  const at = reminderTime(booking.startAt, settings.reminderHourDayBefore, Date.now());
  if (!at) return;
  const { client, artist, tattoo } = await clientAndArtist(ctx, booking);
  const consent = await getConsent(ctx, booking._id);
  const vars = bookingVars(booking, client, tattoo, settings, { consent: consent ? "signed" : "NOT signed" });
  await queueMessage(ctx, {
    templateKey: "reminder_client", to: client.phone, recipient: "client", vars, sendAt: at,
    bookingId: booking._id, clientId: client._id,
  }, settings);
  if (artist) {
    await queueMessage(ctx, {
      templateKey: "reminder_artist", to: artist.phone, recipient: "artist",
      vars: { ...vars, time: vars.time24! }, sendAt: at, bookingId: booking._id,
    }, settings);
  }
}

/** M-1 confirmation (now) + M-4 reminders. */
export async function scheduleCreatedMessages(ctx: MutationCtx, bookingId: Id<"bookings">, consentToken: string) {
  const booking = (await ctx.db.get(bookingId))!;
  const settings = await getSettings(ctx);
  const { client, artist, tattoo } = await clientAndArtist(ctx, booking);
  const vars = bookingVars(booking, client, tattoo, settings, { link: tokenUrl("consent", consentToken) });
  await queueMessage(ctx, {
    templateKey: "confirmed_client", to: client.phone, recipient: "client", vars,
    bookingId, clientId: client._id,
  }, settings);
  if (artist) {
    await queueMessage(ctx, {
      templateKey: "confirmed_artist", to: artist.phone, recipient: "artist",
      vars: { ...vars, time: vars.time24! }, bookingId,
    }, settings);
  }
  await scheduleReminders(ctx, (await ctx.db.get(bookingId))!, settings);
}

/** M-2: cancel pending pre-session jobs, notify, re-schedule reminders. */
export async function scheduleRescheduledMessages(ctx: MutationCtx, bookingId: Id<"bookings">) {
  await cancelQueued(ctx, bookingId);
  const booking = (await ctx.db.get(bookingId))!;
  const settings = await getSettings(ctx);
  const { client, artist, tattoo } = await clientAndArtist(ctx, booking);
  const vars = bookingVars(booking, client, tattoo, settings);
  await queueMessage(ctx, {
    templateKey: "rescheduled_client", to: client.phone, recipient: "client", vars,
    bookingId, clientId: client._id,
  }, settings);
  if (artist) {
    await queueMessage(ctx, {
      templateKey: "rescheduled_artist", to: artist.phone, recipient: "artist",
      vars: { ...vars, time: vars.time24! }, bookingId,
    }, settings);
  }
  await scheduleReminders(ctx, (await ctx.db.get(bookingId))!, settings);
}

export async function scheduleCancelledMessages(ctx: MutationCtx, bookingId: Id<"bookings">) {
  await cancelQueued(ctx, bookingId);
  const booking = (await ctx.db.get(bookingId))!;
  const settings = await getSettings(ctx);
  const { client, artist, tattoo } = await clientAndArtist(ctx, booking);
  const vars = bookingVars(booking, client, tattoo, settings, { reason: booking.cancelReason ?? "" });
  await queueMessage(ctx, {
    templateKey: "cancelled_client", to: client.phone, recipient: "client", vars,
    bookingId, clientId: client._id,
  }, settings);
  if (artist) {
    await queueMessage(ctx, {
      templateKey: "cancelled_artist", to: artist.phone, recipient: "artist",
      vars: { ...vars, time: vars.time24! }, bookingId,
    }, settings);
  }
}

/** M-6/M-7/M-8 after completion. Feedback token valid 30 days from the aftercare send. */
export async function scheduleCompletionMessages(ctx: MutationCtx, booking: Doc<"bookings">) {
  const settings = await getSettings(ctx);
  const completedAt = booking.completedAt ?? Date.now();
  const { client, tattoo } = await clientAndArtist(ctx, booking);
  const aftercareAt = followUpTime(completedAt, 1);
  const feedbackToken = await createToken(ctx, "feedback", booking._id, aftercareAt + 30 * DAY_MS);
  const vars = bookingVars(booking, client, tattoo, settings, { link: tokenUrl("feedback", feedbackToken) });
  const base = { to: client.phone, recipient: "client" as const, vars, bookingId: booking._id, clientId: client._id };
  await queueMessage(ctx, { ...base, templateKey: "aftercare_client", sendAt: aftercareAt }, settings);
  await queueMessage(ctx, { ...base, templateKey: "healed_client", sendAt: followUpTime(completedAt, 21) }, settings);
  await queueMessage(ctx, { ...base, templateKey: "touchup_client", sendAt: followUpTime(completedAt, 42) }, settings);
}

/**
 * P-6: a booking is `completed` only when total paid ≥ final price.
 * Completion also needs the session day to have arrived — a client paying in full early
 * must not trigger aftercare SMS before the session.
 */
export async function evaluateCompletion(ctx: MutationCtx, bookingId: Id<"bookings">, actor: Id<"staff">) {
  const b = (await ctx.db.get(bookingId))!;
  if (b.status !== "confirmed") return false;
  if (b.paidTotalKes < b.finalPriceKes) return false;
  if (Date.now() < startOfDayEAT(b.startAt)) return false;
  const completedAt = Date.now();
  await ctx.db.patch(bookingId, { status: "completed", completedAt });
  await cancelQueued(ctx, bookingId, ["reminder_client", "reminder_artist"]);
  const client = await ctx.db.get(b.clientId);
  if (client) {
    await ctx.db.patch(client._id, {
      lastVisitAt: Math.max(client.lastVisitAt ?? 0, b.startAt),
      sessionCount: (client.sessionCount ?? 0) + 1,
    });
  }
  await audit(ctx, actor, "bookings", bookingId, "completed", { paidTotalKes: b.paidTotalKes, finalPriceKes: b.finalPriceKes });
  await scheduleCompletionMessages(ctx, { ...b, status: "completed", completedAt });
  return true;
}

/** Undo completion (e.g. a reversal leaves a balance): back to confirmed, drop follow-ups. */
export async function revertCompletion(ctx: MutationCtx, bookingId: Id<"bookings">, actor: Id<"staff">) {
  const b = (await ctx.db.get(bookingId))!;
  if (b.status !== "completed" || b.paidTotalKes >= b.finalPriceKes) return;
  await ctx.db.patch(bookingId, { status: "confirmed", completedAt: undefined });
  await cancelQueued(ctx, bookingId);
  const client = await ctx.db.get(b.clientId);
  if (client?.sessionCount) await ctx.db.patch(client._id, { sessionCount: client.sessionCount - 1 });
  await audit(ctx, actor, "bookings", bookingId, "completion_reverted");
}

export async function recomputePaid(ctx: MutationCtx, bookingId: Id<"bookings">) {
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
    .collect();
  const total = payments.reduce((s, p) => s + p.amountKes, 0);
  await ctx.db.patch(bookingId, { paidTotalKes: total });
  return total;
}

export async function extendConsentToken(ctx: MutationCtx, bookingId: Id<"bookings">, startAt: number) {
  const t = await tokenFor(ctx, bookingId, "consent");
  if (t) await ctx.db.patch(t._id, { expiresAt: startAt + DAY_MS });
}

export function describeSlot(b: Pick<Doc<"bookings">, "startAt">) {
  return `${formatDateShort(b.startAt)} ${formatTime24(b.startAt)}`;
}
