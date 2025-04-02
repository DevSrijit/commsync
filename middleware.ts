import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getToken } from "next-auth/jwt";

// Track the last sync time
let lastSyncTime = 0;
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip the middleware checks for API routes and static assets
  if (
    path.startsWith("/api/") ||
    path.match(/\.(jpg|jpeg|png|gif|svg|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // Check authentication status
  const token = await getToken({ req: request });
  const isAuthenticated = !!token;

  // Define protected routes that require authentication
  const protectedRoutes = ["/dashboard", "/pricing"];
  const authRoutes = ["/login", "/auth"];

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && (path === "/" || authRoutes.includes(path))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users away from protected routes
  if (
    !isAuthenticated &&
    protectedRoutes.some((route) => path.startsWith(route))
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Get the internal API key
  const apiKey = process.env.SYNC_API_KEY;
  if (!apiKey) {
    console.warn("Sync API key not set, skipping automatic operations");
    return NextResponse.next();
  }

  // Handle periodic sync
  const now = Date.now();
  if (now - lastSyncTime > SYNC_INTERVAL_MS) {
    lastSyncTime = now;

    // Trigger the background sync
    try {
      fetch(`${request.nextUrl.origin}/api/sync?apiKey=${apiKey}`, {
        method: "GET",
      }).catch((error) => {
        console.error("Error triggering automatic sync:", error);
      });

      console.log("Triggered automatic sync at", new Date().toISOString());
    } catch (error) {
      console.error("Failed to trigger automatic sync:", error);
    }
  }

  return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    // Match all request paths except those starting with:
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
