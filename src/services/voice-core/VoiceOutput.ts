/**
 * Voice Core — VoiceOutput.
 * Centralizes ALL speech output. Wraps the existing tts-router (which already
 * implements the safe browser speak queue, Bark fallback and state machine)
 * and adds sentence-aware buffering for streaming text plus barge-in stop.
 */

import { ttsRouter, type VoiceSettings } from "@/services/tts/tts-router";
import { SentenceBuffer, toSpeechFriendly, type VoiceSessionStatus } from "./VoiceTypes";

export interface VoiceOutputCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

/** UI-facing speaking-state updates (Chat, Dashboard, presence orb). */
export type VoiceOutputStateListener = (state: { speaking: boolean; error: string | null }) => void;

class VoiceOutput {
  private callbacks: VoiceOutputCallbacks = {};
  private sentenceQueue: string[] = [];
  private isSpeakingActive = false;
  private cancelled = false;
  private lastError: string | null = null;
  private listeners = new Set<VoiceOutputStateListener>();
  /** Global mute — audio output is dropped, text still flows. */
  private muted = false;

  setCallbacks(cb: VoiceOutputCallbacks): void {
    this.callbacks = cb;
    ttsRouter.setCallbacks({
      onPlay: () => {
        this.isSpeakingActive = true;
        this.notify();
        this.callbacks.onStart?.();
      },
      onEnd: () => {
        this.isSpeakingActive = false;
        this.notify();
        if (this.cancelled) {
          this.cancelled = false;
          return;
        }
        this.speakNext();
      },
      onError: (message: string) => {
        this.isSpeakingActive = false;
        this.cancelled = false;
        this.sentenceQueue = [];
        this.lastError = message;
        this.notify();
        this.callbacks.onError?.(message);
      },
    });
  }

  /** Subscribe to speaking/error state instead of clobbering session callbacks. */
  subscribe(listener: VoiceOutputStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) {
      try {
        l({ speaking: this.isSpeakingActive, error: this.lastError });
      } catch { /* listener errors never break output */ }
    }
  }

  // ── Mute (Dashboard + Settings control) ─────────────────────────────────

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.sentenceQueue = [];
      this.cancelled = true;
      ttsRouter.stop();
      this.isSpeakingActive = false;
      this.notify();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  clearError(): void {
    this.lastError = null;
    this.notify();
    ttsRouter.clearError();
  }

  // ── Speech output ───────────────────────────────────────────────────────

  /** Speak a finalized text (markdown stripped). */
  async speak(text: string): Promise<void> {
    const friendly = toSpeechFriendly(text);
    if (!friendly || this.muted) return;
    this.cancelled = false;
    await ttsRouter.speak(friendly);
  }

  /**
   * Feed streaming chunks; whole sentences are queued and spoken one at a
   * time — never per-chunk fragments. Call `endStream()` when generation
   * completes to flush the remainder.
   */
  streamChunk(chunk: string): void {
    if (this.muted) return;
    const buffer = this.ensureBuffer();
    for (const sentence of buffer.push(chunk)) {
      this.sentenceQueue.push(toSpeechFriendly(sentence));
    }
    if (!this.isSpeakingActive) this.speakNext();
  }

  endStream(): void {
    const buffer = this.streamBuffer;
    if (buffer) {
      const rest = buffer.flush();
      if (rest) this.sentenceQueue.push(toSpeechFriendly(rest));
    }
    if (!this.isSpeakingActive) this.speakNext();
  }

  private streamBuffer: SentenceBuffer | null = null;
  private ensureBuffer(): SentenceBuffer {
    if (!this.streamBuffer) this.streamBuffer = new SentenceBuffer();
    return this.streamBuffer;
  }

  private speakNext(): void {
    const next = this.sentenceQueue.shift();
    if (!next) return;
    void ttsRouter.speak(next).catch((err) => {
      this.callbacks.onError?.(err instanceof Error ? err.message : "Speech failed");
    });
  }

  /** Barge-in: stop audio immediately and drop anything queued. */
  interrupt(): void {
    this.sentenceQueue = [];
    this.streamBuffer = null;
    this.cancelled = true;
    ttsRouter.stop();
  }

  pause(): void {
    ttsRouter.pause();
  }

  resume(): void {
    ttsRouter.resume();
  }

  isSpeaking(): boolean {
    return this.isSpeakingActive;
  }

  // ── Compatibility passthroughs (legacy ttsRouter stays internal) ────────
  // UI components must use these, never import tts-router directly.

  getSettings(): VoiceSettings {
    return ttsRouter.getSettings();
  }

  updateSettings(settings: Partial<VoiceSettings>): void {
    ttsRouter.updateSettings(settings);
  }

  setVolume(volume: number): void {
    ttsRouter.setVolume(volume);
  }

  isBarkAvailable(): boolean {
    return ttsRouter.isBarkAvailable();
  }

  initialize(): void {
    ttsRouter.initialize();
  }

  async testVoice(): Promise<Awaited<ReturnType<typeof ttsRouter.testVoice>>> {
    return ttsRouter.testVoice();
  }

  getDiagnostics(): ReturnType<typeof ttsRouter.getDiagnostics> {
    return ttsRouter.getDiagnostics();
  }
}

export const voiceOutput = new VoiceOutput();
