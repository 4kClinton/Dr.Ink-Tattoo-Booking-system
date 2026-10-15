import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, type ActionCtx } from "./_generated/server";
import { fail } from "./lib/errors";
import { atApiKey, atBaseUrl } from "./sms";

/**
 * Artist-only SMS admin: is Africa's Talking connected, what's the balance, does delivery work.
 * Never returns the API key.
 */

async function requireArtistInAction(ctx: ActionCtx): Promise<Doc<"staff">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) fail("UNAUTHENTICATED", "Please sign in again.");
  const me: Doc<"staff"> | null = await ctx.runQuery(internal.staff._staffForUser, { userId });
  if (!me?.active || me.role !== "artist") fail("FORBIDDEN", "Only the artist can do that.");
  return me;
}

export const status = action({
  args: {},
  handler: async (ctx) => {
    await requireArtistInAction(ctx);
    const username = process.env.AT_USERNAME ?? null;
    const hasKey = !!atApiKey();
    const senderId = process.env.AT_SENDER_ID ?? null;
    const secret = process.env.SMS_WEBHOOK_SECRET ?? null;
    const siteUrl = process.env.CONVEX_SITE_URL ?? null;
    const deliveryCallbackUrl = secret && siteUrl ? `${siteUrl}/sms/delivery?secret=${secret}` : null;
    const base = { username, hasKey, senderId, deliveryCallbackUrl };

    if (!hasKey || !username) {
      return { ...base, mode: "dev" as const, balance: null, error: !hasKey ? "No API key set." : "AT_USERNAME isn't set." };
    }
    try {
      const res = await fetch(`${atBaseUrl(username)}/user?username=${encodeURIComponent(username)}`, {
        headers: { apiKey: atApiKey()!, Accept: "application/json" },
      });
      const text = await res.text();
      if (!res.ok) {
        return {
          ...base,
          mode: username === "sandbox" ? ("sandbox" as const) : ("live" as const),
          balance: null,
          error: res.status === 401 ? "Africa's Talking rejected the key + username pair." : `HTTP ${res.status}: ${text.slice(0, 120)}`,
        };
      }
      const json = JSON.parse(text) as { UserData?: { balance?: string } };
      return {
        ...base,
        mode: username === "sandbox" ? ("sandbox" as const) : ("live" as const),
        balance: json.UserData?.balance ?? null,
        error: null,
      };
    } catch (e) {
      return { ...base, mode: "live" as const, balance: null, error: e instanceof Error ? e.message : String(e) };
    }
  },
});

export const _queueTest = internalMutation({
  args: { to: v.string(), body: v.string() },
  handler: async (ctx, { to, body }): Promise<Id<"messages">> => {
    const messageId = await ctx.db.insert("messages", {
      to,
      recipient: "artist",
      templateKey: "test",
      body,
      status: "queued",
      attempts: 0,
      sendAt: Date.now(),
    });
    const jobId = await ctx.scheduler.runAfter(0, internal.sms.send, { messageId, manual: true });
    await ctx.db.patch(messageId, { jobId });
    return messageId;
  },
});

/** Sends a one-line test SMS to the artist's own phone (ignores quiet hours, shows in Messages). */
export const sendTest = action({
  args: {},
  handler: async (ctx): Promise<{ to: string }> => {
    const me = await requireArtistInAction(ctx);
    await ctx.runMutation(internal.smsAdmin._queueTest, {
      to: me.phone,
      body: "Dr.Ink Booking: test SMS. If you can read this, client messages will reach phones.",
    });
    return { to: me.phone };
  },
});
