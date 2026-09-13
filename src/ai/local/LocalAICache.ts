/**
 * Nova Local AI — Model Cache Metadata
 *
 * The model weights themselves are cached by Transformers.js / the browser
 * Cache API (under our configured cacheDir). This module stores only
 * lightweight METADATA and provides cache-presence detection so the UI never
 * shows a fake "cached" state and never duplicates the model on disk.
 */

import { MODEL_CACHE_VERSION } from "./LocalModelConfig";

const METADATA_KEY = "nova_local_model_meta";

export interface ModelMetadata {
  modelId: string;
  version: string;
  downloadedAt: number;
}

export class LocalAICache {
  /**
   * Detect whether the Transformers.js browser cache actually holds model
   * assets. Checks Cache API entries belonging to our cacheDir.
   */
  async hasTransformersCache(): Promise<boolean> {
    try {
      if (typeof caches === "undefined") return false;
      const names = await caches.keys();
      for (const name of names) {
        if (!name.includes("nova-ai-cache") && !name.includes("transformers-cache")) continue;
        const cache = await caches.open(name);
        const keys = await cache.keys();
        // Any cached model asset counts (onnx weights, tokenizer, config).
        if (keys.some((req) => req.url.includes("Qwen2.5-0.5B") || req.url.includes("onnx"))) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /** Store lightweight download metadata (never the weights themselves). */
  async storeMetadata(modelId: string): Promise<void> {
    try {
      const meta: ModelMetadata = {
        modelId,
        version: MODEL_CACHE_VERSION,
        downloadedAt: Date.now(),
      };
      localStorage.setItem(METADATA_KEY, JSON.stringify(meta));
    } catch { /* ignore */ }
  }

  getMetadata(): ModelMetadata | null {
    try {
      const raw = localStorage.getItem(METADATA_KEY);
      return raw ? (JSON.parse(raw) as ModelMetadata) : null;
    } catch {
      return null;
    }
  }

  /** Metadata from a previous model version → stale. */
  isMetadataCurrent(): boolean {
    const meta = this.getMetadata();
    return !!meta && meta.version === MODEL_CACHE_VERSION;
  }

  clearMetadata(): void {
    try {
      localStorage.removeItem(METADATA_KEY);
    } catch { /* ignore */ }
  }

  /** Approximate storage requirement for the current model (bytes). */
  getApproximateSize(): number {
    return 380 * 1024 * 1024; // q4 quantized weights + tokenizer (~380 MB)
  }
}

export const localAICache = new LocalAICache();
