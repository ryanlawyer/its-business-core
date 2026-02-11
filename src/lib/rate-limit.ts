/**
 * In-memory rate limiter using a Map with periodic cleanup.
 * Each key (IP or user) tracks request count and window expiry.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    // Periodic cleanup every 60 seconds to evict expired entries
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    // Allow the timer to not prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Check if a request is within rate limits.
   * Returns { allowed, retryAfterMs } where retryAfterMs is 0 if allowed.
   */
  check(key: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetAt) {
      this.limits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, retryAfterMs: Math.ceil((entry.resetAt - now) / 1000) };
    }

    entry.count++;
    return { allowed: true, retryAfterMs: 0 };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits) {
      if (now > entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }
}

// Singleton limiters for middleware use
export const apiLimiter = new RateLimiter(100, 60_000);   // 100 req/min for API routes
export const pageLimiter = new RateLimiter(200, 60_000);  // 200 req/min for page routes
