import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { prisma } from "@/lib/prisma";

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
    // matching cascade below to find or create the Staff row, then stash
    // its id + identity on the token so subsequent requests don't need a
    // DB hit.
    async jwt({ token, profile, trigger }) {
      if (trigger === "signIn" && profile) {
        const azureOid = profile.oid as string;
        const email = (profile.email ??
          profile.preferred_username) as string;
        const name = (profile.name as string) ?? email;
        const emailNorm = email.toLowerCase();

        const staff = await resolveStaff({ azureOid, email: emailNorm, name });

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

/**
 * Match-or-create cascade for sign-in:
 *   1. azureOid     → already linked from a prior login
 *   2. email        → existing Staff with matching email (case-insensitive),
 *                     hasn't logged in before
 *   3. name + email-is-null → legacy Staff row predating SSO that has no
 *                             email yet; fill it in
 *   4. fallback     → INSERT a new Staff (source = "login")
 */
async function resolveStaff(args: {
  azureOid: string;
  email: string;
  name: string;
}) {
  const { azureOid, email, name } = args;
  const now = new Date();

  // 1. Match by Azure object id
  const byOid = await prisma.staff.findUnique({ where: { azureOid } });
  if (byOid) {
    return prisma.staff.update({
      where: { id: byOid.id },
      data: { email, name, lastLoginAt: now, isActive: true },
    });
  }

  // 2. Match by email (case-insensitive)
  const byEmail = await prisma.staff.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (byEmail) {
    return prisma.staff.update({
      where: { id: byEmail.id },
      data: {
        azureOid,
        name,
        lastLoginAt: now,
        isActive: true,
        // Keep "legacy" if it was legacy, else mark as login
        source: byEmail.source === "legacy" ? "legacy" : "login",
      },
    });
  }

  // 3. Match a legacy Staff (email NULL) by name (case-insensitive)
  const byName = await prisma.staff.findFirst({
    where: {
      email: null,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (byName) {
    return prisma.staff.update({
      where: { id: byName.id },
      data: {
        azureOid,
        email,
        lastLoginAt: now,
        isActive: true,
        // Was legacy — keep that source so we know they pre-existed SSO
      },
    });
  }

  // 4. Create
  return prisma.staff.create({
    data: {
      name,
      email,
      azureOid,
      designation: "", // unknown until set manually or via tenant sync (Phase B)
      lastLoginAt: now,
      isActive: true,
      source: "login",
    },
  });
}
