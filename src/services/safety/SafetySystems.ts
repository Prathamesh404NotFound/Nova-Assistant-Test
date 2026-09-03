/**
 * Nova Safety — Rate Limiter, Loop Detector, Emergency Stop
 * Prevents runaway execution, detects loops, and provides a global kill switch.
 */

// ─── Rate Limiter ────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

class RateLimiterImpl {
  private limits = new Map<string, RateLimitEntry>();
  private config: Record<string, { maxRequests: number; windowMs: number }> = {
    ai_gemini: { maxRequests: 30, windowMs: 60_000 },
    ai_local: { maxRequests: 60, windowMs: 60_000 },
    browser: { maxRequests: 20, windowMs: 60_000 },
    email: { maxRequests: 10, windowMs: 60_000 },
    desktop: { maxRequests: 30, windowMs: 60_000 },
    notifications: { maxRequests: 20, windowMs: 60_000 },
    automation: { maxRequests: 15, windowMs: 60_000 },
    search: { maxRequests: 20, windowMs: 60_000 },
    screen: { maxRequests: 10, windowMs: 60_000 },
    default: { maxRequests: 30, windowMs: 60_000 },
  };

  /** Check if a request is allowed. Returns true if allowed, false if rate limited. */
  check(category: string): boolean {
    const cfg = this.config[category] || this.config.default;
    const now = Date.now();
    const entry = this.limits.get(category);

    if (!entry || now - entry.windowStart > cfg.windowMs) {
      this.limits.set(category, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= cfg.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  /** Get remaining requests in current window. */
  remaining(category: string): number {
    const cfg = this.config[category] || this.config.default;
    const entry = this.limits.get(category);
    if (!entry || Date.now() - entry.windowStart > cfg.windowMs) return cfg.maxRequests;
    return Math.max(0, cfg.maxRequests - entry.count);
  }

  /** Configure limits for a category. */
  configure(category: string, maxRequests: number, windowMs: number): void {
    this.config[category] = { maxRequests, windowMs };
  }

  /** Reset limits for a category. */
  reset(category: string): void {
    this.limits.delete(category);
  }
}

export const rateLimiter = new RateLimiterImpl();

// ─── Loop Detector ───────────────────────────────────────────────────────────

interface LoopPattern {
  key: string;
  timestamps: number[];
  maxRepeats: number;
  windowMs: number;
}

class LoopDetectorImpl {
  private patterns = new Map<string, LoopPattern>();
  private onLoopDetected?: (key: string, count: number) => void;
  private defaultMaxRepeats = 5;
  private defaultWindowMs = 60_000;

  setHandler(handler: (key: string, count: number) => void): void {
    this.onLoopDetected = handler;
  }

  /** Record an execution of a tool/step. Returns true if a loop is detected. */
  record(key: string, maxRepeats?: number, windowMs?: number): boolean {
    const now = Date.now();
    const cfg = {
      maxRepeats: maxRepeats || this.defaultMaxRepeats,
      windowMs: windowMs || this.defaultWindowMs,
    };

    let pattern = this.patterns.get(key);
    if (!pattern) {
      pattern = { key, timestamps: [], ...cfg };
      this.patterns.set(key, pattern);
    }

    // Prune old timestamps
    pattern.timestamps = pattern.timestamps.filter((t) => now - t < cfg.windowMs);
    pattern.timestamps.push(now);

    if (pattern.timestamps.length >= cfg.maxRepeats) {
      this.onLoopDetected?.(key, pattern.timestamps.length);
      return true;
    }
    return false;
  }

  /** Check if a key is in a loop state. */
  isLooping(key: string): boolean {
    const pattern = this.patterns.get(key);
    if (!pattern) return false;
    const now = Date.now();
    const recent = pattern.timestamps.filter((t) => now - t < pattern.windowMs);
    return recent.length >= pattern.maxRepeats;
  }

  /** Reset tracking for a key. */
  reset(key: string): void {
    this.patterns.delete(key);
  }

  /** Reset all tracking. */
  resetAll(): void {
    this.patterns.clear();
  }
}

export const loopDetector = new LoopDetectorImpl();

// ─── Emergency Stop ──────────────────────────────────────────────────────────

export type EmergencyStopSource = "user" | "system" | "supervisor";

interface EmergencyStopState {
  active: boolean;
  triggeredAt?: number;
  source?: EmergencyStopSource;
  reason?: string;
}

class EmergencyStopImpl {
  private state: EmergencyStopState = { active: false };
  private listeners: Array<(active: boolean, source?: EmergencyStopSource) => void> = [];
  private onCancelMission?: (missionId: string) => void;
  private onCancelScheduler?: () => void;

  /** Check if emergency stop is active. */
  isActive(): boolean {
    return this.state.active;
  }

  /** Get the current state. */
  getState(): EmergencyStopState {
    return { ...this.state };
  }

  /** Trigger emergency stop. */
  trigger(source: EmergencyStopSource, reason?: string): void {
    this.state = {
      active: true,
      triggeredAt: Date.now(),
      source,
      reason: reason || "Emergency stop activated",
    };
    this.notify();
  }

  /** Resume after emergency stop. */
  resume(): void {
    this.state = { active: false };
    this.notify();
  }

  /** Register listener for emergency stop state changes. */
  onStateChange(listener: (active: boolean, source?: EmergencyStopSource) => void): void {
    this.listeners.push(listener);
  }

  /** Set handlers for stopping subsystems. */
  setHandlers(handlers: {
    cancelMission?: (missionId: string) => void;
    cancelScheduler?: () => void;
  }): void {
    this.onCancelMission = handlers.cancelMission;
    this.onCancelScheduler = handlers.cancelScheduler;
  }

  /** Check if a tool execution is allowed (blocks during emergency stop unless whitelisted). */
  canExecute(toolName: string): boolean {
    if (!this.state.active) return true;
    // Allow safety-related tools during emergency stop
    const whitelisted = ["navigation.go", "task.list", "memory.search", "memory.list", "calendar.list", "email.list"];
    return whitelisted.includes(toolName);
  }

  /** Get user-facing message during emergency stop. */
  getMessage(): string {
    if (!this.state.active) return "";
    const elapsed = this.state.triggeredAt ? Math.round((Date.now() - this.state.triggeredAt) / 1000) : 0;
    return `Nova is in emergency stop mode (${elapsed}s ago). Most actions are paused. Say "resume" to continue.`;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state.active, this.state.source);
    }
  }
}

export const emergencyStop = new EmergencyStopImpl();
