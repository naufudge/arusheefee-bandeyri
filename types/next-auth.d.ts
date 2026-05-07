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
    accessToken?: string;
    accessTokenExpiresAt?: number;
  }
}
