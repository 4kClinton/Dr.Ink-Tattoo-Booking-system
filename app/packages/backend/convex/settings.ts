import { firstIssue, permissionsFor, settingsInputSchema, TEMPLATE_KEYS, TEMPLATES, type TemplateKey } from "@drink/shared";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentStaff, requirePermission, requireStaff } from "./lib/auth";
import { audit } from "./lib/audit";
import { fail } from "./lib/errors";
import { getSettings } from "./lib/settings";

/** Readable by all staff (manager needs deposit % for the booking sheet). */
export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const s = await getSettings(ctx);
    const terms = s.currentTermsId ? await ctx.db.get(s.currentTermsId) : null;
    return { ...s, currentTermsVersion: terms?.version ?? null };
  },
});

export const update = mutation({
  args: {
    depositPercent: v.number(),
    minDepositKes: v.optional(v.number()),
    rescheduleLimit: v.number(),
    reminderHourDayBefore: v.number(),
    artistDigestHour: v.number(),
    quietHoursStart: v.number(),
    quietHoursEnd: v.number(),
    businessWhatsapp: v.string(),
    googleReviewUrl: v.optional(v.string()),
    instagramHandle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx, ["artist"]);
    const parsed = settingsInputSchema.safeParse(args);
    if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
    const s = await ctx.db.query("settings").first();
    if (!s) fail("NOT_FOUND", "Settings missing — sign out and in again.");
    await ctx.db.patch(s._id, parsed.data);
    await audit(ctx, staff._id, "settings", s._id, "updated", parsed.data);
  },
});

// ───────────── Terms (L-1) ─────────────

export const termsList = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, ["artist"]);
    return await ctx.db.query("terms").withIndex("by_version").order("desc").collect();
  },
});

export const publishTerms = mutation({
  args: { body: v.string() },
  handler: async (ctx, { body }) => {
    const staff = await requireStaff(ctx, ["artist"]);
    if (body.trim().length < 20) fail("INVALID", "The terms look too short to publish.");
    const latest = await ctx.db.query("terms").withIndex("by_version").order("desc").first();
    const version = (latest?.version ?? 0) + 1;
    const termsId = await ctx.db.insert("terms", { version, body: body.trim(), publishedAt: Date.now(), publishedBy: staff._id });
    const s = await ctx.db.query("settings").first();
    if (s) await ctx.db.patch(s._id, { currentTermsId: termsId });
    await audit(ctx, staff._id, "terms", termsId, "published", { version });
    return version;
  },
});

// ───────────── Message templates ─────────────

export const templates = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "templates.edit");
    const rows = await ctx.db.query("messageTemplates").collect();
    return TEMPLATE_KEYS.map((key) => {
      const row = rows.find((r) => r.key === key);
      return {
        key,
        ...TEMPLATES[key],
        defaultBody: TEMPLATES[key].body,
        body: row?.body ?? TEMPLATES[key].body,
        enabled: row?.enabled ?? true,
      };
    });
  },
});

export const updateTemplate = mutation({
  args: { key: v.string(), body: v.string(), enabled: v.boolean() },
  handler: async (ctx, { key, body, enabled }) => {
    const staff = await requirePermission(ctx, "templates.edit");
    if (!(TEMPLATE_KEYS as readonly string[]).includes(key)) fail("INVALID", "Unknown template.");
    if (!body.trim()) fail("INVALID", "The message can't be empty.");
    const unknown = [...body.matchAll(/\{(\w+)\}/g)]
      .map((m) => m[1]!)
      .filter((name) => !TEMPLATES[key as TemplateKey].variables.includes(name));
    if (unknown.length) fail("INVALID", `{${unknown[0]}} isn't available in this message.`);
    const row = await ctx.db.query("messageTemplates").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (row) await ctx.db.patch(row._id, { body: body.trim(), enabled });
    else await ctx.db.insert("messageTemplates", { key, body: body.trim(), enabled });
    await audit(ctx, staff._id, "messageTemplates", key, "updated", { body, enabled });
  },
});

/** Used by the shell to decide what to render before staff record exists. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const staff = await currentStaff(ctx);
    return staff
      ? {
          _id: staff._id,
          name: staff.name,
          role: staff.role,
          email: staff.email ?? null,
          permissions: permissionsFor(staff),
          mustChangePassword: !!staff.mustChangePassword,
        }
      : null;
  },
});
