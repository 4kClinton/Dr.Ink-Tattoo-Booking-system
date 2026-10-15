import { MAX_IMAGES_PER_TATTOO } from "@drink/shared";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requirePermission, requireStaff } from "./lib/auth";
import { audit } from "./lib/audit";
import { getConsent } from "./lib/bookingLogic";
import { fail } from "./lib/errors";

const kindV = v.union(v.literal("reference"), v.literal("final"), v.literal("healed"));
const FIELD = { reference: "referenceImages", final: "finalImages", healed: "healedImages" } as const;

/** TRD §7: generateUploadUrl → client POST → save storage id on the tattoo. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const addImages = mutation({
  args: { tattooId: v.id("tattoos"), kind: kindV, storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, { tattooId, kind, storageIds }) => {
    const staff = await requirePermission(ctx, "bookings.manage");
    const t = await ctx.db.get(tattooId);
    if (!t) fail("NOT_FOUND", "Tattoo record not found.");
    const all = t.referenceImages.length + t.finalImages.length + t.healedImages.length;
    if (all + storageIds.length > MAX_IMAGES_PER_TATTOO) {
      for (const id of storageIds) await ctx.storage.delete(id);
      fail("LIMIT_REACHED", `Up to ${MAX_IMAGES_PER_TATTOO} images per tattoo.`);
    }
    for (const id of storageIds) {
      const meta = await ctx.db.system.get(id);
      if (!meta || !meta.contentType?.startsWith("image/")) {
        await ctx.storage.delete(id);
        fail("INVALID", "Only JPEG, PNG, HEIC or WebP images.");
      }
    }
    await ctx.db.patch(tattooId, { [FIELD[kind]]: [...t[FIELD[kind]], ...storageIds] });
    await audit(ctx, staff._id, "tattoos", tattooId, `${kind}_images_added`, { count: storageIds.length });
  },
});

/** Removing an image: artist only (AU-2 — the manager never deletes records). Reference images
 *  just uploaded during booking creation are discarded client-side before they're attached. */
export const removeImage = mutation({
  args: { tattooId: v.id("tattoos"), kind: kindV, storageId: v.id("_storage") },
  handler: async (ctx, { tattooId, kind, storageId }) => {
    const staff = await requireStaff(ctx, ["artist"]);
    const t = await ctx.db.get(tattooId);
    if (!t) fail("NOT_FOUND", "Tattoo record not found.");
    await ctx.db.patch(tattooId, { [FIELD[kind]]: t[FIELD[kind]].filter((id) => id !== storageId) });
    await ctx.storage.delete(storageId);
    await audit(ctx, staff._id, "tattoos", tattooId, `${kind}_image_removed`);
  },
});

/** Discard an upload that never got attached (e.g. user removed it from the booking sheet). */
export const discardUpload = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requireStaff(ctx);
    const inUse = (await ctx.db.query("tattoos").collect()).some((t) =>
      [...t.referenceImages, ...t.finalImages, ...t.healedImages].includes(storageId),
    );
    if (!inUse) await ctx.storage.delete(storageId);
  },
});

/** T-3: portfolio-approved only when the client gave photo permission on the consent form. */
export const setPortfolioApproved = mutation({
  args: { tattooId: v.id("tattoos"), approved: v.boolean() },
  handler: async (ctx, { tattooId, approved }) => {
    const staff = await requirePermission(ctx, "bookings.manage");
    const t = await ctx.db.get(tattooId);
    if (!t) fail("NOT_FOUND", "Tattoo record not found.");
    if (approved) {
      const consent = await getConsent(ctx, t.bookingId);
      if (!consent?.photoPermission) fail("FORBIDDEN", "The client hasn't given photo permission on their consent form.");
    }
    await ctx.db.patch(tattooId, { portfolioApproved: approved });
    await audit(ctx, staff._id, "tattoos", tattooId, "portfolio", { approved });
  },
});
