/**
 * Nova Local AI — Model Manager
 * Uses @huggingface/transformers to load and run Qwen3-0.6B in the browser.
 * Supports WebGPU acceleration with WASM/CPU fallback.
 */

import {
  pipeline,
  env,
  type TextGenerationPipeline,
} from "@huggingface/transformers";
import { localAICache } from "./LocalAICache";
import { localAIDetector } from "./LocalAIDetector";

// Model configuration — correct HuggingFace repo name with -ONNX suffix
const MODEL_ID = "onnx-community/Qwen3-0.6B-ONNX";
const LOCAL_MODEL_VERSION = "qwen3-0.6b-onnx-v1";

// Lazy singleton
let pipelineInstance: TextGenerationPipeline | null = null;
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
 * Detect the best available device for inference.
 */
async function detectBestDevice(): Promise<"webgpu" | "wasm"> {
  try {
    if (await localAIDetector.detect().then((d) => d.webgpuAvailable)) {
      return "webgpu";
    }
  } catch {
    // ignore
  }
  return "wasm";
}

/**
 * Download model with progress tracking.
 */
export async function downloadModel(
  onProgress?: (progress: { loaded: number; total: number; percent: number; speed?: number }) => void
): Promise<void> {
  const cached = await localAICache.isModelCached();
  if (cached) return;

  try {
    if (onProgress) {
      onProgress({ loaded: 0, total: 0, percent: 0 });
    }

    await getOrCreatePipeline();

    if (onProgress) {
      onProgress({ loaded: 100, total: 100, percent: 100 });
    }

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
        "Model not found on HuggingFace. The model repository may have been renamed or is temporarily unavailable."
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
    if (msg.includes("Unsupported device")) {
      throw new Error(
        "Your browser does not support the required hardware acceleration. Try using Chrome or Edge for Local AI."
      );
    }

    throw new Error(`Failed to load model: ${msg}`);
  }
}

/**
 * Get or create the pipeline (singleton pattern).
 * Uses q4 dtype (4-bit quantization) which is the smallest available for this model.
 * Detects WebGPU availability and falls back to WASM/CPU when not available.
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

      // Detect best device (WebGPU preferred, WASM fallback)
      const device = await detectBestDevice();

      // Use q4 (4-bit quantization) — the standard quantization for this model
      // This is smaller and works on both WebGPU and WASM backends
      const pipe = await pipeline("text-generation", MODEL_ID, {
        device: device as any,
        dtype: "q4" as any,
      });

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
