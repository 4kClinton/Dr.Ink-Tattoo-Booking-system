import { addDaysEAT, dateKeyEAT, LOCATION_LABEL, SOURCES, startOfDayEAT, toEAT } from "@drink/shared";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./lib/auth";

/** R-3/R-4/R-5 — artist only. Period is [from, to) in epoch ms. */
export const summary = query({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, { from, to }) => {
    await requirePermission(ctx, "reports.view");
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_paid_at", (q) => q.gte("paidAt", from).lt("paidAt", to))
      .collect();
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_start", (q) => q.gte("startAt", from).lt("startAt", to))
      .collect();

    const deposits = payments.filter((p) => p.type === "deposit").reduce((s, p) => s + p.amountKes, 0);
    const balances = payments.filter((p) => p.type === "balance").reduce((s, p) => s + p.amountKes, 0);
    const reversals = payments.filter((p) => p.type === "reversal").reduce((s, p) => s + p.amountKes, 0);
    const collected = deposits + balances + reversals;

    const confirmed = bookings.filter((b) => b.status === "confirmed");
    const completed = bookings.filter((b) => b.status === "completed");
    const noShows = bookings.filter((b) => b.status === "no_show");
    const cancelled = bookings.filter((b) => b.status === "cancelled");
    const outstanding = confirmed.reduce((s, b) => s + Math.max(0, b.finalPriceKes - b.paidTotalKes), 0);
    const attended = completed.length + noShows.length;
    const retained = [...noShows, ...cancelled]
      .filter((b) => b.depositOutcome === "forfeited")
      .reduce((s, b) => s + Math.min(b.paidTotalKes, b.depositRequiredKes), 0);

    // Weekly series (Mon-start weeks overlapping the period)
    const weeks: { weekStart: number; label: string; deposits: number; balances: number }[] = [];
    const firstWd = toEAT(from).weekday;
    let ws = addDaysEAT(startOfDayEAT(from), -((firstWd + 6) % 7));
    while (ws < to && weeks.length < 60) {
      const we = addDaysEAT(ws, 7);
      const inWeek = payments.filter((p) => p.paidAt >= ws && p.paidAt < we);
      weeks.push({
        weekStart: ws,
        label: dateKeyEAT(ws),
        deposits: inWeek.filter((p) => p.type === "deposit").reduce((s, p) => s + p.amountKes, 0),
        balances: inWeek.filter((p) => p.type !== "deposit").reduce((s, p) => s + p.amountKes, 0),
      });
      ws = we;
    }

    const live = bookings.filter((b) => b.status !== "cancelled");
    const byLocation = Object.entries(LOCATION_LABEL).map(([key, label]) => {
      const rows = live.filter((b) => b.location === key);
      return { key, label, sessions: rows.length, valueKes: rows.reduce((s, b) => s + b.finalPriceKes, 0) };
    });
    const bySource = [...SOURCES.map((s) => ({ key: s.value as string, label: s.label as string })), { key: "", label: "Not set" }]
      .map(({ key, label }) => {
        const rows = live.filter((b) => (b.source ?? "") === key);
        return { key, label, sessions: rows.length, valueKes: rows.reduce((s, b) => s + b.finalPriceKes, 0) };
      })
      .filter((r) => r.sessions > 0);

    return {
      collected,
      deposits,
      balances,
      reversals,
      outstanding,
      sessionsCompleted: completed.length,
      sessionsBooked: live.length,
      noShowRate: attended ? noShows.length / attended : 0,
      noShows: noShows.length,
      cancellations: cancelled.length,
      cancellationRate: bookings.length ? cancelled.length / bookings.length : 0,
      depositsRetained: retained,
      weeks,
      byLocation,
      bySource,
    };
  },
});
