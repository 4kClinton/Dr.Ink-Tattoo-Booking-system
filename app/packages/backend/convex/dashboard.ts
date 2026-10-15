import { addDaysEAT, endOf, shortName, startOfDayEAT, TEMPLATES, toEAT, type TemplateKey } from "@drink/shared";
import { query } from "./_generated/server";
import { bookingSummary } from "./bookings";
import { can, requireStaff } from "./lib/auth";
import { getConsent } from "./lib/bookingLogic";

/**
 * R-1 Today view + the manager's "Attention" inbox:
 * failed SMS, past sessions still `confirmed`, missing consent for tomorrow.
 */
export const today = query({
  args: {},
  handler: async (ctx) => {
    const staff = await requireStaff(ctx);
    const now = Date.now();
    const dayStart = startOfDayEAT(now);
    const tomorrow = addDaysEAT(dayStart, 1);
    const dayAfter = addDaysEAT(dayStart, 2);

    const todays = await ctx.db
      .query("bookings")
      .withIndex("by_start", (q) => q.gte("startAt", dayStart).lt("startAt", tomorrow))
      .collect();
    const sessions = await Promise.all(
      todays.filter((b) => b.status !== "cancelled").sort((a, b) => a.startAt - b.startAt).map((b) => bookingSummary(ctx, b)),
    );
    const current = sessions.find((s) => s.status === "confirmed" && s.endAt > now) ?? null;

    // Attention
    const failed = await ctx.db.query("messages").withIndex("by_status", (q) => q.eq("status", "failed")).collect();
    const failedRows = await Promise.all(
      failed
        .filter((m) => !m.resentAt)
        .slice(0, 20)
        .map(async (m) => {
          const c = m.clientId ? await ctx.db.get(m.clientId) : null;
          return {
            messageId: m._id,
            bookingId: m.bookingId ?? null,
            who: c ? shortName(c.fullName) : m.recipient === "artist" ? "You" : m.to,
            label: TEMPLATES[m.templateKey as TemplateKey]?.label.split(" — ")[0] ?? m.templateKey,
            error: m.error ?? null,
          };
        }),
    );
    const unclosed = (
      await ctx.db
        .query("bookings")
        .withIndex("by_status_start", (q) => q.eq("status", "confirmed").lt("startAt", now))
        .collect()
    ).filter((b) => endOf(b) < now);
    const tomorrowRows = await ctx.db
      .query("bookings")
      .withIndex("by_status_start", (q) => q.eq("status", "confirmed").gte("startAt", tomorrow).lt("startAt", dayAfter))
      .collect();
    const missingConsentTomorrow = [];
    for (const b of tomorrowRows) {
      if (!(await getConsent(ctx, b._id))) {
        const c = await ctx.db.get(b.clientId);
        missingConsentTomorrow.push({ bookingId: b._id, clientName: c ? shortName(c.fullName) : "", startAt: b.startAt });
      }
    }
    const unsettled =
      staff.role === "artist"
        ? (await ctx.db.query("bookings").withIndex("by_status_start", (q) => q.eq("status", "cancelled")).collect())
            .filter((b) => b.depositOutcome === "pending")
            .map((b) => ({ bookingId: b._id, startAt: b.startAt }))
        : [];

    // Week summary (needs reports access): Mon–Sun containing today
    let week = null;
    if (can(staff, "reports.view")) {
      const wd = toEAT(now).weekday; // 0=Sun
      const weekStart = addDaysEAT(dayStart, -((wd + 6) % 7));
      const weekEnd = addDaysEAT(weekStart, 7);
      const rows = (
        await ctx.db.query("bookings").withIndex("by_start", (q) => q.gte("startAt", weekStart).lt("startAt", weekEnd)).collect()
      ).filter((b) => b.status === "confirmed" || b.status === "completed");
      week = { sessions: rows.length, bookedKes: rows.reduce((s, b) => s + b.finalPriceKes, 0) };
    }

    return {
      role: staff.role,
      name: staff.name,
      now,
      sessions,
      currentId: current?._id ?? null,
      attention: {
        failed: failedRows,
        unclosed: unclosed.map((b) => ({ bookingId: b._id, startAt: b.startAt })),
        missingConsentTomorrow,
        unsettledDeposits: unsettled,
      },
      week,
    };
  },
});
