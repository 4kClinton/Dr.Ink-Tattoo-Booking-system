import type { MutationCtx } from "../_generated/server";
import { fail } from "./errors";

/** Fixed-window limiter (TRD §6: public mutations, 10 req/min per token). */
export async function rateLimit(ctx: MutationCtx, key: string, max = 10, windowMs = 60_000) {
  const now = Date.now();
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!row || now - row.windowStart >= windowMs) {
    if (row) await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    else await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
    return;
  }
  if (row.count >= max) fail("RATE_LIMITED", "Too many attempts. Wait a minute and try again.");
  await ctx.db.patch(row._id, { count: row.count + 1 });
}
