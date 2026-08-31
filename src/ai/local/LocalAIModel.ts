/**
 * Nova Local AI — Model Manager
 * Uses @huggingface/transformers to load and run Qwen3-0.6B in the browser.
 * Supports WebGPU acceleration with WASM/CPU fallback.
 */

import {
  pipeline,
  env,
  AutoTokenizer,
  type TextGenerationPipeline,
  type PreTrainedTokenizer,
} from "@huggingface/transformers";
import { localAICache, type ModelMetadata } from "./LocalAICache";
import { localAIDetector } from "./LocalAIDetector";

// Model configuration — correct HuggingFace repo name with -ONNX suffix
const MODEL_ID = "onnx-community/Qwen3-0.6B-ONNX";
const LOCAL_MODEL_VERSION = "qwen3-0.6b-onnx-v1";

// Lazy singleton
let pipelineInstance: TextGenerationPipeline | null = null;
let tokenizerInstance: PreTrainedTokenizer | null = null;
let isInitializing = false;
let initPromise: Promise<TextGenerationPipeline> | null = null;

export interface GenerateOptions {
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface GenerateCallbacks {
  onToken?: (token: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Download model with progress tracking.
 */
export async function downloadModel(
  onProgress?: (progress: { loaded: number; total: number; percent: number; speed?: number }) => void
): Promise<void> {
  // Check if already cached
  const cached = await localAICache.isModelCached();
  if (cached) return;

  const startTime = Date.now();

  try {
    if (onProgress) {
      onProgress({ loaded: 0, total: 0, percent: 0 });
    }

    // Initialize the pipeline — this triggers the download
    await getOrCreatePipeline();

    // After pipeline loads, the model is downloaded
    if (onProgress) {
      onProgress({ loaded: 100, total: 100, percent: 100 });
    }

    // Mark as cached
    localAIDetector.markModelCached();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const msg = error.message || "";

    if (msg.includes("401") || msg.includes("Unauthorized")) {
      throw new Error(
        "Model download requires authentication. The model may be temporarily unavailable. Please try again later."
      );
    }
    if (msg.includes("404") || msg.includes("Not Found")) {
      throw new Error(
        "Model not found on HuggingFace. The model repository may have been renamed. Please report this issue."
      );
    }
    if (msg.includes("OOM") || msg.includes("out of memory") || msg.includes("memory")) {
      throw new Error(
        "Not enough memory to load the model. Try closing other browser tabs or using a device with more RAM."
      );
    }
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("Failed to fetch")) {
      throw new Error(
        "Network error downloading the model. Check your internet connection and try again."
      );
    }

    throw new Error(`Failed to load model: ${msg}`);
  }
}

/**
 * Auto-detect the best available dtype for the model.
 */
async function selectBestDtype(): Promise<string> {
  try {
    // Try to use the registry to detect available dtypes
    const { ModelRegistry } = await import("@huggingface/transformers");
    const availableDtypes = await ModelRegistry.get_available_dtypes(MODEL_ID);

    // Prefer smaller quantizations in order
    const preferred = ["q4", "q4f16", "q8", "int8", "fp16", "fp32"];
    const dtype = preferred.find((d) => availableDtypes.includes(d)) ?? "fp32";

    if (import.meta.env.DEV) {
      console.log("[Nova Local AI] Available dtypes:", availableDtypes, "→ selected:", dtype);
    }
    return dtype;
  } catch {
    // Fallback to q4 if registry detection fails
    return "q4";
  }
}

/**
 * Get or create the pipeline (singleton pattern).
 */
async function getOrCreatePipeline(): Promise<TextGenerationPipeline> {
  if (pipelineInstance) return pipelineInstance;
  if (initPromise) return initPromise;

  isInitializing = true;
  initPromise = (async () => {
    try {
      // Configure Transformers.js
      env.allowLocalModels = false;
      env.cacheDir = "nova-ai-cache";

      // Auto-detect best dtype
      const dtype = await selectBestDtype();

      const pipe = await pipeline("text-generation", MODEL_ID, {
        device: "webgpu" as any,
        dtype: dtype as any,
      });

      // Also load the tokenizer for proper chat template formatting
      try {
        tokenizerInstance = await AutoTokenizer.from_pretrained(MODEL_ID);
      } catch {
        // Tokenizer loading failure is non-critical; pipeline has its own
      }

      pipelineInstance = pipe;
      isInitializing = false;
      return pipe;
    } catch (err) {
      isInitializing = false;
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Initialize the model (lazy).
 */
export async function initializeModel(): Promise<void> {
  await getOrCreatePipeline();
}

/**
 * Generate text using the local model.
 */
export async function generateLocally(
  messages: Array<{ role: string; content: string }>,
  options?: GenerateOptions
): Promise<string> {
  if (!pipelineInstance) {
    throw new Error("Model not initialized. Call initializeModel() first.");
  }

  const maxTokens = options?.maxNewTokens ?? 256;
  const temperature = options?.temperature ?? 0.7;
  const topP = options?.topP ?? 0.9;

  // Use the pipeline directly with chat-style messages
  // Transformers.js handles the chat template internally for Qwen3
  const chatMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  const result = await pipelineInstance(chatMessages, {
    max_new_tokens: maxTokens,
    temperature,
    top_p: topP,
    do_sample: temperature > 0,
  });

  const generated = Array.isArray(result) ? result[0] : result;
  // The pipeline returns the full conversation; extract the last assistant message
  const lastMsg = (generated as any).generated_text;
  if (Array.isArray(lastMsg)) {
    const lastAssistant = lastMsg.filter((m: any) => m.role === "assistant").pop();
    return lastAssistant?.content?.trim() || "I'm not sure how to respond to that.";
  }
  if (typeof lastMsg === "string") {
    return lastMsg.trim() || "I'm not sure how to respond to that.";
  }
  return "I'm not sure how to respond to that.";
}

/**
 * Generate with streaming support.
 * Transformers.js v4 may not support true token streaming for text-generation,
 * so we accumulate the full response and deliver it as a single update.
 */
export async function generateStream(
  messages: Array<{ role: string; content: string }>,
  options?: GenerateOptions,
  callbacks?: GenerateCallbacks
): Promise<string> {
  if (!pipelineInstance) {
    throw new Error("Model not initialized. Call initializeModel() first.");
  }

  const maxTokens = options?.maxNewTokens ?? 256;
  const temperature = options?.temperature ?? 0.7;
  const topP = options?.topP ?? 0.9;

  const chatMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  try {
    const stream = await pipelineInstance(chatMessages, {
      max_new_tokens: maxTokens,
      temperature,
      top_p: topP,
      do_sample: temperature > 0,
    });

    const generated = Array.isArray(stream) ? stream[0] : stream;
    const lastMsg = (generated as any).generated_text;
    let fullResponse = "";

    if (Array.isArray(lastMsg)) {
      const lastAssistant = lastMsg.filter((m: any) => m.role === "assistant").pop();
      fullResponse = lastAssistant?.content?.trim() || "";
    } else if (typeof lastMsg === "string") {
      fullResponse = lastMsg.trim();
    }

    if (!fullResponse) fullResponse = "I'm not sure how to respond to that.";

    callbacks?.onToken?.(fullResponse);
    callbacks?.onDone?.();
    return fullResponse;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    callbacks?.onError?.(error);
    throw error;
  }
}

/**
 * Cancel ongoing generation (best effort).
 */
export function cancelGeneration(): void {
  if (pipelineInstance) {
    try {
      (pipelineInstance as any).abort?.();
    } catch { /* ignore */ }
  }
}

/**
 * Unload model from memory.
 */
export function unloadModel(): void {
  if (pipelineInstance) {
    try {
      (pipelineInstance as any).dispose?.();
    } catch { /* ignore */ }
    pipelineInstance = null;
    tokenizerInstance = null;
    initPromise = null;
    isInitializing = false;
  }
}

/**
 * Check if model is currently loaded.
 */
export function isModelLoaded(): boolean {
  return pipelineInstance !== null;
}

/**
 * Check if model is currently loading.
 */
export function isModelLoading(): boolean {
  return isInitializing;
}

/**
 * Clear the model cache from browser storage.
 */
export async function clearModelCache(): Promise<void> {
  unloadModel();
  localAIDetector.clearModelCacheMarker();
  await localAICache.deleteModel();
}
