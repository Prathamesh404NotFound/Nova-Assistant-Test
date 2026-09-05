/**
 * Nova AI OS — Self-Healing Health Monitor
 *
 * Monitors Nova's own health — API failures, model degradation,
 * memory issues — and automatically recovers. Logs diagnostics,
 * suggests fixes, and reroutes requests to alternative models.
 */

export type HealthStatus = "healthy" | "degraded" | "critical";

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  lastCheck: number;
  errorCount: number;
  lastError?: string;
  recoveryAction?: string;
}

export interface HealthReport {
  overall: HealthStatus;
  components: ComponentHealth[];
  uptime: number;
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
}

interface ErrorRecord {
  component: string;
  message: string;
  timestamp: number;
}

// ─── State ─────────────────────────────────────────────────────────────────

const HEALTH_KEY = "nova_health_v1";
const ERROR_LOG_KEY = "nova_error_log";
const MAX_ERROR_LOG = 50;
const MAX_COMPONENT_ERRORS = 5; // threshold for degraded status

let _startTime = Date.now();
let _totalRequests = 0;
let _successfulRequests = 0;
let _totalLatency = 0;

// ─── Component Health Tracking ─────────────────────────────────────────────

function loadHealth(): ComponentHealth[] {
  try {
    const raw = localStorage.getItem(HEALTH_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return createDefaultHealth();
}

function saveHealth(components: ComponentHealth[]): void {
  try {
    localStorage.setItem(HEALTH_KEY, JSON.stringify(components));
  } catch { /* ignore */ }
}

function createDefaultHealth(): ComponentHealth[] {
  return [
    { name: "gemini-api", status: "healthy", lastCheck: Date.now(), errorCount: 0 },
    { name: "local-ai", status: "healthy", lastCheck: Date.now(), errorCount: 0 },
    { name: "memory-system", status: "healthy", lastCheck: Date.now(), errorCount: 0 },
    { name: "intent-router", status: "healthy", lastCheck: Date.now(), errorCount: 0 },
    { name: "voice-pipeline", status: "healthy", lastCheck: Date.now(), errorCount: 0 },
  ];
}

function getComponent(components: ComponentHealth[], name: string): ComponentHealth {
  let comp = components.find((c) => c.name === name);
  if (!comp) {
    comp = { name, status: "healthy", lastCheck: Date.now(), errorCount: 0 };
    components.push(comp);
  }
  return comp;
}

// ─── Error Logging ─────────────────────────────────────────────────────────

function logError(component: string, message: string): void {
  try {
    const raw = localStorage.getItem(ERROR_LOG_KEY);
    const errors: ErrorRecord[] = raw ? JSON.parse(raw) : [];
    errors.unshift({ component, message, timestamp: Date.now() });
    if (errors.length > MAX_ERROR_LOG) errors.length = MAX_ERROR_LOG;
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(errors));
  } catch { /* ignore */ }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Record a successful request.
 */
export function recordSuccess(component: string, latencyMs: number): void {
  _totalRequests++;
  _successfulRequests++;
  _totalLatency += latencyMs;

  const components = loadHealth();
  const comp = getComponent(components, component);

  // Reset error count on success (gradual recovery)
  if (comp.errorCount > 0) {
    comp.errorCount = Math.max(0, comp.errorCount - 1);
  }

  // Update status based on error count
  if (comp.errorCount === 0) {
    comp.status = "healthy";
  } else if (comp.errorCount < MAX_COMPONENT_ERRORS) {
    comp.status = "degraded";
  }

  comp.lastCheck = Date.now();
  saveHealth(components);
}

/**
 * Record a failed request.
 * Returns the recovery action Nova should take.
 */
export function recordFailure(component: string, error: string): string | null {
  _totalRequests++;
  logError(component, error);

  const components = loadHealth();
  const comp = getComponent(components, component);

  comp.errorCount++;
  comp.lastError = error;
  comp.lastCheck = Date.now();

  // Determine status and recovery action
  let recoveryAction: string | null = null;

  if (comp.errorCount >= MAX_COMPONENT_ERRORS) {
    comp.status = "critical";

    switch (component) {
      case "gemini-api":
        comp.recoveryAction = "Reroute to local AI";
        recoveryAction = "local";
        break;
      case "local-ai":
        comp.recoveryAction = "Reroute to Gemini";
        recoveryAction = "gemini";
        break;
      case "memory-system":
        comp.recoveryAction = "Skip memory context";
        recoveryAction = "skip-memory";
        break;
      case "voice-pipeline":
        comp.recoveryAction = "Disable voice temporarily";
        recoveryAction = "disable-voice";
        break;
      default:
        comp.recoveryAction = "Retry with fallback";
        recoveryAction = "retry";
    }
  } else if (comp.errorCount >= 2) {
    comp.status = "degraded";
    comp.recoveryAction = "Monitor for further errors";
  }

  saveHealth(components);
  return recoveryAction;
}

/**
 * Get the current health report.
 */
export function getHealthReport(): HealthReport {
  const components = loadHealth();

  // Determine overall status
  const statuses = components.map((c) => c.status);
  let overall: HealthStatus = "healthy";
  if (statuses.includes("critical")) {
    overall = "critical";
  } else if (statuses.includes("degraded")) {
    overall = "degraded";
  }

  const successRate = _totalRequests > 0 ? _successfulRequests / _totalRequests : 1;
  const avgLatencyMs = _totalRequests > 0 ? _totalLatency / _totalRequests : 0;

  return {
    overall,
    components,
    uptime: Date.now() - _startTime,
    totalRequests: _totalRequests,
    successRate: Math.round(successRate * 100) / 100,
    avgLatencyMs: Math.round(avgLatencyMs),
  };
}

/**
 * Check if a specific component is healthy enough to use.
 */
export function isComponentHealthy(name: string): boolean {
  const components = loadHealth();
  const comp = components.find((c) => c.name === name);
  return !comp || comp.status !== "critical";
}

/**
 * Get the recommended fallback routing.
 * Returns which provider to use based on current health.
 */
export function getRecommendedRoute(): "gemini" | "local" | "both" {
  const components = loadHealth();
  const gemini = components.find((c) => c.name === "gemini-api");
  const local = components.find((c) => c.name === "local-ai");

  const geminiHealthy = !gemini || gemini.status !== "critical";
  const localHealthy = !local || local.status !== "critical";

  if (geminiHealthy && localHealthy) return "both";
  if (geminiHealthy) return "gemini";
  if (localHealthy) return "local";
  return "both"; // Both degraded — try both anyway
}

/**
 * Get recent error log.
 */
export function getRecentErrors(limit: number = 10): ErrorRecord[] {
  try {
    const raw = localStorage.getItem(ERROR_LOG_KEY);
    const errors: ErrorRecord[] = raw ? JSON.parse(raw) : [];
    return errors.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Auto-recover: reset critical components that have been stable.
 */
export function autoRecover(): void {
  const components = loadHealth();
  const now = Date.now();
  let changed = false;

  for (const comp of components) {
    if (comp.status === "critical") {
      // If no errors in the last 5 minutes, downgrade to degraded
      if (now - comp.lastCheck > 5 * 60 * 1000) {
        comp.status = "degraded";
        comp.errorCount = Math.max(0, comp.errorCount - 2);
        comp.recoveryAction = "Auto-recovered after cooldown";
        changed = true;
      }
    }
  }

  if (changed) saveHealth(components);
}

/**
 * Reset all health tracking.
 */
export function resetHealth(): void {
  _startTime = Date.now();
  _totalRequests = 0;
  _successfulRequests = 0;
  _totalLatency = 0;
  saveHealth(createDefaultHealth());
  try {
    localStorage.removeItem(ERROR_LOG_KEY);
  } catch { /* ignore */ }
}

/**
 * Build a diagnostic summary string for AI context.
 */
export function getDiagnosticSummary(): string {
  const report = getHealthReport();
  if (report.overall === "healthy") return "";

  const lines = [`System Health: ${report.overall.toUpperCase()}`];

  for (const comp of report.components) {
    if (comp.status !== "healthy") {
      lines.push(`- ${comp.name}: ${comp.status}${comp.lastError ? ` (${comp.lastError.slice(0, 50)})` : ""}`);
    }
  }

  if (report.totalRequests > 0) {
    lines.push(`Success rate: ${Math.round(report.successRate * 100)}%, Avg latency: ${report.avgLatencyMs}ms`);
  }

  return lines.join("\n");
}
