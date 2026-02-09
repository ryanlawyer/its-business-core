import { auth } from "@/auth";
import { NextResponse } from "next/server";

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

// Proper static asset detection — no generic dot-includes check
const STATIC_FILE_EXT = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|webp|avif|mp4|webm)$/;

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    STATIC_FILE_EXT.test(pathname)
  );
}

// CSRF protection: validate Origin/Referer for state-changing requests
function validateCsrf(req: Request, pathname: string): boolean {
  const method = req.method;
  // Only check state-changing methods
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }

  // Allow auth API routes (login needs to work without CSRF)
  if (pathname.startsWith("/api/auth")) {
    return true;
  }

  // Allow setup API (no session exists yet during setup)
  if (pathname.startsWith("/api/setup")) {
    return true;
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");

  if (!host) {
    return false;
  }

  // Check Origin header first (most reliable)
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }

  // Fall back to Referer header
  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      return refererHost === host;
    } catch {
      return false;
    }
  }

  // If neither header is present, allow (some browser configs strip these)
  // This is acceptable per OWASP guidelines since we also have session cookies
  return true;
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Always allow static assets
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // CSRF validation for state-changing requests
  if (!validateCsrf(req, pathname)) {
    return NextResponse.json(
      { error: "CSRF validation failed" },
      { status: 403 }
    );
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/receipts/upload|api/purchase-orders/.*/upload-receipt|api/statements|api/admin/restore).*)"],
};
