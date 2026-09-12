/**
 * Nova Local AI — Main Service
 * Unified interface for local AI inference.
 */

import { localAIDetector, type LocalAIAvailability } from "./LocalAIDetector";
import { localAICache } from "./LocalAICache";
import {
  initializeModel,
  generateStream,
  cancelGeneration,
  unloadModel,
  isModelLoaded,
  isModelLoading,
  clearModelCache,
} from "./LocalAIModel";
import { classifyRequest } from "./LocalAIClassifier";

export type { LocalAIAvailability };

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LocalAIResponse {
  text: string;
  source: "local";
  latencyMs: number;
}

export interface GenerationCallbacks {
  onToken?: (accumulated: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

class LocalAIServiceImpl {
  private availability: LocalAIAvailability | null = null;
  private isDownloading = false;

  /**
   * Detect device capabilities.
   */
  async detect(): Promise<LocalAIAvailability> {
    if (!this.availability) {
      this.availability = await localAIDetector.detect();
    }
    return this.availability;
  }

  /**
   * Check if local AI is ready to use.
   */
  async isReady(): Promise<boolean> {
    const avail = await this.detect();
    return avail.supported && isModelLoaded();
  }

  /**
   * Download the model with progress tracking.
   */
  async downloadModel(
    onProgress?: (progress: { loaded: number; total: number; percent: number }) => void
  ): Promise<void> {
    if (this.isDownloading) return;
    this.isDownloading = true;
    this.lastDownloadFailed = false;
    try {
      await initializeModel();
      localAIDetector.markModelCached();
      onProgress?.({ loaded: 100, total: 100, percent: 100 });
    } catch (err) {
      this.lastDownloadFailed = true;
      throw err;
    } finally {
      this.isDownloading = false;
    }
  }

  /**
   * Ensure the model is loaded. Downloads if needed.
   */
  async ensureReady(): Promise<void> {
    if (isModelLoaded()) return;
    const avail = await this.detect();
    if (!avail.supported) {
      throw new Error(
        avail.reason || "Local AI is not supported on this device."
      );
    }
    await initializeModel();
  }

  /**
   * Generate a response using the local model.
   */
  async generate(
    messages: ChatMessage[],
    options?: { maxNewTokens?: number; temperature?: number },
    callbacks?: GenerationCallbacks
  ): Promise<LocalAIResponse> {
    const startTime = performance.now();

    await this.ensureReady();

    const response = await generateStream(
      messages,
      {
        maxNewTokens: options?.maxNewTokens ?? 256,
        temperature: options?.temperature ?? 0.7,
      },
      {
        onToken: callbacks?.onToken,
        onDone: callbacks?.onDone,
        onError: callbacks?.onError,
      }
    );

    const latencyMs = Math.round(performance.now() - startTime);
    return { text: response, source: "local", latencyMs };
  }

  /**
   * Classify a request to determine local vs cloud routing.
   */
  classify(input: string): ReturnType<typeof classifyRequest> {
    return classifyRequest(input);
  }

  /**
   * Cancel ongoing generation.
   */
  cancel(): void {
    cancelGeneration();
  }

  /**
   * Unload the model from memory.
   */
  unload(): void {
    unloadModel();
  }

  /**
   * Clear the downloaded model from browser storage.
   */
  async clearCache(): Promise<void> {
    await clearModelCache();
    this.availability = null;
  }

  /**
   * Check if the model is genuinely available: marker present AND the
   * cache actually holds model data. Repairs stale markers when the
   * cache is empty so the UI never shows a fake "cached" state.
   */
  async isCached(): Promise<boolean> {
    const marker = localAIDetector.isModelCached();
    const cacheHasData = await localAICache.isModelCached();
    if (marker && !cacheHasData) {
      // Stale marker with missing files — invalidate and repair.
      localAIDetector.clearModelCacheMarker();
      return false;
    }
    return marker || cacheHasData;
  }

  /**
   * Get the real model lifecycle state.
   */
  async getState(): Promise<import("./LocalAIDetector").LocalModelState> {
    const avail = await this.detect();
    if (!avail.supported && !isModelLoaded()) return "unavailable";
    if (isModelLoaded()) return "running";
    if (isModelLoading() || this.isDownloading) return this.isDownloading ? "downloading" : "loading";
    if (this.lastDownloadFailed) return "failed";
    if (await this.isCached()) return "ready";
    return "unknown";
  }

  private lastDownloadFailed = false;

  /**
   * Get model status as a human-readable string (backwards compatible).
   */
  getStatus(): string {
    if (isModelLoading()) return "Loading";
    if (isModelLoaded()) return "Ready";
    if (this.isDownloading) return "Downloading";
    if (this.lastDownloadFailed) return "Failed";
    return "Not installed";
  }
}

export const localAIService = new LocalAIServiceImpl();
