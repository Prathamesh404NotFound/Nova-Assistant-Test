/**
 * Nova TTS — Router / VoiceOutputService
 *
 * Provider strategy:
 *   1. Browser SpeechSynthesis — guaranteed baseline (default)
 *   2. Cloud TTS provider      — optional, when configured
 *   3. Local Bark              — optional desktop enhancement (localhost only)
 *
 * The default is a provider that works immediately in any browser with no
 * Python server. Bark is only used when the user explicitly selects it AND
 * the local server responds.
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

/** Real playback state exposed to the UI. */
export type VoicePlaybackState = "IDLE" | "SPEAKING" | "PAUSED" | "STOPPED" | "ERROR";

export interface VoicePlaybackInfo {
  state: VoicePlaybackState;
  provider: "browser" | "bark";
  error: string | null;
  lastSpokenText: string | null;
}

const SETTINGS_KEY = "nova_voice_settings";

function loadSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
      const merged = { ...getDefaultSettings(), ...parsed };
      // Migration: an old saved "bark" default is not valid in a browser
      // deployment unless the local server is actually reachable. The router
      // checks Bark liveness at speak-time, so keep the user's explicit
      // choice but never let a missing value default to bark.
      return merged;
    }
  } catch { /* ignore */ }
  return getDefaultSettings();
}

function getDefaultSettings(): VoiceSettings {
  return {
    engine: "browser", // ← guaranteed baseline; never depend on localhost Bark
    voicePreset: "nova-default",
    volume: 1.0,
    speed: 1.0,
    autoSpeak: true,
    interruptOnNewInput: true,
  };
}

// ── Voice selection (async-safe) ─────────────────────────────────────────────

const LANG_MAP: Record<string, string[]> = {
  en: ["en-US", "en-IN", "en-GB"],
  hi: ["hi-IN"],
  mr: ["mr-IN"],
};

/**
 * Resolve the best available voice for a language code, handling browsers
 * where getVoices() returns [] until voiceschanged fires.
 */
function getVoicesWithWait(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      clearTimeout(timer);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    const timer = setTimeout(done, timeoutMs);
  });
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  language?: string
): { voice: SpeechSynthesisVoice | null; lang: string } {
  const langCode = (language || "en").split(/[-_]/)[0].toLowerCase();
  const preferred = LANG_MAP[langCode] ?? LANG_MAP.en;
  // Exact locale match first, then any voice whose lang starts with the code
  for (const locale of preferred) {
    const exact = voices.find((v) => v.lang.replace("_", "-") === locale);
    if (exact) return { voice: exact, lang: locale };
  }
  const partial = voices.find((v) => v.lang.toLowerCase().startsWith(langCode));
  if (partial) return { voice: partial, lang: partial.lang };
  // Hinglish / unknown: fall back to any English voice, then any voice
  const anyEn = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  if (anyEn) return { voice: anyEn, lang: anyEn.lang };
  return { voice: voices[0] ?? null, lang: preferred[0] };
}

// ── TTS Router ───────────────────────────────────────────────────────────────

export class TTSRouter {
  private barkProvider: BarkTTSProvider;
  private audioQueue: AudioQueue;
  private settings: VoiceSettings;
  private onStatusChange?: (status: TTSStatus) => void;
  private onPlay?: () => void;
  private onEnd?: () => void;
  private onError?: (message: string) => void;

  // Real playback state machine
  private playbackState: VoicePlaybackState = "IDLE";
  private playbackError: string | null = null;
  private lastSpokenText: string | null = null;
  /** Chrome-safe speech serialization: only one utterance queued at a time. */
  private browserSpeakToken = 0;

  constructor() {
    this.barkProvider = new BarkTTSProvider();
    this.audioQueue = new AudioQueue();
    this.settings = loadSettings();
    this.audioQueue.setVolume(this.settings.volume);
  }

  /** Initialize the TTS system. Preloads browser voices; probes Bark only if selected. */
  async initialize(): Promise<void> {
    // Always warm the voice list — Chrome loads voices asynchronously and the
    // first speak() would otherwise pick a default voice or fail silently.
    await getVoicesWithWait();

    if (this.settings.engine === "bark") {
      try {
        await this.barkProvider.initialize();
      } catch {
        console.warn("[TTS] Bark initialization failed — browser TTS will be used");
        this.setPlaybackError("Local Bark server unavailable — using browser voice");
      }
    }
  }

  /** Speak text. Processes for speech, chunks, and plays through queue. */
  async speak(text: string, options?: TTSOptions): Promise<void> {
    // Stop current if interrupt-on-new is enabled — never let two voices overlap
    if (this.settings.interruptOnNewInput) {
      this.stop();
    }

    const spokenText = prepareTextForSpeech(text);
    if (!spokenText) return;

    const mergedOptions: TTSOptions = {
      voicePreset: options?.voicePreset || this.settings.voicePreset,
      speed: options?.speed || this.settings.speed,
      maxChars: options?.maxChars || 200,
      language: options?.language,
    };

    // Explicitly-selected Bark (only if actually alive)
    if (this.settings.engine === "bark" && this.barkProvider.isReady()) {
      try {
        const result = await this.barkProvider.speak(spokenText, mergedOptions);
        this.playResult(result);
        return;
      } catch (err) {
        console.warn("[TTS] Bark failed, falling back to browser:", err);
        this.setPlaybackError("Bark generation failed — using browser voice");
      }
    }

    await this.speakWithBrowser(spokenText, mergedOptions);
  }

  /** Generate and play a TTS result through the audio queue. */
  private playResult(result: TTSResult): void {
    const queueId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    this.audioQueue.enqueue({
      id: queueId,
      audioUrl: result.audioUrl,
      text: result.spokenText,
      onPlay: () => {
        this.playbackState = "SPEAKING";
        this.onPlay?.();
      },
      onEnd: () => {
        URL.revokeObjectURL(result.audioUrl);
        if (this.audioQueue.getStatus() === "idle") {
          this.playbackState = "IDLE";
          this.onEnd?.();
        }
      },
      onError: (err) => {
        console.error("[TTS] Playback error:", err);
        URL.revokeObjectURL(result.audioUrl);
        this.setPlaybackError("Audio playback failed");
        this.onEnd?.();
      },
    });
  }

  /**
   * Browser SpeechSynthesis with a safe speak queue.
   *
   * Chrome race: calling cancel() synchronously right before speak() cancels
   * the newly queued utterance too. Instead of an arbitrary delay, we cancel,
   * then wait until speechSynthesis reports idle (bounded), then queue the
   * utterance under a token so a newer request supersedes an older one.
   */
  private async speakWithBrowser(text: string, options: TTSOptions): Promise<void> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.setPlaybackError("Speech synthesis is not available in this browser");
      this.onEnd?.();
      return;
    }

    const token = ++this.browserSpeakToken;
    const synth = window.speechSynthesis;

    // 1. Stop old speech
    try { synth.cancel(); } catch { /* ignore */ }

    // 2. Wait for cancellation to settle — bounded, event-based, not a fixed sleep
    const waitIdle = async () => {
      for (let i = 0; i < 20; i++) {
        if (token !== this.browserSpeakToken) return false; // superseded
        if (!synth.speaking && !synth.pending) return true;
        await new Promise((r) => setTimeout(r, 25));
      }
      return token === this.browserSpeakToken;
    };
    const ready = await waitIdle();
    if (!ready) return; // a newer speak() took over

    // 3. Resolve voice (handles async voice loading)
    const voices = await getVoicesWithWait();
    if (token !== this.browserSpeakToken) return; // superseded while waiting
    const { voice, lang } = pickVoice(voices, options.language);

    // 4. Create utterance, assign voice, register handlers
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = Math.max(0.1, Math.min(10, options.speed || 1.0));
    utterance.pitch = 1.0;
    utterance.volume = this.settings.volume;
    utterance.lang = lang;
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      this.playbackState = "SPEAKING";
      this.onPlay?.();
    };
    utterance.onend = () => {
      if (token !== this.browserSpeakToken) return;
      this.playbackState = "IDLE";
      this.onEnd?.();
    };
    utterance.onerror = (event) => {
      if (token !== this.browserSpeakToken) return;
      // "interrupted"/"canceled" are expected after stop() — not user-facing errors
      const reason = (event as SpeechSynthesisErrorEvent).error;
      if (reason === "interrupted" || reason === "canceled") {
        this.playbackState = "STOPPED";
        this.onEnd?.();
        return;
      }
      console.error("[TTS] Browser speech error:", reason);
      this.setPlaybackError(`Speech failed: ${reason || "unknown error"}`);
      this.onEnd?.();
    };

    // 5. Speak
    this.lastSpokenText = text;
    try {
      synth.speak(utterance);
      this.playbackState = "SPEAKING";
      this.onPlay?.();
    } catch (err) {
      console.warn("[TTS] Browser speech failed to start:", err);
      this.setPlaybackError("Speech failed to start");
      this.onEnd?.();
    }
  }

  /** Stop all playback and clear queue. */
  stop(): void {
    this.browserSpeakToken++; // invalidate in-flight browser speak chains
    this.audioQueue.stop();
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    this.barkProvider.stopGeneration();
    this.playbackState = "STOPPED";
  }

  /** Pause current playback. */
  pause(): void {
    this.audioQueue.pause();
    try { window.speechSynthesis?.pause(); } catch { /* ignore */ }
    if (this.playbackState === "SPEAKING") this.playbackState = "PAUSED";
  }

  /** Resume paused playback. */
  resume(): void {
    this.audioQueue.resume();
    try { window.speechSynthesis?.resume(); } catch { /* ignore */ }
    if (this.playbackState === "PAUSED") this.playbackState = "SPEAKING";
  }

  // ── Playback state API ─────────────────────────────────────────────────────

  private setPlaybackError(message: string): void {
    this.playbackState = "ERROR";
    this.playbackError = message;
    this.onError?.(message);
  }

  /** Real playback state — the UI must reflect actual playback, not intent. */
  getPlaybackInfo(): VoicePlaybackInfo {
    return {
      state: this.playbackState,
      provider: this.settings.engine === "bark" && this.barkProvider.isReady() ? "bark" : "browser",
      error: this.playbackError,
      lastSpokenText: this.lastSpokenText,
    };
  }

  /** Reset a transient error back to idle (e.g. after user acknowledgment). */
  clearError(): void {
    if (this.playbackState === "ERROR") {
      this.playbackState = "IDLE";
      this.playbackError = null;
    }
  }

  /**
   * Diagnostic test that exercises the exact production speech path.
   * Used by the Settings "Test Nova Voice" button.
   */
  async testVoice(): Promise<VoicePlaybackInfo> {
    this.clearError();
    try {
      await this.speak("Hello. Nova voice is working correctly.");
    } catch (err) {
      this.setPlaybackError(err instanceof Error ? err.message : String(err));
    }
    return this.getPlaybackInfo();
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
    if (this.playbackState === "SPEAKING") return "playing";
    if (this.audioQueue.getStatus() === "playing") return "playing";
    if (this.playbackState === "ERROR") return "error";
    if (this.settings.engine === "browser") {
      return "speechSynthesis" in window ? "ready" : "unavailable";
    }
    return this.barkProvider.getStatus();
  }

  /** Check if Bark is available. */
  isBarkAvailable(): boolean {
    return this.barkProvider.isReady();
  }

  /** Current resolved voice for diagnostics. */
  async getVoiceDiagnostics(): Promise<Record<string, unknown>> {
    const voices = await getVoicesWithWait(500);
    const { voice, lang } = pickVoice(voices, "en");
    return {
      engine: this.settings.engine,
      browserSupported: typeof window !== "undefined" && "speechSynthesis" in window,
      voiceCount: voices.length,
      resolvedVoice: voice?.name ?? null,
      resolvedLang: lang,
      playback: this.getPlaybackInfo(),
      bark: this.barkProvider.getDiagnostics(),
      queue: {
        status: this.audioQueue.getStatus(),
        pending: this.audioQueue.pendingCount,
      },
      settings: this.settings,
    };
  }

  /** Legacy diagnostics (synchronous). */
  getDiagnostics(): Record<string, unknown> {
    return {
      engine: this.settings.engine,
      playback: this.getPlaybackInfo(),
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
    onError?: (message: string) => void;
  }): void {
    this.onStatusChange = callbacks.onStatusChange;
    this.onPlay = callbacks.onPlay;
    this.onEnd = callbacks.onEnd;
    this.onError = callbacks.onError;
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch { /* ignore */ }
  }
}

/** Singleton TTS router */
export const ttsRouter = new TTSRouter();
