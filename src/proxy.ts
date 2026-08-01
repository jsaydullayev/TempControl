import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/server/auth/session";

/**
 * Optimistic check only — it verifies that a session cookie is merely PRESENT.
 *
 * Next.js documents Proxy as unsuitable for "full session management or
 * authorization": it cannot reach the database, so it cannot tell a valid
 * session from a stale one. Real authorisation happens in `@/server/auth/dal`
 * and is re-run inside every page, route handler and server action.
 *
 * Because of that blindness it must NEVER redirect away from /login. A cookie
 * whose session no longer resolves — an old token after a reseed, a
 * deactivated building — would otherwise bounce forever: the page sends the
 * visitor to /login, the proxy sees a cookie and sends them back. The login
 * page does that redirect itself, where the session can actually be verified.
 *
 * (Renamed from `middleware.ts` — Next.js 16 calls this convention Proxy.)
 */
const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic) return NextResponse.next();

  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
