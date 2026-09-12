/**
 * Voice Core — VoiceSession.
 * Binds input, output, wake word, the state machine, the Live provider and
 * NovaCore into one continuous conversational loop:
 *
 *   listening → (wake) → capture → NovaCore → speaking → (barge-in) → listening
 *
 * The browser fallback path (STT → NovaCore → TTS) always works; the Live API
 * path engages when configured.
 */

import { voiceStateMachine } from "./VoiceStateMachine";
import { voiceInput } from "./VoiceInput";
import { voiceOutput } from "./VoiceOutput";
import { wakeWordDetector } from "./VoiceWakeWord";
import { liveVoiceProvider } from "./LiveVoiceProvider";
import { novaCore } from "@/services/nova-core/NovaCore";
import { novaEventBus } from "@/services/nova-core/NovaEventBus";
import { DEFAULT_VOICE_CONFIG, type VoiceSessionConfig, type VoiceSessionStatus } from "./VoiceTypes";

class VoiceSession {
  private config: VoiceSessionConfig = { ...DEFAULT_VOICE_CONFIG };
  private active = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private processingRequest = false;
  private listeners: Array<(status: VoiceSessionStatus) => void> = [];
  private lastTranscript = "";
  private userId = "anonymous";

  constructor() {
    voiceStateMachine.subscribe(() => this.notify());

    voiceInput.setCallbacks({
      onTranscript: (text, isFinal) => this.handleTranscript(text, isFinal),
      onError: (kind, message) => this.handleError(kind, message),
      onListeningChange: (listening) => {
        if (listening && voiceStateMachine.current !== "speaking") {
          voiceStateMachine.transition("listening");
        }
        this.resetSilenceTimer();
        this.notify();
      },
    });

    voiceOutput.setCallbacks({
      onStart: () => {
        voiceStateMachine.transition("speaking");
        this.notify();
      },
      onEnd: () => {
        // Continuous conversation: return to listening after speaking.
        if (this.active && this.config.continuousConversation) {
          voiceStateMachine.transition("listening");
          void voiceInput.start(this.config.lang);
        } else if (this.active) {
          voiceStateMachine.reset("sleeping");
        }
        this.notify();
      },
      onError: () => {
        voiceStateMachine.transition("listening");
        this.notify();
      },
    });

    // Barge-in: any user speech while Nova is speaking interrupts output.
    novaEventBus.on("voice.transcript", ({ text }) => {
      if (voiceStateMachine.current === "speaking" && text.trim()) {
        this.bargeIn();
      }
    });
  }

  configure(partial: Partial<VoiceSessionConfig>): void {
    this.config = { ...this.config, ...partial };
    wakeWordDetector.configure(this.config);
  }

  getConfig(): Readonly<VoiceSessionConfig> {
    return this.config;
  }

  setUserId(userId: string): void {
    this.userId = userId || "anonymous";
  }

  /** Start the continuous voice session. */
  async start(opts?: { requireWakeWord?: boolean }): Promise<boolean> {
    if (this.active) return true;
    this.active = true;
    this.setSilenceConfig();

    const liveStatus = liveVoiceProvider.getStatus();
    if (liveStatus.available) {
      const live = await liveVoiceProvider.connect();
      if (live) {
        voiceStateMachine.reset("listening");
        this.notify();
        return true;
      }
      // Live failed → browser fallback below.
    }

    if (opts?.requireWakeWord) {
      wakeWordDetector.arm();
      voiceStateMachine.reset("sleeping");
    } else {
      voiceStateMachine.reset("listening");
    }

    const ok = await voiceInput.start(this.config.lang);
    if (!ok) {
      this.active = false;
      voiceStateMachine.reset("sleeping");
    }
    this.notify();
    return ok;
  }

  stop(): void {
    this.active = false;
    wakeWordDetector.disarm();
    liveVoiceProvider.disconnect();
    voiceInput.stop();
    voiceOutput.interrupt();
    this.clearSilenceTimer();
    voiceStateMachine.reset("sleeping");
    this.notify();
  }

  isActive(): boolean {
    return this.active;
  }

  /** Feed text as if spoken — same brain for text and voice modality testing. */
  async submitText(text: string): Promise<void> {
    await this.processUtterance(text);
  }

  /** Barge-in: stop speech immediately, resume listening. */
  bargeIn(): void {
    if (voiceStateMachine.current !== "speaking") return;
    voiceStateMachine.transition("interrupted");
    voiceOutput.interrupt();
    voiceStateMachine.transition("listening");
    this.notify();
  }

  private async handleTranscript(text: string, isFinal: boolean): Promise<void> {
    if (!this.active) return;

    // Barge-in: user speech while Nova speaks interrupts output immediately.
    // Guard against echo/self-hearing: require a substantial utterance.
    if (voiceStateMachine.current === "speaking" && text.trim().length >= 6) {
      this.bargeIn();
      return;
    }

    this.resetSilenceTimer();

    // Wake-word gating in sleeping state.
    if (voiceStateMachine.current === "sleeping") {
      const command = wakeWordDetector.feedTranscript(text);
      if (command !== null && command.trim()) {
        voiceStateMachine.transition("listening");
        if (isFinal || command.length > 8) {
          await this.processUtterance(command.trim());
        }
      }
      return;
    }

    if (voiceStateMachine.current === "listening" && isFinal && text.trim()) {
      await this.processUtterance(text.trim());
    }
  }

  private async processUtterance(text: string): Promise<void> {
    if (this.processingRequest) return; // one request at a time
    this.processingRequest = true;
    this.clearSilenceTimer();
    voiceStateMachine.transition("processing");
    this.notify();

    novaEventBus.emit("voice.transcript", { text, isFinal: true });
    this.lastTranscript = text;

    try {
      const response = await novaCore.handle({
        id: "",
        userId: this.userId,
        input: text,
        source: this.config.wakeWordEnabled ? "wake_word" : "voice",
        timestamp: Date.now(),
        context: { conversationHistory: [] },
      });

      // Only speak meaningful output; tool confirmations surface as questions.
      if (response.text.trim()) {
        await voiceOutput.speak(response.spokenText ?? response.text);
      } else {
        voiceStateMachine.transition("listening");
      }
    } catch {
      voiceStateMachine.transition("error");
      voiceStateMachine.transition("listening");
    } finally {
      this.processingRequest = false;
      this.resetSilenceTimer();
      this.notify();
    }
  }

  private handleError(kind: string, message: string): void {
    if (kind === "aborted" || kind === "no-speech") return; // routine
    voiceStateMachine.transition("error");
    this.notify();
    // Fatal permission errors end the session.
    if (kind === "not-allowed" || kind === "service-not-allowed" || kind === "audio-capture") {
      this.active = false;
      voiceStateMachine.reset("sleeping");
    }
  }

  private setSilenceConfig(): void {
    // silence timeout handled by resetSilenceTimer
  }

  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
    if (!this.active) return;
    this.silenceTimer = setTimeout(() => {
      if (voiceStateMachine.current === "listening") {
        voiceStateMachine.transition("sleeping");
        if (this.config.wakeWordEnabled) wakeWordDetector.arm();
        this.notify();
      }
    }, this.config.silenceTimeoutMs);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  subscribe(listener: (status: VoiceSessionStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getStatus(): VoiceSessionStatus {
    return {
      state: voiceStateMachine.current,
      listening: voiceInput.isListening(),
      speaking: voiceOutput.isSpeaking(),
      provider: liveVoiceProvider.isConnected() ? "live" : "browser",
      lang: this.config.lang,
      bargeInCount: voiceStateMachine.getBargeInCount(),
    };
  }

  private notify(): void {
    const status = this.getStatus();
    for (const l of this.listeners) {
      try {
        l(status);
      } catch {
        /* non-critical */
      }
    }
  }

  getLastTranscript(): string {
    return this.lastTranscript;
  }
}

export const voiceSession = new VoiceSession();
