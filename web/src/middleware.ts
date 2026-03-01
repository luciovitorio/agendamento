import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export default async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const isLoggedIn = !!token;
  const { nextUrl } = req;
  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isAuthRoute = nextUrl.pathname === "/login";

  // Allow anyone to check API routes or images
  if (
    isApiAuthRoute ||
    nextUrl.pathname.startsWith("/_next") ||
    nextUrl.pathname.includes(".")
  ) {
    return;
  }

  if (isAuthRoute) {
    if (isLoggedIn) {
      return Response.redirect(new URL("/admin", nextUrl));
    }
    return;
  }

  // The admin dashboard is protected
  if (nextUrl.pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      return Response.redirect(new URL("/login", nextUrl));
    }
  }

  // The root URL is also restricted
  if (nextUrl.pathname === "/") {
    if (isLoggedIn) {
      return Response.redirect(new URL("/admin", nextUrl));
    } else {
      return Response.redirect(new URL("/login", nextUrl));
    }
  }

  return;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
