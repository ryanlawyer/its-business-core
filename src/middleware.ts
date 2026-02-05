import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Force Node.js runtime to support Prisma and file system access
export const runtime = "nodejs";

// Setup status is cached in memory to avoid DB calls on every request
// It's invalidated when setup completes (requires app restart or cache clear)
let setupCompleteCache: boolean | null = null;

async function checkSetupComplete(): Promise<boolean> {
  if (setupCompleteCache !== null) {
    return setupCompleteCache;
  }

  try {
    // Dynamic import to avoid issues during build
    const { prisma } = await import("@/lib/prisma");
    const config = await prisma.systemConfig.findUnique({
      where: { key: "setup_complete" },
    });
    setupCompleteCache = config?.value === "true";
    return setupCompleteCache;
  } catch (error) {
    // Database might not exist yet - setup not complete
    console.error("Setup check error:", error);
    return false;
  }
}

// Export for testing/cache invalidation
export function clearSetupCache() {
  setupCompleteCache = null;
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Always allow static assets and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Always allow auth API routes (needed for session checks during setup)
  const isAuthApi = pathname.startsWith("/api/auth");
  if (isAuthApi) {
    return NextResponse.next();
  }

  // Check if setup is complete
  const isSetupComplete = await checkSetupComplete();

  // Setup routes
  const isSetupPage = pathname.startsWith("/setup");
  const isSetupApi = pathname.startsWith("/api/setup");

  if (!isSetupComplete) {
    // Not configured - only allow setup routes
    if (isSetupPage || isSetupApi) {
      return NextResponse.next();
    }
    // Redirect everything else to setup
    return NextResponse.redirect(new URL("/setup", req.url));
  }

  // Setup complete - block setup routes
  if (isSetupPage || isSetupApi) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Normal auth flow for configured system
  const isLoggedIn = !!req.auth;
  const isAuthPage = pathname.startsWith("/auth");

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
