/**
 * Nova Local AI — Device Capability Detection
 * Detects WebGPU, WASM, storage, and estimates device performance.
 * The localStorage marker is lightweight metadata only — never proof that
 * the model is actually loadable (see LocalAIService.isCached + warm-up).
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

export class LocalAIDetector {
  /**
   * Check if WebGPU is actually usable (adapter request succeeds).
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
    const mem = (navigator as { deviceMemory?: number }).deviceMemory || 4; // GB
    const hasWebGPU = !!navigator.gpu;

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

  /** Check if the version marker matches the CURRENT model version. */
  isModelCached(expectedVersion?: string): boolean {
    try {
      const version = localStorage.getItem(MODEL_VERSION_KEY);
      if (!version) return false;
      // A marker for a DIFFERENT (older) model version is stale — treat as
      // not cached so the new model downloads; the old marker gets replaced
      // on successful download.
      return expectedVersion ? version === expectedVersion : true;
    } catch {
      return false;
    }
  }

  /** Mark the current model version as cached after successful download. */
  markModelCached(version: string): void {
    try {
      localStorage.setItem(MODEL_VERSION_KEY, version);
    } catch { /* ignore */ }
  }

  /** Clear the cached model marker. */
  clearModelCacheMarker(): void {
    try {
      localStorage.removeItem(MODEL_VERSION_KEY);
    } catch { /* ignore */ }
  }

  /** Full capability detection. */
  async detect(): Promise<LocalAIAvailability> {
    const webgpuAvailable = await LocalAIDetector.checkWebGPU();
    const wasmAvailable = this.checkWASM();
    const estimatedPerformance = this.estimatePerformance();

    let backend: Backend = "unsupported";
    let supported = false;

    if (webgpuAvailable) {
      backend = "webgpu";
      supported = true;
    } else if (wasmAvailable) {
      backend = "wasm";
      supported = true;
    }

    let reason: string | undefined;
    if (!supported) {
      reason = "Neither WebGPU nor WebAssembly is available in this browser.";
    }

    return {
      supported,
      backend,
      modelCached: false, // callers combine with isModelCached(version) + cache check
      estimatedPerformance,
      reason,
      webgpuAvailable,
      wasmAvailable,
    };
  }
}

export const localAIDetector = new LocalAIDetector();
