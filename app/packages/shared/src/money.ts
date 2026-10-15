/** Money is integer KES everywhere. Display: "KES 12,000" (space, comma thousands, no decimals). */
export function formatKes(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  return `KES ${sign}${Math.abs(Math.round(amount)).toLocaleString("en-US")}`;
}

/** Number only, comma thousands — for SMS variables like "KES {deposit}". */
export function formatAmount(amount: number): string {
  return Math.round(amount).toLocaleString("en-US");
}

/** Parse "12,000" / "12000" / "KES 12,000" → 12000. Returns null for empty/invalid. */
export function parseKes(input: string): number | null {
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** TRD §4.3: max(ceil(quoted × pct / 100), minDeposit ?? 0), never above the quote. */
export function computeDepositRequired(quotedKes: number, depositPercent: number, minDepositKes?: number): number {
  const pct = Math.ceil((quotedKes * depositPercent) / 100);
  return Math.min(quotedKes, Math.max(pct, minDepositKes ?? 0));
}

export function balanceDue(finalPriceKes: number, paidTotalKes: number): number {
  return Math.max(0, finalPriceKes - paidTotalKes);
}
