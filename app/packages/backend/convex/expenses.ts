/**
 * R-7 — studio expenses. Gated by `expenses.manage` (artist always has it).
 * Money = integer KES; `incurredAt` is epoch ms. The cost side of the profit figures in reports.ts.
 */
import { EXPENSE_CATEGORY_LABEL, type ExpenseCategory, expenseInputSchema, firstIssue } from "@drink/shared";
import { v } from "convex/values";
import { methodV } from "./schema";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { audit } from "./lib/audit";
import { fail } from "./lib/errors";

const expenseArgV = {
  category: v.string(),
  amountKes: v.number(),
  incurredAt: v.number(),
  vendor: v.optional(v.string()),
  note: v.optional(v.string()),
  method: v.optional(methodV),
};

/** List expenses in [from, to) with a total and per-category breakdown. */
export const list = query({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, { from, to }) => {
    await requirePermission(ctx, "expenses.manage");
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_incurred_at", (q) => q.gte("incurredAt", from).lt("incurredAt", to))
      .order("desc")
      .collect();
    const staff = await ctx.db.query("staff").collect();
    const staffName = new Map(staff.map((s) => [s._id, s.name]));

    // Resolve the client behind any booking-linked (session) expenses for display.
    const bookingIds = [...new Set(expenses.flatMap((e) => (e.bookingId ? [e.bookingId] : [])))];
    const bookings = await Promise.all(bookingIds.map((id) => ctx.db.get(id)));
    const clientIdByBooking = new Map(bookings.flatMap((b) => (b ? [[b._id, b.clientId] as const] : [])));
    const clients = await Promise.all([...new Set(clientIdByBooking.values())].map((id) => ctx.db.get(id)));
    const clientName = new Map(clients.flatMap((c) => (c ? [[c._id, c.fullName] as const] : [])));
    const linkedClientFor = (bookingId: typeof bookingIds[number] | undefined) => {
      if (!bookingId) return null;
      const cid = clientIdByBooking.get(bookingId);
      return cid ? clientName.get(cid) ?? null : null;
    };

    const total = expenses.reduce((s, e) => s + e.amountKes, 0);
    const byCategory = Object.entries(
      expenses.reduce<Record<string, number>>((acc, e) => {
        acc[e.category] = (acc[e.category] ?? 0) + e.amountKes;
        return acc;
      }, {}),
    )
      .map(([key, amountKes]) => ({ key, label: EXPENSE_CATEGORY_LABEL[key as ExpenseCategory] ?? key, amountKes }))
      .sort((a, b) => b.amountKes - a.amountKes);

    return {
      total,
      byCategory,
      rows: expenses.map((e) => ({
        _id: e._id,
        category: e.category,
        categoryLabel: EXPENSE_CATEGORY_LABEL[e.category as ExpenseCategory] ?? e.category,
        amountKes: e.amountKes,
        incurredAt: e.incurredAt,
        vendor: e.vendor ?? null,
        note: e.note ?? null,
        method: e.method ?? null,
        recordedBy: staffName.get(e.recordedBy) ?? "",
        bookingId: e.bookingId ?? null,
        linkedClient: linkedClientFor(e.bookingId),
      })),
    };
  },
});

export const create = mutation({
  args: expenseArgV,
  handler: async (ctx, args) => {
    const staff = await requirePermission(ctx, "expenses.manage");
    const parsed = expenseInputSchema.safeParse(args);
    if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
    const id = await ctx.db.insert("expenses", { ...parsed.data, recordedBy: staff._id });
    await audit(ctx, staff._id, "expenses", id, "created", { category: args.category, amountKes: args.amountKes });
    return id;
  },
});

export const update = mutation({
  args: { expenseId: v.id("expenses"), ...expenseArgV },
  handler: async (ctx, { expenseId, ...args }) => {
    const staff = await requirePermission(ctx, "expenses.manage");
    const existing = await ctx.db.get(expenseId);
    if (!existing) fail("NOT_FOUND", "Expense not found.");
    const parsed = expenseInputSchema.safeParse(args);
    if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
    await ctx.db.patch(expenseId, {
      category: parsed.data.category,
      amountKes: parsed.data.amountKes,
      incurredAt: parsed.data.incurredAt,
      vendor: parsed.data.vendor,
      note: parsed.data.note,
      method: parsed.data.method,
    });
    await audit(ctx, staff._id, "expenses", expenseId, "updated", { amountKes: args.amountKes });
  },
});

export const remove = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, { expenseId }) => {
    const staff = await requirePermission(ctx, "expenses.manage");
    const existing = await ctx.db.get(expenseId);
    if (!existing) fail("NOT_FOUND", "Expense not found.");
    await ctx.db.delete(expenseId);
    await audit(ctx, staff._id, "expenses", expenseId, "deleted", { category: existing.category, amountKes: existing.amountKes });
  },
});
