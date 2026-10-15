import { describe, expect, it } from "vitest";
import { findOverlaps, intervalsOverlap, renderTemplate, SAMPLE_VARS, smsSegments, TEMPLATES } from "../src";

const H = 3_600_000;
describe("overlap detection", () => {
  const a = { startAt: 10 * H, durationMin: 180 }; // 10:00–13:00
  it("detects overlap", () => {
    expect(intervalsOverlap(a, { startAt: 12 * H, durationMin: 60 })).toBe(true);
    expect(intervalsOverlap(a, { startAt: 9 * H, durationMin: 600 })).toBe(true);
  });
  it("treats back-to-back sessions as free", () => {
    expect(intervalsOverlap(a, { startAt: 13 * H, durationMin: 60 })).toBe(false);
    expect(intervalsOverlap(a, { startAt: 9 * H, durationMin: 60 })).toBe(false);
  });
  it("filters a list", () => {
    const list = [{ id: 1, startAt: 8 * H, durationMin: 60 }, { id: 2, startAt: 11 * H, durationMin: 30 }];
    expect(findOverlaps(a, list).map((x) => x.id)).toEqual([2]);
  });
});

describe("templates", () => {
  it("renders variables", () => {
    expect(renderTemplate("Hi {firstName}, KES {deposit}", { firstName: "Wanjiru", deposit: "3,000" })).toBe(
      "Hi Wanjiru, KES 3,000",
    );
  });
  it("leaves unknown variables visible", () => {
    expect(renderTemplate("Hi {nope}", {})).toBe("Hi {nope}");
  });
  it("keeps short default client templates within one SMS segment", () => {
    for (const key of ["reminder_client", "healed_client", "rescheduled_client"] as const) {
      const text = renderTemplate(TEMPLATES[key].body, SAMPLE_VARS);
      expect(smsSegments(text).segments, key).toBe(1);
    }
  });
  it("counts GSM-7 vs UCS-2 segments", () => {
    expect(smsSegments("a".repeat(160))).toMatchObject({ segments: 1, encoding: "GSM-7" });
    expect(smsSegments("a".repeat(161))).toMatchObject({ segments: 2 });
    expect(smsSegments("{}".repeat(80)).chars).toBe(320);
    expect(smsSegments("Hi 😀")).toMatchObject({ encoding: "UCS-2", segments: 1 });
  });
});
