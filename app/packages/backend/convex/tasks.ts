import { firstIssue, taskInputSchema } from "@drink/shared";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireStaff } from "./lib/auth";
import { audit } from "./lib/audit";
import { fail } from "./lib/errors";

const checklistV = v.array(v.object({ text: v.string(), done: v.boolean() }));
const taskArgs = {
  title: v.string(),
  note: v.optional(v.string()),
  due: v.optional(v.number()),
  clientIds: v.optional(v.array(v.id("clients"))),
  checklist: v.optional(checklistV),
};

/** Resolve the linked clients for a set of tasks in one pass, skipping any that were deleted. */
async function resolveClients(ctx: QueryCtx, tasks: Doc<"tasks">[]) {
  const ids = [...new Set(tasks.flatMap((t) => t.clientIds))];
  const entries = await Promise.all(
    ids.map(async (id) => {
      const c = await ctx.db.get(id);
      return [id, c] as const;
    }),
  );
  const byId = new Map(entries);
  return (t: Doc<"tasks">) =>
    t.clientIds
      .map((id) => byId.get(id))
      .filter((c): c is Doc<"clients"> => !!c)
      .map((c) => ({ _id: c._id, fullName: c.fullName }));
}

function shape(t: Doc<"tasks">, clients: { _id: Id<"clients">; fullName: string }[]) {
  const done = t.checklist.filter((i) => i.done).length;
  return {
    _id: t._id,
    createdAt: t._creationTime,
    title: t.title,
    note: t.note ?? null,
    due: t.due ?? null,
    done: t.done,
    doneAt: t.doneAt ?? null,
    checklist: t.checklist,
    checklistDone: done,
    checklistTotal: t.checklist.length,
    clients,
  };
}
export type TaskShape = ReturnType<typeof shape>;

/** Open tasks (done = false) by default, or completed ones when `done` is true. */
export const list = query({
  args: { done: v.optional(v.boolean()) },
  handler: async (ctx, { done = false }) => {
    await requireStaff(ctx);
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_done", (q) => q.eq("done", done))
      .collect();
    // Open: soonest due first, undated last, newest-created as tiebreak. Done: most recently finished.
    tasks.sort((a, b) =>
      done
        ? (b.doneAt ?? b._creationTime) - (a.doneAt ?? a._creationTime)
        : (a.due ?? Infinity) - (b.due ?? Infinity) || b._creationTime - a._creationTime,
    );
    const clientsOf = await resolveClients(ctx, tasks);
    return tasks.map((t) => shape(t, clientsOf(t)));
  },
});

/** Count of open tasks, and how many of those are due today or overdue — for the nav / header. */
export const openCount = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const open = await ctx.db
      .query("tasks")
      .withIndex("by_done", (q) => q.eq("done", false))
      .collect();
    const endOfToday = Date.now();
    return { open: open.length, due: open.filter((t) => t.due != null && t.due <= endOfToday).length };
  },
});

function parse(input: { title: string; note?: string; due?: number; clientIds?: string[]; checklist?: { text: string; done: boolean }[] }) {
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
  return parsed.data;
}

export const create = mutation({
  args: taskArgs,
  handler: async (ctx, input) => {
    const staff = await requireStaff(ctx);
    const data = parse(input);
    const taskId = await ctx.db.insert("tasks", {
      title: data.title,
      note: data.note,
      due: data.due,
      clientIds: (data.clientIds ?? []) as Id<"clients">[],
      checklist: data.checklist ?? [],
      done: false,
      createdBy: staff._id,
    });
    await audit(ctx, staff._id, "tasks", taskId, "created");
    return taskId;
  },
});

export const update = mutation({
  args: { taskId: v.id("tasks"), ...taskArgs },
  handler: async (ctx, { taskId, ...patch }) => {
    const staff = await requireStaff(ctx);
    const t = await ctx.db.get(taskId);
    if (!t) fail("NOT_FOUND", "Task not found.");
    const data = parse({
      title: patch.title ?? t.title,
      note: patch.note ?? t.note,
      due: patch.due ?? t.due,
      clientIds: patch.clientIds ?? t.clientIds,
      checklist: patch.checklist ?? t.checklist,
    });
    await ctx.db.patch(taskId, {
      title: data.title,
      note: data.note,
      due: data.due,
      clientIds: (data.clientIds ?? []) as Id<"clients">[],
      checklist: data.checklist ?? [],
    });
    await audit(ctx, staff._id, "tasks", taskId, "updated");
  },
});

/** Tick / untick the whole task. */
export const setDone = mutation({
  args: { taskId: v.id("tasks"), done: v.boolean() },
  handler: async (ctx, { taskId, done }) => {
    const staff = await requireStaff(ctx);
    const t = await ctx.db.get(taskId);
    if (!t) fail("NOT_FOUND", "Task not found.");
    await ctx.db.patch(taskId, { done, doneAt: done ? Date.now() : undefined });
    await audit(ctx, staff._id, "tasks", taskId, done ? "completed" : "reopened");
  },
});

/** Tick / untick a single checklist item by index. */
export const setItemDone = mutation({
  args: { taskId: v.id("tasks"), index: v.number(), done: v.boolean() },
  handler: async (ctx, { taskId, index, done }) => {
    await requireStaff(ctx);
    const t = await ctx.db.get(taskId);
    if (!t) fail("NOT_FOUND", "Task not found.");
    const item = t.checklist[index];
    if (!item) fail("NOT_FOUND", "Checklist item not found.");
    const checklist = t.checklist.map((it, i) => (i === index ? { ...it, done } : it));
    await ctx.db.patch(taskId, { checklist });
  },
});

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const staff = await requireStaff(ctx);
    const t = await ctx.db.get(taskId);
    if (!t) return;
    await ctx.db.delete(taskId);
    await audit(ctx, staff._id, "tasks", taskId, "deleted");
  },
});
