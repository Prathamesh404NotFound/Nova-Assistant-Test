/**
 * Nova Self-Healing Engine — Recovery, Retry, Fallback
 * Classifies failures, retries safely, falls back to alternatives, and asks user when needed.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type FailureClassification =
  | "transient"       // network blip, timeout — safe to retry
  | "provider_error"  // API error — try alternative
  | "auth_expired"    // needs re-auth — ask user
  | "invalid_input"   // bad args — do not retry
  | "permission_denied" // no access — inform user
  | "irreversible"    // already happened — cannot retry
  | "cancellation"    // user cancelled — stop
  | "resource_exhausted" // rate limit, out of memory — back off
  | "unknown";        // classify then act

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableClassifications: FailureClassification[];
}

export interface RecoveryResult {
  action: "retry" | "fallback" | "ask_user" | "fail";
  delayMs?: number;
  fallbackProvider?: string;
  userMessage?: string;
  error?: string;
}

export interface FallbackChain {
  tool: string;
  providers: Array<{
    name: string;
    available: () => boolean;
    execute: (args: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  }>;
}

export interface RecoveryContext {
  toolName: string;
  attemptNumber: number;
  maxAttempts: number;
  failureClassification: FailureClassification;
  error: string;
  retryable: boolean;
  args: Record<string, unknown>;
}

// ─── Default Policies ────────────────────────────────────────────────────────

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableClassifications: ["transient", "provider_error", "resource_exhausted"],
};

const TOOL_RETRY_POLICIES: Partial<Record<string, Partial<RetryPolicy>>> = {
  "email.send": { maxRetries: 1, retryableClassifications: ["transient"] }, // conservative for external side effects
  "calendar.create": { maxRetries: 2 },
  "browser.open": { maxRetries: 2 },
  "search.web": { maxRetries: 2 },
  "screen.capture": { maxRetries: 1 },
  "desktop.type": { maxRetries: 0 }, // never retry desktop control blindly
  "desktop.click": { maxRetries: 0 },
  "desktop.hotkey": { maxRetries: 0 },
  "file.write": { maxRetries: 1, retryableClassifications: ["transient"] },
  "file.delete": { maxRetries: 0 }, // never retry destructive
};

// ─── Failure Classifier ──────────────────────────────────────────────────────

function classifyFailure(error: string, retryable?: boolean): FailureClassification {
  const lower = error.toLowerCase();

  if (lower.includes("cancelled") || lower.includes("aborted")) return "cancellation";
  if (lower.includes("permission") || lower.includes("access denied") || lower.includes("unauthorized")) return "permission_denied";
  if (lower.includes("expired") || lower.includes("token") || lower.includes("auth")) return "auth_expired";
  if (lower.includes("rate limit") || lower.includes("quota") || lower.includes("429") || lower.includes("out of memory")) return "resource_exhausted";
  if (lower.includes("invalid") || lower.includes("missing required") || lower.includes("malformed") || lower.includes("not found")) return "invalid_input";
  if (lower.includes("timeout") || lower.includes("econnreset") || lower.includes("network") || lower.includes("fetch failed") || lower.includes("econnrefused")) return "transient";
  if (lower.includes("already sent") || lower.includes("already exists") || lower.includes("already created")) return "irreversible";

  if (retryable === true) return "transient";
  if (retryable === false) return "unknown";
  return "unknown";
}

// ─── Retry Policy ────────────────────────────────────────────────────────────

function getRetryPolicy(toolName: string): RetryPolicy {
  const override = TOOL_RETRY_POLICIES[toolName] || {};
  return { ...DEFAULT_RETRY_POLICY, ...override };
}

function computeDelay(attempt: number, policy: RetryPolicy): number {
  const delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
  // Add jitter: ±20%
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.min(Math.max(delay + jitter, 0), policy.maxDelayMs);
}

// ─── Self-Healing Engine ─────────────────────────────────────────────────────

class RecoveryEngineImpl {
  private activeRecoveries = new Map<string, number>(); // track attempts per operation

  /**
   * Classify a failure and determine the recovery action.
   */
  classify(error: string, retryable?: boolean): FailureClassification {
    return classifyFailure(error, retryable);
  }

  /**
   * Decide recovery action based on failure context.
   */
  recover(ctx: RecoveryContext): RecoveryResult {
    const policy = getRetryPolicy(ctx.toolName);
    const classification = ctx.failureClassification || classifyFailure(ctx.error, ctx.retryable);

    // ── Cancellation: stop immediately ──
    if (classification === "cancellation") {
      return { action: "fail", userMessage: "Action was cancelled." };
    }

    // ── Irreversible: cannot retry ──
    if (classification === "irreversible") {
      return {
        action: "fail",
        userMessage: "This action has already been completed and cannot be undone or retried.",
      };
    }

    // ── Invalid input: fix, don't retry ──
    if (classification === "invalid_input") {
      return {
        action: "fail",
        userMessage: `The input was invalid: ${ctx.error}. Could you rephrase or check the details?`,
      };
    }

    // ── Permission denied: inform user ──
    if (classification === "permission_denied") {
      return {
        action: "fail",
        userMessage: "I don't have permission to perform that action. You can grant access in Settings → Security.",
      };
    }

    // ── Auth expired: ask user to re-auth ──
    if (classification === "auth_expired") {
      return {
        action: "ask_user",
        userMessage: "The authentication for this service has expired. Please reconnect it in Settings → Integrations.",
      };
    }

    // ── Resource exhausted: back off ──
    if (classification === "resource_exhausted") {
      if (ctx.attemptNumber < policy.maxRetries) {
        return {
          action: "retry",
          delayMs: computeDelay(ctx.attemptNumber, policy) * 2, // extra backoff for rate limits
        };
      }
      return {
        action: "fail",
        userMessage: "The service is temporarily overloaded. I'll try again in a few minutes.",
      };
    }

    // ── Transient / provider error: retry if within policy ──
    if (policy.retryableClassifications.includes(classification)) {
      if (ctx.attemptNumber < policy.maxRetries) {
        return {
          action: "retry",
          delayMs: computeDelay(ctx.attemptNumber, policy),
        };
      }
      // Retries exhausted — try fallback
      return {
        action: "fallback",
        userMessage: `Primary provider failed after ${policy.maxRetries} attempts. Trying alternative...`,
      };
    }

    // ── Unknown: fail safely ──
    return {
      action: "fail",
      userMessage: `Something went wrong: ${ctx.error}. No changes were made.`,
    };
  }

  /**
   * Execute with self-healing: classify errors and recover automatically.
   */
  async executeWithRecovery<T>(
    toolName: string,
    operation: () => Promise<T>,
    fallbacks?: Array<() => Promise<T>>,
    options?: { maxAttempts?: number }
  ): Promise<{ result?: T; success: boolean; error?: string; attempts: number }> {
    const policy = getRetryPolicy(toolName);
    const maxAttempts = options?.maxAttempts ?? policy.maxRetries + 1;
    const lastError = { current: "" };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        this.activeRecoveries.delete(toolName);
        return { result, success: true, attempts: attempt };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        lastError.current = errorMsg;
        const classification = classifyFailure(errorMsg);

        const decision = this.recover({
          toolName,
          attemptNumber: attempt,
          maxAttempts,
          failureClassification: classification,
          error: errorMsg,
          retryable: policy.retryableClassifications.includes(classification),
          args: {},
        });

        if (decision.action === "retry" && decision.delayMs) {
          await this.delay(decision.delayMs);
          continue;
        }

        // Try fallbacks
        if ((decision.action === "fallback" || attempt >= maxAttempts) && fallbacks?.length) {
          for (const fb of fallbacks) {
            try {
              const result = await fb();
              return { result, success: true, attempts: attempt };
            } catch { /* fallback also failed, continue */ }
          }
        }

        if (decision.action === "fail" || decision.action === "ask_user") {
          return { success: false, error: errorMsg, attempts: attempt };
        }
      }
    }

    return { success: false, error: lastError.current, attempts: maxAttempts };
  }

  /**
   * Track attempt count for loop detection.
   */
  incrementAttempt(key: string): number {
    const current = this.activeRecoveries.get(key) || 0;
    this.activeRecoveries.set(key, current + 1);
    return current + 1;
  }

  resetAttempts(key: string): void {
    this.activeRecoveries.delete(key);
  }

  getAttemptCount(key: string): number {
    return this.activeRecoveries.get(key) || 0;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const recoveryEngine = new RecoveryEngineImpl();
