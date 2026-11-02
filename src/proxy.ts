import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Sends anyone who hasn't entered the passcode to /login.
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || (await verifySession(request.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.next();
  }
  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked. Reload and enter the passcode." }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
