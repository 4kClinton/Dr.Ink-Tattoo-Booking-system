import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { publicBaseUrl } from "./settings";

type Purpose = Doc<"accessTokens">["purpose"];
const PATH: Record<Purpose, string> = { consent: "c", terms: "t", feedback: "f" };

/** 32 random bytes, base64url (~43 chars). Never sequential IDs (TRD §6). */
export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createToken(
  ctx: MutationCtx,
  purpose: Purpose,
  bookingId: Id<"bookings">,
  expiresAt: number,
): Promise<string> {
  const token = randomToken();
  await ctx.db.insert("accessTokens", { token, purpose, bookingId, expiresAt });
  return token;
}

export async function tokenFor(ctx: QueryCtx, bookingId: Id<"bookings">, purpose: Purpose) {
  const all = await ctx.db
    .query("accessTokens")
    .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
    .collect();
  return all.filter((t) => t.purpose === purpose).sort((a, b) => b._creationTime - a._creationTime)[0] ?? null;
}

export function tokenUrl(purpose: Purpose, token: string): string {
  return `${publicBaseUrl()}/${PATH[purpose]}/${token}`;
}
