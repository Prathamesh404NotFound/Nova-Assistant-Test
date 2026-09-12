/**
 * Voice Core — local wake-word detection.
 * Simple energy + phrase matching over the Web Speech interim transcript.
 * Fully local — no network request needed for wake detection.
 */

import { voiceStateMachine } from "./VoiceStateMachine";
import { novaEventBus } from "@/services/nova-core/NovaEventBus";
import type { VoiceSessionConfig } from "./VoiceTypes";

class WakeWordDetector {
  private config: VoiceSessionConfig | null = null;
  private lastWakeAt = 0;
  private armed = false;

  configure(config: VoiceSessionConfig): void {
    this.config = config;
  }

  /** Start watching for the wake phrase. */
  arm(): void {
    this.armed = true;
  }

  disarm(): void {
    this.armed = false;
  }

  isArmed(): boolean {
    return this.armed;
  }

  /**
   * Feed an interim transcript; returns the remainder text after the wake
   * phrase if it fired (with cooldown), or null.
   */
  feedTranscript(text: string): string | null {
    const cfg = this.config;
    if (!cfg || !cfg.wakeWordEnabled || !this.armed) return null;

    const lower = text.toLowerCase().trim();
    const now = Date.now();
    if (now - this.lastWakeAt < cfg.wakeCooldownMs) return null;

    for (const phrase of cfg.wakePhrases) {
      const idx = lower.indexOf(phrase);
      if (idx === -1) continue;
      // Require the match to be at a word boundary for fewer false positives.
      const before = idx === 0 ? " " : lower[idx - 1];
      const after = lower[idx + phrase.length] ?? " ";
      if (!/[\s,.!?]/.test(before) || !/[\s,.!?]/.test(after)) continue;

      this.lastWakeAt = now;
      voiceStateMachine.transition("wake_detected");
      novaEventBus.emit("voice.wake", { source: "local", confidence: cfg.wakeSensitivity });
      // Text after the wake phrase is the command.
      const remainder = text.slice(idx + phrase.length).replace(/^[\s,.!?]+/, "");
      return remainder;
    }
    return null;
  }
}

export const wakeWordDetector = new WakeWordDetector();
