/**
 * Nova Core — observable world state.
 * A single observable snapshot of the environment Nova operates in.
 * Any subsystem may subscribe; updates are cheap shallow compares.
 */

import { novaEventBus } from "./NovaEventBus";
import type { NovaWorldState, VoicePhase } from "./NovaTypes";

type Listener = (state: NovaWorldState) => void;

const initialState: NovaWorldState = {
  currentUser: null,
  currentPage: "dashboard",
  currentRoute: "/",
  currentConversationId: null,
  voiceState: "sleeping",
  activeTaskCount: 0,
  currentTime: Date.now(),
  networkOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  connectedServices: [],
  connectedDevices: [],
  pendingNotifications: 0,
  upcomingCalendarEvents: [],
  activeAutomations: 0,
  recentActions: [],
  currentAIModel: "auto",
  systemHealth: "unknown",
};

class NovaWorld {
  private state: NovaWorldState = { ...initialState };
  private listeners = new Set<Listener>();
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  getState(): Readonly<NovaWorldState> {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Shallow patch — only notifies when something actually changed. */
  patch(partial: Partial<NovaWorldState>): void {
    let changed = false;
    for (const key of Object.keys(partial) as Array<keyof NovaWorldState>) {
      if (this.state[key] !== partial[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...partial };
    for (const l of this.listeners) {
      try {
        l(this.state);
      } catch (err) {
        if (import.meta.env.DEV) console.warn("[Nova World] listener error:", err);
      }
    }
  }

  setVoicePhase(phase: VoicePhase): void {
    this.patch({ voiceState: phase });
    novaEventBus.emit("voice.phase", { phase });
  }

  recordAction(tool: string, success: boolean): void {
    const recentActions = [
      { tool, success, at: Date.now() },
      ...this.state.recentActions,
    ].slice(0, 20);
    this.patch({ recentActions });
  }

  /** One-minute heartbeat for time-dependent decisions; auto-starts on first use. */
  private ensureClock(): void {
    if (this.clockTimer) return;
    this.clockTimer = setInterval(() => {
      this.patch({ currentTime: Date.now() });
    }, 60_000);
  }

  start(): void {
    this.ensureClock();
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }
    this.patch({ networkOnline: navigator.onLine });
  }

  stop(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
  }

  private handleOnline = () => {
    this.patch({ networkOnline: true });
    novaEventBus.emit("network.online", {});
  };

  private handleOffline = () => {
    this.patch({ networkOnline: false });
    novaEventBus.emit("network.offline", {});
  };
}

export const novaWorld = new NovaWorld();
