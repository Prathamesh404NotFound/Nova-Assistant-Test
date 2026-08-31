/**
 * Nova Local AI — Model Cache
 * Uses the browser Cache API to store the large model file.
 * Much better than localStorage for multi-hundred-MB artifacts.
 */

const CACHE_NAME = "nova-local-ai-model-v1";
const MODEL_URL_PREFIX = "nova-local-model://";
const METADATA_KEY = "nova_local_model_meta";

export interface ModelMetadata {
  modelId: string;
  version: string;
  backend: string;
  quantization: string;
  downloadedAt: number;
  size: number;
}

export class LocalAICache {
  /**
   * Check if the model is cached via Cache API.
   */
  async isModelCached(): Promise<boolean> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      return keys.some((req) => req.url.startsWith(MODEL_URL_PREFIX));
    } catch {
      return false;
    }
  }

  /**
   * Get the cached model as a blob URL.
   */
  async getCachedModel(): Promise<string | null> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      const modelReq = keys.find((req) => req.url.startsWith(MODEL_URL_PREFIX));
      if (!modelReq) return null;
      const response = await cache.match(modelReq);
      if (!response) return null;
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }

  /**
   * Store a downloaded model blob in the cache.
   */
  async storeModel(blob: Blob, metadata: ModelMetadata): Promise<void> {
    const cache = await caches.open(CACHE_NAME);
    const url = `${MODEL_URL_PREFIX}${metadata.modelId}`;
    const response = new Response(blob, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(blob.size),
      },
    });
    await cache.put(new Request(url), response);
    // Store metadata
    try {
      localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
    } catch { /* ignore */ }
  }

  /**
   * Get stored model metadata.
   */
  getMetadata(): ModelMetadata | null {
    try {
      const raw = localStorage.getItem(METADATA_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Delete cached model from Cache API.
   */
  async deleteModel(): Promise<void> {
    try {
      await caches.delete(CACHE_NAME);
      localStorage.removeItem(METADATA_KEY);
    } catch { /* ignore */ }
  }

  /**
   * Get approximate cached model size in bytes.
   */
  async getCachedSize(): Promise<number> {
    try {
      const meta = this.getMetadata();
      if (meta?.size) return meta.size;
      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      const modelReq = keys.find((req) => req.url.startsWith(MODEL_URL_PREFIX));
      if (!modelReq) return 0;
      const response = await cache.match(modelReq);
      if (!response) return 0;
      const blob = await response.blob();
      return blob.size;
    } catch {
      return 0;
    }
  }
}

export const localAICache = new LocalAICache();
