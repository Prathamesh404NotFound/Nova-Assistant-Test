/**
 * Voice Core — explicit state machine.
 * All voice state lives here; React never infers important voice state from
 * unrelated UI state. Illegal transitions are logged and ignored.
 */

import { VOICE_TRANSITIONS, type VoiceStateName } from "./VoiceTypes";
import { novaEventBus } from "@/services/nova-core/NovaEventBus";
import { novaWorld } from "@/services/nova-core/NovaContext";

type VoiceStateListener = (state: VoiceStateName, prev: VoiceStateName) => void;

class VoiceStateMachine {
  private state: VoiceStateName = "sleeping";
  private listeners = new Set<VoiceStateListener>();
  private bargeInCount = 0;

  get current(): VoiceStateName {
    return this.state;
  }

  subscribe(listener: VoiceStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Attempt a transition; returns whether it was legal and applied. */
  transition(next: VoiceStateName): boolean {
    if (next === this.state) return true;
    const allowed = VOICE_TRANSITIONS[this.state];
    if (!allowed.includes(next)) {
      if (import.meta.env.DEV) {
        console.warn(`[Voice] illegal transition ${this.state} → ${next}, ignoring`);
      }
      return false;
    }
    const prev = this.state;
    this.state = next;
    if (next === "listening" && prev === "speaking") {
      this.bargeInCount += 1;
    }
    novaWorld.setVoicePhase(next);
    novaEventBus.emit("voice.phase", { phase: next });
    for (const l of this.listeners) {
      try {
        l(next, prev);
      } catch (err) {
        if (import.meta.env.DEV) console.warn("[Voice] listener error:", err);
      }
    }
    return true;
  }

  /** Force a state (used on session start/stop/reset where transitions are reset). */
  reset(state: VoiceStateName = "sleeping"): void {
    const prev = this.state;
    this.state = state;
    novaWorld.setVoicePhase(state);
    for (const l of this.listeners) {
      try {
        l(state, prev);
      } catch {
        /* non-critical */
      }
    }
  }

  getBargeInCount(): number {
    return this.bargeInCount;
  }
}

export const voiceStateMachine = new VoiceStateMachine();
