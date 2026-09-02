/**
 * Nova TTS — Bark Provider
 * Communicates with the local Python Bark TTS service.
 * Handles lazy initialization, model download status, caching.
 */

import type { TTSProvider, TTSOptions, TTSResult, TTSStatus } from "./tts-provider";

const BARK_SERVICE_URL = "http://127.0.0.1:5150";

export class BarkTTSProvider implements TTSProvider {
  readonly id = "bark";
  readonly name = "Suno Bark (Local)";

  private status: TTSStatus = "uninitialized";
  private serviceAvailable = false;
  private abortController: AbortController | null = null;
  private diagnostics: Record<string, unknown> = {};

  async initialize(): Promise<void> {
    this.status = "loading";
    try {
      const response = await fetch(`${BARK_SERVICE_URL}/api/tts/status`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json();
        this.serviceAvailable = true;
        this.diagnostics = data;
        this.status = data.loaded ? "ready" : "loading";

        // If not loaded, try to load
        if (!data.loaded) {
          await this.loadModel();
        }
      } else {
        this.serviceAvailable = false;
        this.status = "unavailable";
      }
    } catch {
      this.serviceAvailable = false;
      this.status = "unavailable";
      this.diagnostics = { error: "Bark service not reachable" };
    }
  }

  private async loadModel(): Promise<void> {
    this.status = "loading";
    try {
      const response = await fetch(`${BARK_SERVICE_URL}/api/tts/load`, {
        method: "POST",
        signal: AbortSignal.timeout(120000), // 2 min for first download
      });
      if (response.ok) {
        const data = await response.json();
        this.diagnostics = { ...this.diagnostics, ...data };
        this.status = data.success ? "ready" : "error";
      } else {
        this.status = "error";
      }
    } catch {
      this.status = "error";
      this.diagnostics = { ...this.diagnostics, error: "Failed to load model" };
    }
  }

  async speak(text: string, options?: TTSOptions): Promise<TTSResult> {
    if (!this.serviceAvailable) {
      throw new Error("Bark service is not available. Is the Python backend running?");
    }

    this.status = "generating";
    this.abortController = new AbortController();

    const startTime = performance.now();

    try {
      const response = await fetch(`${BARK_SERVICE_URL}/api/tts/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voicePreset: options?.voicePreset || "nova-default",
          maxChars: options?.maxChars || 200,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Bark returned ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const sampleRate = parseInt(response.headers.get("X-Sample-Rate") || "24000");
      const generationMs = parseInt(response.headers.get("X-Generation-Ms") || "0");

      this.status = "ready";
      this.diagnostics = {
        ...this.diagnostics,
        lastGenerationMs: generationMs,
        lastSampleRate: sampleRate,
      };

      return {
        audioBlob,
        audioUrl,
        sampleRate,
        generationMs: generationMs || Math.round(performance.now() - startTime),
        spokenText: text,
        provider: "bark",
      };
    } catch (err) {
      this.status = "ready";
      throw err;
    } finally {
      this.abortController = null;
    }
  }

  stopGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.status = "ready";
  }

  isReady(): boolean {
    return this.status === "ready" || this.status === "generating";
  }

  getStatus(): TTSStatus {
    return this.status;
  }

  getDiagnostics(): Record<string, unknown> {
    return {
      ...this.diagnostics,
      serviceAvailable: this.serviceAvailable,
      serviceUrl: BARK_SERVICE_URL,
    };
  }

  dispose(): void {
    this.stopGeneration();
    this.serviceAvailable = false;
    this.status = "uninitialized";
  }
}
