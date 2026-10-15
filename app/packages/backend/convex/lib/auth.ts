import { getAuthUserId } from "@convex-dev/auth/server";
import { hasPermission, PERMISSIONS, type Permission } from "@drink/shared";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { fail } from "./errors";

export type Role = "artist" | "manager";

/** TRD §4.1 — every staff function starts here. Access checks live in Convex, never only in UI. */
export async function requireStaff(ctx: QueryCtx, roles?: Role[]): Promise<Doc<"staff">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) fail("UNAUTHENTICATED", "Please sign in again.");
  const staff = await ctx.db
    .query("staff")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!staff?.active) fail("FORBIDDEN", "Your account isn't active. Ask the artist to re-enable it.");
  if (roles && !roles.includes(staff.role)) fail("FORBIDDEN", "Only the artist can do that.");
  return staff;
}

/** Staff member who has been granted `permission` (the artist always has it). */
export async function requirePermission(ctx: QueryCtx, permission: Permission): Promise<Doc<"staff">> {
  const staff = await requireStaff(ctx);
  if (!hasPermission(staff, permission)) {
    const label = PERMISSIONS.find((p) => p.key === permission)?.label.toLowerCase() ?? permission;
    fail("FORBIDDEN", `You don't have access to ${label}. Ask the artist to turn it on.`);
  }
  return staff;
}

export const can = (staff: Doc<"staff">, permission: Permission) => hasPermission(staff, permission);

export async function currentStaff(ctx: QueryCtx): Promise<Doc<"staff"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const staff = await ctx.db
    .query("staff")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return staff?.active ? staff : null;
}

export const isArtist = (s: Doc<"staff">) => s.role === "artist";
