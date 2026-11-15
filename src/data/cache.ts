// Simple in-memory cache with TTL

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

const store = new Map<string, CacheEntry<unknown>>();

export const cache = {
  get<T>(key: string): T | undefined {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value as T;
  },

  set<T>(key: string, value: T, ttl: number = DEFAULT_TTL): void {
    store.set(key, { value, expiresAt: Date.now() + ttl });
  },

  clear(): void {
    store.clear();
  },
};
