import { clientInputSchema, firstIssue, formatPhone, normalizeKenyanPhone } from "@drink/shared";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { can, requirePermission, requireStaff } from "./lib/auth";
import { audit } from "./lib/audit";
import { getTattoo } from "./lib/bookingLogic";
import { fail } from "./lib/errors";

async function lastTattoo(ctx: QueryCtx, clientId: Id<"clients">) {
  const t = await ctx.db
    .query("tattoos")
    .withIndex("by_client", (q) => q.eq("clientId", clientId))
    .order("desc")
    .first();
  return t ? `${t.description} · ${t.placement}` : null;
}

function row(c: Doc<"clients">) {
  return {
    _id: c._id,
    fullName: c.fullName,
    phone: c.phone,
    phoneDisplay: formatPhone(c.phone),
    instagram: c.instagram,
    flagged: c.flagged,
    lastVisitAt: c.lastVisitAt,
    sessionCount: c.sessionCount ?? 0,
  };
}

/** C-4: search by name, phone or IG handle. Used by Step 1 "Phone or name" (debounced). */
export const search = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    await requireStaff(ctx);
    const term = q.trim();
    if (term.length < 2) return [];
    const found = new Map<Id<"clients">, Doc<"clients">>();

    const phone = normalizeKenyanPhone(term);
    if (phone) {
      const c = await ctx.db.query("clients").withIndex("by_phone", (x) => x.eq("phone", phone)).unique();
      if (c) found.set(c._id, c);
    } else if (/^[+\d\s]{4,}$/.test(term)) {
      // partial phone: prefix-scan the E.164 index
      const digits = term.replace(/\D/g, "").replace(/^0/, "").replace(/^254/, "");
      const prefix = `+254${digits}`;
      const rows = await ctx.db
        .query("clients")
        .withIndex("by_phone", (x) => x.gte("phone", prefix).lt("phone", prefix + "￿"))
        .take(10);
      rows.forEach((c) => found.set(c._id, c));
    }
    const ig = term.replace(/^@/, "").toLowerCase();
    if (/^[a-z0-9._]{2,}$/.test(ig)) {
      const rows = await ctx.db
        .query("clients")
        .withIndex("by_instagram", (x) => x.gte("instagram", ig).lt("instagram", ig + "￿"))
        .take(5);
      rows.forEach((c) => found.set(c._id, c));
    }
    const byName = await ctx.db
      .query("clients")
      .withSearchIndex("search_name", (s) => s.search("fullName", term).eq("archived", false))
      .take(10);
    byName.forEach((c) => found.set(c._id, c));

    const list = [...found.values()].filter((c) => !c.archived).slice(0, 10);
    return await Promise.all(list.map(async (c) => ({ ...row(c), lastTattoo: await lastTattoo(ctx, c._id) })));
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireStaff(ctx);
    const page = await ctx.db
      .query("clients")
      .withIndex("by_last_visit")
      .order("desc")
      .filter((q) => q.eq(q.field("archived"), false))
      .paginate(paginationOpts);
    return { ...page, page: page.page.map(row) };
  },
});

/** C-3: profile with bookings, tattoos, payments, consent, feedback and lifetime spend. */
export const get = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    const staff = await requireStaff(ctx);
    const client = await ctx.db.get(clientId);
    if (!client) return null;
    const [bookings, payments, consents, feedback, tattoos, projects] = await Promise.all([
      ctx.db.query("bookings").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect(),
      ctx.db.query("payments").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect(),
      ctx.db.query("consents").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect(),
      ctx.db.query("feedback").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect(),
      ctx.db.query("tattoos").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect(),
      ctx.db.query("projects").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect(),
    ]);
    const lifetimeSpend = payments.reduce((s, p) => s + p.amountKes, 0);
    const bookingRows = await Promise.all(
      bookings
        .sort((a, b) => b.startAt - a.startAt)
        .map(async (b) => {
          const t = await getTattoo(ctx, b._id);
          return {
            _id: b._id,
            startAt: b.startAt,
            status: b.status,
            location: b.location,
            finalPriceKes: b.finalPriceKes,
            paidTotalKes: b.paidTotalKes,
            tattooShort: t ? `${t.description} · ${t.placement}` : "",
          };
        }),
    );
    const photos = (
      await Promise.all(
        tattoos.flatMap((t) =>
          [
            ...t.healedImages.map((id) => ({ id, kind: "healed" as const })),
            ...t.finalImages.map((id) => ({ id, kind: "final" as const })),
            ...t.referenceImages.map((id) => ({ id, kind: "reference" as const })),
          ].map(async (img) => ({
            ...img,
            bookingId: t.bookingId,
            placement: t.placement,
            portfolioApproved: t.portfolioApproved,
            url: await ctx.storage.getUrl(img.id),
          })),
        ),
      )
    ).filter((p) => p.url);
    return {
      client,
      viewerRole: staff.role,
      stats: {
        sessions: bookings.filter((b) => b.status === "completed").length,
        lifetimeSpend: can(staff, "reports.view") ? lifetimeSpend : null,
        lastVisitAt: client.lastVisitAt ?? null,
        noShows: bookings.filter((b) => b.status === "no_show").length,
      },
      bookings: bookingRows,
      payments: payments.sort((a, b) => b.paidAt - a.paidAt),
      consents: consents.sort((a, b) => b.signedAt - a.signedAt),
      feedback: feedback.sort((a, b) => b.submittedAt - a.submittedAt),
      photos,
      projects,
    };
  },
});

export const projects = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    await requireStaff(ctx);
    const ps = await ctx.db.query("projects").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect();
    return await Promise.all(
      ps.map(async (p) => {
        const sessions = (await ctx.db.query("bookings").withIndex("by_project", (q) => q.eq("projectId", p._id)).collect()).filter(
          (b) => b.status !== "cancelled",
        );
        return { ...p, sessionsBooked: sessions.length };
      }),
    );
  },
});

export const update = mutation({
  args: {
    clientId: v.id("clients"),
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    instagram: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { clientId, ...patch }) => {
    const staff = await requirePermission(ctx, "clients.edit");
    const c = await ctx.db.get(clientId);
    if (!c) fail("NOT_FOUND", "Client not found.");
    const merged = { fullName: c.fullName, phone: c.phone, email: c.email, instagram: c.instagram, dateOfBirth: c.dateOfBirth, notes: c.notes, ...patch };
    const parsed = clientInputSchema.safeParse(merged);
    if (!parsed.success) fail("INVALID", firstIssue(parsed.error));
    if (parsed.data.phone !== c.phone) {
      const clash = await ctx.db.query("clients").withIndex("by_phone", (q) => q.eq("phone", parsed.data.phone)).unique();
      if (clash) fail("INVALID", `That number already belongs to ${clash.fullName}.`);
    }
    await ctx.db.patch(clientId, parsed.data);
    await audit(ctx, staff._id, "clients", clientId, "updated", patch);
  },
});

/** C-5: flagged clients show a warning when booked. */
export const setFlag = mutation({
  args: { clientId: v.id("clients"), reason: v.optional(v.string()) },
  handler: async (ctx, { clientId, reason }) => {
    const staff = await requirePermission(ctx, "clients.edit");
    await ctx.db.patch(clientId, { flagged: reason?.trim() || undefined });
    await audit(ctx, staff._id, "clients", clientId, reason ? "flagged" : "unflagged", { reason });
  },
});

/** C-6: opted-out clients get transactional SMS only. */
export const setMarketingOptOut = mutation({
  args: { clientId: v.id("clients"), optOut: v.boolean() },
  handler: async (ctx, { clientId, optOut }) => {
    const staff = await requirePermission(ctx, "clients.edit");
    await ctx.db.patch(clientId, { marketingOptOut: optOut });
    await audit(ctx, staff._id, "clients", clientId, "marketing_opt_out", { optOut });
  },
});

/** AU-2: nothing is hard-deleted by the manager. Artist can archive. */
export const archive = mutation({
  args: { clientId: v.id("clients"), archived: v.boolean() },
  handler: async (ctx, { clientId, archived }) => {
    const staff = await requireStaff(ctx, ["artist"]);
    await ctx.db.patch(clientId, { archived });
    await audit(ctx, staff._id, "clients", clientId, archived ? "archived" : "unarchived");
  },
});

/**
 * KDPA right to erasure (TRD §8): anonymise personal fields, delete images,
 * keep payment amounts for accounting. Irreversible.
 */
export const erase = mutation({
  args: { clientId: v.id("clients"), confirmName: v.string() },
  handler: async (ctx, { clientId, confirmName }) => {
    const staff = await requireStaff(ctx, ["artist"]);
    const c = await ctx.db.get(clientId);
    if (!c) fail("NOT_FOUND", "Client not found.");
    if (confirmName.trim().toLowerCase() !== c.fullName.trim().toLowerCase()) {
      fail("INVALID", "Type the client's full name exactly to confirm.");
    }
    const upcoming = await ctx.db
      .query("bookings")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .filter((q) => q.eq(q.field("status"), "confirmed"))
      .first();
    if (upcoming) fail("BAD_STATUS", "Cancel or close this client's open bookings before erasing their data.");

    const tattoos = await ctx.db.query("tattoos").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect();
    for (const t of tattoos) {
      for (const id of [...t.referenceImages, ...t.finalImages, ...t.healedImages]) await ctx.storage.delete(id);
      await ctx.db.patch(t._id, { referenceImages: [], finalImages: [], healedImages: [], portfolioApproved: false, description: "[erased]" });
    }
    for (const cs of await ctx.db.query("consents").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect()) {
      await ctx.db.patch(cs._id, { signatureName: "[erased]", healthAnswers: null, userAgent: undefined });
    }
    for (const f of await ctx.db.query("feedback").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect()) {
      await ctx.db.patch(f._id, { comment: undefined });
    }
    for (const p of await ctx.db.query("payments").withIndex("by_client", (q) => q.eq("clientId", clientId)).collect()) {
      await ctx.db.patch(p._id, { payerName: undefined, payerPhone: undefined, mpesaRawMessage: undefined });
    }
    await ctx.db.patch(clientId, {
      fullName: "Erased client",
      phone: `erased:${clientId}`,
      email: undefined,
      instagram: undefined,
      dateOfBirth: undefined,
      notes: undefined,
      flagged: undefined,
      archived: true,
      marketingOptOut: true,
      erasedAt: Date.now(),
    });
    await audit(ctx, staff._id, "clients", clientId, "erased");
  },
});
