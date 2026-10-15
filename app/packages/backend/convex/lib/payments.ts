import { firstIssue, formatDateShort, normalizeMpesaCode, paymentInputSchema, shortName } from "@drink/shared";
import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { methodV } from "../schema";
import { fail } from "./errors";

export const paymentArgV = v.object({
  method: methodV,
  amountKes: v.number(),
  mpesaCode: v.optional(v.string()),
  mpesaRawMessage: v.optional(v.string()),
  payerName: v.optional(v.string()),
  payerPhone: v.optional(v.string()),
  paidAt: v.optional(v.number()),
});
export type PaymentArg = Infer<typeof paymentArgV>;

/** Who already used this code? null if free. Codes are unique across the system (P-2). */
export async function findMpesaCode(ctx: QueryCtx, code: string) {
  const existing = await ctx.db
    .query("payments")
    .withIndex("by_mpesa_code", (q) => q.eq("mpesaCode", normalizeMpesaCode(code)))
    .first();
  if (!existing) return null;
  const booking = await ctx.db.get(existing.bookingId);
  const client = await ctx.db.get(existing.clientId);
  return {
    paymentId: existing._id,
    bookingId: existing.bookingId,
    clientName: client ? shortName(client.fullName) : "another client",
    bookingDate: booking ? formatDateShort(booking.startAt) : "",
  };
}

export function validatePayment(input: PaymentArg) {
  const parsed = paymentInputSchema.safeParse(input);
  if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
  return parsed.data;
}

export async function insertPayment(
  ctx: MutationCtx,
  staff: Doc<"staff">,
  booking: Pick<Doc<"bookings">, "_id" | "clientId">,
  input: PaymentArg,
  type: "deposit" | "balance",
): Promise<Id<"payments">> {
  const p = validatePayment(input);
  let mpesaCode: string | undefined;
  if (p.method === "mpesa") {
    mpesaCode = normalizeMpesaCode(p.mpesaCode!);
    const used = await findMpesaCode(ctx, mpesaCode);
    if (used) {
      fail(
        "MPESA_CODE_USED",
        `This M-Pesa code is already recorded on ${used.clientName}'s booking (${used.bookingDate}).`,
        { bookingId: used.bookingId },
      );
    }
  }
  return await ctx.db.insert("payments", {
    bookingId: booking._id,
    clientId: booking.clientId,
    type,
    method: p.method,
    amountKes: p.amountKes,
    mpesaCode,
    mpesaRawMessage: p.method === "mpesa" ? p.mpesaRawMessage : undefined,
    payerName: p.payerName,
    payerPhone: p.payerPhone,
    paidAt: p.paidAt ?? Date.now(),
    recordedBy: staff._id,
  });
}
