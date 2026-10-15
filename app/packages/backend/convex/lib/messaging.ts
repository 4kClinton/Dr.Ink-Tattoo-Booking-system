import {
  applyQuietHours, firstName, formatAmount, formatDateShort, formatTime12, formatTime24,
  LOCATION_LABEL, renderTemplate, shortName, TEMPLATES, type TemplateKey,
} from "@drink/shared";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getSettings, type Settings } from "./settings";

export async function templateBody(ctx: QueryCtx, key: TemplateKey): Promise<{ body: string; enabled: boolean }> {
  const row = await ctx.db
    .query("messageTemplates")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return row ? { body: row.body, enabled: row.enabled } : { body: TEMPLATES[key].body, enabled: true };
}

export async function artistFor(ctx: QueryCtx, artistId?: Id<"staff">): Promise<Doc<"staff"> | null> {
  if (artistId) {
    const s = await ctx.db.get(artistId);
    if (s) return s;
  }
  return (
    (await ctx.db
      .query("staff")
      .withIndex("by_role", (q) => q.eq("role", "artist"))
      .filter((q) => q.eq(q.field("active"), true))
      .first()) ?? null
  );
}

export function tattooShort(t: Pick<Doc<"tattoos">, "description" | "placement"> | null): string {
  if (!t) return "";
  return `${t.description}, ${t.placement}`.slice(0, 60);
}

export function locationText(b: Pick<Doc<"bookings">, "location" | "locationNote">): string {
  return b.location === "other" && b.locationNote ? b.locationNote : LOCATION_LABEL[b.location];
}

/** Standard variables for any booking-related template. */
export function bookingVars(
  booking: Doc<"bookings">,
  client: Doc<"clients">,
  tattoo: Doc<"tattoos"> | null,
  settings: Settings,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    firstName: firstName(client.fullName),
    clientName: shortName(client.fullName),
    date: formatDateShort(booking.startAt),
    time: formatTime12(booking.startAt),
    time24: formatTime24(booking.startAt),
    location: locationText(booking),
    deposit: formatAmount(booking.depositRequiredKes),
    depositPaid: formatAmount(Math.min(booking.paidTotalKes, booking.finalPriceKes)),
    balance: formatAmount(Math.max(0, booking.finalPriceKes - booking.paidTotalKes)),
    whatsapp: settings.businessWhatsapp,
    tattooShort: tattooShort(tattoo),
    ...extra,
  };
}

export interface QueueArgs {
  templateKey: TemplateKey;
  to: string;
  recipient: "client" | "artist" | "manager";
  vars: Record<string, string>;
  sendAt?: number; // default now
  bookingId?: Id<"bookings">;
  clientId?: Id<"clients">;
}

/**
 * Renders + logs a message and schedules `sms.send`. Quiet hours shift the send time.
 * Returns null when the template is disabled or the client opted out of marketing.
 */
export async function queueMessage(ctx: MutationCtx, args: QueueArgs, settingsIn?: Settings) {
  const meta = TEMPLATES[args.templateKey];
  const { body, enabled } = await templateBody(ctx, args.templateKey);
  if (!enabled) return null;
  if (meta.marketing && args.clientId) {
    const client = await ctx.db.get(args.clientId);
    if (client?.marketingOptOut) return null;
  }
  const settings = settingsIn ?? (await getSettings(ctx));
  const now = Date.now();
  const sendAt = applyQuietHours(Math.max(args.sendAt ?? now, now), settings.quietHoursStart, settings.quietHoursEnd);
  const messageId = await ctx.db.insert("messages", {
    bookingId: args.bookingId,
    clientId: args.clientId,
    to: args.to,
    recipient: args.recipient,
    templateKey: args.templateKey,
    body: renderTemplate(body, args.vars),
    status: "queued",
    attempts: 0,
    sendAt,
  });
  const jobId = await ctx.scheduler.runAt(sendAt, internal.sms.send, { messageId });
  await ctx.db.patch(messageId, { jobId });
  if (args.bookingId) {
    const b = await ctx.db.get(args.bookingId);
    if (b) await ctx.db.patch(b._id, { scheduledJobs: [...b.scheduledJobs, jobId] });
  }
  return { messageId, jobId, sendAt };
}

/**
 * Cancel queued messages for a booking (optionally only some templates).
 * Belt-and-braces: scheduler.cancel + status=cancelled, and sms.send re-checks status.
 */
export async function cancelQueued(ctx: MutationCtx, bookingId: Id<"bookings">, keys?: TemplateKey[]) {
  const queued = await ctx.db
    .query("messages")
    .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
    .filter((q) => q.eq(q.field("status"), "queued"))
    .collect();
  const cancelledJobs = new Set<string>();
  for (const m of queued) {
    if (keys && !keys.includes(m.templateKey as TemplateKey)) continue;
    if (m.jobId) {
      const job = await ctx.db.system.get(m.jobId);
      if (job && job.state.kind === "pending") await ctx.scheduler.cancel(m.jobId);
      cancelledJobs.add(m.jobId);
    }
    await ctx.db.patch(m._id, { status: "cancelled" });
  }
  const b = await ctx.db.get(bookingId);
  if (b && cancelledJobs.size) {
    await ctx.db.patch(bookingId, { scheduledJobs: b.scheduledJobs.filter((j) => !cancelledJobs.has(j)) });
  }
  return cancelledJobs.size;
}
