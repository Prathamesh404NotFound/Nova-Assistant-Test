/**
 * Nova TTS — Provider Abstraction
 * Defines the interface all TTS backends must implement.
 */

export type TTSStatus =
  | "uninitialized"
  | "downloading"
  | "loading"
  | "ready"
  | "generating"
  | "playing"
  | "error"
  | "unavailable";

export interface TTSOptions {
  /** Voice preset ID */
  voicePreset?: string;
  /** Speech speed multiplier */
  speed?: number;
  /** Language code */
  language?: string;
  /** Max characters per generation chunk */
  maxChars?: number;
}

export interface TTSResult {
  /** Audio blob (WAV format) */
  audioBlob: Blob;
  /** Object URL for playback */
  audioUrl: string;
  /** Sample rate of generated audio */
  sampleRate: number;
  /** Generation time in ms */
  generationMs: number;
  /** Text that was spoken */
  spokenText: string;
  /** Provider that generated this */
  provider: string;
}

export interface TTSProvider {
  /** Unique provider identifier */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;

  /** Initialize the provider (load model, etc.) */
  initialize(): Promise<void>;

  /** Generate speech from text */
  speak(text: string, options?: TTSOptions): Promise<TTSResult>;

  /** Stop any current generation */
  stopGeneration(): void;

  /** Check if provider is ready to generate */
  isReady(): boolean;

  /** Get current status */
  getStatus(): TTSStatus;

  /** Get provider-specific diagnostics */
  getDiagnostics(): Record<string, unknown>;

  /** Release resources */
  dispose?(): void;
}
