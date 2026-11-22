/**
 * Microsoft Graph helpers — both flows are now delegated.
 *
 *   1. Per-login enrichment via the user's delegated access token (`/me`)
 *      — the token comes straight from `account.access_token` in the
 *      next-auth jwt callback.
 *
 *   2. Tenant sync via the same delegated access token (`/users`)
 *      — the token is persisted onto the JWT/session at sign-in time
 *      and read back via `auth()` server-side. Requires the user to have
 *      consented to the `User.Read.All` scope (admin-consent permission).
 *
 * Note on token lifetime: Microsoft delegated access tokens last ~1 hour.
 * The session renews them with the refresh token (lib/graph-token.ts). If
 * that fails (e.g. the refresh token was revoked), the token is dropped and
 * Graph calls ask the user to sign out and back in.
 */

import { auth } from "@/lib/auth";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export type GraphProfile = {
  jobTitle: string | null;
  department: string | null;
};

export type GraphTenantUser = {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle: string | null;
  department: string | null;
  accountEnabled: boolean;
  assignedLicenses: { skuId: string }[];
  userType: string;
};

// ---------- Delegated: enrich the just-signed-in user ----------

/**
 * Fetch jobTitle / department for the user whose access token this is.
 * Returns null on any failure — callers must NOT rely on this succeeding;
 * sign-in continues regardless.
 */
export async function fetchUserProfile(
  accessToken: string,
): Promise<GraphProfile | null> {
  try {
    const res = await fetch(
      `${GRAPH_BASE}/me?$select=jobTitle,department`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!res.ok) {
      console.warn(`[graph] /me ${res.status} ${res.statusText}`);
      return null;
    }
    const data = (await res.json()) as Partial<GraphProfile>;
    return {
      jobTitle: data.jobTitle ?? null,
      department: data.department ?? null,
    };
  } catch (err) {
    console.warn(
      "[graph] /me threw:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ---------- Delegated: list the tenant ----------

const SIGN_IN_AGAIN = "Your Microsoft sign-in has expired. Sign out and back in, then sync again.";

/**
 * List all licensed Member users in the tenant. Acts on behalf of the
 * currently-signed-in user (delegated). Pages through `@odata.nextLink`
 * automatically, then filters to users with at least one assigned license
 * (the license-based shared-mailbox filter).
 *
 * Throws if no signed-in session is available, if the access token is
 * missing, or if Graph returns a non-2xx response.
 */
export async function listTenantUsers(): Promise<GraphTenantUser[]> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("listTenantUsers: no active session");
  }
  const accessToken = session.accessToken;
  if (!accessToken) throw new Error(SIGN_IN_AGAIN);

  const select = [
    "id",
    "displayName",
    "mail",
    "userPrincipalName",
    "jobTitle",
    "department",
    "accountEnabled",
    "assignedLicenses",
    "userType",
  ].join(",");
  const filter = "accountEnabled eq true and userType eq 'Member'";

  const all: GraphTenantUser[] = [];
  let url: string | null = `${GRAPH_BASE}/users?$select=${select}&$filter=${encodeURIComponent(
    filter,
  )}&$top=999`;

  while (url) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new Error("Microsoft Graph didn't respond. Try again in a few minutes.");
    }
    if (!res.ok) {
      // Graph's error code only (no token), for the server log.
      const code = await res.json().then((j) => j?.error?.code).catch(() => null);
      console.warn(`[graph] /users ${res.status}${code ? ` ${code}` : ""}`);
      if (res.status === 401) throw new Error(SIGN_IN_AGAIN);
      if (res.status === 403) {
        throw new Error(
          "Microsoft refused access to the tenant's user list: the app's User.Read.All permission needs admin consent.",
        );
      }
      throw new Error(`Microsoft Graph returned an error (${res.status}). Try again in a few minutes.`);
    }
    const data = (await res.json()) as {
      value: GraphTenantUser[];
      "@odata.nextLink"?: string;
    };
    all.push(...data.value);
    url = data["@odata.nextLink"] ?? null;
  }

  return all.filter((u) => u.assignedLicenses && u.assignedLicenses.length > 0);
}
