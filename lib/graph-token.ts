import type { JWT } from "next-auth/jwt";

// Renews the delegated Microsoft Graph token kept on the session. Access
// tokens last about an hour; the refresh token (from `offline_access`) lets
// the session keep a working one instead of failing Graph calls until the
// user signs in again.

const SCOPE = "openid profile email User.Read User.Read.All offline_access";
/** Renew this long before expiry, so a token never runs out mid-request. */
const EARLY_SECONDS = 300;

export function graphTokenNeedsRefresh(token: JWT, nowSeconds = Date.now() / 1000): boolean {
  return (
    Boolean(token.refreshToken) &&
    typeof token.accessTokenExpiresAt === "number" &&
    nowSeconds >= token.accessTokenExpiresAt - EARLY_SECONDS
  );
}

export async function refreshGraphToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.AUTH_MICROSOFT_CLIENT_ID ?? "",
          client_secret: process.env.AUTH_MICROSOFT_CLIENT_SECRET ?? "",
          grant_type: "refresh_token",
          refresh_token: token.refreshToken ?? "",
          scope: SCOPE,
        }),
        signal: AbortSignal.timeout(5_000),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number | string;
      refresh_token?: string;
      error?: string;
    };
    if (!res.ok || !data.access_token) throw new Error(data.error ?? `HTTP ${res.status}`);
    return {
      ...token,
      accessToken: data.access_token,
      accessTokenExpiresAt: Math.floor(Date.now() / 1000) + (Number(data.expires_in) || 3600),
      refreshToken: data.refresh_token ?? token.refreshToken,
    };
  } catch (err) {
    // Only the error code is logged, never a token.
    console.warn("[auth] Graph token refresh failed:", err instanceof Error ? err.message : err);
    // Drop the tokens so every later request doesn't retry (and wait); Graph
    // calls then ask the user to sign in again.
    return { ...token, accessToken: undefined, accessTokenExpiresAt: undefined, refreshToken: undefined };
  }
}
