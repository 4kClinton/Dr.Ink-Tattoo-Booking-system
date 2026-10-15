import { addDaysEAT, dateKeyEAT, minutesOfDayEAT, startOfDayEAT, toEAT } from "@drink/shared";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission, requireStaff } from "./lib/auth";
import { audit } from "./lib/audit";
import { fail } from "./lib/errors";

/** A-1/A-2/A-3. All staff can read (calendar shading, booking defaults); only the artist edits. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("availability").collect();
    return {
      weekly: rows.filter((r) => r.kind === "weekly").sort((a, b) => (a.weekday ?? 0) - (b.weekday ?? 0)),
      blocks: rows.filter((r) => r.kind === "block").sort((a, b) => (a.from ?? 0) - (b.from ?? 0)),
      tours: rows.filter((r) => r.kind === "tour").sort((a, b) => (a.from ?? 0) - (b.from ?? 0)),
    };
  },
});

/** Warnings for a proposed slot: outside hours, blocked day, and the tour location default. */
export const checkSlot = query({
  args: { startAt: v.number(), durationMin: v.number() },
  handler: async (ctx, { startAt, durationMin }) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("availability").collect();
    const endAt = startAt + durationMin * 60_000;
    const { weekday } = toEAT(startAt);
    const startMin = minutesOfDayEAT(startAt);
    const endMin = startMin + durationMin;
    const weekly = rows.filter((r) => r.kind === "weekly" && r.weekday === weekday);
    const warnings: string[] = [];
    if (rows.some((r) => r.kind === "weekly")) {
      const inside = weekly.some((w) => startMin >= (w.startMin ?? 0) && endMin <= (w.endMin ?? 1440));
      if (!inside) warnings.push(weekly.length ? "Outside working hours." : "This is a day off.");
    }
    const block = rows.find((r) => r.kind === "block" && (r.from ?? 0) < endAt && startAt < (r.to ?? 0));
    if (block) warnings.push(`Blocked: ${block.note || "Off"}.`);
    const tour = rows.find((r) => r.kind === "tour" && (r.from ?? 0) <= startAt && startAt < (r.to ?? 0));
    return { warnings, tourLocation: tour?.location ?? null, tourNote: tour?.note ?? null };
  },
});

export const setWeekly = mutation({
  args: { days: v.array(v.object({ weekday: v.number(), startMin: v.number(), endMin: v.number() })) },
  handler: async (ctx, { days }) => {
    const staff = await requirePermission(ctx, "availability.manage");
    for (const d of days) {
      if (d.weekday < 0 || d.weekday > 6 || d.startMin >= d.endMin || d.startMin < 0 || d.endMin > 1440) {
        fail("INVALID", "Check the working hours — the end must be after the start.");
      }
    }
    for (const r of await ctx.db.query("availability").withIndex("by_kind", (q) => q.eq("kind", "weekly")).collect()) {
      await ctx.db.delete(r._id);
    }
    for (const d of days) await ctx.db.insert("availability", { kind: "weekly", ...d });
    await audit(ctx, staff._id, "availability", "weekly", "updated", { days });
  },
});

/** Block or tour over whole EAT days [fromKey, toKey] inclusive. */
export const addRange = mutation({
  args: {
    kind: v.union(v.literal("block"), v.literal("tour")),
    from: v.number(),
    to: v.number(),
    location: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const staff = await requirePermission(ctx, "availability.manage");
    const from = startOfDayEAT(args.from);
    const to = addDaysEAT(startOfDayEAT(args.to), 1);
    if (to <= from) fail("INVALID", "The end date must be on or after the start date.");
    if (args.kind === "tour" && !args.location) fail("INVALID", "Choose the tour location.");
    const id = await ctx.db.insert("availability", {
      kind: args.kind,
      from,
      to,
      location: args.location,
      note: args.note?.trim() || undefined,
    });
    await audit(ctx, staff._id, "availability", id, "created", { kind: args.kind, from: dateKeyEAT(from), to: dateKeyEAT(to - 1) });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("availability") },
  handler: async (ctx, { id }) => {
    const staff = await requirePermission(ctx, "availability.manage");
    await ctx.db.delete(id);
    await audit(ctx, staff._id, "availability", id, "deleted");
  },
});
