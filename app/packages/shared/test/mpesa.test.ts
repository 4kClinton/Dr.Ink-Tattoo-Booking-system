import { describe, expect, it } from "vitest";
import { fromEATParts, parseMpesa } from "../src";
import { fixtures } from "./fixtures/mpesa";

describe("parseMpesa", () => {
  it("parses a till / Pochi message", () => {
    expect(parseMpesa(fixtures.till)).toEqual({
      code: "TJ4AB12XYZ",
      amountKes: 2000,
      payerName: "JOHN DOE",
      payerPhone: "0712345678",
      paidAt: fromEATParts(2026, 10, 14, 15, 41),
    });
  });

  it("tolerates masked phone digits", () => {
    const p = parseMpesa(fixtures.tillMasked)!;
    expect(p.code).toBe("TJE7QX1PLM");
    expect(p.amountKes).toBe(3500);
    expect(p.payerName).toBe("WANJIRU KAMAU");
    expect(p.payerPhone).toBe("0712***678");
    expect(p.paidAt).toBe(fromEATParts(2026, 10, 15, 10, 5));
  });

  it("parses a paybill message", () => {
    const p = parseMpesa(fixtures.paybill)!;
    expect(p).toMatchObject({ code: "TJF2KD8RTY", amountKes: 15000, payerName: "BRIAN OTIENO", payerPhone: "254722111222" });
    expect(p.paidAt).toBe(fromEATParts(2026, 10, 16, 9, 12));
  });

  it("handles amounts without decimals and a space after Ksh", () => {
    const p = parseMpesa(fixtures.noDecimals)!;
    expect(p.amountKes).toBe(6400);
    expect(p.payerName).toBe("MARY A. NJERI");
    expect(p.paidAt).toBe(fromEATParts(2026, 11, 1, 12, 0));
  });

  it("uppercases the code and handles 4-digit years / 11:59 pm", () => {
    const p = parseMpesa(fixtures.lowercase)!;
    expect(p.code).toBe("TJH1AA2BB3");
    expect(p.amountKes).toBe(500);
    expect(p.paidAt).toBe(fromEATParts(2026, 11, 2, 23, 59));
  });

  it("returns null when it can't read the message", () => {
    expect(parseMpesa(fixtures.garbage)).toBeNull();
    expect(parseMpesa("")).toBeNull();
  });

  it("does not treat an outgoing 'sent to' message as a received payment", () => {
    expect(parseMpesa(fixtures.sentNotReceived)).toBeNull();
  });
});
