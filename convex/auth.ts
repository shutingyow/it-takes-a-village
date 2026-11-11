import Apple from "@auth/core/providers/apple";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * Apple + Google OAuth + email/password via Convex Auth.
 *
 * Env (Convex dashboard / `npx convex env set`):
 * - AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
 * - AUTH_APPLE_ID (Services ID), AUTH_APPLE_SECRET (JWT, max 6 months)
 * - SITE_URL (e.g. https://takesavillage.co)
 *
 * Callbacks:
 * - {CONVEX_SITE_URL}/api/auth/callback/google
 * - {CONVEX_SITE_URL}/api/auth/callback/apple
 *
 * Password accounts work in-app (no OAuth browser). Reset/verify email can be
 * added later via Password({ reset, verify }).
 */
const NATIVE_AUTH_SCHEME = "ittakesavillage://";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "")
          .trim()
          .toLowerCase();
        if (!email || !email.includes("@")) {
          throw new Error("Invalid email");
        }
        return { email };
      },
    }),
    Google,
    Apple({
      // Preserve name on first Sign in with Apple (only sent once).
      profile: (appleProfile) => {
        const profile = appleProfile as {
          sub: string;
          email?: string | null;
          name?: { firstName?: string; lastName?: string };
        };
        const parts = [profile.name?.firstName, profile.name?.lastName].filter(
          Boolean
        ) as string[];
        return {
          id: profile.sub,
          name: parts.length > 0 ? parts.join(" ") : undefined,
          email: profile.email ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    // Allow Capacitor to return to the app via custom URL scheme after OAuth
    // instead of landing on SITE_URL in Safari.
    async redirect({ redirectTo }) {
      const site = (process.env.SITE_URL ?? "").replace(/\/$/, "");
      if (redirectTo.startsWith(NATIVE_AUTH_SCHEME)) {
        return redirectTo;
      }
      if (redirectTo.startsWith("/") || redirectTo.startsWith("?")) {
        if (!site) {
          throw new Error("SITE_URL is not configured");
        }
        return `${site}${redirectTo}`;
      }
      if (site && redirectTo.startsWith(site)) {
        return redirectTo;
      }
      throw new Error(`Invalid redirectTo: ${redirectTo}`);
    },
  },
});
