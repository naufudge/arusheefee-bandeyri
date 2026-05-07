/**
 * Microsoft Graph helpers for two distinct flows:
 *   1. Per-login enrichment via the user's delegated access token (`/me`)
 *   2. Tenant sync via app-only client_credentials (`/users`)
 *
 * Both run server-side only. App credentials never leave Node.
 */

const TENANT_ID = process.env.AUTH_MICROSOFT_TENANT_ID!;
const CLIENT_ID = process.env.AUTH_MICROSOFT_CLIENT_ID!;
const CLIENT_SECRET = process.env.AUTH_MICROSOFT_CLIENT_SECRET!;

const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

let cachedAppToken: { token: string; expiresAt: number } | null = null;

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

// ---------- App-only: list the tenant ----------

async function getAppToken(): Promise<string> {
  // Return cached token if it still has >60s left.
  if (cachedAppToken && Date.now() < cachedAppToken.expiresAt - 60_000) {
    return cachedAppToken.token;
  }
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph app token fetch failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedAppToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedAppToken.token;
}

/**
 * List all licensed Member users in the tenant. Pages through @odata.nextLink
 * automatically, then filters to users with at least one assigned license
 * (this is the license-based shared-mailbox filter).
 */
export async function listTenantUsers(): Promise<GraphTenantUser[]> {
  const token = await getAppToken();
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
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Graph /users failed: ${res.status} ${text}`);
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
