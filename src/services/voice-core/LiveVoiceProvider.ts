/**
 * Voice Core — Live API provider (Gemini Live).
 * Bidirectional real-time voice over WebSocket. Requires an ephemeral token
 * minted by a backend (never a long-lived API key in the client).
 *
 * When no token endpoint is configured the provider reports unavailable and
 * the session transparently uses the browser STT→NovaCore→TTS fallback, so
 * real-time voice is never a single point of failure.
 */

export interface LiveProviderStatus {
  available: boolean;
  reason?: string;
}

export interface LiveSessionEvents {
  onAudioChunk?: (base64Pcm: string) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onInterrupted?: () => void;
  onError?: (message: string) => void;
  onClose?: () => void;
}

const EPHEMERAL_TOKEN_ENDPOINT_KEY = "nova:live-token-endpoint";

function getTokenEndpoint(): string | null {
  try {
    const fromEnv = (import.meta.env.VITE_LIVE_TOKEN_ENDPOINT as string | undefined) ?? null;
    return fromEnv || localStorage.getItem(EPHEMERAL_TOKEN_ENDPOINT_KEY) || null;
  } catch {
    return null;
  }
}

class LiveVoiceProvider {
  private ws: WebSocket | null = null;
  private events: LiveSessionEvents = {};
  private reconnectAttempts = 0;
  private maxReconnects = 3;
  private intentionalClose = false;

  /** Availability requires a configured ephemeral-token endpoint. */
  getStatus(): LiveProviderStatus {
    if (typeof WebSocket === "undefined") {
      return { available: false, reason: "WebSockets unsupported in this browser" };
    }
    if (!getTokenEndpoint()) {
      return {
        available: false,
        reason: "Live API not configured — set VITE_LIVE_TOKEN_ENDPOINT (ephemeral-token backend)",
      };
    }
    return { available: true };
  }

  setEvents(events: LiveSessionEvents): void {
    this.events = events;
  }

  /** Open a persistent Live session. Resolves false when unavailable. */
  async connect(): Promise<boolean> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return true;
    const status = this.getStatus();
    if (!status.available) return false;

    this.intentionalClose = false;
    try {
      // Mint a short-lived token from the configured backend endpoint.
      const res = await fetch(getTokenEndpoint()!, { method: "POST" });
      if (!res.ok) throw new Error(`Token endpoint returned ${res.status}`);
      const { token } = (await res.json()) as { token?: string };
      if (!token) throw new Error("No token in response");

      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(token)}`;
      this.ws = new WebSocket(url);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
      };
      this.ws.onmessage = (ev) => this.handleMessage(ev);
      this.ws.onerror = () => this.events.onError?.("Live connection error");
      this.ws.onclose = () => {
        this.ws = null;
        if (!this.intentionalClose && this.reconnectAttempts < this.maxReconnects) {
          this.reconnectAttempts += 1;
          const delay = 1000 * this.reconnectAttempts;
          setTimeout(() => void this.connect(), delay);
        } else {
          this.events.onClose?.();
        }
      };
      return true;
    } catch (err) {
      this.events.onError?.(err instanceof Error ? err.message : "Live connect failed");
      return false;
    }
  }

  private handleMessage(ev: MessageEvent): void {
    try {
      const data = JSON.parse(typeof ev.data === "string" ? ev.data : "{}");
      // serverContent: model audio / turn completion / interruptions
      const server = data.serverContent ?? {};
      if (server.interrupted) {
        this.events.onInterrupted?.();
        return;
      }
      const parts = server.modelTurn?.parts ?? [];
      for (const part of parts) {
        const inline = part.inlineData?.data;
        if (typeof inline === "string") this.events.onAudioChunk?.(inline);
      }
      if (server.turnComplete) {
        // Model turn finished — caller can resume listening.
      }
      // client transcription of the user's speech
      const input = server.inputTranscription?.text;
      if (typeof input === "string") this.events.onTranscript?.(input, false);
      const output = server.outputTranscription?.text;
      if (typeof output === "string") this.events.onTranscript?.(output, true);
    } catch {
      /* non-JSON frames are ignored */
    }
  }

  /** Send a chunk of 16kHz mono PCM16 audio as base64. */
  sendAudio(base64Pcm16k: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: base64Pcm16k }] },
    }));
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const liveVoiceProvider = new LiveVoiceProvider();
