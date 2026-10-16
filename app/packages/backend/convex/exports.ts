import { dateKeyEAT, EXPENSE_CATEGORY_LABEL, type ExpenseCategory, formatTime24 } from "@drink/shared";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./lib/auth";

/** R-6 — artist only. Returns rows; the browser turns them into CSV. */
export const rows = query({
  args: { kind: v.union(v.literal("clients"), v.literal("bookings"), v.literal("payments"), v.literal("expenses")) },
  handler: async (ctx, { kind }) => {
    await requirePermission(ctx, "exports.csv");
    if (kind === "expenses") {
      const staff = await ctx.db.query("staff").collect();
      const staffName = new Map(staff.map((s) => [s._id, s.name]));
      const expenses = await ctx.db.query("expenses").withIndex("by_incurred_at").order("desc").collect();
      return expenses.map((e) => ({
        id: e._id,
        date: dateKeyEAT(e.incurredAt),
        category: EXPENSE_CATEGORY_LABEL[e.category as ExpenseCategory] ?? e.category,
        amount_kes: e.amountKes,
        method: e.method ?? "",
        vendor: e.vendor ?? "",
        note: e.note ?? "",
        recorded_by: staffName.get(e.recordedBy) ?? "",
      }));
    }
    const clients = await ctx.db.query("clients").collect();
    const clientName = new Map(clients.map((c) => [c._id, c.fullName]));
    if (kind === "clients") {
      return clients.map((c) => ({
        id: c._id,
        name: c.fullName,
        phone: c.phone,
        email: c.email ?? "",
        instagram: c.instagram ?? "",
        date_of_birth: c.dateOfBirth ?? "",
        sessions: c.sessionCount ?? 0,
        last_visit: c.lastVisitAt ? dateKeyEAT(c.lastVisitAt) : "",
        flagged: c.flagged ?? "",
        marketing_opt_out: c.marketingOptOut ? "yes" : "no",
        archived: c.archived ? "yes" : "no",
      }));
    }
    if (kind === "bookings") {
      const bookings = await ctx.db.query("bookings").withIndex("by_start").collect();
      return bookings.map((b) => ({
        id: b._id,
        date: dateKeyEAT(b.startAt),
        time: formatTime24(b.startAt),
        duration_min: b.durationMin,
        client: clientName.get(b.clientId) ?? "",
        location: b.location,
        status: b.status,
        source: b.source ?? "",
        quoted_kes: b.quotedPriceKes,
        final_kes: b.finalPriceKes,
        expected_expenses_kes: b.expectedExpensesKes ?? "",
        deposit_pct: b.depositPercent,
        deposit_required_kes: b.depositRequiredKes,
        paid_kes: b.paidTotalKes,
        balance_kes: Math.max(0, b.finalPriceKes - b.paidTotalKes),
        reschedules: b.rescheduleCount,
        deposit_outcome: b.depositOutcome ?? "",
        cancel_reason: b.cancelReason ?? "",
      }));
    }
    const payments = await ctx.db.query("payments").withIndex("by_paid_at").collect();
    return payments.map((p) => ({
      id: p._id,
      date: dateKeyEAT(p.paidAt),
      time: formatTime24(p.paidAt),
      booking_id: p.bookingId,
      client: clientName.get(p.clientId) ?? "",
      type: p.type,
      method: p.method,
      amount_kes: p.amountKes,
      mpesa_code: p.mpesaCode ?? "",
      payer_name: p.payerName ?? "",
      payer_phone: p.payerPhone ?? "",
      reverses: p.reversesPaymentId ?? "",
      note: p.note ?? "",
    }));
  },
});
