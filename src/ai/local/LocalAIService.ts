/**
 * Nova Local AI — Main Service
 * The CANONICAL local inference interface. The rest of Nova must use this
 * service, never touch Transformers.js directly.
 *
 * Contract: detect / initialize / ensureReady / generate / generateStream /
 * cancel / dispose / getStatus / getDiagnostics / clearCache
 *
 * The Nova system prompt, chat-template message ordering, sliding history
 * window and memory context are applied here so every caller gets identical,
 * correct model formatting.
 */

import { localAIDetector, type LocalAIAvailability } from "./LocalAIDetector";
import { localAICache } from "./LocalAICache";
import {
  initializeModel,
  generateLocally,
  generateStream,
  cancelGeneration,
  unloadModel,
  isModelLoaded,
  isModelLoading,
  clearModelCache,
  getLifecycle,
  getModelDiagnostics,
  onLifecycleChange,
  type LocalModelLifecycle,
  type ModelDiagnostics,
} from "./LocalAIModel";
import { classifyRequest } from "./LocalAIClassifier";
import {
  LOCAL_MODEL_CONFIG,
  MODEL_CACHE_VERSION,
  NOVA_LOCAL_SYSTEM_PROMPT,
  HISTORY_WINDOW_TURNS,
} from "./LocalModelConfig";

export type { LocalAIAvailability, LocalModelLifecycle, ModelDiagnostics };
export { LOCAL_MODEL_CONFIG, MODEL_CACHE_VERSION };

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
  onDone?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/** Assemble model messages: Nova system prompt + compact recent history. */
function buildModelMessages(
  conversationHistory: Array<{ role: string; content: string }>,
  currentInput: string,
  options?: { systemPrompt?: string; memoryContext?: string }
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  let system = options?.systemPrompt ?? NOVA_LOCAL_SYSTEM_PROMPT;
  if (options?.memoryContext) {
    // Selected relevant memories only — never the whole database.
    system += `\n\nRelevant user context:\n${options.memoryContext}`;
  }
  messages.push({ role: "system", content: system });

  // Sliding window keeps the prompt small and inference fast.
  const recent = conversationHistory.slice(-HISTORY_WINDOW_TURNS);
  for (const msg of recent) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: "user", content: currentInput });
  return messages;
}

class LocalAIServiceImpl {
  private availability: LocalAIAvailability | null = null;
  private isDownloading = false;
  private lastDownloadFailed = false;

  /** Detect device capabilities (WebGPU validated via real adapter request). */
  async detect(): Promise<LocalAIAvailability> {
    if (!this.availability) {
      this.availability = await localAIDetector.detect();
    }
    return this.availability;
  }

  /** True only when the model is actually loaded and READY. */
  async isReady(): Promise<boolean> {
    return isModelLoaded() && (getLifecycle() === "ready" || getLifecycle() === "running");
  }

  /**
   * Download the model with progress tracking. Resolves only after a real
   * warm-up succeeded (lifecycle READY) — never a spinner-then-lie.
   */
  async downloadModel(
    onProgress?: (progress: { loaded: number; total: number; percent: number }) => void
  ): Promise<void> {
    if (this.isDownloading) return;
    this.isDownloading = true;
    this.lastDownloadFailed = false;
    try {
      // downloadModel in the model manager loads + warm-ups + marks cached.
      const mod = await import("./LocalAIModel");
      await mod.downloadModel(onProgress);
    } catch (err) {
      this.lastDownloadFailed = true;
      throw err;
    } finally {
      this.isDownloading = false;
    }
  }

  /** Ensure the model is loaded + warmed. Throws honestly on failure. */
  async ensureReady(): Promise<void> {
    const avail = await this.detect();
    if (!avail.supported) {
      throw new Error(avail.reason || "Local AI is not supported on this device.");
    }
    await initializeModel();
  }

  /** Initialize without downloading semantics (alias for ensureReady). */
  async initialize(): Promise<void> {
    await this.ensureReady();
  }

  /**
   * Generate a full response. Applies the Nova system prompt + history
   * window internally when raw messages are not provided.
   */
  async generate(
    messagesOrInput: ChatMessage[] | string,
    options?: { maxNewTokens?: number; temperature?: number; memoryContext?: string },
    callbacks?: GenerationCallbacks,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<LocalAIResponse> {
    const startTime = performance.now();
    await this.ensureReady();

    const messages = typeof messagesOrInput === "string"
      ? buildModelMessages(conversationHistory, messagesOrInput, { memoryContext: options?.memoryContext })
      : messagesOrInput;

    const response = await generateStream(
      messages,
      {
        maxNewTokens: options?.maxNewTokens ?? LOCAL_MODEL_CONFIG.recommendedMaxTokens,
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

  /** Streaming generation — real incremental tokens from the model. */
  async generateStream(
    messagesOrInput: ChatMessage[] | string,
    options?: { maxNewTokens?: number; temperature?: number; memoryContext?: string },
    callbacks?: GenerationCallbacks,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<string> {
    await this.ensureReady();
    const messages = typeof messagesOrInput === "string"
      ? buildModelMessages(conversationHistory, messagesOrInput, { memoryContext: options?.memoryContext })
      : messagesOrInput;

    return generateStream(
      messages,
      {
        maxNewTokens: options?.maxNewTokens ?? LOCAL_MODEL_CONFIG.recommendedMaxTokens,
        temperature: options?.temperature ?? 0.7,
      },
      callbacks
    );
  }

  /** Classify a request to determine local vs cloud routing. */
  classify(input: string): ReturnType<typeof classifyRequest> {
    return classifyRequest(input);
  }

  /** Cancel the current generation; model stays loaded, partial output valid. */
  cancel(): void {
    cancelGeneration();
  }

  /** Explicitly dispose the model (frees memory). */
  dispose(): void {
    unloadModel();
  }

  /** Alias kept for existing callers. */
  unload(): void {
    this.dispose();
  }

  /** Clear the downloaded model from browser storage. */
  async clearCache(): Promise<void> {
    await clearModelCache();
    this.availability = null;
  }

  /**
   * Check if the CURRENT model version is genuinely available: version
   * marker present AND the browser cache holds the model data. A marker
   * from the previous model (qwen3-0.6b) is stale — invalidates it.
   */
  async isCached(): Promise<boolean> {
    const markerCurrent = localAIDetector.isModelCached(MODEL_CACHE_VERSION);
    const markerAny = localAIDetector.isModelCached();
    const cacheHasData = await localAICache.hasTransformersCache();

    // Old-model marker → invalidate so the UI shows the truth.
    if (markerAny && !markerCurrent) {
      localAIDetector.clearModelCacheMarker();
      return false;
    }
    // Marker present but assets missing (private mode eviction etc.) → repair.
    if (markerCurrent && !cacheHasData) {
      localAIDetector.clearModelCacheMarker();
      return false;
    }
    return markerCurrent && cacheHasData;
  }

  /** Get the real model lifecycle state — never inferred from a flag alone. */
  async getState(): Promise<LocalModelLifecycle> {
    if (getLifecycle() !== "unknown") return getLifecycle();
    const avail = await this.detect();
    if (!avail.supported) return "unavailable";
    if (this.isDownloading) return "downloading";
    if (this.lastDownloadFailed) return "failed";
    if (await this.isCached()) return "ready";
    return "unknown";
  }

  /** Human-readable status for the UI. */
  getStatus(): string {
    const lc = getLifecycle();
    if (lc === "running") return "Running";
    if (lc === "ready") return "Ready";
    if (lc === "warming" || lc === "loading") return "Loading";
    if (lc === "downloading" || this.isDownloading) return "Downloading";
    if (lc === "failed" || this.lastDownloadFailed) return "Failed";
    if (lc === "unavailable") return "Unavailable";
    return "Not installed";
  }

  /** Dev diagnostics: load/warm-up/inference timings + backend + dtype. */
  getDiagnostics(): ModelDiagnostics {
    return getModelDiagnostics();
  }

  /** Subscribe to lifecycle changes (UI progress without polling). */
  onStateChange(cb: (s: LocalModelLifecycle) => void): () => void {
    return onLifecycleChange(cb);
  }
}

export const localAIService = new LocalAIServiceImpl();
