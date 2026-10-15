import { fromEATParts } from "./time";

/**
 * Parses the M-Pesa confirmation SMS received on the BUSINESS line (TRD §4.5).
 * Parsing never blocks: on null the UI falls back to manual code + amount entry.
 *
 * Supported shapes (keep adding real ones to test/fixtures/mpesa.ts):
 *  - Till / Pochi / personal:  "<CODE> Confirmed. You have received Ksh2,000.00 from JOHN DOE 0712345678 on 14/10/26 at 3:41 PM. …"
 *  - Paybill:                  "<CODE> Confirmed. on 14/10/26 at 3:41 PM Ksh2,000.00 received from JOHN DOE 254712345678. Account Number …"
 *  - Masked phones:            "0712***678"
 */
export interface ParsedMpesa {
  code: string;
  amountKes: number;
  payerName?: string;
  payerPhone?: string;
  paidAt?: number;
}

export const MPESA_CODE_RE = /^[A-Z0-9]{10}$/;

const CODE_RE = /^\s*([A-Z0-9]{10})\s+Confirmed\b/i;
const AMOUNT_RE = /(?:received|You have received)\s+Ksh\s?([\d,]+(?:\.\d{1,2})?)|Ksh\s?([\d,]+(?:\.\d{1,2})?)\s+received/i;
const FROM_RE = /\bfrom\s+(.+?)\s+(\+?254\d{9}|0\d{9}|[\d*]{6,13})(?=[\s.,]|$)/i;
const FROM_NO_PHONE_RE = /\bfrom\s+([A-Z][A-Z .'-]+?)(?=\s+on\s|\.\s|\s+Account)/i;
const WHEN_RE = /\bon\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+at\s+(\d{1,2}):(\d{2})\s?([AP]M)/i;

export function normalizeMpesaCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidMpesaCode(code: string): boolean {
  return MPESA_CODE_RE.test(normalizeMpesaCode(code));
}

export function parseMpesa(raw: string): ParsedMpesa | null {
  const text = raw.replace(/\s+/g, " ").trim();
  const code = text.match(CODE_RE)?.[1];
  const amountMatch = text.match(AMOUNT_RE);
  const amountStr = amountMatch?.[1] ?? amountMatch?.[2];
  if (!code || !amountStr) return null;

  const amountKes = Math.round(parseFloat(amountStr.replace(/,/g, "")));
  if (!Number.isFinite(amountKes) || amountKes <= 0) return null;

  const result: ParsedMpesa = { code: code.toUpperCase(), amountKes };

  const from = text.match(FROM_RE);
  if (from) {
    result.payerName = tidyName(from[1]!);
    result.payerPhone = from[2]!;
  } else {
    const nameOnly = text.match(FROM_NO_PHONE_RE);
    if (nameOnly) result.payerName = tidyName(nameOnly[1]!);
  }

  const when = text.match(WHEN_RE);
  if (when) result.paidAt = toEpochEAT(when);
  return result;
}

function tidyName(name: string): string {
  return name.replace(/\s+/g, " ").trim().toUpperCase();
}

function toEpochEAT(m: RegExpMatchArray): number | undefined {
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  let hour = Number(m[4]) % 12;
  if (m[6]!.toUpperCase() === "PM") hour += 12;
  const minute = Number(m[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || minute > 59) return undefined;
  return fromEATParts(year, month, day, hour, minute);
}
