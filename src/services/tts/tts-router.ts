/**
 * Nova TTS — Router
 * Routes speech requests through Bark (primary) → Browser (fallback).
 * Manages provider lifecycle, audio queue, settings, and caching.
 */

import type { TTSProvider, TTSOptions, TTSResult, TTSStatus } from "./tts-provider";
import { BarkTTSProvider } from "./bark-provider";
import { AudioQueue } from "./audio-queue";
import { prepareTextForSpeech } from "./speech-text-processor";

export interface VoiceSettings {
  engine: "bark" | "browser";
  voicePreset: string;
  volume: number;
  speed: number;
  autoSpeak: boolean;
  interruptOnNewInput: boolean;
}

const SETTINGS_KEY = "nova_voice_settings";

function loadSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...getDefaultSettings(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return getDefaultSettings();
}

function getDefaultSettings(): VoiceSettings {
  return {
    engine: "bark",
    voicePreset: "nova-default",
    volume: 1.0,
    speed: 1.0,
    autoSpeak: true,
    interruptOnNewInput: true,
  };
}

export class TTSRouter {
  private barkProvider: BarkTTSProvider;
  private audioQueue: AudioQueue;
  private settings: VoiceSettings;
  private onStatusChange?: (status: TTSStatus) => void;
  private onPlay?: () => void;
  private onEnd?: () => void;

  constructor() {
    this.barkProvider = new BarkTTSProvider();
    this.audioQueue = new AudioQueue();
    this.settings = loadSettings();

    // Apply saved volume
    this.audioQueue.setVolume(this.settings.volume);
  }

  /** Initialize the TTS system. Call once at app startup. */
  async initialize(): Promise<void> {
    if (this.settings.engine === "bark") {
      try {
        await this.barkProvider.initialize();
      } catch {
        console.warn("[TTS] Bark initialization failed, falling back to browser");
      }
    }
  }

  /** Speak text. Processes for speech, chunks, and plays through queue. */
  async speak(text: string, options?: TTSOptions): Promise<void> {
    // Stop current if interrupt-on-new is enabled
    if (this.settings.interruptOnNewInput) {
      this.stop();
    }

    // Process text for speech
    const spokenText = prepareTextForSpeech(text);
    if (!spokenText) return;

    const mergedOptions: TTSOptions = {
      voicePreset: options?.voicePreset || this.settings.voicePreset,
      speed: options?.speed || this.settings.speed,
      maxChars: options?.maxChars || 200,
    };

    // Try Bark first
    if (this.settings.engine === "bark" && this.barkProvider.isReady()) {
      try {
        const result = await this.barkProvider.speak(spokenText, mergedOptions);
        this.playResult(result);
        return;
      } catch (err) {
        console.warn("[TTS] Bark failed, falling back to browser:", err);
      }
    }

    // Fallback: browser SpeechSynthesis
    this.speakWithBrowser(spokenText, mergedOptions);
  }

  /** Generate and play a TTS result through the audio queue. */
  private playResult(result: TTSResult): void {
    const queueId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    this.audioQueue.enqueue({
      id: queueId,
      audioUrl: result.audioUrl,
      text: result.spokenText,
      onPlay: () => {
        this.onPlay?.();
      },
      onEnd: () => {
        // Revoke URL after playback
        URL.revokeObjectURL(result.audioUrl);
        if (this.audioQueue.getStatus() === "idle") {
          this.onEnd?.();
        }
      },
      onError: (err) => {
        console.error("[TTS] Playback error:", err);
        URL.revokeObjectURL(result.audioUrl);
      },
    });
  }

  /** Browser SpeechSynthesis fallback. */
  private speakWithBrowser(text: string, options: TTSOptions): void {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.speed || 1.0;
    utterance.lang = options.language
      ? `${options.language}-${options.language === "en" ? "US" : "IN"}`
      : "en-US";

    utterance.onstart = () => this.onPlay?.();
    utterance.onend = () => this.onEnd?.();
    utterance.onerror = () => this.onEnd?.();

    window.speechSynthesis.speak(utterance);
  }

  /** Stop all playback and clear queue. */
  stop(): void {
    this.audioQueue.stop();
    window.speechSynthesis?.cancel();
    this.barkProvider.stopGeneration();
  }

  /** Pause current playback. */
  pause(): void {
    this.audioQueue.pause();
  }

  /** Resume paused playback. */
  resume(): void {
    this.audioQueue.resume();
  }

  /** Set volume (0.0 - 1.0). */
  setVolume(vol: number): void {
    this.settings.volume = Math.max(0, Math.min(1, vol));
    this.audioQueue.setVolume(this.settings.volume);
    this.saveSettings();
  }

  /** Update voice settings. */
  updateSettings(partial: Partial<VoiceSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.audioQueue.setVolume(this.settings.volume);
    this.saveSettings();
  }

  /** Get current settings. */
  getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  /** Get current TTS status. */
  getStatus(): TTSStatus {
    if (this.audioQueue.getStatus() === "playing") return "playing";
    return this.barkProvider.getStatus();
  }

  /** Check if Bark is available. */
  isBarkAvailable(): boolean {
    return this.barkProvider.isReady();
  }

  /** Get diagnostics for developer view. */
  getDiagnostics(): Record<string, unknown> {
    return {
      engine: this.settings.engine,
      bark: this.barkProvider.getDiagnostics(),
      queue: {
        status: this.audioQueue.getStatus(),
        pending: this.audioQueue.pendingCount,
      },
      settings: this.settings,
    };
  }

  /** Set callbacks. */
  setCallbacks(callbacks: {
    onStatusChange?: (status: TTSStatus) => void;
    onPlay?: () => void;
    onEnd?: () => void;
  }): void {
    this.onStatusChange = callbacks.onStatusChange;
    this.onPlay = callbacks.onPlay;
    this.onEnd = callbacks.onEnd;
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch { /* ignore */ }
  }
}

/** Singleton TTS router */
export const ttsRouter = new TTSRouter();
