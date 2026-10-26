import { getAuthUserId, invalidateSessions, modifyAccountCredentials, retrieveAccount } from "@convex-dev/auth/server";
import { firstName, isPermission, MANAGER_DEFAULTS, normalizePhone, permissionsFor, DAY_MS } from "@drink/shared";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireStaff } from "./lib/auth";
import { audit } from "./lib/audit";
import { fail } from "./lib/errors";
import { queueMessage } from "./lib/messaging";
import { publicBaseUrl } from "./lib/settings";
import { randomToken } from "./lib/tokens";

/**
 * Roles & access control (PRD §3).
 * - The first account is the artist (owner). There is only ever one artist.
 * - Managers join only through an invite link the artist creates; the artist chooses what each
 *   manager can do, can change it any time, can deactivate them (signs them out everywhere) and
 *   can issue a temporary password.
 */

const INVITE_TTL_MS = 7 * DAY_MS;
const MIN_PASSWORD = 8;

function inviteLink(token: string) {
  return `${publicBaseUrl()}/sign-in?invite=${token}`;
}

function cleanPermissions(list: string[]) {
  return [...new Set(list.filter(isPermission))];
}

function staffRow(s: Doc<"staff">) {
  return {
    _id: s._id,
    name: s.name,
    email: s.email ?? null,
    phone: s.phone,
    role: s.role,
    active: s.active,
    permissions: permissionsFor(s),
    mustChangePassword: !!s.mustChangePassword,
  };
}

// ───────────── queries ─────────────

/** Sign-in screen: is this a fresh install (first account becomes the artist)? */
export const needsSetup = query({
  args: {},
  handler: async (ctx) => !(await ctx.db.query("staff").first()),
});

/** Invite landing page. The token itself is the secret; it reveals only the invitee's own name + email. */
export const inviteInfo = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return { state: "invalid" as const };
    const invite = await ctx.db.query("invites").withIndex("by_token", (q) => q.eq("token", token)).unique();
    if (!invite) return { state: "invalid" as const };
    if (invite.acceptedAt) return { state: "used" as const };
    if ((invite.expiresAt ?? 0) < Date.now()) return { state: "expired" as const };
    return { state: "ok" as const, name: invite.name, email: invite.email };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, ["artist"]);
    const staff = (await ctx.db.query("staff").collect()).sort((a, b) =>
      a.role === b.role ? a.name.localeCompare(b.name) : a.role === "artist" ? -1 : 1,
    );
    const now = Date.now();
    const invites = (await ctx.db.query("invites").collect())
      .filter((i) => !i.acceptedAt)
      .map((i) => ({
        _id: i._id,
        name: i.name,
        email: i.email,
        phone: i.phone,
        expiresAt: i.expiresAt ?? 0,
        expired: (i.expiresAt ?? 0) < now,
        link: i.token ? inviteLink(i.token) : null,
        permissions: cleanPermissions(i.permissions ?? MANAGER_DEFAULTS),
      }));
    return { staff: staff.map(staffRow), invites };
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => staffRow(await requireStaff(ctx)),
});

// ───────────── invites ─────────────

async function sendInviteSms(
  ctx: Parameters<typeof queueMessage>[0],
  invite: { name: string; phone: string; token: string },
  artist: Doc<"staff">,
) {
  await queueMessage(ctx, {
    templateKey: "staff_invite",
    to: invite.phone,
    recipient: "manager",
    vars: { firstName: firstName(invite.name), artistName: firstName(artist.name), link: inviteLink(invite.token) },
  });
}

export const invite = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    phone: v.string(),
    permissions: v.optional(v.array(v.string())),
    sendSms: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const artist = await requireStaff(ctx, ["artist"]);
    const email = args.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("INVALID", "Enter a valid email.");
    const phone = normalizePhone(args.phone);
    if (!phone) fail("INVALID", "Enter a valid phone number.");
    const name = args.name.trim();
    if (name.length < 2) fail("INVALID", "Enter their name.");

    const existingStaff = await ctx.db.query("staff").filter((q) => q.eq(q.field("email"), email)).first();
    if (existingStaff) fail("INVALID", `${existingStaff.name} already has an account with that email.`);
    const pending = (await ctx.db.query("invites").withIndex("by_email", (q) => q.eq("email", email)).collect()).filter(
      (i) => !i.acceptedAt,
    );
    for (const p of pending) await ctx.db.delete(p._id); // a fresh invite replaces any older one

    const token = randomToken();
    const permissions = cleanPermissions(args.permissions ?? MANAGER_DEFAULTS);
    const id = await ctx.db.insert("invites", {
      email,
      name,
      phone,
      role: "manager",
      invitedBy: artist._id,
      token,
      expiresAt: Date.now() + INVITE_TTL_MS,
      permissions,
    });
    if (args.sendSms !== false) await sendInviteSms(ctx, { name, phone, token }, artist);
    await audit(ctx, artist._id, "invites", id, "created", { email, permissions });
    return { link: inviteLink(token) };
  },
});

/** New link + 7 more days (the old link stops working). */
export const resendInvite = mutation({
  args: { inviteId: v.id("invites"), sendSms: v.optional(v.boolean()) },
  handler: async (ctx, { inviteId, sendSms }) => {
    const artist = await requireStaff(ctx, ["artist"]);
    const inv = await ctx.db.get(inviteId);
    if (!inv || inv.acceptedAt) fail("NOT_FOUND", "That invite has already been used or removed.");
    const token = randomToken();
    await ctx.db.patch(inviteId, { token, expiresAt: Date.now() + INVITE_TTL_MS });
    if (sendSms !== false) await sendInviteSms(ctx, { name: inv.name, phone: inv.phone, token }, artist);
    await audit(ctx, artist._id, "invites", inviteId, "resent");
    return { link: inviteLink(token) };
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, { inviteId }) => {
    const artist = await requireStaff(ctx, ["artist"]);
    await ctx.db.delete(inviteId);
    await audit(ctx, artist._id, "invites", inviteId, "revoked");
  },
});

export const setInvitePermissions = mutation({
  args: { inviteId: v.id("invites"), permissions: v.array(v.string()) },
  handler: async (ctx, { inviteId, permissions }) => {
    const artist = await requireStaff(ctx, ["artist"]);
    const clean = cleanPermissions(permissions);
    await ctx.db.patch(inviteId, { permissions: clean });
    await audit(ctx, artist._id, "invites", inviteId, "permissions", { permissions: clean });
  },
});

// ───────────── access management ─────────────

export const setPermissions = mutation({
  args: { staffId: v.id("staff"), permissions: v.array(v.string()) },
  handler: async (ctx, { staffId, permissions }) => {
    const artist = await requireStaff(ctx, ["artist"]);
    const s = await ctx.db.get(staffId);
    if (!s) fail("NOT_FOUND", "Staff member not found.");
    if (s.role === "artist") fail("INVALID", "The artist always has full access.");
    const before = permissionsFor(s);
    const clean = cleanPermissions(permissions);
    await ctx.db.patch(staffId, { permissions: clean });
    await audit(ctx, artist._id, "staff", staffId, "permissions", {
      granted: clean.filter((p) => !before.includes(p)),
      revoked: before.filter((p) => !clean.includes(p)),
    });
  },
});

/** Deactivating takes effect immediately (every function checks `active`) and signs them out everywhere. */
export const setActive = mutation({
  args: { staffId: v.id("staff"), active: v.boolean() },
  handler: async (ctx, { staffId, active }) => {
    const artist = await requireStaff(ctx, ["artist"]);
    if (staffId === artist._id) fail("INVALID", "You can't deactivate your own account.");
    const s = await ctx.db.get(staffId);
    if (!s) fail("NOT_FOUND", "Staff member not found.");
    await ctx.db.patch(staffId, { active });
    if (!active) await ctx.scheduler.runAfter(0, internal.staff.signOutEverywhere, { userId: s.userId });
    await audit(ctx, artist._id, "staff", staffId, active ? "activated" : "deactivated");
  },
});

export const signOutEverywhere = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await invalidateSessions(ctx, { userId });
  },
});

export const updateMe = mutation({
  args: { name: v.string(), phone: v.string() },
  handler: async (ctx, args) => {
    const me = await requireStaff(ctx);
    const phone = normalizePhone(args.phone);
    if (!phone) fail("INVALID", "Enter a valid phone number.");
    await ctx.db.patch(me._id, { name: args.name.trim() || me.name, phone });
    await audit(ctx, me._id, "staff", me._id, "updated", { name: args.name, phone });
  },
});

// ───────────── passwords (actions: they call Convex Auth's credential helpers) ─────────────

export const _staffForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) =>
    await ctx.db.query("staff").withIndex("by_user", (q) => q.eq("userId", userId)).unique(),
});

export const _staffById = internalQuery({
  args: { staffId: v.id("staff") },
  handler: async (ctx, { staffId }) => await ctx.db.get(staffId),
});

export const _setMustChange = internalMutation({
  args: { staffId: v.id("staff"), value: v.boolean(), actor: v.id("staff"), action: v.string() },
  handler: async (ctx, { staffId, value, actor, action }) => {
    await ctx.db.patch(staffId, { mustChangePassword: value || undefined });
    await audit(ctx, actor, "staff", staffId, action);
  },
});

function tempPassword() {
  // Unambiguous characters, 12 long (~62 bits)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/**
 * Artist resets a manager's access: issues a one-time temporary password (shown once, to the artist),
 * signs the manager out everywhere, and forces them to choose a new password at next sign-in.
 */
export const resetPassword = action({
  args: { staffId: v.id("staff") },
  handler: async (ctx, { staffId }): Promise<{ tempPassword: string; email: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) fail("UNAUTHENTICATED", "Please sign in again.");
    const me = await ctx.runQuery(internal.staff._staffForUser, { userId });
    if (!me?.active || me.role !== "artist") fail("FORBIDDEN", "Only the artist can do that.");
    const target = await ctx.runQuery(internal.staff._staffById, { staffId });
    if (!target || !target.email) fail("NOT_FOUND", "Staff member not found.");
    if (target._id === me._id) fail("INVALID", "Use “Change password” in your profile for your own account.");
    const secret = tempPassword();
    await modifyAccountCredentials(ctx, { provider: "password", account: { id: target.email, secret } });
    await invalidateSessions(ctx, { userId: target.userId });
    await ctx.runMutation(internal.staff._setMustChange, { staffId, value: true, actor: me._id, action: "password_reset" });
    return { tempPassword: secret, email: target.email };
  },
});

/** Any staff member changes their own password. Current password required unless a reset forced it. */
export const changePassword = action({
  args: { currentPassword: v.optional(v.string()), newPassword: v.string() },
  handler: async (ctx, { currentPassword, newPassword }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) fail("UNAUTHENTICATED", "Please sign in again.");
    const me = await ctx.runQuery(internal.staff._staffForUser, { userId });
    if (!me?.active || !me.email) fail("FORBIDDEN", "Your account isn't active.");
    if (newPassword.length < MIN_PASSWORD) fail("INVALID", `Use at least ${MIN_PASSWORD} characters.`);
    if (!me.mustChangePassword) {
      try {
        await retrieveAccount(ctx, { provider: "password", account: { id: me.email, secret: currentPassword ?? "" } });
      } catch {
        fail("INVALID", "Your current password isn't right.");
      }
    }
    await modifyAccountCredentials(ctx, { provider: "password", account: { id: me.email, secret: newPassword } });
    await ctx.runMutation(internal.staff._setMustChange, {
      staffId: me._id as Id<"staff">,
      value: false,
      actor: me._id,
      action: "password_changed",
    });
  },
});
