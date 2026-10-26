import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { normalizePhone } from "@drink/shared";
import type { MutationCtx } from "./_generated/server";
import { fail } from "./lib/errors";
import { hashSecret, verifySecret } from "./lib/passwordHash";
import { seedDefaults } from "./lib/seed";

/**
 * Convex Auth, email + password, staff only (TRD §2).
 * Sign-up is closed: the very first account becomes the artist (owner);
 * after that only someone holding the artist's invite link can create an account.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      crypto: { hashSecret, verifySecret },
      profile(params) {
        return {
          email: String(params.email).trim().toLowerCase(),
          ...(params.name ? { name: String(params.name).trim() } : {}),
          ...(params.phone ? { phone: String(params.phone) } : {}),
          ...(params.inviteToken ? { inviteToken: String(params.inviteToken) } : {}),
        };
      },
    }),
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(rawCtx, { userId, existingUserId, profile }) {
      if (existingUserId) return;
      const ctx = rawCtx as unknown as MutationCtx;
      const email = String(profile.email ?? "").toLowerCase();
      const anyStaff = await ctx.db.query("staff").first();

      if (!anyStaff) {
        const phone = normalizePhone(String(profile.phone ?? ""));
        if (!phone) fail("INVALID", "Enter your mobile number so the system can text you.");
        const staffId = await ctx.db.insert("staff", {
          userId,
          name: String(profile.name ?? "Artist"),
          email,
          phone,
          role: "artist",
          active: true,
        });
        await seedDefaults(ctx, staffId);
        return;
      }

      // Managers can only join through the artist's invite link: the token must match an open,
      // unexpired invite for this exact email.
      const token = String(profile.inviteToken ?? "");
      const invite = token
        ? await ctx.db
            .query("invites")
            .withIndex("by_token", (q) => q.eq("token", token))
            .unique()
        : null;
      if (!invite || invite.acceptedAt || invite.email !== email) {
        fail("NOT_INVITED", "This sign-up needs a valid invite link from the artist.");
      }
      if ((invite.expiresAt ?? 0) < Date.now()) {
        fail("NOT_INVITED", "This invite link has expired. Ask the artist to send a new one.");
      }
      await ctx.db.insert("staff", {
        userId,
        name: invite.name,
        email,
        phone: invite.phone,
        role: invite.role,
        active: true,
        permissions: invite.permissions,
      });
      await ctx.db.patch(userId, { inviteToken: undefined, name: invite.name });
      await ctx.db.patch(invite._id, { acceptedAt: Date.now() });
    },
  },
});
