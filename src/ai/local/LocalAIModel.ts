/**
 * Nova Local AI — Model Manager
 * Uses @huggingface/transformers to load and run Qwen3-0.6B in the browser.
 * Supports WebGPU acceleration with WASM/CPU fallback.
 */

import { pipeline, env, type TextGenerationPipeline } from "@huggingface/transformers";
import { localAICache, type ModelMetadata } from "./LocalAICache";
import { localAIDetector } from "./LocalAIDetector";

// Model configuration
const MODEL_ID = "onnx-community/Qwen3-0.6B";
const LOCAL_MODEL_VERSION = "qwen3-0.6b-local-v1";

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
 * Download model with progress tracking.
 */
export async function downloadModel(
  onProgress?: (progress: { loaded: number; total: number; percent: number; speed?: number }) => void
): Promise<void> {
  // Check if already cached
  const cached = await localAICache.isModelCached();
  if (cached) return;

  const startTime = Date.now();
  let lastLoaded = 0;
  let lastTime = startTime;

  // Transformers.js handles the download internally when we first call pipeline.
  // But we want progress, so we'll use fetch directly and then cache.
  const detectResult = await localAIDetector.detect();
  const device = detectResult.backend === "webgpu" ? "webgpu" : "wasm";

  // Set up progress tracking via a head request to get total size
  try {
    // We'll let Transformers.js download and track progress via its callback
    // Since HF transformers doesn't expose raw download progress easily,
    // we use a simulated progress based on pipeline initialization
    if (onProgress) {
      onProgress({ loaded: 0, total: 0, percent: 0 });
    }

    // Initialize the pipeline - this triggers the download
    await getOrCreatePipeline(device, (progressText) => {
      // Transformers.js logs download progress to console
      // We parse approximate progress from logs
      if (onProgress) {
        // Approximate progress based on loading phase
        const elapsed = Date.now() - startTime;
        const estimated = Math.min(95, Math.floor(elapsed / 200)); // Rough estimation
        onProgress({
          loaded: estimated * 4.5, // ~450MB target
          total: 450,
          percent: estimated,
        });
      }
    });

    // Mark as cached
    localAIDetector.markModelCached();

    if (onProgress) {
      onProgress({ loaded: 450, total: 450, percent: 100 });
    }
  } catch (err) {
    throw err;
  }
}

/**
 * Get or create the pipeline (singleton pattern).
 */
async function getOrCreatePipeline(
  device: string,
  onLog?: (msg: string) => void
): Promise<TextGenerationPipeline> {
  if (pipelineInstance) return pipelineInstance;
  if (initPromise) return initPromise;

  isInitializing = true;
  initPromise = (async () => {
    try {
      // Configure Transformers.js
      env.cacheDir = "nova-ai-cache";

      if (onLog) onLog("Loading model...");

      const pipe = await pipeline("text-generation", MODEL_ID, {
        device: device as any,
        dtype: "q4f16" as any, // Q4 quantization for smaller size
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
  const detectResult = await localAIDetector.detect();
  const device = detectResult.backend === "webgpu" ? "webgpu" : "wasm";
  await getOrCreatePipeline(device);
}

/**
 * Generate text using the local model.
 * Returns a promise that resolves with the full response.
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

  // Build prompt from messages
  const prompt = buildPrompt(messages);

  const result = await pipelineInstance(prompt, {
    max_new_tokens: maxTokens,
    temperature,
    top_p: topP,
    do_sample: temperature > 0,
  });

  // Extract generated text (remove the prompt from the output)
  const generated = Array.isArray(result) ? result[0] : result;
  const fullText = (generated as any).generated_text || "";
  // Remove the prompt prefix from the output
  const responseText = fullText.slice(prompt.length).trim();
  return responseText || "I'm not sure how to respond to that.";
}

/**
 * Generate with streaming support.
 * Calls onToken for each generated token.
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

  const prompt = buildPrompt(messages);
  let fullResponse = "";

  try {
    const stream = await pipelineInstance(prompt, {
      max_new_tokens: maxTokens,
      temperature,
      top_p: topP,
      do_sample: temperature > 0,
      streamer: true as any, // Enable streaming
    } as any);

    // If streaming is not directly supported by the pipeline version,
    // fall back to non-streaming
    if (stream && typeof (stream as any)[Symbol.asyncIterator] === "function") {
      for await (const chunk of stream as any) {
        const token = chunk?.token?.text || chunk?.text || "";
        if (token) {
          fullResponse += token;
          callbacks?.onToken?.(fullResponse);
        }
      }
    } else {
      // Fallback: use generate without streaming
      fullResponse = await generateLocally(messages, options);
      callbacks?.onToken?.(fullResponse);
    }

    callbacks?.onDone?.();
    return fullResponse;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    callbacks?.onError?.(error);
    throw error;
  }
}

/**
 * Build a chat prompt from messages.
 * Uses a simple chat format appropriate for Qwen3-0.6B.
 */
function buildPrompt(messages: Array<{ role: string; content: string }>): string {
  const systemMsg = `You are Nova, a friendly personal AI assistant running locally on the user's device. Be concise, natural, and helpful. Do not claim access to the internet or external tools.`;

  let prompt = `<|system|>\n${systemMsg}\n</|system|>\n`;

  for (const msg of messages) {
    if (msg.role === "user") {
      prompt += `<|user|>\n${msg.content}\n</|user|>\n`;
    } else if (msg.role === "assistant") {
      prompt += `<|assistant|>\n${msg.content}\n</|assistant|>\n`;
    }
  }

  prompt += `<|assistant|>\n`;
  return prompt;
}

/**
 * Cancel ongoing generation (best effort).
 */
export function cancelGeneration(): void {
  // Transformers.js doesn't have a standard cancel API,
  // but we can try to abort via the pipeline's internal abort controller
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
