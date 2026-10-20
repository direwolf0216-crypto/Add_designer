import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PAGES = ["/login", "/reset-password"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (isAuthPage) {
    if (token && pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/dashboard/overview", req.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Every page except API routes (which check the session themselves), Next internals and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|assets/|fonts/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf)$).*)"],
};
