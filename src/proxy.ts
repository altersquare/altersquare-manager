import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Block members without a GitHub username from accessing the app
  const { pathname } = req.nextUrl;
  if (
    req.auth.user?.role !== "admin" &&
    !req.auth.user?.githubUsername &&
    pathname !== "/no-access"
  ) {
    return NextResponse.redirect(new URL("/no-access", req.url));
  }

  // If a member WITH a GitHub username tries to visit /no-access, send them home
  if (
    pathname === "/no-access" &&
    (req.auth.user?.role === "admin" || req.auth.user?.githubUsername)
  ) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - api (all API routes — auth handled per-route)
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!api|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)",
  ],
};
