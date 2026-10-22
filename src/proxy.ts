import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Content Security Policy for pages. A fresh nonce per request lets Next.js mark its own inline
 * scripts (and <Script> tags) as trusted; `strict-dynamic` then trusts what those load (the Google
 * Picker pulls in more from apis.google.com). Styles stay 'unsafe-inline' because framer-motion,
 * Base UI and recharts set styles inline.
 */
function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Avatars and Drive thumbnails come from Google-hosted URLs; images are low risk, so any https host is allowed.
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://www.googleapis.com https://docs.google.com https://content.googleapis.com",
    "frame-src 'self' https://docs.google.com https://drive.google.com https://accounts.google.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** Drop the stale session cookies when a revoked token sent someone back to sign in. */
function clearSession(res: NextResponse, revoked: boolean): NextResponse {
  if (revoked) {
    for (const name of ["next-auth.session-token", "__Secure-next-auth.session-token"]) res.cookies.set(name, "", { maxAge: 0, path: "/" });
  }
  return res;
}

/** Pass the nonce to Next (it reads the CSP from the request headers) and set the policy on the response. */
function withCsp(req: NextRequest, response: NextResponse): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  // Redirects carry the header too; for rendered pages Next needs the request headers to apply the nonce.
  const res = response.headers.get("location") ? response : NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

const AUTH_PAGES = ["/login", "/reset-password"];
// Legal pages are public: Google OAuth verification and customers need to read them without an account.
const PUBLIC_PAGES = ["/privacy", "/terms"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const raw = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  // A session whose account no longer exists or was deactivated is marked revoked by the JWT callback;
  // treat it as signed out (and clear the cookie) instead of serving a shell whose every API call fails.
  const revoked = Boolean(raw?.revoked);
  const token = revoked ? null : raw;
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));
  if (PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return withCsp(req, NextResponse.next());

  if (isAuthPage) {
    if (token && pathname.startsWith("/login")) {
      return withCsp(req, NextResponse.redirect(new URL("/dashboard/overview", req.url)));
    }
    return withCsp(req, NextResponse.next());
  }

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname + search);
    return withCsp(req, clearSession(NextResponse.redirect(loginUrl), revoked));
  }

  // Pages that need a permission send people without it to the jobs board (the token's permissions are
  // refreshed on every page load, so this follows role changes closely).
  const perms = (token.permissions as string[] | undefined) ?? [];
  const admin = token.role === "ADMIN";
  const needs = pathname.startsWith("/dashboard") ? "view_analytics" : pathname.startsWith("/transactions") ? "view_transactions" : null;
  if (!admin && ((needs && !perms.includes(needs)) || pathname.startsWith("/settings"))) {
    return withCsp(req, NextResponse.redirect(new URL("/jobs", req.url)));
  }

  return withCsp(req, NextResponse.next());
}

export const config = {
  // Every page except API routes (which check the session themselves), Next internals and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|assets/|fonts/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf)$).*)"],
};
