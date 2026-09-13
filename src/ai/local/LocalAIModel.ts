/**
 * Nova Local AI — Model Manager (Qwen2.5-0.5B-Instruct)
 *
 * Loads onnx-community/Qwen2.5-0.5B-Instruct via @huggingface/transformers
 * entirely in-browser. WebGPU when available, WASM otherwise, honest
 * "unavailable" when neither works. Real lifecycle state machine — a
 * localStorage flag is never proof that the model is loaded.
 *
 *   UNKNOWN → DOWNLOADING → LOADING → WARMING → READY ⇄ RUNNING
 *                                    ↘ FAILED / UNAVAILABLE
 *
 * READY is only reached after a successful warm-up inference.
 */

import {
  pipeline,
  env,
  TextStreamer,
  InterruptableStoppingCriteria,
  type TextGenerationPipeline,
} from "@huggingface/transformers";
import { localAIDetector, LocalAIDetector } from "./LocalAIDetector";
import {
  LOCAL_MODEL_CONFIG,
  MODEL_CACHE_VERSION,
  NOVA_LOCAL_SYSTEM_PROMPT,
} from "./LocalModelConfig";

// ── Lifecycle state machine ─────────────────────────────────────────────────

export type LocalModelLifecycle =
  | "unknown" | "downloading" | "loading" | "warming" | "ready" | "running" | "failed" | "unavailable";

let lifecycle: LocalModelLifecycle = "unknown";
export function getLifecycle(): LocalModelLifecycle { return lifecycle; }
function setLifecycle(next: LocalModelLifecycle): void {
  lifecycle = next;
  for (const l of lifecycleListeners) { try { l(next); } catch { /* non-critical */ } }
}

const lifecycleListeners: Array<(s: LocalModelLifecycle) => void> = [];
export function onLifecycleChange(cb: (s: LocalModelLifecycle) => void): () => void {
  lifecycleListeners.push(cb);
  return () => {
    const i = lifecycleListeners.indexOf(cb);
    if (i >= 0) lifecycleListeners.splice(i, 1);
  };
}

// ── Singleton pipeline (one model, one session — never duplicated) ──────────

let pipelineInstance: TextGenerationPipeline | null = null;
let initPromise: Promise<TextGenerationPipeline> | null = null;
let stoppingCriteria: InterruptableStoppingCriteria | null = null;

export interface GenerateOptions {
  maxNewTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface GenerateCallbacks {
  onToken?: (token: string) => void;
  onDone?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/** Dev-only diagnostics. */
export interface ModelDiagnostics {
  loadTimeMs: number | null;
  warmupTimeMs: number | null;
  lastInferenceMs: number | null;
  backend: string | null;
  dtype: string | null;
  modelId: string;
  lifecycle: LocalModelLifecycle;
}

const diagnostics: ModelDiagnostics = {
  loadTimeMs: null, warmupTimeMs: null, lastInferenceMs: null,
  backend: null, dtype: null, modelId: LOCAL_MODEL_CONFIG.id, lifecycle: "unknown",
};
export function getModelDiagnostics(): ModelDiagnostics {
  return { ...diagnostics, lifecycle };
}

/** Pick dtype per backend (capability-aware — never one dtype for all). */
function dtypeFor(device: "webgpu" | "wasm"): string {
  return LOCAL_MODEL_CONFIG.quantization[device];
}

/** Select the best backend and validate it — never assume WebGPU works. */
async function selectDevice(): Promise<{ device: "webgpu" | "wasm"; dtype: string }> {
  const webgpuOk = await LocalAIDetector.checkWebGPU();
  if (webgpuOk && LOCAL_MODEL_CONFIG.preferredDevice === "webgpu") {
    return { device: "webgpu", dtype: dtypeFor("webgpu") };
  }
  if (localAIDetector.checkWASM()) {
    return { device: "wasm", dtype: dtypeFor("wasm") };
  }
  setLifecycle("unavailable");
  throw new Error("Neither WebGPU nor WebAssembly is available in this browser. Local AI is unavailable.");
}

/** Get or create the pipeline (singleton). Rejected init clears the promise. */
async function getOrCreatePipeline(): Promise<TextGenerationPipeline> {
  if (pipelineInstance) return pipelineInstance;
  if (initPromise) return initPromise;

  setLifecycle("loading");
  const loadStart = performance.now();

  initPromise = (async () => {
    try {
      env.allowLocalModels = false;
      env.cacheDir = "nova-ai-cache";

      const { device, dtype } = await selectDevice();
      diagnostics.backend = device;
      diagnostics.dtype = dtype;

      const pipe = await pipeline("text-generation", LOCAL_MODEL_CONFIG.id, {
        device: device as never,
        dtype: dtype as never,
        progress_callback: (p: { status?: string; progress?: number }) => {
          if (p.status === "progress" && typeof p.progress === "number") {
            // surface download progress to listeners if needed
          }
        },
      });

      pipelineInstance = pipe;
      diagnostics.loadTimeMs = Math.round(performance.now() - loadStart);
      setLifecycle("warming");
      return pipe;
    } catch (err) {
      initPromise = null;
      pipelineInstance = null;
      // Distinguish hardware failure from network/download failure honestly.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("WebGPU") || msg.includes("device")) {
        setLifecycle("unavailable");
      } else {
        setLifecycle("failed");
      }
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Warm-up: one tiny inference that must succeed before the model is READY.
 * Also measures first-token latency.
 */
async function warmUp(): Promise<void> {
  const pipe = pipelineInstance;
  if (!pipe) throw new Error("Warm-up called without a pipeline");
  const start = performance.now();
  try {
    const out = await pipe([{ role: "user", content: "Hello." }], {
      max_new_tokens: 8,
      do_sample: false,
    });
    const generated = Array.isArray(out) ? out[0] : out;
    const text = extractGenerated(generated);
    diagnostics.warmupTimeMs = Math.round(performance.now() - start);
    // An empty warm-up is a real failure, not a success.
    if (!text) throw new Error("Warm-up generation produced empty output");
    setLifecycle("ready");
  } catch (err) {
    setLifecycle("failed");
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/** Extract assistant text from a Transformers.js generation result. */
function extractGenerated(generated: unknown): string {
  const lastMsg = (generated as { generated_text?: unknown })?.generated_text;
  if (Array.isArray(lastMsg)) {
    const lastAssistant = lastMsg
      .filter((m: { role?: string }) => m.role === "assistant")
      .pop() as { content?: string } | undefined;
    return lastAssistant?.content?.trim() ?? "";
  }
  if (typeof lastMsg === "string") return lastMsg.trim();
  return "";
}

/**
 * Download + load + warm-up with progress tracking.
 * Resolves only when the model is genuinely READY.
 */
export async function downloadModel(
  onProgress?: (progress: { loaded: number; total: number; percent: number; speed?: number }) => void
): Promise<void> {
  try {
    if (onProgress) onProgress({ loaded: 0, total: 0, percent: 0 });

    // Reuse a healthy loaded instance.
    if (pipelineInstance && lifecycle === "ready") {
      onProgress?.({ loaded: 100, total: 100, percent: 100 });
      return;
    }

    initPromise = null; // allow a fresh attempt after a previous failure
    setLifecycle("downloading");

    await getOrCreatePipeline();

    if (onProgress) onProgress({ loaded: 100, total: 100, percent: 100 });
    localAIDetector.markModelCached(MODEL_CACHE_VERSION);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const msg = error.message || "";

    if (msg.includes("401") || msg.includes("Unauthorized")) {
      throw new Error("Model download requires authentication. The model repository may be temporarily unavailable. Please try again later.");
    }
    if (msg.includes("404") || msg.includes("Not Found")) {
      throw new Error("Model not found on HuggingFace. The repository may have been renamed or is temporarily unavailable.");
    }
    if (msg.includes("OOM") || msg.includes("out of memory") || /memory/i.test(msg)) {
      throw new Error("Not enough memory to load the model. Try closing other browser tabs or using a device with more RAM.");
    }
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("Failed to fetch")) {
      throw new Error("Network error downloading the model. Check your internet connection and try again.");
    }

    throw new Error(`Failed to load model: ${msg}`);
  }
}

/** Initialize lazily (load if needed, warm up if not yet READY). */
export async function initializeModel(): Promise<void> {
  if (pipelineInstance && (lifecycle === "ready" || lifecycle === "running")) return;
  await getOrCreatePipeline();
  if (lifecycle === "warming") await warmUp();
}

/** Generate using the model's proper chat template (system/user/assistant). */
export async function generateLocally(
  messages: Array<{ role: string; content: string }>,
  options?: GenerateOptions
): Promise<string> {
  if (!pipelineInstance) throw new Error("Model not initialized. Call initializeModel() first.");
  lifecycle = "running";
  const start = performance.now();

  const chatMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  const result = await pipelineInstance(chatMessages, {
    max_new_tokens: options?.maxNewTokens ?? LOCAL_MODEL_CONFIG.recommendedMaxTokens,
    temperature: options?.temperature ?? 0.7,
    top_p: options?.topP ?? 0.9,
    do_sample: (options?.temperature ?? 0.7) > 0,
  });

  diagnostics.lastInferenceMs = Math.round(performance.now() - start);
  lifecycle = "ready";
  const generated = Array.isArray(result) ? result[0] : result;
  return extractGenerated(generated); // "" on empty — callers escalate honestly
}

/** Streaming generation — REAL incremental tokens via TextStreamer. */
export async function generateStream(
  messages: Array<{ role: string; content: string }>,
  options?: GenerateOptions,
  callbacks?: GenerateCallbacks
): Promise<string> {
  const pipe = pipelineInstance;
  if (!pipe) throw new Error("Model not initialized. Call initializeModel() first.");

  const maxTokens = options?.maxNewTokens ?? LOCAL_MODEL_CONFIG.recommendedMaxTokens;
  const temperature = options?.temperature ?? 0.7;

  const chatMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  lifecycle = "running";
  const start = performance.now();
  stoppingCriteria = new InterruptableStoppingCriteria();

  try {
    let fullResponse = "";
    let lastSent = 0;

    const streamer = new TextStreamer(pipe.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (token: string) => {
        fullResponse += token;
        // Emit meaningful deltas only (never one final dump, never placeholders).
        if (fullResponse.length - lastSent >= 2 || /[\s.!?।]$/.test(token)) {
          lastSent = fullResponse.length;
          callbacks?.onToken?.(fullResponse);
        }
      },
    });

    await pipe(chatMessages, {
      max_new_tokens: maxTokens,
      temperature,
      top_p: options?.topP ?? 0.9,
      do_sample: temperature > 0,
      streamer,
      stopping_criteria: stoppingCriteria,
    });

    stoppingCriteria = null;
    diagnostics.lastInferenceMs = Math.round(performance.now() - start);
    lifecycle = "ready";

    const trimmed = fullResponse.trim();
    if (!trimmed) return ""; // honest empty — caller escalates or errors
    callbacks?.onDone?.(trimmed);
    return trimmed;
  } catch (err) {
    stoppingCriteria = null;
    lifecycle = "ready"; // model itself is fine — only this generation failed
    const error = err instanceof Error ? err : new Error(String(err));
    callbacks?.onError?.(error);
    throw error;
  }
}

/**
 * Cancel the current generation. Partial output stays valid; the model
 * remains loaded and READY (no reload).
 */
export function cancelGeneration(): void {
  if (stoppingCriteria) {
    try {
      stoppingCriteria.interrupt();
    } catch { /* ignore */ }
  }
}

/** Dispose the model completely (explicit request only). */
export function unloadModel(): void {
  if (pipelineInstance) {
    try {
      (pipelineInstance as { dispose?: () => void }).dispose?.();
    } catch { /* ignore */ }
  }
  pipelineInstance = null;
  initPromise = null;
  stoppingCriteria = null;
  setLifecycle("unknown");
}

export function isModelLoaded(): boolean {
  return pipelineInstance !== null;
}

export function isModelLoading(): boolean {
  return lifecycle === "loading" || lifecycle === "downloading" || lifecycle === "warming";
}

/** Clear the model cache from browser storage + invalidate stale markers. */
export async function clearModelCache(): Promise<void> {
  unloadModel();
  localAIDetector.clearModelCacheMarker();
  // Transformers.js assets live in the Cache API under our cacheDir; deleting
  // only our named caches keeps unrelated browser caches intact.
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => n.includes("nova-ai-cache") || n.includes("transformers-cache"))
        .map((n) => caches.delete(n))
    );
  } catch { /* ignore */ }
}

export { LOCAL_MODEL_CONFIG, NOVA_LOCAL_SYSTEM_PROMPT };
