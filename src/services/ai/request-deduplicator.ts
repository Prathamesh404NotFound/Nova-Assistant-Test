import { NovaResponse } from "./types";

interface CacheEntry {
  response: NovaResponse;
  timestamp: number;
}

class RequestDeduplicator {
  private cache = new Map<string, CacheEntry>();
  private pendingPromises = new Map<string, Promise<NovaResponse>>();
  private readonly TTL_MS = 5000; // 5-second deduplication window

  generateFingerprint(input: string, context?: string): string {
    const normalized = input.toLowerCase().trim().replace(/\s+/g, " ");
    const ctx = context ? context.toLowerCase().trim() : "";
    return `${normalized}::${ctx}`;
  }

  getCached(fingerprint: string): NovaResponse | null {
    const entry = this.cache.get(fingerprint);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.TTL_MS) {
      this.cache.delete(fingerprint);
      return null;
    }

    return entry.response;
  }

  setCached(fingerprint: string, response: NovaResponse) {
    this.cache.set(fingerprint, {
      response,
      timestamp: Date.now(),
    });
  }

  getPending(fingerprint: string): Promise<NovaResponse> | null {
    return this.pendingPromises.get(fingerprint) || null;
  }

  setPending(fingerprint: string, promise: Promise<NovaResponse>) {
    this.pendingPromises.set(fingerprint, promise);
    promise.finally(() => {
      this.pendingPromises.delete(fingerprint);
    });
  }

  clear() {
    this.cache.clear();
    this.pendingPromises.clear();
  }
}

export const requestDeduplicator = new RequestDeduplicator();
