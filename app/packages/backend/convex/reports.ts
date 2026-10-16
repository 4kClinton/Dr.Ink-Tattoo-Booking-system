import {
  addDaysEAT, dateKeyEAT, EXPENSE_CATEGORY_LABEL, type ExpenseCategory,
  LOCATION_LABEL, SOURCES, startOfDayEAT, toEAT,
} from "@drink/shared";
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
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_incurred_at", (q) => q.gte("incurredAt", from).lt("incurredAt", to))
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

    // Profitability (cash basis): revenue collected this period minus expenses incurred this period.
    const expensesTotal = expenses.reduce((s, e) => s + e.amountKes, 0);
    const expensesByCategory = Object.entries(
      expenses.reduce<Record<string, number>>((acc, e) => {
        acc[e.category] = (acc[e.category] ?? 0) + e.amountKes;
        return acc;
      }, {}),
    )
      .map(([key, amountKes]) => ({ key, label: EXPENSE_CATEGORY_LABEL[key as ExpenseCategory] ?? key, amountKes }))
      .sort((a, b) => b.amountKes - a.amountKes);
    const netProfit = collected - expensesTotal;
    const profitMargin = collected > 0 ? netProfit / collected : 0;

    // Per-session economics over completed sessions in the period.
    const completedValue = completed.reduce((s, b) => s + b.finalPriceKes, 0);
    const completedMinutes = completed.reduce((s, b) => s + b.durationMin, 0);
    const avgOrderValue = completed.length ? Math.round(completedValue / completed.length) : 0;
    const revenuePerHour = completedMinutes ? Math.round(completedValue / (completedMinutes / 60)) : 0;

    // New clients = client records created within the period.
    const allClients = await ctx.db.query("clients").collect();
    const newClients = allClients.filter((c) => !c.archived && c._creationTime >= from && c._creationTime < to).length;

    return {
      collected,
      deposits,
      balances,
      reversals,
      outstanding,
      expensesTotal,
      expensesByCategory,
      netProfit,
      profitMargin,
      avgOrderValue,
      revenuePerHour,
      newClients,
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

/**
 * Lifetime (all-time) client economics — independent of the period selector.
 * LTV = average revenue collected per paying client; plus repeat rate and avg sessions per client.
 */
export const lifetime = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "reports.view");
    const payments = await ctx.db.query("payments").withIndex("by_paid_at").collect();
    const completed = await ctx.db
      .query("bookings")
      .withIndex("by_status_start", (q) => q.eq("status", "completed"))
      .collect();

    const collectedAllTime = payments.reduce((s, p) => s + p.amountKes, 0);
    const payingClients = new Set(payments.filter((p) => p.amountKes > 0).map((p) => String(p.clientId)));

    const sessionsByClient = new Map<string, number>();
    for (const b of completed) {
      const k = String(b.clientId);
      sessionsByClient.set(k, (sessionsByClient.get(k) ?? 0) + 1);
    }
    const clientsWithSession = sessionsByClient.size;
    const repeatClients = [...sessionsByClient.values()].filter((n) => n >= 2).length;

    return {
      ltv: payingClients.size ? Math.round(collectedAllTime / payingClients.size) : 0,
      avgSessionsPerClient: clientsWithSession ? completed.length / clientsWithSession : 0,
      repeatRate: clientsWithSession ? repeatClients / clientsWithSession : 0,
      payingClients: payingClients.size,
      clientsWithSession,
      repeatClients,
      collectedAllTime,
    };
  },
});
