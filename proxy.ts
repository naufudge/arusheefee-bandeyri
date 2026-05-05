import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/api/auth"];

// `auth` from next-auth v5 is itself a middleware factory: passing it a
// callback gives us the request augmented with `req.auth` (the session).
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // Unauthenticated request hitting a protected path → /login with the
  // intended destination preserved as ?callbackUrl=
  if (!req.auth && !isPublic) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Already signed in but visiting /login → bounce home
  if (req.auth && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

// Run on every request EXCEPT framework internals and static assets, so
// even direct hits to /print or /api/pv/* are gated.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.png|fonts/|icons/|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.webp$).*)",
  ],
};
