import {
  clientInputSchema,
  firstIssue,
  formatPhone,
  leadInputSchema,
  LEAD_STATUSES,
  normalizeKenyanPhone,
} from "@drink/shared";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requirePermission, requireStaff } from "./lib/auth";
import { audit } from "./lib/audit";
import { fail } from "./lib/errors";

const statusV = v.union(...LEAD_STATUSES.map((s) => v.literal(s)));
const leadArgs = {
  name: v.optional(v.string()),
  phone: v.optional(v.string()),
  instagram: v.optional(v.string()),
  tiktok: v.optional(v.string()),
  source: v.optional(v.string()),
  note: v.optional(v.string()),
  remindAt: v.optional(v.number()),
  price: v.optional(v.number()),
  followUpAt: v.optional(v.number()),
  extras: v.optional(v.array(v.string())),
};

/** A short human name for a lead, used as the follow-up task title. */
function leadLabel(l: { name?: string; phone?: string; instagram?: string; tiktok?: string }) {
  return l.name || l.phone || (l.instagram ? `@${l.instagram}` : l.tiktok ? `@${l.tiktok}` : "lead");
}

async function row(ctx: QueryCtx, l: Doc<"leads">) {
  const images = (
    await Promise.all((l.images ?? []).map(async (id) => ({ id, url: await ctx.storage.getUrl(id) })))
  ).filter((x): x is { id: Id<"_storage">; url: string } => x.url !== null);
  return {
    _id: l._id,
    createdAt: l._creationTime,
    name: l.name ?? null,
    phone: l.phone ?? null,
    phoneDisplay: l.phone ? (l.phone.startsWith("+254") ? formatPhone(l.phone) : l.phone) : null,
    instagram: l.instagram ?? null,
    tiktok: l.tiktok ?? null,
    source: l.source ?? null,
    note: l.note ?? null,
    status: l.status,
    convertedClientId: l.convertedClientId ?? null,
    lastContactedAt: l.lastContactedAt ?? null,
    remindAt: l.remindAt ?? null,
    price: l.price ?? null,
    followUpAt: l.followUpAt ?? null,
    extras: l.extras ?? [],
    images,
  };
}

/** Pipeline list, newest first. `status: "all"` (or omitted) returns every open lead. */
export const list = query({
  args: { paginationOpts: paginationOptsValidator, status: v.optional(statusV) },
  handler: async (ctx, { paginationOpts, status }) => {
    await requireStaff(ctx);
    const page = status
      ? await ctx.db
          .query("leads")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .paginate(paginationOpts)
      : await ctx.db.query("leads").order("desc").paginate(paginationOpts);
    return { ...page, page: await Promise.all(page.page.map((l) => row(ctx, l))) };
  },
});

/** Search by name, phone or @handle. */
export const search = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    await requireStaff(ctx);
    const term = q.trim();
    if (term.length < 2) return [];
    const found = new Map<Id<"leads">, Doc<"leads">>();

    const phone = normalizeKenyanPhone(term);
    if (phone) {
      const rows = await ctx.db.query("leads").withIndex("by_phone", (x) => x.eq("phone", phone)).take(10);
      rows.forEach((l) => found.set(l._id, l));
    } else if (/^[+\d\s]{4,}$/.test(term)) {
      const digits = term.replace(/\D/g, "");
      const rows = await ctx.db.query("leads").withIndex("by_phone").collect();
      rows.filter((l) => l.phone?.replace(/\D/g, "").includes(digits)).forEach((l) => found.set(l._id, l));
    }
    const byName = await ctx.db
      .query("leads")
      .withSearchIndex("search_name", (s) => s.search("name", term))
      .take(10);
    byName.forEach((l) => found.set(l._id, l));

    return await Promise.all([...found.values()].slice(0, 20).map((l) => row(ctx, l)));
  },
});

/**
 * Open leads with a "promised to book" date in [from, to) — for the calendar. Converted and lost
 * leads drop out (they're no longer waiting to book). Returns a light day-marker shape.
 */
export const remindRange = query({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, { from, to }) => {
    await requireStaff(ctx);
    const rows = await ctx.db
      .query("leads")
      .withIndex("by_remind_at", (q) => q.gte("remindAt", from).lt("remindAt", to))
      .collect();
    return rows
      .filter((l) => l.status === "new" || l.status === "contacted")
      .map((l) => ({
        _id: l._id,
        name: l.name ?? l.phone ?? (l.instagram ? `@${l.instagram}` : l.tiktok ? `@${l.tiktok}` : "Lead"),
        remindAt: l.remindAt!,
        status: l.status,
      }));
  },
});

/** One lead, in full, for the lead profile page. Null if it doesn't exist. */
export const get = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    await requireStaff(ctx);
    const l = await ctx.db.get(leadId);
    return l ? await row(ctx, l) : null;
  },
});

/** Counts per status for the filter chips. */
export const counts = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const all = await ctx.db.query("leads").collect();
    const by: Record<string, number> = { all: all.length, new: 0, contacted: 0, converted: 0, lost: 0 };
    for (const l of all) by[l.status] = (by[l.status] ?? 0) + 1;
    return by;
  },
});

export const create = mutation({
  args: { ...leadArgs, images: v.optional(v.array(v.id("_storage"))) },
  handler: async (ctx, { images, ...input }) => {
    const staff = await requirePermission(ctx, "clients.edit");
    const parsed = leadInputSchema.safeParse(input);
    if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
    const leadId = await ctx.db.insert("leads", {
      ...parsed.data,
      images,
      status: "new",
      createdBy: staff._id,
    });
    // A follow-up date spawns a studio task due that day, linked back so edits stay in sync.
    if (parsed.data.followUpAt) {
      const taskId = await ctx.db.insert("tasks", {
        title: `Follow up with ${leadLabel(parsed.data)}`,
        due: parsed.data.followUpAt,
        done: false,
        checklist: [],
        clientIds: [],
        leadIds: [leadId],
        createdBy: staff._id,
      });
      await ctx.db.patch(leadId, { followUpTaskId: taskId });
    }
    await audit(ctx, staff._id, "leads", leadId, "created");
    return leadId;
  },
});

export const update = mutation({
  args: { leadId: v.id("leads"), ...leadArgs, images: v.optional(v.array(v.id("_storage"))) },
  handler: async (ctx, { leadId, images, ...patch }) => {
    const staff = await requirePermission(ctx, "clients.edit");
    const l = await ctx.db.get(leadId);
    if (!l) fail("NOT_FOUND", "Lead not found.");
    const merged = {
      name: l.name,
      phone: l.phone,
      instagram: l.instagram,
      tiktok: l.tiktok,
      source: l.source,
      note: l.note,
      remindAt: l.remindAt,
      price: l.price,
      followUpAt: l.followUpAt,
      extras: l.extras,
      ...patch,
    };
    const parsed = leadInputSchema.safeParse(merged);
    if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
    // Images come through whole; delete any the edit removed so storage doesn't leak. Skip this
    // for converted leads — those images are shared with the client record and must stay.
    if (images !== undefined && !l.convertedClientId) {
      const kept = new Set<string>(images);
      for (const id of l.images ?? []) if (!kept.has(id)) await ctx.storage.delete(id);
    }
    // Keep the follow-up task in step with the date: create one, re-date the existing one, or
    // drop it when the date is cleared (leaving it alone if it's already been ticked done).
    let followUpTaskId = l.followUpTaskId;
    if (parsed.data.followUpAt) {
      const existing = followUpTaskId ? await ctx.db.get(followUpTaskId) : null;
      if (existing) {
        // Re-date, and backfill the lead link for tasks created before leadIds existed.
        await ctx.db.patch(existing._id, {
          due: parsed.data.followUpAt,
          leadIds: existing.leadIds?.includes(leadId) ? existing.leadIds : [...(existing.leadIds ?? []), leadId],
        });
      } else {
        followUpTaskId = await ctx.db.insert("tasks", {
          title: `Follow up with ${leadLabel(parsed.data)}`,
          due: parsed.data.followUpAt,
          done: false,
          checklist: [],
          clientIds: l.convertedClientId ? [l.convertedClientId] : [],
          leadIds: [leadId],
          createdBy: staff._id,
        });
      }
    } else if (followUpTaskId) {
      const existing = await ctx.db.get(followUpTaskId);
      if (existing && !existing.done) await ctx.db.delete(followUpTaskId);
      followUpTaskId = undefined;
    }
    await ctx.db.patch(leadId, {
      ...parsed.data,
      ...(images !== undefined ? { images } : {}),
      followUpTaskId,
    });
    await audit(ctx, staff._id, "leads", leadId, "updated", patch);
  },
});

export const setStatus = mutation({
  args: { leadId: v.id("leads"), status: statusV },
  handler: async (ctx, { leadId, status }) => {
    const staff = await requirePermission(ctx, "clients.edit");
    const l = await ctx.db.get(leadId);
    if (!l) fail("NOT_FOUND", "Lead not found.");
    await ctx.db.patch(leadId, {
      status,
      ...(status === "contacted" ? { lastContactedAt: Date.now() } : {}),
    });
    await audit(ctx, staff._id, "leads", leadId, "status", { status });
  },
});

/**
 * Turn a lead into a real client. Needs a full name and a valid Kenyan mobile — the same
 * rules as adding a client directly. Marks the lead converted and links the new client.
 */
export const convert = mutation({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    const staff = await requirePermission(ctx, "clients.edit");
    const l = await ctx.db.get(leadId);
    if (!l) fail("NOT_FOUND", "Lead not found.");
    if (l.convertedClientId) return l.convertedClientId;

    const parsed = clientInputSchema.safeParse({
      fullName: l.name ?? "",
      phone: l.phone ?? "",
      instagram: l.instagram ?? "",
      notes: l.note ?? "",
    });
    if (!parsed.success) {
      fail("INVALID", `Add a full name and a valid phone before converting — ${firstIssue(parsed.error).toLowerCase()}`);
    }
    const clash = await ctx.db
      .query("clients")
      .withIndex("by_phone", (q) => q.eq("phone", parsed.data.phone))
      .unique();
    const leadImages = l.images ?? [];
    let clientId: Id<"clients">;
    if (clash) {
      clientId = clash._id;
      // Merge the lead's images into the existing client, skipping any duplicates.
      if (leadImages.length) {
        const have = new Set<string>(clash.images ?? []);
        const merged = [...(clash.images ?? []), ...leadImages.filter((id) => !have.has(id))];
        await ctx.db.patch(clientId, { images: merged });
      }
    } else {
      clientId = await ctx.db.insert("clients", {
        ...parsed.data,
        images: leadImages.length ? leadImages : undefined,
        marketingOptOut: false,
        archived: false,
        sessionCount: 0,
      });
    }
    await ctx.db.patch(leadId, { status: "converted", convertedClientId: clientId });
    // Point any open follow-up task at the new client so it shows up on their record.
    if (l.followUpTaskId) {
      const task = await ctx.db.get(l.followUpTaskId);
      if (task && !task.clientIds.includes(clientId)) {
        await ctx.db.patch(task._id, { clientIds: [...task.clientIds, clientId] });
      }
    }
    await audit(ctx, staff._id, "leads", leadId, "converted", { clientId, existing: !!clash });
    return clientId;
  },
});

export const remove = mutation({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    const staff = await requirePermission(ctx, "clients.edit");
    const l = await ctx.db.get(leadId);
    if (!l) return;
    // Converted leads share their images with the client record — leave that storage alone.
    if (!l.convertedClientId) for (const id of l.images ?? []) await ctx.storage.delete(id);
    // Drop the spawned follow-up task unless it's already been ticked done.
    if (l.followUpTaskId) {
      const task = await ctx.db.get(l.followUpTaskId);
      if (task && !task.done) await ctx.db.delete(l.followUpTaskId);
    }
    await ctx.db.delete(leadId);
    await audit(ctx, staff._id, "leads", leadId, "deleted");
  },
});
