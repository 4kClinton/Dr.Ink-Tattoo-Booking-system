import { formatKes } from "@drink/shared";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission, requireStaff } from "./lib/auth";
import { audit } from "./lib/audit";
import { evaluateCompletion, recomputePaid, revertCompletion } from "./lib/bookingLogic";
import { fail } from "./lib/errors";
import { findMpesaCode, insertPayment, paymentArgV } from "./lib/payments";

/** Instant duplicate check while the manager pastes (Step 4 / record payment sheet). */
export const checkMpesaCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    await requireStaff(ctx);
    if (code.trim().length !== 10) return null;
    return await findMpesaCode(ctx, code);
  },
});

/**
 * P-1/P-2/P-6: record a balance payment. If it clears the balance on the session day,
 * the booking completes and M-6/M-7/M-8 are scheduled — in the same transaction.
 */
export const record = mutation({
  args: { bookingId: v.id("bookings"), payment: paymentArgV },
  handler: async (ctx, args) => {
    const staff = await requirePermission(ctx, "payments.record");
    const b = await ctx.db.get(args.bookingId);
    if (!b) fail("NOT_FOUND", "Booking not found.");
    if (b.status !== "confirmed") fail("BAD_STATUS", "Payments can only be recorded on confirmed bookings.");
    const paymentId = await insertPayment(ctx, staff, { bookingId: b._id, clientId: b.clientId }, args.payment, "balance");
    const paidTotalKes = await recomputePaid(ctx, b._id);
    await audit(ctx, staff._id, "payments", paymentId, "recorded", {
      bookingId: b._id,
      amountKes: args.payment.amountKes,
      method: args.payment.method,
      mpesaCode: args.payment.mpesaCode?.toUpperCase(),
    });
    const completed = await evaluateCompletion(ctx, b._id, staff._id);
    return { paymentId, paidTotalKes, completed, balanceKes: Math.max(0, b.finalPriceKes - paidTotalKes) };
  },
});

/** P-7: payments are immutable; corrections are reversing entries (artist only). */
export const reverse = mutation({
  args: { paymentId: v.id("payments"), reason: v.string() },
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx, ["artist"]);
    const p = await ctx.db.get(args.paymentId);
    if (!p) fail("NOT_FOUND", "Payment not found.");
    if (p.type === "reversal") fail("INVALID", "A reversal can't be reversed. Record a new payment instead.");
    if (p.reversedAt) fail("INVALID", "This payment has already been reversed.");
    const reason = args.reason.trim();
    if (reason.length < 3) fail("INVALID", "Add a reason for the reversal.");
    const id = await ctx.db.insert("payments", {
      bookingId: p.bookingId,
      clientId: p.clientId,
      type: "reversal",
      method: p.method,
      amountKes: -p.amountKes,
      paidAt: Date.now(),
      recordedBy: staff._id,
      reversesPaymentId: p._id,
      note: reason,
    });
    await ctx.db.patch(p._id, { reversedAt: Date.now() });
    if (p.bookingId) {
      await recomputePaid(ctx, p.bookingId);
      await revertCompletion(ctx, p.bookingId, staff._id);
    }
    await audit(ctx, staff._id, "payments", p._id, "reversed", { reversalId: id, amountKes: p.amountKes, reason });
    return { message: `Reversed ${formatKes(p.amountKes)}` };
  },
});
