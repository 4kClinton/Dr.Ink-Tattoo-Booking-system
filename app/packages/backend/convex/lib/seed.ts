import { DEFAULT_SETTINGS, TEMPLATE_KEYS, TEMPLATES } from "@drink/shared";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const DEFAULT_TERMS = `# Dr.Ink Tattoos — Booking Terms

**Deposit.** A deposit (set when you book) secures your session and comes off your final price. The deposit is **non-refundable**.

**Rescheduling.** You can move your session once with at least 48 hours' notice. After that, the deposit is forfeited and a new deposit is needed.

**Cancellations and no-shows.** If you cancel or don't show up, the deposit is kept.

**If we cancel.** If Dr.Ink has to cancel, your deposit moves to a new date or is refunded — your choice.

**Lateness.** More than 30 minutes late may mean a shorter session or a new booking with a new deposit.

**Final price.** The quote is an estimate. If the design grows on the day, we'll agree the new price with you before continuing.

**Age.** You must be 18 or older. Bring ID.

**Your data.** We keep your contact details, consent form and tattoo photos to run your booking, under the Kenya Data Protection Act 2019. We only use photos for our portfolio if you say yes. Ask us any time to see or delete your data.
`;

/** First-run setup: settings singleton, T&Cs v1, default SMS templates. Idempotent. */
export async function seedDefaults(ctx: MutationCtx, staffId: Id<"staff">) {
  let settings = await ctx.db.query("settings").first();
  if (!settings) {
    const id = await ctx.db.insert("settings", { ...DEFAULT_SETTINGS });
    settings = (await ctx.db.get(id))!;
  }
  if (!settings.currentTermsId) {
    const termsId = await ctx.db.insert("terms", {
      version: 1,
      body: DEFAULT_TERMS,
      publishedAt: Date.now(),
      publishedBy: staffId,
    });
    await ctx.db.patch(settings._id, { currentTermsId: termsId });
  }
  for (const key of TEMPLATE_KEYS) {
    const exists = await ctx.db
      .query("messageTemplates")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!exists) await ctx.db.insert("messageTemplates", { key, body: TEMPLATES[key].body, enabled: true });
  }
  // Default weekly hours: Mon–Sat 10:00–19:00
  const weekly = await ctx.db.query("availability").withIndex("by_kind", (q) => q.eq("kind", "weekly")).first();
  if (!weekly) {
    for (const weekday of [1, 2, 3, 4, 5, 6]) {
      await ctx.db.insert("availability", { kind: "weekly", weekday, startMin: 600, endMin: 1140 });
    }
  }
}
