import { fromEATParts } from "@drink/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import { bookingArgs, setup } from "./helpers.testutil";

afterEach(() => vi.useRealTimers());

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: any) => e?.data?.code === code);
}

/** A session on 16 Oct 2026, paid in full that afternoon → completed. */
async function completedSession() {
  const ctx = await setup();
  const id = await ctx.manager.mutation(api.bookings.create, bookingArgs());
  vi.setSystemTime(fromEATParts(2026, 10, 16, 13, 0));
  const res = await ctx.manager.mutation(api.payments.record, { bookingId: id, payment: { method: "cash", amountKes: 12000 } });
  expect(res.completed).toBe(true);
  return { ...ctx, id };
}

describe("7-day healing check-in reminders", () => {
  it("is upcoming until 7 days after completion, then due", async () => {
    const { manager, id } = await completedSession();

    vi.setSystemTime(fromEATParts(2026, 10, 22, 9, 0));
    let r = await manager.query(api.reminders.list, {});
    expect(r.due).toHaveLength(0);
    expect(r.upcoming.map((x) => x.bookingId)).toEqual([id]);
    expect(r.upcoming[0]!.dueAt).toBe(fromEATParts(2026, 10, 23));
    expect(await manager.query(api.reminders.dueCount, {})).toBe(0);

    vi.setSystemTime(fromEATParts(2026, 10, 23, 9, 0));
    r = await manager.query(api.reminders.list, {});
    expect(r.due.map((x) => x.bookingId)).toEqual([id]);
    expect(await manager.query(api.reminders.dueCount, {})).toBe(1);
  });

  it("marking checked moves it to Checked with the note; undo brings it back", async () => {
    const { manager, id } = await completedSession();
    vi.setSystemTime(fromEATParts(2026, 10, 24, 10, 0));
    await manager.mutation(api.reminders.markChecked, { bookingId: id, note: "  Healing well  " });

    let r = await manager.query(api.reminders.list, {});
    expect(r.due).toHaveLength(0);
    expect(r.checked[0]).toMatchObject({ bookingId: id, note: "Healing well" });
    expect(await manager.query(api.reminders.dueCount, {})).toBe(0);

    await manager.mutation(api.reminders.undoChecked, { bookingId: id });
    r = await manager.query(api.reminders.list, {});
    expect(r.due.map((x) => x.bookingId)).toEqual([id]);
  });

  it("drops unchecked reminders three weeks after they fell due", async () => {
    const { manager } = await completedSession();
    vi.setSystemTime(fromEATParts(2026, 11, 14, 9, 0)); // due 23 Oct + 22 days
    const r = await manager.query(api.reminders.list, {});
    expect(r.due).toHaveLength(0);
  });

  it("only completed sessions can be checked", async () => {
    const { manager } = await setup();
    const id = await manager.mutation(api.bookings.create, bookingArgs());
    await expectCode(manager.mutation(api.reminders.markChecked, { bookingId: id }), "BAD_STATUS");
  });
});
