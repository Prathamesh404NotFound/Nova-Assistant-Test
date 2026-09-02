/**
 * Nova World State — WorldStateService
 * Tracks permission-aware context for the entire system.
 * Uses efficient polling and event-driven updates.
 */

import type { WorldState, TimeContext, NetworkContext, BatteryContext, AppContext, ScreenContext, FocusContext } from "./WorldStateTypes";

// ─── Storage ────────────────────────────────────────────────────────────────

const FOCUS_KEY = "nova_focus_mode";
const POLL_INTERVAL = 30_000; // 30 seconds

// ─── Event Emitter ──────────────────────────────────────────────────────────

type WorldStateListener = (state: WorldState) => void;

// ─── WorldState Service ─────────────────────────────────────────────────────

class WorldStateServiceImpl {
  private state: WorldState;
  private listeners: WorldStateListener[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.state = this.buildInitialState();
  }

  /**
   * Start tracking world state.
   */
  start(): void {
    if (this.pollTimer) return;

    // Initial build
    this.state = this.buildState();
    this.notify();

    // Poll for changes
    this.pollTimer = setInterval(() => {
      const newState = this.buildState();
      if (this.hasChanged(this.state, newState)) {
        this.state = newState;
        this.notify();
      }
    }, POLL_INTERVAL);

    // Listen for network changes
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.updateNetwork());
      window.addEventListener("offline", () => this.updateNetwork());
    }
  }

  /**
   * Stop tracking.
   */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Get current world state snapshot.
   */
  getState(): WorldState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes.
   */
  onChange(listener: WorldStateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Force an immediate state update.
   */
  refresh(): WorldState {
    this.state = this.buildState();
    this.notify();
    return this.state;
  }

  // ─── Focus Mode ───────────────────────────────────────────────────────

  getFocusMode(): FocusContext {
    try {
      const raw = localStorage.getItem(FOCUS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { isActive: false, mode: "none", startedAt: null, allowedNotifications: [] };
  }

  setFocusMode(mode: FocusContext["mode"], allowedNotifications: string[] = []): void {
    const focus: FocusContext = {
      isActive: mode !== "none",
      mode,
      startedAt: mode !== "none" ? Date.now() : null,
      allowedNotifications,
    };
    localStorage.setItem(FOCUS_KEY, JSON.stringify(focus));
    this.state.focus = focus;
    this.notify();
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private buildInitialState(): WorldState {
    const now = new Date();
    return {
      timestamp: Date.now(),
      time: this.getTimeContext(now),
      network: { online: navigator.onLine, type: "unknown" },
      battery: { level: 1, charging: false },
      activeApp: { name: "Nova", title: "Nova Assistant", isNova: true },
      screen: { width: window.screen.width, height: window.screen.height, isActive: true, lastInteraction: Date.now() },
      calendar: { nextEvent: null, todayEventCount: 0, freeMinutesUntilNext: 0, hasConflicts: false },
      tasks: { pendingCount: 0, overdueCount: 0, completedToday: 0, nextTask: null },
      email: { unreadCount: 0, importantCount: 0, lastReceivedAt: null },
      missions: { activeCount: 0, pausedCount: 0, failedCount: 0, nextMission: null },
      notifications: { unreadCount: 0, lastNotificationAt: null, suppressedCount: 0 },
      integrations: { connected: 0, errors: 0, expired: 0 },
      focus: this.getFocusMode(),
    };
  }

  private buildState(): WorldState {
    const now = new Date();
    return {
      ...this.state,
      timestamp: Date.now(),
      time: this.getTimeContext(now),
      network: this.getNetworkContext(),
      battery: this.state.battery, // Updated via events
      activeApp: this.getActiveApp(),
      screen: this.getScreenContext(),
      focus: this.getFocusMode(),
    };
  }

  private getTimeContext(now: Date): TimeContext {
    const hour = now.getHours();
    const isQuietHours = hour >= 23 || hour < 7; // 11 PM - 7 AM

    return {
      now,
      hour,
      minute: now.getMinutes(),
      dayOfWeek: now.toLocaleDateString("en-US", { weekday: "long" }),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isQuietHours,
      isFocusMode: this.getFocusMode().isActive,
    };
  }

  private getNetworkContext(): NetworkContext {
    const online = navigator.onLine;
    let type: NetworkContext["type"] = "unknown";

    if (!online) {
      type = "none";
    } else if (typeof navigator !== "undefined" && "connection" in navigator) {
      const conn = (navigator as Record<string, unknown>).connection as { effectiveType?: string; type?: string } | undefined;
      if (conn) {
        type = (conn.type as NetworkContext["type"]) || "unknown";
      }
    }

    return { online, type };
  }

  private getActiveApp(): AppContext {
    if (typeof document !== "undefined") {
      return {
        name: document.title || "Nova",
        title: document.title || "Nova Assistant",
        url: window.location.href,
        isNova: true,
      };
    }
    return { name: "Nova", title: "Nova Assistant", isNova: true };
  }

  private getScreenContext(): ScreenContext {
    return {
      width: window.screen.width,
      height: window.screen.height,
      isActive: Date.now() - this.state.screen.lastInteraction < 300_000, // 5 min
      lastInteraction: this.state.screen.lastInteraction,
    };
  }

  private updateNetwork(): void {
    this.state.network = this.getNetworkContext();
    this.notify();
  }

  private hasChanged(prev: WorldState, next: WorldState): boolean {
    return (
      prev.time.hour !== next.time.hour ||
      prev.time.minute !== next.time.minute ||
      prev.network.online !== next.network.online ||
      prev.focus.isActive !== next.focus.isActive ||
      prev.focus.mode !== next.focus.mode
    );
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch { /* ignore listener errors */ }
    }
  }
}

export const worldStateService = new WorldStateServiceImpl();
