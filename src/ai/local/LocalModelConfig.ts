/**
 * Nova Local AI — Model Configuration
 * Single source of truth for the local model. No code outside this file may
 * hardcode model ids, revisions, dtypes, or file assumptions.
 */

export const MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct" as const;

/** Cache/version marker — bumping this invalidates the previous model's marker. */
export const MODEL_CACHE_VERSION = "nova-local-qwen25-0.5b-v1";

export interface LocalModelConfig {
  /** HuggingFace model id (Transformers.js ONNX build). */
  id: string;
  displayName: string;
  parameterCount: string;
  supportedLanguages: string[];
  /** Preferred inference backend when available. */
  preferredDevice: "webgpu" | "wasm";
  /** Fallback backend when the preferred one is unavailable. */
  fallbackDevice: "webgpu" | "wasm";
  /** Capability-aware quantization per backend. */
  quantization: { webgpu: string; wasm: string };
  /** Maximum prompt context the model supports. */
  maxContext: number;
  /** Recommended default generation length (keeps responses snappy). */
  recommendedMaxTokens: number;
  /** Approximate on-disk size of the quantized weights (bytes). */
  approximateDownloadBytes: number;
}

export const LOCAL_MODEL_CONFIG: LocalModelConfig = {
  id: MODEL_ID,
  displayName: "Qwen2.5 0.5B Instruct",
  parameterCount: "0.49B",
  supportedLanguages: ["en", "hi", "hinglish", "+29 more"],
  preferredDevice: "webgpu",
  fallbackDevice: "wasm",
  // 4-bit quantizations: q4f16 keeps fp16 activations on WebGPU (best
  // size/quality tradeoff); q4 is the compatible compact build for WASM.
  quantization: { webgpu: "q4f16", wasm: "q4" },
  maxContext: 32768,
  recommendedMaxTokens: 256,
  // q4f16 model.onnx ≈ 350 MB; q4 variant is similar. Honest approximation.
  approximateDownloadBytes: 380 * 1024 * 1024,
};

/** Concise Nova identity for the lightweight model (kept small on purpose). */
export const NOVA_LOCAL_SYSTEM_PROMPT =
  "You are Nova, a lightweight offline AI assistant. " +
  "You are concise, useful, calm and intelligent. " +
  "Follow the user's language: English input → English. Hindi input → Hindi. Hinglish → natural Hinglish. " +
  "Do not invent actions. Do not claim a tool executed unless a real tool returned success. " +
  "When the request requires cloud knowledge or an unavailable tool, state the limitation clearly.";

/** Sliding window of conversation turns sent to the model (tokens are ~4 chars). */
export const HISTORY_WINDOW_TURNS = 6;
