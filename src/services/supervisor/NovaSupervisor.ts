/**
 * Nova System Supervisor — Health Monitor
 * Monitors all subsystems, detects failures, and coordinates recovery.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type SubsystemName =
  | "ai_gemini"
  | "ai_local"
  | "tts_bark"
  | "tts_browser"
  | "stt"
  | "browser"
  | "desktop_bridge"
  | "scheduler"
  | "email"
  | "calendar"
  | "memory"
  | "notifications"
  | "search"
  | "mission_engine"
  | "perception"
  | "computer"
  | "automation"
  | "world_state"
  | "attention"
  | "personalization"
  | "integration";

export type HealthStatus = "healthy" | "degraded" | "offline" | "error" | "auth_required";

export interface SubsystemHealth {
  name: SubsystemName;
  status: HealthStatus;
  lastCheck: number;
  lastError?: string;
  consecutiveFailures: number;
  responseTimeMs?: number;
  details?: string;
}

export interface HealthCheckResult {
  overall: HealthStatus;
  subsystems: SubsystemHealth[];
  timestamp: number;
}

// ─── Health Monitor ──────────────────────────────────────────────────────────

class HealthMonitorImpl {
  private subsystems = new Map<SubsystemName, SubsystemHealth>();
  private checkIntervalMs = 60_000; // check every 60s
  private timerId: ReturnType<typeof setInterval> | null = null;
  private _onStatusChange?: (name: SubsystemName, old: HealthStatus, current: HealthStatus) => void;
  private _onCriticalFailure?: (name: SubsystemName, health: SubsystemHealth) => void;

  /** Initialize and start periodic health checks. */
  init(): void {
    // Register all known subsystems
    const names: SubsystemName[] = [
      "ai_gemini", "ai_local", "tts_bark", "tts_browser", "stt",
      "browser", "desktop_bridge", "scheduler", "email", "calendar",
      "memory", "notifications", "search", "mission_engine", "perception",
      "computer", "automation", "world_state", "attention", "personalization",
      "integration",
    ];
    for (const name of names) {
      this.subsystems.set(name, {
        name,
        status: "healthy",
        lastCheck: Date.now(),
        consecutiveFailures: 0,
      });
    }
  }

  startMonitoring(): void {
    if (this.timerId) return;
    this.timerId = setInterval(() => this.runChecks(), this.checkIntervalMs);
  }

  stopMonitoring(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /** Set callback for status changes. */
  onStatusChange(handler: (name: SubsystemName, old: HealthStatus, current: HealthStatus) => void): void {
    this._onStatusChange = handler;
  }

  /** Set callback for critical failures. */
  onCriticalFailure(handler: (name: SubsystemName, health: SubsystemHealth) => void): void {
    this._onCriticalFailure = handler;
  }

  /** Report a subsystem check result. */
  report(name: SubsystemName, status: HealthStatus, details?: string, responseTimeMs?: number, error?: string): void {
    const prev = this.subsystems.get(name);
    const oldStatus = prev?.status || "healthy";

    const updated: SubsystemHealth = {
      name,
      status,
      lastCheck: Date.now(),
      consecutiveFailures: status === "healthy" ? 0 : (prev?.consecutiveFailures || 0) + 1,
      responseTimeMs,
      lastError: error,
      details,
    };
    this.subsystems.set(name, updated);

    if (oldStatus !== status) {
      this._onStatusChange?.(name, oldStatus, status);
    }
    if (status === "error" || status === "offline") {
      if (updated.consecutiveFailures >= 3) {
        this._onCriticalFailure?.(name, updated);
      }
    }
  }

  /** Get health of a specific subsystem. */
  getSubsystem(name: SubsystemName): SubsystemHealth | undefined {
    return this.subsystems.get(name);
  }

  /** Get overall health status. */
  getOverallHealth(): HealthStatus {
    let worst: HealthStatus = "healthy";
    const order: Record<HealthStatus, number> = { healthy: 0, degraded: 1, offline: 2, error: 3, auth_required: 4 };
    for (const [, health] of this.subsystems) {
      if (order[health.status] > order[worst]) {
        worst = health.status;
      }
    }
    return worst;
  }

  /** Get full health report. */
  getHealthReport(): HealthCheckResult {
    return {
      overall: this.getOverallHealth(),
      subsystems: Array.from(this.subsystems.values()),
      timestamp: Date.now(),
    };
  }

  /** Auto-detect provider availability (lightweight checks). */
  private async runChecks(): Promise<void> {
    // Check Gemini API key
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem("nova_gemini_key");
    this.report("ai_gemini", geminiKey ? "healthy" : "auth_required", geminiKey ? "API key present" : "No API key");

    // Check browser session count
    const browserSessionCount = parseInt(sessionStorage.getItem("nova_browser_sessions") || "0");
    this.report("browser", browserSessionCount > 0 ? "healthy" : "degraded", `${browserSessionCount} active sessions`);

    // Check localStorage availability (memory, tasks, etc.)
    try {
      localStorage.setItem("__nova_health_check__", "1");
      localStorage.removeItem("__nova_health_check__");
      this.report("memory", "healthy", "localStorage available");
    } catch {
      this.report("memory", "error", "localStorage unavailable");
    }

    // Check scheduler
    const schedulerJobs = parseInt(localStorage.getItem("nova_scheduler_job_count") || "0");
    this.report("scheduler", "healthy", `${schedulerJobs} scheduled jobs`);
  }

  /** Get developer diagnostics string. */
  getDiagnostics(): string {
    const lines: string[] = ["─── System Health ───"];
    for (const [, h] of this.subsystems) {
      const icon = h.status === "healthy" ? "✓" : h.status === "degraded" ? "⚠" : "✗";
      lines.push(`${icon} ${h.name}: ${h.status}${h.lastError ? ` (${h.lastError})` : ""}`);
    }
    return lines.join("\n");
  }
}

export const healthMonitor = new HealthMonitorImpl();
