/**
 * Voice Core — VoiceInput.
 * Microphone pipeline over the browser SpeechRecognition engine (the existing
 * useOfflineSTT logic, extracted to a service so voice and text share one
 * brain through NovaCore). Handles permission, unsupported browsers, and
 * continuous listening with auto-restart.
 */

export interface VoiceInputCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError: (kind: string, message: string) => void;
  onListeningChange: (listening: boolean) => void;
}

class VoiceInput {
  private recognition: SpeechRecognition | null = null;
  private callbacks: VoiceInputCallbacks | null = null;
  private shouldListen = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private starting = false;
  lang = "en-US";

  setCallbacks(cb: VoiceInputCallbacks): void {
    this.callbacks = cb;
  }

  isSupported(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }

  getRecognitionCtor(): (new () => SpeechRecognition) | null {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognition;
      webkitSpeechRecognition?: new () => SpeechRecognition;
    };
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
  }

  async start(lang?: string): Promise<boolean> {
    if (lang) this.lang = lang;
    if (!this.isSupported()) {
      this.callbacks?.onError("not-supported", "Speech recognition is not supported in this browser.");
      return false;
    }
    this.shouldListen = true;
    return this.spawn();
  }

  private spawn(): boolean {
    if (this.starting || this.recognition) return this.recognition !== null;
    const Ctor = this.getRecognitionCtor();
    if (!Ctor) return false;
    this.starting = true;
    try {
      const rec = new Ctor();
      rec.lang = this.lang;
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (text) this.callbacks?.onTranscript(text, result.isFinal);
        }
      };
      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        const fatal = event.error === "not-allowed" || event.error === "service-not-allowed" ||
          event.error === "audio-capture" || event.error === "not-supported";
        this.callbacks?.onError(event.error, this.describeError(event.error));
        if (fatal) this.shouldListen = false;
      };

      rec.onend = () => {
        this.recognition = null;
        this.callbacks?.onListeningChange(false);
        // Auto-restart while the session wants to listen.
        if (this.shouldListen) {
          this.restartTimer = setTimeout(() => {
            this.restartTimer = null;
            if (this.shouldListen) this.spawn();
          }, 400);
        }
      };
      rec.onstart = () => {
        this.starting = false;
        this.callbacks?.onListeningChange(true);
      };

      this.recognition = rec;
      rec.start();
      return true;
    } catch (err) {
      this.starting = false;
      this.recognition = null;
      // "already started" — treat as success
      if (err instanceof Error && /already started/i.test(err.message)) return true;
      this.callbacks?.onError("unknown", err instanceof Error ? err.message : "Failed to start microphone");
      return false;
    }
  }

  stop(): void {
    this.shouldListen = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    const rec = this.recognition;
    this.recognition = null;
    if (rec) {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      this.callbacks?.onListeningChange(false);
    }
  }

  isListening(): boolean {
    return this.shouldListen;
  }

  private describeError(kind: string): string {
    switch (kind) {
      case "not-allowed":
      case "service-not-allowed":
        return "Microphone permission was denied. Enable it in your browser settings.";
      case "audio-capture":
        return "No microphone was found on this device.";
      case "network":
        return "Speech recognition needs a network connection.";
      case "not-supported":
        return "Speech recognition is not supported in this browser.";
      default:
        return "Microphone error. Try again.";
    }
  }
}

export const voiceInput = new VoiceInput();
