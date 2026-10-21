import { firstIssue, promoInputSchema } from "@drink/shared";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireStaff } from "./lib/auth";
import { audit } from "./lib/audit";
import { fail } from "./lib/errors";

const promoArgs = {
  title: v.string(),
  priceKes: v.optional(v.number()),
  details: v.optional(v.string()),
  active: v.optional(v.boolean()),
};

async function row(ctx: QueryCtx, p: Doc<"promos">) {
  return {
    _id: p._id,
    createdAt: p._creationTime,
    title: p.title,
    priceKes: p.priceKes ?? null,
    details: p.details ?? null,
    active: p.active,
    imageUrl: p.image ? await ctx.storage.getUrl(p.image) : null,
  };
}
export type PromoRow = Awaited<ReturnType<typeof row>>;

/** All offers, active first, then newest. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("promos").collect();
    rows.sort((a, b) => Number(b.active) - Number(a.active) || b._creationTime - a._creationTime);
    return await Promise.all(rows.map((p) => row(ctx, p)));
  },
});

/** Upload URL for a promo flyer image. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: { ...promoArgs, image: v.optional(v.id("_storage")) },
  handler: async (ctx, { image, ...input }) => {
    const staff = await requireStaff(ctx);
    const parsed = promoInputSchema.safeParse(input);
    if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
    const promoId = await ctx.db.insert("promos", {
      title: parsed.data.title,
      priceKes: parsed.data.priceKes,
      details: parsed.data.details,
      active: parsed.data.active ?? true,
      image,
      createdBy: staff._id,
    });
    await audit(ctx, staff._id, "promos", promoId, "created");
    return promoId;
  },
});

export const update = mutation({
  args: { promoId: v.id("promos"), ...promoArgs, image: v.optional(v.union(v.id("_storage"), v.null())) },
  handler: async (ctx, { promoId, image, ...input }) => {
    const staff = await requireStaff(ctx);
    const p = await ctx.db.get(promoId);
    if (!p) fail("NOT_FOUND", "Offer not found.");
    const parsed = promoInputSchema.safeParse({
      title: input.title ?? p.title,
      priceKes: input.priceKes ?? p.priceKes,
      details: input.details ?? p.details,
      active: input.active ?? p.active,
    });
    if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
    // image: undefined = leave as-is, null = clear, id = replace (deleting the old file either way).
    if (image !== undefined && p.image && p.image !== image) await ctx.storage.delete(p.image);
    await ctx.db.patch(promoId, {
      title: parsed.data.title,
      priceKes: parsed.data.priceKes,
      details: parsed.data.details,
      active: parsed.data.active ?? true,
      ...(image !== undefined ? { image: image ?? undefined } : {}),
    });
    await audit(ctx, staff._id, "promos", promoId, "updated");
  },
});

/** Quick active/paused toggle from the list. */
export const setActive = mutation({
  args: { promoId: v.id("promos"), active: v.boolean() },
  handler: async (ctx, { promoId, active }) => {
    const staff = await requireStaff(ctx);
    const p = await ctx.db.get(promoId);
    if (!p) fail("NOT_FOUND", "Offer not found.");
    await ctx.db.patch(promoId, { active });
    await audit(ctx, staff._id, "promos", promoId, active ? "activated" : "paused");
  },
});

export const remove = mutation({
  args: { promoId: v.id("promos") },
  handler: async (ctx, { promoId }) => {
    const staff = await requireStaff(ctx);
    const p = await ctx.db.get(promoId);
    if (!p) return;
    if (p.image) await ctx.storage.delete(p.image);
    await ctx.db.delete(promoId);
    await audit(ctx, staff._id, "promos", promoId, "deleted");
  },
});
