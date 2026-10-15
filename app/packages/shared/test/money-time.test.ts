import { describe, expect, it } from "vitest";
import {
  addDaysEAT, ageOn, applyQuietHours, atHourEAT, computeDepositRequired, dateKeyEAT, followUpTime,
  formatDateShort, formatKes, formatTime12, formatTime24, fromEATParts, normalizeKenyanPhone,
  parseKes, reminderTime, shortName, startOfDayEAT, toEAT,
} from "../src";

describe("deposit maths", () => {
  it("is quote × pct, rounded up", () => {
    expect(computeDepositRequired(15000, 20)).toBe(3000);
    expect(computeDepositRequired(15001, 20)).toBe(3001);
    expect(computeDepositRequired(999, 20)).toBe(200);
  });
  it("respects a minimum deposit but never exceeds the quote", () => {
    expect(computeDepositRequired(5000, 20, 2000)).toBe(2000);
    expect(computeDepositRequired(1500, 20, 2000)).toBe(1500);
    expect(computeDepositRequired(50000, 20, 2000)).toBe(10000);
  });
});

describe("money format", () => {
  it("formats KES with space and commas, no decimals", () => {
    expect(formatKes(12000)).toBe("KES 12,000");
    expect(formatKes(0)).toBe("KES 0");
    expect(parseKes("KES 12,500")).toBe(12500);
    expect(parseKes("")).toBeNull();
  });
});

describe("EAT time", () => {
  const t = fromEATParts(2026, 10, 16, 10, 0); // Fri 16 Oct 10:00 EAT = 07:00 UTC
  it("round-trips parts", () => {
    expect(new Date(t).toISOString()).toBe("2026-10-16T07:00:00.000Z");
    expect(toEAT(t)).toMatchObject({ year: 2026, month: 10, day: 16, hour: 10, minute: 0, weekday: 5 });
  });
  it("formats for staff and clients", () => {
    expect(formatDateShort(t)).toBe("Fri 16 Oct");
    expect(formatTime24(fromEATParts(2026, 10, 16, 14, 30))).toBe("14:30");
    expect(formatTime12(fromEATParts(2026, 10, 16, 14, 30))).toBe("2:30 PM");
  });
  it("finds the EAT day even when UTC is on the previous date", () => {
    const earlyMorning = fromEATParts(2026, 10, 16, 1, 30); // 22:30 UTC on 15th
    expect(dateKeyEAT(earlyMorning)).toBe("2026-10-16");
    expect(startOfDayEAT(earlyMorning)).toBe(fromEATParts(2026, 10, 16));
  });
  it("adds calendar days across month ends", () => {
    expect(addDaysEAT(fromEATParts(2026, 10, 31, 9, 0), 1)).toBe(fromEATParts(2026, 11, 1, 9, 0));
    expect(atHourEAT(t, 18)).toBe(fromEATParts(2026, 10, 16, 18, 0));
  });
});

describe("quiet hours", () => {
  it("moves late-evening sends to 07:00 next day", () => {
    expect(applyQuietHours(fromEATParts(2026, 10, 16, 22, 15))).toBe(fromEATParts(2026, 10, 17, 7, 0));
    expect(applyQuietHours(fromEATParts(2026, 10, 16, 21, 0))).toBe(fromEATParts(2026, 10, 17, 7, 0));
  });
  it("moves early-morning sends to 07:00 same day", () => {
    expect(applyQuietHours(fromEATParts(2026, 10, 16, 3, 0))).toBe(fromEATParts(2026, 10, 16, 7, 0));
  });
  it("leaves daytime sends alone", () => {
    const at = fromEATParts(2026, 10, 16, 7, 0);
    expect(applyQuietHours(at)).toBe(at);
    expect(applyQuietHours(fromEATParts(2026, 10, 16, 20, 59))).toBe(fromEATParts(2026, 10, 16, 20, 59));
  });
});

describe("scheduling", () => {
  const start = fromEATParts(2026, 10, 16, 10, 0);
  it("reminds the day before at the configured hour", () => {
    expect(reminderTime(start, 18, fromEATParts(2026, 10, 14, 12, 0))).toBe(fromEATParts(2026, 10, 15, 18, 0));
  });
  it("skips the reminder when it is already in the past", () => {
    expect(reminderTime(start, 18, fromEATParts(2026, 10, 15, 19, 0))).toBeNull();
  });
  it("follows up at 10:00 EAT N days later", () => {
    expect(followUpTime(fromEATParts(2026, 10, 16, 16, 0), 1)).toBe(fromEATParts(2026, 10, 17, 10, 0));
    expect(followUpTime(fromEATParts(2026, 10, 16, 16, 0), 21)).toBe(fromEATParts(2026, 11, 6, 10, 0));
  });
});

describe("phones and names", () => {
  it("normalises Kenyan formats to E.164", () => {
    for (const v of ["0712345678", "712345678", "+254712345678", "254712345678", "0712 345 678", "0110 123 456"]) {
      expect(normalizeKenyanPhone(v)).toMatch(/^\+254[17]\d{8}$/);
    }
    expect(normalizeKenyanPhone("0712345678")).toBe("+254712345678");
    expect(normalizeKenyanPhone("0212345678")).toBeNull();
    expect(normalizeKenyanPhone("12345")).toBeNull();
  });
  it("shortens names", () => {
    expect(shortName("Wanjiru Kamau")).toBe("Wanjiru K.");
    expect(shortName("Brian")).toBe("Brian");
  });
  it("computes age for the 18+ rule", () => {
    const at = fromEATParts(2026, 10, 16);
    expect(ageOn("2008-10-16", at)).toBe(18);
    expect(ageOn("2008-10-17", at)).toBe(17);
  });
});
