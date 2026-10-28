/**
 * + Healing check-in reminders: 7 days after a session is completed, the artist checks on the
 * client's tattoo. Derived from completed bookings (nothing to create or keep in sync — a session
 * reverted to confirmed simply drops off); the check itself is stamped on the booking.
 */
import { addDaysEAT, DAY_MS, startOfDayEAT } from "@drink/shared";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireStaff } from "./lib/auth";
import { audit } from "./lib/audit";
import { fail } from "./lib/errors";

export const HEAL_CHECK_DAYS = 7;
/** Unchecked reminders stop showing this many days after they fell due. */
const OVERDUE_WINDOW_DAYS = 21;
/** Checked reminders stay in the "Checked" list this long. */
const CHECKED_WINDOW_DAYS = 30;

const dueAtFor = (b: Doc<"bookings">) => addDaysEAT(startOfDayEAT(b.completedAt ?? b.startAt), HEAL_CHECK_DAYS);

/** Completed sessions recent enough to have a reminder in play. Completion can trail the session
 * (balance paid later), so scan sessions a generous window back and filter on the due date. */
async function recentCompleted(ctx: QueryCtx) {
  const since = Date.now() - (OVERDUE_WINDOW_DAYS + CHECKED_WINDOW_DAYS + 120) * DAY_MS;
  return ctx.db
    .query("bookings")
    .withIndex("by_status_start", (q) => q.eq("status", "completed").gte("startAt", since))
    .collect();
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const today = startOfDayEAT(Date.now());
    const bookings = (await recentCompleted(ctx)).filter((b) => {
      const due = dueAtFor(b);
      if (b.healCheckAt) return b.healCheckAt >= today - CHECKED_WINDOW_DAYS * DAY_MS;
      return due >= today - OVERDUE_WINDOW_DAYS * DAY_MS;
    });

    const clientIds = [...new Set(bookings.map((b) => b.clientId))];
    const clients = new Map(
      (await Promise.all(clientIds.map((id) => ctx.db.get(id)))).flatMap((c) => (c ? [[c._id, c] as const] : [])),
    );
    const staffIds = [...new Set(bookings.flatMap((b) => (b.healCheckBy ? [b.healCheckBy] : [])))];
    const staffName = new Map(
      (await Promise.all(staffIds.map((id) => ctx.db.get(id)))).flatMap((s) => (s ? [[s._id, s.name] as const] : [])),
    );

    const rows = bookings.map((b) => {
      const c = clients.get(b.clientId);
      return {
        bookingId: b._id,
        clientId: b.clientId,
        clientName: c?.fullName ?? "Unknown client",
        phone: c?.erasedAt ? null : c?.phone ?? null,
        sessionAt: b.startAt,
        completedAt: b.completedAt ?? b.startAt,
        tattooCount: b.tattooCount ?? 1,
        dueAt: dueAtFor(b),
        checkedAt: b.healCheckAt ?? null,
        checkedBy: b.healCheckBy ? staffName.get(b.healCheckBy) ?? null : null,
        note: b.healCheckNote ?? null,
      };
    });

    const open = rows.filter((r) => !r.checkedAt);
    return {
      due: open.filter((r) => r.dueAt <= today).sort((a, b) => a.dueAt - b.dueAt),
      upcoming: open.filter((r) => r.dueAt > today).sort((a, b) => a.dueAt - b.dueAt),
      checked: rows.filter((r) => r.checkedAt).sort((a, b) => b.checkedAt! - a.checkedAt!),
    };
  },
});

/** Count of check-ins due today or overdue — the nav badge. */
export const dueCount = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const today = startOfDayEAT(Date.now());
    return (await recentCompleted(ctx)).filter((b) => {
      if (b.healCheckAt) return false;
      const due = dueAtFor(b);
      return due <= today && due >= today - OVERDUE_WINDOW_DAYS * DAY_MS;
    }).length;
  },
});

export const markChecked = mutation({
  args: { bookingId: v.id("bookings"), note: v.optional(v.string()) },
  handler: async (ctx, { bookingId, note }) => {
    const staff = await requireStaff(ctx);
    const b = await ctx.db.get(bookingId);
    if (!b) fail("NOT_FOUND", "Booking not found.");
    if (b.status !== "completed") fail("BAD_STATUS", "Only completed sessions have a healing check-in.");
    const trimmed = note?.trim().slice(0, 500) || undefined;
    await ctx.db.patch(bookingId, { healCheckAt: Date.now(), healCheckBy: staff._id, healCheckNote: trimmed });
    await audit(ctx, staff._id, "bookings", bookingId, "heal_checked", { note: trimmed ?? null });
  },
});

export const undoChecked = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const staff = await requireStaff(ctx);
    const b = await ctx.db.get(bookingId);
    if (!b) fail("NOT_FOUND", "Booking not found.");
    await ctx.db.patch(bookingId, { healCheckAt: undefined, healCheckBy: undefined, healCheckNote: undefined });
    await audit(ctx, staff._id, "bookings", bookingId, "heal_check_undone");
  },
});
