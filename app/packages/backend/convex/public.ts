import { consentInputSchema, feedbackInputSchema, firstIssue, firstName, formatDateShort, shortName, formatTime12 } from "@drink/shared";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { fail } from "./lib/errors";
import { artistFor, locationText, queueMessage } from "./lib/messaging";
import { rateLimit } from "./lib/rateLimit";
import { getSettings } from "./lib/settings";
import { tokenFor } from "./lib/tokens";

/**
 * Public, unauthenticated functions behind tokenised links (TRD §6).
 * A token only grants access to its own purpose + booking.
 * Pages show first name only — never phone, price or photos.
 */

type Purpose = Doc<"accessTokens">["purpose"];
type TokenState = "ok" | "invalid" | "expired" | "used";

async function loadToken(ctx: QueryCtx, token: string, purpose: Purpose) {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return { state: "invalid" as TokenState, row: null };
  const row = await ctx.db.query("accessTokens").withIndex("by_token", (q) => q.eq("token", token)).unique();
  if (!row || row.purpose !== purpose) return { state: "invalid" as TokenState, row: null };
  if (row.usedAt) return { state: "used" as TokenState, row };
  if (row.expiresAt < Date.now()) return { state: "expired" as TokenState, row };
  return { state: "ok" as TokenState, row };
}

async function contact(ctx: QueryCtx) {
  const s = await getSettings(ctx);
  return { whatsapp: s.businessWhatsapp, googleReviewUrl: s.googleReviewUrl ?? null, instagramHandle: s.instagramHandle ?? null };
}

export const consentContext = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const { state, row } = await loadToken(ctx, token, "consent");
    const base = { state, ...(await contact(ctx)) };
    if (!row || state === "invalid") return { ...base, session: null };
    const b = await ctx.db.get(row.bookingId);
    const c = b && (await ctx.db.get(b.clientId));
    if (!b || !c) return { ...base, state: "invalid" as TokenState, session: null };
    const termsToken = await tokenFor(ctx, b._id, "terms");
    return {
      ...base,
      state: b.status === "cancelled" ? ("expired" as TokenState) : state,
      session: {
        firstName: firstName(c.fullName),
        date: formatDateShort(b.startAt),
        time: formatTime12(b.startAt),
        weekday: formatDateShort(b.startAt).split(" ")[0],
        location: locationText(b),
        termsToken: termsToken?.token ?? null,
      },
    };
  },
});

export const submitConsent = mutation({
  args: {
    token: v.string(),
    confirmedAdult: v.boolean(),
    healthAnswers: v.any(),
    aftercareAck: v.boolean(),
    photoPermission: v.boolean(),
    dataProcessingConsent: v.boolean(),
    signatureName: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, { token, userAgent, ...input }) => {
    await rateLimit(ctx, `consent:${token}`);
    const { state, row } = await loadToken(ctx, token, "consent");
    if (state === "invalid" || !row) fail("TOKEN_INVALID", "This link isn't valid.");
    if (state === "used") fail("TOKEN_USED", "This form has already been signed.");
    if (state === "expired") fail("TOKEN_EXPIRED", "This link has expired.");
    const parsed = consentInputSchema.safeParse(input);
    if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
    const b = (await ctx.db.get(row.bookingId))!;
    const now = Date.now();
    await ctx.db.insert("consents", {
      bookingId: b._id,
      clientId: b.clientId,
      ...parsed.data,
      signedAt: now,
      userAgent: userAgent?.slice(0, 300),
    });
    await ctx.db.patch(row._id, { usedAt: now });
    await ctx.db.patch(b.clientId, { dataConsentAt: now });
    const t = await ctx.db.query("tattoos").withIndex("by_booking", (q) => q.eq("bookingId", b._id)).unique();
    if (t && !parsed.data.photoPermission && t.portfolioApproved) await ctx.db.patch(t._id, { portfolioApproved: false });
    return { ok: true };
  },
});

export const termsForToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const { state, row } = await loadToken(ctx, token, "terms");
    if (!row || state === "invalid" || state === "expired") return { state, terms: null, ...(await contact(ctx)) };
    const b = await ctx.db.get(row.bookingId);
    const terms = b && (await ctx.db.get(b.termsId));
    if (!terms) return { state: "invalid" as TokenState, terms: null, ...(await contact(ctx)) };
    return { state: "ok" as TokenState, terms: { version: terms.version, body: terms.body, publishedAt: terms.publishedAt }, ...(await contact(ctx)) };
  },
});

export const feedbackContext = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const { state, row } = await loadToken(ctx, token, "feedback");
    const base = { state, ...(await contact(ctx)) };
    if (!row || state === "invalid") return { ...base, firstName: null };
    const b = await ctx.db.get(row.bookingId);
    const c = b && (await ctx.db.get(b.clientId));
    return { ...base, firstName: c ? firstName(c.fullName) : null };
  },
});

export const submitFeedback = mutation({
  args: { token: v.string(), rating: v.number(), comment: v.optional(v.string()) },
  handler: async (ctx, { token, ...input }) => {
    await rateLimit(ctx, `feedback:${token}`);
    const { state, row } = await loadToken(ctx, token, "feedback");
    if (state === "invalid" || !row) fail("TOKEN_INVALID", "This link isn't valid.");
    if (state === "used") fail("TOKEN_USED", "Thanks — we already have your feedback.");
    if (state === "expired") fail("TOKEN_EXPIRED", "This link has expired.");
    const parsed = feedbackInputSchema.safeParse(input);
    if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
    const b = (await ctx.db.get(row.bookingId))!;
    const now = Date.now();
    await ctx.db.insert("feedback", { bookingId: b._id, clientId: b.clientId, ...parsed.data, submittedAt: now });
    await ctx.db.patch(row._id, { usedAt: now });

    // F-2: rating ≤ 3 → notify the artist
    if (parsed.data.rating <= 3) {
      const artist = await artistFor(ctx, b.artistId);
      const client = await ctx.db.get(b.clientId);
      if (artist && client) {
        await queueMessage(ctx, {
          templateKey: "low_rating_artist",
          to: artist.phone,
          recipient: "artist",
          bookingId: b._id,
          vars: {
            clientName: shortName(client.fullName),
            rating: String(parsed.data.rating),
            comment: parsed.data.comment ? `"${parsed.data.comment.slice(0, 80)}"` : "",
          },
        });
      }
    }
    return { rating: parsed.data.rating };
  },
});
