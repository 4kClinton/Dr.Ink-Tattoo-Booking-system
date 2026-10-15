import { ConvexError } from "convex/values";

export interface AppError {
  code?: string;
  message: string;
  [k: string]: unknown;
}

/** Business errors come from Convex as ConvexError({ code, message }). */
export function toAppError(e: unknown): AppError {
  if (e instanceof ConvexError) {
    const d = e.data as AppError | string;
    return typeof d === "string" ? { message: d } : d;
  }
  if (e instanceof Error && /Failed to fetch|network/i.test(e.message)) {
    return { code: "NETWORK", message: "No connection. Check your data and try again." };
  }
  return { message: "Something went wrong. Try again." };
}
