import { ConvexError } from "convex/values";

/**
 * Every business-rule failure is a ConvexError with a stable `code` the UI can switch on
 * and a human `message` written to UI-UX-SPEC §6 (what happened + what to do).
 */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID"
  | "DEPOSIT_INSUFFICIENT"
  | "DEPOSIT_REQUIRED"
  | "MPESA_CODE_USED"
  | "SLOT_OVERLAP"
  | "CLIENT_UNDERAGE"
  | "BAD_STATUS"
  | "TOO_EARLY"
  | "NOT_INVITED"
  | "TOKEN_INVALID"
  | "TOKEN_EXPIRED"
  | "TOKEN_USED"
  | "RATE_LIMITED"
  | "LIMIT_REACHED";

export function fail(code: ErrorCode, message: string, extra?: Record<string, unknown>): never {
  throw new ConvexError({ code, message, ...extra });
}
