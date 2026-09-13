/**
 * Nova Kill Switch — one obvious, immediate off-switch for everything that
 * can affect the user's world:
 *
 *   microphone        — voice input and wake word stop instantly
 *   computerControl   — desktop.* / environment tools refuse to execute
 *   automation        — proactive engine and automations stop acting
 *   desktopConnection — paired agent commands are blocked at the bridge
 *
 * When any switch is OFF, the corresponding subsystem receives a hard
 * "refuse" answer — not a UI hint. Nova cannot route around it.
 */

import { novaEventBus } from "@/services/nova-core/NovaEventBus";

export type KillSwitchKey = "microphone" | "computerControl" | "automation" | "desktopConnection";

export interface KillSwitchState {
  microphone: boolean;
  computerControl: boolean;
  automation: boolean;
  desktopConnection: boolean;
  /** Timestamp of last full shutdown (all off) — shown in the UI. */
  lastFullShutdownAt: number | null;
}

const STORAGE_KEY = "nova_kill_switch_v1";

const DEFAULT_STATE: KillSwitchState = {
  microphone: true,
  computerControl: true,
  automation: true,
  desktopConnection: true,
  lastFullShutdownAt: null,
};

function loadState(): KillSwitchState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_STATE };
}

type Listener = (state: KillSwitchState) => void;

class KillSwitchService {
  private state: KillSwitchState = loadState();
  private listeners: Listener[] = [];

  constructor() {
    // Persist across reloads so a disabled state survives restarts.
    // Note: state is device-local by design — kill switches are hardware.
  }

  get(key: KillSwitchKey): boolean {
    return this.state[key];
  }

  getAll(): Readonly<KillSwitchState> {
    return this.state;
  }

  isEnabled(key: KillSwitchKey): boolean {
    return this.state[key];
  }

  set(key: KillSwitchKey, enabled: boolean): void {
    if (this.state[key] === enabled) return;
    this.state = { ...this.state, [key]: enabled };

    const allOff = !this.state.microphone && !this.state.computerControl &&
      !this.state.automation && !this.state.desktopConnection;
    if (allOff) this.state.lastFullShutdownAt = Date.now();

    this.persist();
    this.notify();

    // Typed event for the rest of the system to react.
    novaEventBus.emit("agent.completed", { agent: `kill-switch:${key}:${enabled ? "on" : "off"}` });

    if (!enabled) {
      // Immediate enforcement for the affected subsystems.
      if (key === "microphone" || allOff) {
        this.stopVoiceSubsystems();
      }
      if (key === "desktopConnection" || allOff) {
        this.invalidateAgentBridge();
      }
    }
  }

  /** PANIC: everything off, immediately. */
  shutdownAll(): void {
    this.state = {
      microphone: false,
      computerControl: false,
      automation: false,
      desktopConnection: false,
      lastFullShutdownAt: Date.now(),
    };
    this.persist();
    this.notify();
    this.stopVoiceSubsystems();
    this.invalidateAgentBridge();
    novaEventBus.emit("agent.completed", { agent: "kill-switch:panic" });
  }

  /** Restore defaults (all on). */
  enableAll(): void {
    this.state = { ...DEFAULT_STATE, lastFullShutdownAt: this.state.lastFullShutdownAt };
    this.persist();
    this.notify();
    novaEventBus.emit("agent.completed", { agent: "kill-switch:enable-all" });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch { /* ignore */ }
  }

  private notify(): void {
    for (const l of this.listeners) {
      try { l(this.state); } catch { /* non-critical */ }
    }
  }

  private stopVoiceSubsystems(): void {
    // Imported lazily to avoid circulars at module-eval time.
    void (async () => {
      try {
        const { voiceSession } = await import("@/services/voice-core/VoiceSession");
        voiceSession.stop();
      } catch { /* best-effort */ }
      try {
        const { voiceOutput } = await import("@/services/voice-core/VoiceOutput");
        voiceOutput.interrupt();
      } catch { /* best-effort */ }
    })();
  }

  private invalidateAgentBridge(): void {
    void (async () => {
      try {
        const { agentBridge } = await import("@/services/computer/AgentBridge");
        agentBridge.invalidate();
      } catch { /* best-effort */ }
    })();
  }
}

export const killSwitch = new KillSwitchService();

/** Guard helper for tool executors — returns an error string when blocked. */
export function assertComputerControlAllowed(): string | null {
  if (!killSwitch.isEnabled("computerControl")) {
    return "Computer control is disabled (kill switch). Nova cannot execute desktop commands.";
  }
  if (!killSwitch.isEnabled("desktopConnection")) {
    return "Desktop connection is disabled (kill switch). Nova cannot reach the desktop agent.";
  }
  return null;
}
