import { fromEATParts } from "@drink/shared";
import { convexTest } from "convex-test";
import { vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import { seedDefaults } from "../lib/seed";
import schema from "../schema";
import { modules } from "../test.setup";

export const NOW = fromEATParts(2026, 10, 14, 12, 0); // Wed 14 Oct 2026, 12:00 EAT

export async function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const artistUser = await ctx.db.insert("users", { email: "clint@drink.co.ke" });
    const artistId = await ctx.db.insert("staff", {
      userId: artistUser, name: "Clint", phone: "+254711000001", role: "artist", active: true,
    });
    await seedDefaults(ctx, artistId);
    const managerUser = await ctx.db.insert("users", { email: "mgr@drink.co.ke" });
    const managerId = await ctx.db.insert("staff", {
      userId: managerUser, name: "Manager", phone: "+254711000002", role: "manager", active: true,
    });
    return { artistUser, managerUser, artistId, managerId };
  });
  const artist = t.withIdentity({ subject: `${ids.artistUser}|s1` });
  const manager = t.withIdentity({ subject: `${ids.managerUser}|s2` });
  return { t, artist, manager, ...ids };
}

let codeSeq = 0;
export function mpesaCode() {
  codeSeq++;
  return `TJ${String(codeSeq).padStart(8, "0")}`;
}

export function bookingArgs(overrides: Record<string, unknown> = {}) {
  return {
    client: { fullName: "Wanjiru Kamau", phone: "0712345678" },
    tattoo: { description: "Fine-line rose", placement: "left forearm", colour: "black_grey" as const },
    startAt: fromEATParts(2026, 10, 16, 10, 0),
    durationMin: 180,
    location: "nairobi" as const,
    quotedPriceKes: 15000,
    deposit: { method: "mpesa" as const, amountKes: 3000, mpesaCode: mpesaCode() },
    ...overrides,
  };
}

export async function messagesFor(t: Awaited<ReturnType<typeof setup>>["t"], bookingId: Id<"bookings">) {
  return await t.run(async (ctx) =>
    ctx.db.query("messages").withIndex("by_booking", (q) => q.eq("bookingId", bookingId)).collect(),
  );
}
