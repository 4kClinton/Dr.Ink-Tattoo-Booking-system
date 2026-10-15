/**
 * Africa's Talking SMS (TRD §5.4). Default Convex runtime (fetch + env are available).
 *
 * Credentials (Convex env): AT_USERNAME + AT_API_KEY (or AFRICAS_TALKING_KEY), optional AT_SENDER_ID.
 * Without them the sender runs in DEV mode: nothing leaves the building,
 * the message is marked sent with a `dev-` provider id and logged to the Convex console.
 */
import { TEMPLATES, type TemplateKey } from "@drink/shared";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

export function atApiKey(): string | undefined {
  return process.env.AT_API_KEY || process.env.AFRICAS_TALKING_KEY || undefined;
}

/** https://api.africastalking.com/version1, or the sandbox host when AT_USERNAME is "sandbox". */
export function atBaseUrl(username: string): string {
  return `https://api.${username === "sandbox" ? "sandbox." : ""}africastalking.com/version1`;
}

interface ATRecipient {
  status: string;
  statusCode: number;
  messageId: string;
  number: string;
  cost: string;
}

export const send = internalAction({
  args: { messageId: v.id("messages"), manual: v.optional(v.boolean()) },
  handler: async (ctx, { messageId, manual }) => {
    const data = await ctx.runQuery(internal.messages.getForSend, { messageId });
    if (!data || data.msg.status !== "queued") return;
    const { msg, bookingStatus } = data;

    // Re-read the booking: if its status no longer fits this message, exit (TRD §5.3).
    const required = TEMPLATES[msg.templateKey as TemplateKey]?.requiresStatus;
    if (!manual && required && bookingStatus && bookingStatus !== required) {
      await ctx.runMutation(internal.messages.markCancelled, {
        messageId,
        reason: `Booking is ${bookingStatus.replace("_", "-")}`,
      });
      return;
    }

    const apiKey = atApiKey();
    const username = process.env.AT_USERNAME;
    if (!apiKey || !username) {
      console.log(`[sms:dev] → ${msg.to} (${msg.templateKey})\n${msg.body}`);
      await ctx.runMutation(internal.messages.markSent, { messageId, providerId: `dev-${messageId}` });
      return;
    }

    const body = new URLSearchParams({ username, to: msg.to, message: msg.body, bulkSMSMode: "1" });
    if (process.env.AT_SENDER_ID) body.set("from", process.env.AT_SENDER_ID);

    try {
      const res = await fetch(`${atBaseUrl(username)}/messaging`, {
        method: "POST",
        headers: {
          apiKey,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as { SMSMessageData?: { Recipients?: ATRecipient[]; Message?: string } };
      const r = json.SMSMessageData?.Recipients?.[0];
      // 100 Processed, 101 Sent, 102 Queued
      if (r && [100, 101, 102].includes(r.statusCode)) {
        await ctx.runMutation(internal.messages.markSent, { messageId, providerId: r.messageId });
      } else {
        throw new Error(r?.status ?? json.SMSMessageData?.Message ?? "No recipient in response");
      }
    } catch (e) {
      await ctx.runMutation(internal.messages.markAttemptFailed, {
        messageId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
});
