/**
 * Nova AI OS — Response Cache
 * LRU cache for AI responses to avoid redundant API calls.
 */

interface CacheEntry {
  key: string;
  response: string;
  source: "local" | "gemini";
  timestamp: number;
  hitCount: number;
}

class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 100, ttlMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  private generateKey(input: string, mode: string): string {
    return `${mode}:${input.toLowerCase().trim()}`;
  }

  get(input: string, mode: string): string | null {
    const key = this.generateKey(input, mode);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count and move to end (most recently used)
    entry.hitCount++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.response;
  }

  set(input: string, mode: string, response: string, source: "local" | "gemini"): void {
    const key = this.generateKey(input, mode);

    // If at capacity, remove least recently used (first entry)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      key,
      response,
      source,
      timestamp: Date.now(),
      hitCount: 0,
    });
  }

  has(input: string, mode: string): boolean {
    return this.get(input, mode) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; hitRate: number } {
    let totalHits = 0;
    let totalAccess = 0;
    this.cache.forEach((entry) => {
      totalHits += entry.hitCount;
      totalAccess += entry.hitCount + 1;
    });
    return {
      size: this.cache.size,
      hitRate: totalAccess > 0 ? totalHits / totalAccess : 0,
    };
  }
}

export const responseCache = new ResponseCache();
