/**
 * Nova Local AI — Device Capability Detection
 * Detects WebGPU, WASM, storage, and estimates device performance.
 */

export type Backend = "webgpu" | "wasm" | "unsupported";

export type PerformanceTier = "fast" | "moderate" | "slow";

export interface LocalAIAvailability {
  supported: boolean;
  backend: Backend;
  modelCached: boolean;
  estimatedPerformance?: PerformanceTier;
  reason?: string;
  webgpuAvailable?: boolean;
  wasmAvailable?: boolean;
}

const MODEL_VERSION_KEY = "nova_local_model_version";
const MODEL_VERSION = "qwen3-0.6b-onnx-v1";

export class LocalAIDetector {
  /**
   * Check if WebGPU is available in this browser.
   */
  static async checkWebGPU(): Promise<boolean> {
    try {
      if (!navigator.gpu) return false;
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  /**
   * Check if WASM is available (almost universally supported).
   */
  checkWASM(): boolean {
    try {
      return typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function";
    } catch {
      return false;
    }
  }

  /**
   * Estimate device performance tier based on hardware clues.
   */
  estimatePerformance(): PerformanceTier {
    const cores = navigator.hardwareConcurrency || 2;
    const mem = (navigator as any).deviceMemory || 4; // GB
    const hasWebGPU = !!navigator.gpu;

    // Score based on available signals
    let score = 0;
    if (cores >= 8) score += 3;
    else if (cores >= 4) score += 2;
    else score += 1;

    if (mem >= 8) score += 3;
    else if (mem >= 4) score += 2;
    else score += 1;

    if (hasWebGPU) score += 2;

    if (score >= 7) return "fast";
    if (score >= 4) return "moderate";
    return "slow";
  }

  /**
   * Check if the model is already cached in browser storage.
   */
  isModelCached(): boolean {
    try {
      const version = localStorage.getItem(MODEL_VERSION_KEY);
      return version === MODEL_VERSION;
    } catch {
      return false;
    }
  }

  /**
   * Mark the model as cached after successful download.
   */
  markModelCached(): void {
    try {
      localStorage.setItem(MODEL_VERSION_KEY, MODEL_VERSION);
    } catch { /* ignore */ }
  }

  /**
   * Clear the cached model marker.
   */
  clearModelCacheMarker(): void {
    try {
      localStorage.removeItem(MODEL_VERSION_KEY);
    } catch { /* ignore */ }
  }

  /**
   * Full capability detection.
   */
  async detect(): Promise<LocalAIAvailability> {
    const webgpuAvailable = await LocalAIDetector.checkWebGPU();
    const wasmAvailable = this.checkWASM();
    const modelCached = this.isModelCached();
    const estimatedPerformance = this.estimatePerformance();

    let backend: Backend = "unsupported";
    let supported = false;

    if (webgpuAvailable) {
      backend = "webgpu";
      supported = true;
    } else if (wasmAvailable) {
      backend = "wasm";
      // WASM is supported but may be slow on weak devices
      supported = estimatedPerformance !== "slow" || modelCached;
    }

    let reason: string | undefined;
    if (!supported) {
      if (!webgpuAvailable && !wasmAvailable) {
        reason = "Neither WebGPU nor WebAssembly is available in this browser.";
      } else if (estimatedPerformance === "slow" && !modelCached) {
        reason = "This device may be too weak for local AI. Consider using Gemini mode.";
      }
    }

    return {
      supported,
      backend,
      modelCached,
      estimatedPerformance,
      reason,
      webgpuAvailable,
      wasmAvailable,
    };
  }
}

export const localAIDetector = new LocalAIDetector();
