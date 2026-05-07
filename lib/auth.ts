import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { fetchUserProfile } from "@/lib/graph";
import { resolveStaff } from "@/lib/staff-resolve";

const TENANT_ID = process.env.AUTH_MICROSOFT_TENANT_ID!;

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_CLIENT_SECRET!,
      // Pinning the issuer to OUR tenant turns this into a single-tenant
      // login. Anyone signing in with a different tenant's account will
      // be rejected at the OIDC layer before our callbacks run.
      issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },

  callbacks: {
    // Defence in depth: also enforce the tenant check in code, in case the
    // issuer config is ever loosened.
    async signIn({ profile }) {
      if (!profile) return false;
      if (profile.tid !== TENANT_ID) return false;
      const email = (profile.email ?? profile.preferred_username) as
        | string
        | undefined;
      if (!email) return false;
      return true;
    },

    // Runs on every JWT generation. On the actual sign-in event we use the
    // shared matching cascade to find or create the Staff row, enrich it
    // with jobTitle/department from Graph, then stash the ids/identity on
    // the token so subsequent requests don't need a DB hit.
    async jwt({ token, profile, account, trigger }) {
      if (trigger === "signIn" && profile) {
        const azureOid = profile.oid as string;
        const email = (profile.email ??
          profile.preferred_username) as string;
        const name = (profile.name as string) ?? email;
        const emailNorm = email.toLowerCase();

        // Best-effort Graph enrichment. fetchUserProfile returns null on
        // any failure (timeout, 4xx, 5xx); resolveStaff treats null as
        // "leave existing values alone".
        const graph = account?.access_token
          ? await fetchUserProfile(account.access_token)
          : null;

        const staff = await resolveStaff({
          azureOid,
          email: emailNorm,
          name,
          jobTitle: graph?.jobTitle ?? null,
          department: graph?.department ?? null,
          trigger: "login",
        });

        token.staffId = staff.id;
        token.email = staff.email ?? emailNorm;
        token.name = staff.name;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.staffId as string;
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.name = (token.name as string) ?? session.user.name;
      }
      return session;
    },
  },
});
