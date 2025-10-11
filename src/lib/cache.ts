/**
 * Simple in-memory cache for frequently accessed data
 * Uses Map with TTL (time-to-live) for automatic expiration
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class InMemoryCache {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number;

  constructor(defaultTTL: number = 300000) { // 5 minutes default
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get value from cache
   * Returns null if key doesn't exist or has expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set value in cache with optional TTL in milliseconds
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Delete all expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const cache = new InMemoryCache();

// Run cleanup every 60 seconds (only in Node.js environment, not during build)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 60000);
}

/**
 * Cache key generators for consistency
 */
export const CacheKeys = {
  budgetItems: (fiscalYear?: number) =>
    fiscalYear ? `budget-items:${fiscalYear}` : 'budget-items:all',
  vendors: () => 'vendors:all',
  departments: (includeInactive: boolean = false) =>
    `departments:${includeInactive ? 'all' : 'active'}`,
  roles: () => 'roles:all',
  userPermissions: (userId: string) => `user-permissions:${userId}`,
  formData: () => 'po-form-data',
};
