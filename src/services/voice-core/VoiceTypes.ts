/**
 * Voice Core — shared types and state machine transitions.
 * States: sleeping → wake_detected → listening → processing → speaking →
 *         listening (continuous) | interrupted | error
 */

export type VoiceStateName =
  | "sleeping"
  | "wake_detected"
  | "listening"
  | "processing"
  | "speaking"
  | "interrupted"
  | "error";

/** Legal transitions — anything else is a bug and gets logged, not applied. */
export const VOICE_TRANSITIONS: Record<VoiceStateName, VoiceStateName[]> = {
  sleeping: ["wake_detected", "listening", "error"],
  wake_detected: ["listening", "error"],
  listening: ["processing", "sleeping", "error"],
  processing: ["speaking", "listening", "error"],
  speaking: ["listening", "interrupted", "sleeping", "error"],
  interrupted: ["listening", "processing", "sleeping"],
  error: ["listening", "sleeping"],
};

export interface VoiceTranscriptEvent {
  text: string;
  isFinal: boolean;
  lang: string;
}

export interface VoiceSessionConfig {
  /** Wake word required before processing in "sleeping" sessions. */
  wakeWordEnabled: boolean;
  wakePhrases: string[];
  wakeSensitivity: number; // 0..1
  wakeCooldownMs: number;
  /** Silence (ms) after which an active listening session sleeps. */
  silenceTimeoutMs: number;
  lang: string;
  /** When true, after speaking Nova returns to listening automatically. */
  continuousConversation: boolean;
}

export const DEFAULT_VOICE_CONFIG: VoiceSessionConfig = {
  wakeWordEnabled: false,
  wakePhrases: ["nova", "hey nova", "ok nova"],
  wakeSensitivity: 0.6,
  wakeCooldownMs: 1500,
  silenceTimeoutMs: 30_000,
  lang: "en-US",
  continuousConversation: true,
};

export interface VoiceSessionStatus {
  state: VoiceStateName;
  listening: boolean;
  speaking: boolean;
  provider: "live" | "browser";
  lang: string;
  lastError?: string;
  bargeInCount: number;
  latencyMs?: number;
}

/** Strip markdown so speech never reads syntax aloud. */
export function toSpeechFriendly(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " Here's a code block. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]*)\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "a link")
    .replace(/\|/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Buffer sentences so streaming text is spoken per sentence, not per chunk. */
export class SentenceBuffer {
  private buffer = "";

  push(chunk: string): string[] {
    this.buffer += chunk;
    const sentences: string[] = [];
    // Split on sentence terminators followed by whitespace/end.
    const parts = this.buffer.split(/(?<=[.!?।])\s+/);
    // Keep the last part in the buffer unless it clearly ends a sentence.
    const last = parts.pop() ?? "";
    for (const s of parts) {
      const trimmed = s.trim();
      if (trimmed) sentences.push(trimmed);
    }
    this.buffer = last;
    return sentences;
  }

  /** Flush any remainder (call when generation completes). */
  flush(): string | null {
    const rest = this.buffer.trim();
    this.buffer = "";
    return rest || null;
  }
}
