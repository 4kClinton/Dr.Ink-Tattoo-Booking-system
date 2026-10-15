import { TEMPLATES, type TemplateKey } from "@drink/shared";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requirePermission, requireStaff } from "./lib/auth";
import { audit } from "./lib/audit";
import { fail } from "./lib/errors";

const RETRY_DELAY_MS = 5 * 60_000;
const MAX_ATTEMPTS = 2; // first try + one retry (PRD §5.6)

// ───────────── staff-facing ─────────────

export const list = query({
  args: {
    filter: v.union(v.literal("all"), v.literal("scheduled"), v.literal("delivered"), v.literal("failed")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { filter, paginationOpts }) => {
    await requireStaff(ctx);
    const page =
      filter === "all"
        ? await ctx.db.query("messages").withIndex("by_send_at").order("desc").paginate(paginationOpts)
        : await ctx.db
            .query("messages")
            .withIndex("by_status", (q) => q.eq("status", filter === "scheduled" ? "queued" : filter))
            .order("desc")
            .paginate(paginationOpts);
    const rows = await Promise.all(
      page.page.map(async (m) => {
        const client = m.clientId ? await ctx.db.get(m.clientId) : null;
        return {
          ...m,
          templateLabel: TEMPLATES[m.templateKey as TemplateKey]?.label ?? m.templateKey,
          recipientName: m.recipient === "client" ? (client?.fullName ?? m.to) : m.recipient === "artist" ? "You (artist)" : "Manager",
        };
      }),
    );
    return { ...page, page: rows };
  },
});

/** Manager can manually resend any message. Re-queues a copy now (quiet hours still apply). */
export const resend = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const staff = await requirePermission(ctx, "messages.resend");
    const m = await ctx.db.get(messageId);
    if (!m) fail("NOT_FOUND", "Message not found.");
    if (m.status === "queued") fail("BAD_STATUS", "This message hasn't been sent yet.");
    const now = Date.now();
    const copyId = await ctx.db.insert("messages", {
      bookingId: m.bookingId,
      clientId: m.clientId,
      to: m.to,
      recipient: m.recipient,
      templateKey: m.templateKey,
      body: m.body,
      status: "queued",
      attempts: 0,
      sendAt: now,
    });
    const jobId = await ctx.scheduler.runAfter(0, internal.sms.send, { messageId: copyId, manual: true });
    await ctx.db.patch(copyId, { jobId });
    await ctx.db.patch(messageId, { resentAt: now });
    await audit(ctx, staff._id, "messages", messageId, "resent", { copyId });
    return copyId;
  },
});

/** Hide a failed SMS from the dashboard without resending. */
export const dismiss = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const staff = await requirePermission(ctx, "messages.resend");
    await ctx.db.patch(messageId, { resentAt: Date.now() });
    await audit(ctx, staff._id, "messages", messageId, "dismissed");
  },
});

// ───────────── internal (sms.send pipeline) ─────────────

export const getForSend = internalQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const msg = await ctx.db.get(messageId);
    if (!msg) return null;
    const booking = msg.bookingId ? await ctx.db.get(msg.bookingId) : null;
    return { msg, bookingStatus: booking?.status ?? null };
  },
});

export const markSent = internalMutation({
  args: { messageId: v.id("messages"), providerId: v.string() },
  handler: async (ctx, { messageId, providerId }) => {
    const m = await ctx.db.get(messageId);
    if (!m || m.status !== "queued") return;
    await ctx.db.patch(messageId, { status: "sent", providerId, attempts: m.attempts + 1, sentAt: Date.now(), error: undefined });
  },
});

export const markCancelled = internalMutation({
  args: { messageId: v.id("messages"), reason: v.string() },
  handler: async (ctx, { messageId, reason }) => {
    await ctx.db.patch(messageId, { status: "cancelled", error: reason });
  },
});

/** On failure: retry once after 5 min, then status=failed (surfaced on the dashboard). */
export const markAttemptFailed = internalMutation({
  args: { messageId: v.id("messages"), error: v.string() },
  handler: async (ctx, { messageId, error }) => {
    const m = await ctx.db.get(messageId);
    if (!m || m.status !== "queued") return;
    const attempts = m.attempts + 1;
    if (attempts < MAX_ATTEMPTS) {
      const jobId = await ctx.scheduler.runAfter(RETRY_DELAY_MS, internal.sms.send, { messageId });
      await ctx.db.patch(messageId, { attempts, error, jobId, sendAt: Date.now() + RETRY_DELAY_MS });
    } else {
      await ctx.db.patch(messageId, { attempts, error, status: "failed" });
    }
  },
});

const AT_DELIVERED = new Set(["Success"]);
const AT_FAILED = new Set(["Failed", "Rejected", "AbsentSubscriber", "Expired"]);

export const applyDeliveryReport = internalMutation({
  args: { providerId: v.string(), status: v.string(), failureReason: v.optional(v.string()) },
  handler: async (ctx, { providerId, status, failureReason }) => {
    const m = await ctx.db.query("messages").withIndex("by_provider_id", (q) => q.eq("providerId", providerId)).unique();
    if (!m) return;
    if (AT_DELIVERED.has(status)) await ctx.db.patch(m._id, { status: "delivered" });
    else if (AT_FAILED.has(status)) await ctx.db.patch(m._id, { status: "failed", error: failureReason ?? status });
  },
});

/**
 * Recovery sweep: a message is "stuck" when it's still queued well past its send time but its
 * scheduled job is gone or failed (e.g. sms.send crashed on a timeout before it could record
 * the failure). Re-schedule those so nothing silently never sends.
 */
export const requeueStuck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 10 * 60_000;
    const queued = await ctx.db
      .query("messages")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .filter((q) => q.lt(q.field("sendAt"), cutoff))
      .take(100);
    let requeued = 0;
    for (const m of queued) {
      const job = m.jobId ? await ctx.db.system.get(m.jobId) : null;
      const alive = job && (job.state.kind === "pending" || job.state.kind === "inProgress");
      if (alive) continue;
      const jobId = await ctx.scheduler.runAfter(0, internal.sms.send, { messageId: m._id });
      await ctx.db.patch(m._id, { jobId });
      requeued++;
    }
    if (requeued) console.log(`[sms] requeued ${requeued} stuck message(s)`);
  },
});
