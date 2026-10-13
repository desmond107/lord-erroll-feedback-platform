import { NextResponse, type NextRequest } from "next/server";

// Cheap gate: bounce visitors without a session cookie. Real validation happens server-side.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/portal/login")) return NextResponse.next();
  if (!req.cookies.get("le_session")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/portal/login";
    url.search = pathname === "/portal" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/portal/:path*", "/api/portal/:path*"] };
