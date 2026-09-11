import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_MEETING_PATHS = [
  "/meeting-room/",
  "/api/meeting-room/",
  "/api/webhooks/recall",
  "/api/webhooks/attendee",
  "/api/health",
  "/_next/",
];

export function proxy(request: NextRequest) {
  // A client-supplied forwarded host must never override the tunnel's real host.
  const hosts = [
    request.headers.get("host") || "",
    request.headers.get("x-forwarded-host") || "",
    request.nextUrl.hostname,
  ].flatMap((value) => value.split(","));
  const isPublicTunnel = hosts.some((value) => value.trim().toLowerCase()
    .replace(/:\d+$/u, "").replace(/\.$/u, "").endsWith(".trycloudflare.com"));
  if (!isPublicTunnel) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  if (PUBLIC_MEETING_PATHS.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  return new NextResponse("Not found", { status: 404 });
}

export const config = {
  matcher: "/:path*",
};
