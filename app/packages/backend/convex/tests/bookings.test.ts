import { fromEATParts } from "@drink/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { bookingArgs, messagesFor, mpesaCode, setup } from "./helpers.testutil";

afterEach(() => vi.useRealTimers());

export async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: any) => e?.data?.code === code);
}

describe("bookings.create gates", () => {
  it("creates a booking with snapshots, deposit payment, tokens and queued SMS", async () => {
    const { t, manager } = await setup();
    const id = await manager.mutation(api.bookings.create, bookingArgs());
    const b = await t.run((ctx) => ctx.db.get(id));
    expect(b).toMatchObject({ status: "confirmed", depositPercent: 20, depositRequiredKes: 3000, paidTotalKes: 3000, finalPriceKes: 15000 });
    const msgs = await messagesFor(t, id);
    expect(msgs.map((m) => m.templateKey).sort()).toEqual(
      ["confirmed_artist", "confirmed_client", "reminder_artist", "reminder_client"],
    );
    const reminder = msgs.find((m) => m.templateKey === "reminder_client")!;
    expect(reminder.sendAt).toBe(fromEATParts(2026, 10, 15, 18, 0));
    const tokens = await t.run((ctx) => ctx.db.query("accessTokens").collect());
    expect(tokens.map((x) => x.purpose).sort()).toEqual(["consent", "terms"]);
    expect(tokens[0]!.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("MUST: rejects an underpaid deposit", async () => {
    const { manager } = await setup();
    await expectCode(
      manager.mutation(api.bookings.create, bookingArgs({ deposit: { method: "mpesa", amountKes: 2500, mpesaCode: mpesaCode() } })),
      "DEPOSIT_INSUFFICIENT",
    );
  });

  it("MUST: rejects a duplicate M-Pesa code, case-insensitively", async () => {
    const { manager } = await setup();
    await manager.mutation(api.bookings.create, bookingArgs({ deposit: { method: "mpesa", amountKes: 3000, mpesaCode: "TJ4AB12XYZ" } }));
    await expectCode(
      manager.mutation(
        api.bookings.create,
        bookingArgs({
          startAt: fromEATParts(2026, 10, 20, 10, 0),
          deposit: { method: "mpesa", amountKes: 3000, mpesaCode: "tj4ab12xyz" },
        }),
      ),
      "MPESA_CODE_USED",
    );
  });

  it("reuses the client by phone number in any format", async () => {
    const { t, manager } = await setup();
    await manager.mutation(api.bookings.create, bookingArgs());
    await manager.mutation(
      api.bookings.create,
      bookingArgs({ client: { fullName: "W. Kamau", phone: "+254 712 345 678" }, startAt: fromEATParts(2026, 10, 20, 10, 0) }),
    );
    const clients = await t.run((ctx) => ctx.db.query("clients").collect());
    expect(clients).toHaveLength(1);
  });

  it("blocks overlaps for the manager; the artist can override", async () => {
    const { manager, artist } = await setup();
    await manager.mutation(api.bookings.create, bookingArgs());
    const clash = { startAt: fromEATParts(2026, 10, 16, 12, 0), client: { fullName: "Brian Otieno", phone: "0722111222" } };
    await expectCode(manager.mutation(api.bookings.create, bookingArgs({ ...clash, overrideOverlap: true })), "SLOT_OVERLAP");
    await expectCode(artist.mutation(api.bookings.create, bookingArgs(clash)), "SLOT_OVERLAP");
    await expect(artist.mutation(api.bookings.create, bookingArgs({ ...clash, overrideOverlap: true }))).resolves.toBeTruthy();
  });

  it("back-to-back sessions are not overlaps", async () => {
    const { manager } = await setup();
    await manager.mutation(api.bookings.create, bookingArgs());
    await expect(
      manager.mutation(api.bookings.create, bookingArgs({ startAt: fromEATParts(2026, 10, 16, 13, 0), client: { fullName: "Brian O", phone: "0722111222" } })),
    ).resolves.toBeTruthy();
  });

  it("rejects clients under 18 on the session date", async () => {
    const { manager } = await setup();
    await expectCode(
      manager.mutation(api.bookings.create, bookingArgs({ client: { fullName: "Young One", phone: "0733000000", dateOfBirth: "2008-10-17" } })),
      "CLIENT_UNDERAGE",
    );
  });

  it("requires authentication", async () => {
    const { t } = await setup();
    await expectCode(t.mutation(api.bookings.create, bookingArgs()), "UNAUTHENTICATED");
  });
});

describe("role checks", () => {
  it("MUST: manager cannot reach artist-only functions", async () => {
    const { t, manager } = await setup();
    const id = await manager.mutation(api.bookings.create, bookingArgs());
    const pay = await t.run((ctx) => ctx.db.query("payments").first());
    const now = Date.now();
    const denied = [
      () => manager.mutation(api.settings.update, {
        depositPercent: 50, rescheduleLimit: 1, reminderHourDayBefore: 18, artistDigestHour: 8,
        quietHoursStart: 21, quietHoursEnd: 7, businessWhatsapp: "254700000000",
      }),
      () => manager.mutation(api.settings.publishTerms, { body: "New terms that are long enough to publish." }),
      () => manager.mutation(api.settings.updateTemplate, { key: "reminder_client", body: "x", enabled: true }),
      () => manager.mutation(api.payments.reverse, { paymentId: pay!._id, reason: "typo" }),
      () => manager.query(api.reports.summary, { from: now - 1e9, to: now }),
      () => manager.query(api.exports.rows, { kind: "payments" }),
      () => manager.mutation(api.clients.archive, { clientId: pay!.clientId, archived: true }),
      () => manager.mutation(api.clients.erase, { clientId: pay!.clientId, confirmName: "Wanjiru Kamau" }),
      () => manager.mutation(api.staff.invite, { email: "x@y.z", name: "X", phone: "0711000003" }),
      () => manager.mutation(api.bookings.resolveDeposit, { bookingId: id, outcome: "refunded" }),
    ];
    for (const call of denied) await expectCode((call as () => Promise<unknown>)(), "FORBIDDEN");
  });

  it("deactivated staff are locked out", async () => {
    const { t, manager, managerId } = await setup();
    await t.run((ctx) => ctx.db.patch(managerId, { active: false }));
    await expectCode(manager.query(api.dashboard.today, {}), "FORBIDDEN");
  });
});

describe("messaging", () => {
  it("MUST: a cancelled booking sends no reminders", async () => {
    const { t, manager } = await setup();
    const id = await manager.mutation(api.bookings.create, bookingArgs());
    await manager.mutation(api.bookings.cancel, { bookingId: id, reason: "Client travelling", cancelledBy: "client" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const msgs = await messagesFor(t, id);
    const reminders = msgs.filter((m) => m.templateKey.startsWith("reminder"));
    expect(reminders.length).toBe(2);
    expect(reminders.every((m) => m.status === "cancelled")).toBe(true);
    expect(msgs.find((m) => m.templateKey === "cancelled_client")?.status).toBe("sent");
    const b = await t.run((ctx) => ctx.db.get(id));
    expect(b).toMatchObject({ status: "cancelled", depositOutcome: "forfeited" });
  });

  it("reschedule cancels old jobs and schedules new reminders + M-2", async () => {
    const { t, manager } = await setup();
    const id = await manager.mutation(api.bookings.create, bookingArgs());
    const res = await manager.mutation(api.bookings.reschedule, { bookingId: id, startAt: fromEATParts(2026, 10, 20, 14, 0) });
    expect(res).toEqual({ rescheduleCount: 1, depositForfeited: false });
    const msgs = await messagesFor(t, id);
    const queuedReminders = msgs.filter((m) => m.templateKey === "reminder_client" && m.status === "queued");
    expect(queuedReminders).toHaveLength(1);
    expect(queuedReminders[0]!.sendAt).toBe(fromEATParts(2026, 10, 19, 18, 0));
    expect(msgs.some((m) => m.templateKey === "rescheduled_client")).toBe(true);
    // second reschedule exceeds the default limit of 1 → deposit forfeited flag
    const res2 = await manager.mutation(api.bookings.reschedule, { bookingId: id, startAt: fromEATParts(2026, 10, 21, 14, 0) });
    expect(res2.depositForfeited).toBe(true);
  });

  it("queues sends inside quiet hours until 07:00 EAT", async () => {
    const { t, manager } = await setup();
    vi.setSystemTime(fromEATParts(2026, 10, 14, 22, 30));
    const id = await manager.mutation(api.bookings.create, bookingArgs());
    const confirm = (await messagesFor(t, id)).find((m) => m.templateKey === "confirmed_client")!;
    expect(confirm.sendAt).toBe(fromEATParts(2026, 10, 15, 7, 0));
  });
});

describe("payments and completion", () => {
  it("completes only when total paid ≥ final price, then schedules follow-ups", async () => {
    const { t, manager } = await setup();
    const id = await manager.mutation(api.bookings.create, bookingArgs());
    vi.setSystemTime(fromEATParts(2026, 10, 16, 13, 0)); // session day
    const part = await manager.mutation(api.payments.record, {
      bookingId: id,
      payment: { method: "cash", amountKes: 5000 },
    });
    expect(part).toMatchObject({ completed: false, balanceKes: 7000 });
    await manager.mutation(api.bookings.adjustFinalPrice, { bookingId: id, finalPriceKes: 17000, reason: "Added shading" });
    const rest = await manager.mutation(api.payments.record, {
      bookingId: id,
      payment: { method: "mpesa", amountKes: 9000, mpesaCode: mpesaCode() },
    });
    expect(rest).toMatchObject({ completed: true, balanceKes: 0 });
    const b = await t.run((ctx) => ctx.db.get(id));
    expect(b?.status).toBe("completed");
    const keys = (await messagesFor(t, id))
      .filter((m) => m.status === "queued" && !m.templateKey.startsWith("confirmed"))
      .map((m) => m.templateKey)
      .sort();
    expect(keys).toEqual(["aftercare_client", "healed_client", "touchup_client"]);
  });

  it("does not complete early when a client pays in full before the session day", async () => {
    const { t, manager } = await setup();
    const id = await manager.mutation(api.bookings.create, bookingArgs());
    const r = await manager.mutation(api.payments.record, { bookingId: id, payment: { method: "cash", amountKes: 12000 } });
    expect(r.completed).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("confirmed");
  });

  it("rejects a reused code on a balance payment too", async () => {
    const { manager } = await setup();
    const id = await manager.mutation(api.bookings.create, bookingArgs({ deposit: { method: "mpesa", amountKes: 3000, mpesaCode: "TJAAAAAAAA" } }));
    await expectCode(
      manager.mutation(api.payments.record, { bookingId: id, payment: { method: "mpesa", amountKes: 1000, mpesaCode: "TJAAAAAAAA" } }),
      "MPESA_CODE_USED",
    );
  });

  it("artist reversal reopens a completed booking", async () => {
    const { t, manager, artist } = await setup();
    const id = await manager.mutation(api.bookings.create, bookingArgs());
    vi.setSystemTime(fromEATParts(2026, 10, 16, 13, 0));
    await manager.mutation(api.payments.record, { bookingId: id, payment: { method: "cash", amountKes: 12000 } });
    const bal = await t.run((ctx) => ctx.db.query("payments").filter((q) => q.eq(q.field("type"), "balance")).first());
    await artist.mutation(api.payments.reverse, { paymentId: bal!._id, reason: "Recorded twice" });
    const b = await t.run((ctx) => ctx.db.get(id));
    expect(b).toMatchObject({ status: "confirmed", paidTotalKes: 3000 });
  });

  it("no-show only after start time, and flags the client", async () => {
    const { t, manager } = await setup();
    const id = await manager.mutation(api.bookings.create, bookingArgs());
    await expectCode(manager.mutation(api.bookings.markNoShow, { bookingId: id }), "TOO_EARLY");
    vi.setSystemTime(fromEATParts(2026, 10, 16, 11, 0));
    await manager.mutation(api.bookings.markNoShow, { bookingId: id });
    const b = await t.run((ctx) => ctx.db.get(id));
    const c = await t.run((ctx) => ctx.db.get(b!.clientId));
    expect(b?.status).toBe("no_show");
    expect(c?.flagged).toMatch(/No-show/);
  });
});

describe("public token pages", () => {
  it("signs consent once via token and rejects reuse", async () => {
    const { t, manager } = await setup();
    const id = await manager.mutation(api.bookings.create, bookingArgs());
    const tok = await t.run(async (ctx) =>
      (await ctx.db.query("accessTokens").collect()).find((x) => x.purpose === "consent" && x.bookingId === id)!.token,
    );
    const ctxRes = await t.query(api.public.consentContext, { token: tok });
    expect(ctxRes.state).toBe("ok");
    expect(ctxRes.session?.firstName).toBe("Wanjiru");
    expect(JSON.stringify(ctxRes)).not.toContain("712345678");
    const input = {
      token: tok,
      confirmedAdult: true,
      healthAnswers: { bloodDisorder: false, skinCondition: false, allergies: false, diabetesHeart: false, pregnant: false, alcoholDrugs: false },
      aftercareAck: true,
      photoPermission: true,
      dataProcessingConsent: true,
      signatureName: "Wanjiru Kamau",
    };
    await t.mutation(api.public.submitConsent, input);
    await expectCode(t.mutation(api.public.submitConsent, input), "TOKEN_USED");
    await expectCode(t.mutation(api.public.submitConsent, { ...input, token: "x".repeat(43) }), "TOKEN_INVALID");
  });

  it("low feedback ratings alert the artist", async () => {
    const { t, manager } = await setup();
    const id = await manager.mutation(api.bookings.create, bookingArgs());
    vi.setSystemTime(fromEATParts(2026, 10, 16, 13, 0));
    await manager.mutation(api.payments.record, { bookingId: id, payment: { method: "cash", amountKes: 12000 } });
    const tok = await t.run(async (ctx) => (await ctx.db.query("accessTokens").collect()).find((x) => x.purpose === "feedback")!.token);
    await t.mutation(api.public.submitFeedback, { token: tok, rating: 2, comment: "Took too long" });
    const alerts = (await messagesFor(t, id)).filter((m) => m.templateKey === "low_rating_artist");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.to).toBe("+254711000001");
  });
});

describe("recovery", () => {
  it("requeues a queued message whose send job died", async () => {
    const { t, manager } = await setup();
    const id = await manager.mutation(api.bookings.create, bookingArgs());
    const msg = (await messagesFor(t, id)).find((m) => m.templateKey === "confirmed_client")!;
    // simulate a crashed job: cancel it but leave the message queued
    await t.run(async (ctx) => {
      await ctx.scheduler.cancel(msg.jobId!);
    });
    vi.setSystemTime(Date.now() + 20 * 60_000);
    await t.mutation(internal.messages.requeueStuck, {});
    await t.finishInProgressScheduledFunctions();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = (await messagesFor(t, id)).find((m) => m._id === msg._id)!;
    expect(after.status).toBe("sent");
  });
});

describe("roles & access control", () => {
  it("manager starts with defaults; reports and CSV are off", async () => {
    const { manager } = await setup();
    const me = await manager.query(api.settings.viewer, {});
    expect(me?.permissions).toContain("bookings.manage");
    expect(me?.permissions).not.toContain("reports.view");
    await expectCode(manager.query(api.reports.summary, { from: 0, to: Date.now() }), "FORBIDDEN");
  });

  it("artist can grant and revoke a manager's access", async () => {
    const { artist, manager, managerId } = await setup();
    await artist.mutation(api.staff.setPermissions, { staffId: managerId, permissions: ["reports.view", "payments.record"] });
    await expect(manager.query(api.reports.summary, { from: 0, to: Date.now() })).resolves.toBeTruthy();
    // bookings.manage was not in the new list → creating a booking is now blocked
    await expectCode(manager.mutation(api.bookings.create, bookingArgs()), "FORBIDDEN");
  });

  it("override-overlap can be granted to a manager", async () => {
    const { artist, manager, managerId } = await setup();
    await manager.mutation(api.bookings.create, bookingArgs());
    const clash = { startAt: fromEATParts(2026, 10, 16, 12, 0), client: { fullName: "Brian Otieno", phone: "0722111222" }, overrideOverlap: true };
    await expectCode(manager.mutation(api.bookings.create, bookingArgs(clash)), "SLOT_OVERLAP");
    await artist.mutation(api.staff.setPermissions, {
      staffId: managerId,
      permissions: ["bookings.manage", "bookings.overrideOverlap"],
    });
    await expect(manager.mutation(api.bookings.create, bookingArgs(clash))).resolves.toBeTruthy();
  });

  it("owner-only actions stay closed even with every permission granted", async () => {
    const { t, artist, manager, managerId } = await setup();
    const { PERMISSION_KEYS } = await import("@drink/shared");
    await artist.mutation(api.staff.setPermissions, { staffId: managerId, permissions: PERMISSION_KEYS });
    await manager.mutation(api.bookings.create, bookingArgs());
    const pay = await t.run((ctx) => ctx.db.query("payments").first());
    await expectCode(manager.mutation(api.payments.reverse, { paymentId: pay!._id, reason: "test" }), "FORBIDDEN");
    await expectCode(manager.mutation(api.staff.setPermissions, { staffId: managerId, permissions: [] }), "FORBIDDEN");
    await expectCode(manager.mutation(api.clients.erase, { clientId: pay!.clientId, confirmName: "x" }), "FORBIDDEN");
  });

  it("invites create a one-time link and SMS the manager", async () => {
    const { t, artist } = await setup();
    const { link } = await artist.mutation(api.staff.invite, {
      email: "New@Drink.test", name: "Achieng Otieno", phone: "0733123456", permissions: ["payments.record", "nonsense"],
    });
    expect(link).toMatch(/\/sign-in\?invite=[A-Za-z0-9_-]{43}$/);
    const token = link.split("invite=")[1]!;
    const info = await t.query(api.staff.inviteInfo, { token });
    expect(info).toEqual({ state: "ok", name: "Achieng Otieno", email: "new@drink.test" });
    const inv = await t.run((ctx) => ctx.db.query("invites").first());
    expect(inv?.permissions).toEqual(["payments.record"]); // unknown permissions dropped
    const sms = await t.run((ctx) => ctx.db.query("messages").filter((q) => q.eq(q.field("templateKey"), "staff_invite")).first());
    expect(sms?.to).toBe("+254733123456");
    expect(sms?.body).toContain(token);
    vi.setSystemTime(Date.now() + 8 * 86400000);
    expect((await t.query(api.staff.inviteInfo, { token })).state).toBe("expired");
  });

  it("deactivating a manager locks them out immediately", async () => {
    const { artist, manager, managerId } = await setup();
    await artist.mutation(api.staff.setActive, { staffId: managerId, active: false });
    await expectCode(manager.query(api.dashboard.today, {}), "FORBIDDEN");
  });
});
