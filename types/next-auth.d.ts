import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
    };
    /**
     * Effective RBAC permissions for the signed-in user (union of all
     * permissions across all assigned roles). Computed at sign-in and
     * cached on the JWT — changes take effect on next sign-in.
     * Safe to expose to the client (used for UI gating via
     * useHasPermission). Server-side checks remain authoritative.
     */
    permissions: string[];
    /**
     * Microsoft Graph delegated access token. Server-only — the root
     * layouts strip this field before passing the session to
     * <SessionProvider>, so it never reaches the browser. Read it via
     * `await auth()` in route handlers / server components.
     */
    accessToken?: string;
    /** Unix seconds; useful to gate calls when the token is near expiry. */
    accessTokenExpiresAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    staffId?: string;
    email?: string;
    name?: string;
    permissions?: string[];
    accessToken?: string;
    accessTokenExpiresAt?: number;
  }
}
