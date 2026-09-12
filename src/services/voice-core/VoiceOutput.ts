/**
 * Voice Core — VoiceOutput.
 * Centralizes ALL speech output. Wraps the existing tts-router (which already
 * implements the safe browser speak queue, Bark fallback and state machine)
 * and adds sentence-aware buffering for streaming text plus barge-in stop.
 */

import { ttsRouter } from "@/services/tts/tts-router";
import { SentenceBuffer, toSpeechFriendly, type VoiceSessionStatus } from "./VoiceTypes";

export interface VoiceOutputCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

class VoiceOutput {
  private callbacks: VoiceOutputCallbacks = {};
  private sentenceQueue: string[] = [];
  private isSpeakingActive = false;
  private cancelled = false;

  setCallbacks(cb: VoiceOutputCallbacks): void {
    this.callbacks = cb;
    ttsRouter.setCallbacks({
      onPlay: () => {
        this.isSpeakingActive = true;
        this.callbacks.onStart?.();
      },
      onEnd: () => {
        this.isSpeakingActive = false;
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
        this.callbacks.onError?.(message);
      },
    });
  }

  /** Speak a finalized text (markdown stripped). */
  async speak(text: string): Promise<void> {
    const friendly = toSpeechFriendly(text);
    if (!friendly) return;
    this.cancelled = false;
    await ttsRouter.speak(friendly);
  }

  /**
   * Feed streaming chunks; whole sentences are queued and spoken one at a
   * time — never per-chunk fragments. Call `endStream()` when generation
   * completes to flush the remainder.
   */
  streamChunk(chunk: string): void {
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
}

export const voiceOutput = new VoiceOutput();
