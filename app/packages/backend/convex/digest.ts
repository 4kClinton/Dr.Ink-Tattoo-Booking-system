import { addDaysEAT, formatTime24, shortName, startOfDayEAT, toEAT } from "@drink/shared";
import { internalMutation } from "./_generated/server";
import { artistFor, locationText, queueMessage } from "./lib/messaging";
import { getSettings } from "./lib/settings";

/** M-5: at `artistDigestHour` EAT, text the artist today's sessions (skipped when there are none). */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const settings = await getSettings(ctx);
    const now = Date.now();
    if (toEAT(now).hour !== settings.artistDigestHour) return;
    const dayStart = startOfDayEAT(now);
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_status_start", (q) =>
        q.eq("status", "confirmed").gte("startAt", dayStart).lt("startAt", addDaysEAT(dayStart, 1)),
      )
      .collect();
    if (!bookings.length) return;
    const artist = await artistFor(ctx);
    if (!artist) return;
    const lines = await Promise.all(
      bookings
        .sort((a, b) => a.startAt - b.startAt)
        .map(async (b) => {
          const c = await ctx.db.get(b.clientId);
          return `${formatTime24(b.startAt)} ${c ? shortName(c.fullName) : "?"} (${locationText(b)})`;
        }),
    );
    await queueMessage(
      ctx,
      {
        templateKey: "digest_artist",
        to: artist.phone,
        recipient: "artist",
        vars: { count: String(bookings.length), sessions: lines.join("; ") },
      },
      settings,
    );
  },
});

export const pruneRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 60 * 60_000;
    const old = await ctx.db.query("rateLimits").filter((q) => q.lt(q.field("windowStart"), cutoff)).take(500);
    for (const r of old) await ctx.db.delete(r._id);
  },
});
