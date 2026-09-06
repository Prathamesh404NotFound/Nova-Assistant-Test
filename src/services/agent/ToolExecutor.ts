/**
 * Nova Agent Architecture — Tool Executor
 * Single execution gateway for all tools.
 * Validates args, checks permissions, handles confirmations, logs results.
 */

import { toolRegistry } from "./ToolRegistry";
import { securityLayer } from "@/services/security";
import { rateLimiter, loopDetector, emergencyStop } from "@/services/safety";
import { recoveryEngine } from "@/services/self-healing";
import type {
  ToolContext,
  ToolResult,
  RiskLevel,
  PendingConfirmation,
  ActionLogEntry,
} from "./types";

const MAX_LOG_ENTRIES = 200;
const CONFIRMATION_TTL_MS = 5 * 60 * 1000; // 5 minutes

class ToolExecutorImpl {
  private pendingConfirmations = new Map<string, PendingConfirmation>();
  private actionLog: ActionLogEntry[] = [];
  private onConfirmationNeeded?: (pending: PendingConfirmation) => void;

  constructor() {
    securityLayer.init();
  }

  /** Set callback for when confirmation is needed. */
  setConfirmationHandler(handler: (pending: PendingConfirmation) => void): void {
    this.onConfirmationNeeded = handler;
  }

  /** Execute a tool with the given arguments and context. */
  async execute(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolContext,
    options?: { skipConfirmation?: boolean; source?: ActionLogEntry["source"] }
  ): Promise<ToolResult> {
    const start = Date.now();

    // 1. Look up tool
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      return this.fail(toolName, "TOOL_NOT_FOUND", `Tool '${toolName}' is not registered`, false, start);
    }

    // 2. Check availability
    if (tool.availability && !tool.availability()) {
      return this.fail(toolName, "UNAVAILABLE", `Tool '${toolName}' is currently unavailable`, false, start);
    }

    // 3. Emergency stop check
    if (!emergencyStop.canExecute(toolName)) {
      securityLayer.audit("security.violation", false, `Blocked '${toolName}' during emergency stop`, {
        tool: toolName, risk: "critical", source: options?.source || "system",
      });
      return this.fail(toolName, "EMERGENCY_STOP", "Nova is in emergency stop mode. Most actions are paused.", false, start);
    }

    // 4. Rate limit check
    if (!rateLimiter.check(tool.category)) {
      securityLayer.audit("security.violation", false, `Rate limit exceeded for '${tool.category}'`, {
        tool: toolName, risk: tool.riskLevel, source: options?.source || "system",
      });
      return this.fail(toolName, "RATE_LIMITED", `Rate limit exceeded for ${tool.category}. Please wait a moment.`, false, start);
    }

    // 5. Loop detection
    const loopKey = `${context.source || "unknown"}:${toolName}`;
    if (loopDetector.record(loopKey, 5, 60_000)) {
      securityLayer.audit("security.violation", false, `Loop detected: repeated '${toolName}' calls`, {
        tool: toolName, risk: tool.riskLevel, source: options?.source || "system",
      });
      return this.fail(toolName, "LOOP_DETECTED", `Detected repeated calls to '${toolName}'. Stopping to prevent a loop.`, false, start);
    }

    // 6. Security metadata check
    const secMeta = securityLayer.getToolSecurityMeta(toolName, tool.category);
    const permDecision = securityLayer.checkPermission(toolName, tool.category, context.missionId ? { missionId: context.missionId } : undefined);
    if (!permDecision.allowed) {
      const denyReason = "reason" in permDecision ? permDecision.reason : "Permission denied";
      const match = /Nova permission required: ([a-z_]+)/.exec(denyReason);
      if (match && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("nova:permission-request", {
          detail: { permission: match[1], tool: toolName, message: denyReason },
        }));
      }
      securityLayer.audit("permission.deny", false, denyReason, {
        tool: toolName, risk: tool.riskLevel, source: options?.source || "system",
      });
      return this.fail(toolName, "PERMISSION_DENIED", denyReason, false, start);
    }

    // 7. Scope validation for destructive operations
    if (secMeta.requiresScopeValidation) {
      const scopeCheck = securityLayer.validateDestructiveScope(toolName, args);
      if (!scopeCheck.valid) {
        return this.fail(toolName, "SCOPE_AMBIGUOUS", scopeCheck.question || "Ambiguous scope", false, start);
      }
    }

    // 8. Validate arguments
    const validationError = toolRegistry.validate(toolName, args);
    if (validationError) {
      return this.fail(toolName, "INVALID_INPUT", validationError, false, start);
    }

    // 9. Check confirmation requirement
    const needsConfirmation =
      !options?.skipConfirmation &&
      (typeof tool.confirmationRequired === "function"
        ? tool.confirmationRequired(args)
        : tool.confirmationRequired);

    if (needsConfirmation) {
      const pendingId = `conf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const pending: PendingConfirmation = {
        id: pendingId,
        tool: toolName,
        args,
        riskLevel: tool.riskLevel,
        message: this.buildConfirmationMessage(toolName, args),
        createdAt: Date.now(),
        expiresAt: Date.now() + CONFIRMATION_TTL_MS,
      };
      this.pendingConfirmations.set(pendingId, pending);

      // Notify UI
      this.onConfirmationNeeded?.(pending);

      return {
        success: false,
        tool: toolName,
        error: {
          code: "CONFIRMATION_REQUIRED",
          message: pending.message,
        },
        metadata: { executionMs: Date.now() - start },
      };
    }

    // 10. Execute the tool with self-healing recovery
    const executionResult = await recoveryEngine.executeWithRecovery(
      toolName,
      async () => {
        const result = await tool.execute(args, context);
        if (!result.success) {
          throw new Error(result.error?.message || "Tool execution failed");
        }
        return result;
      },
      undefined, // no fallback providers by default
      { maxAttempts: secMeta.externalSideEffects ? 1 : 2 }
    );

    if (executionResult.success && executionResult.result) {
      const result = executionResult.result as ToolResult;
      // Log the action
      this.log({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        tool: toolName,
        action: args.action as string || "execute",
        argumentsSummary: JSON.stringify(args).slice(0, 200),
        success: result.success,
        error: result.error?.message,
        duration: Date.now() - start,
        source: options?.source || "chat",
      });

      // Security audit log
      securityLayer.audit("tool.execute", true, `Executed ${toolName} in ${Date.now() - start}ms`, {
        tool: toolName,
        risk: tool.riskLevel,
        source: options?.source || "system",
      });

      return result;
    }

    // Execution failed
    const errorMsg = executionResult.error || "Unknown execution error";
    this.log({
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        tool: toolName,
        action: (args.action as string) || "execute",
        argumentsSummary: JSON.stringify(args).slice(0, 200),
        success: false,
        error: errorMsg,
        duration: Date.now() - start,
        source: options?.source || "chat",
    });

    // Security audit log for failure
    securityLayer.audit("tool.execute", false, `Failed ${toolName}: ${errorMsg}`, {
      tool: toolName,
      risk: tool.riskLevel,
      source: options?.source || "system",
    });

    return this.fail(toolName, "EXECUTION_ERROR", errorMsg, true, start);
  }

  /** Confirm a pending action. */
  async confirmPending(
    confirmationId: string,
    context: ToolContext,
    source?: ActionLogEntry["source"]
  ): Promise<ToolResult> {
    const pending = this.pendingConfirmations.get(confirmationId);
    if (!pending) {
      return { success: false, tool: "", error: { code: "EXPIRED", message: "Confirmation expired or not found" } };
    }

    // Check expiry
    if (Date.now() > pending.expiresAt) {
      this.pendingConfirmations.delete(confirmationId);
      return { success: false, tool: pending.tool, error: { code: "EXPIRED", message: "Confirmation expired" } };
    }

    this.pendingConfirmations.delete(confirmationId);

    // Execute with confirmation bypassed
    return this.execute(pending.tool, pending.args, context, {
      skipConfirmation: true,
      source,
    });
  }

  /** Reject/cancel a pending action. */
  rejectPending(confirmationId: string): void {
    this.pendingConfirmations.delete(confirmationId);
  }

  /** Get the action log. */
  getActionLog(): ActionLogEntry[] {
    return [...this.actionLog].reverse();
  }

  /** Get action log filtered by tool. */
  getActionsByTool(toolName: string): ActionLogEntry[] {
    return this.actionLog.filter((e) => e.tool === toolName).reverse();
  }

  /** Private helpers. */
  private fail(
    tool: string,
    code: string,
    message: string,
    retryable: boolean,
    startMs: number
  ): ToolResult {
    return {
      success: false,
      tool,
      error: { code, message, retryable },
      metadata: { executionMs: Date.now() - startMs },
    };
  }

  private log(entry: ActionLogEntry): void {
    this.actionLog.push(entry);
    if (this.actionLog.length > MAX_LOG_ENTRIES) {
      this.actionLog = this.actionLog.slice(-MAX_LOG_ENTRIES);
    }
  }

  private buildConfirmationMessage(toolName: string, args: Record<string, unknown>): string {
    const summaries: Record<string, string> = {
      "memory.save": `Save memory: "${args.value || args.key || ""}"`,
      "memory.delete": `Delete memory: "${args.key || ""}"`,
      "calendar.create": `Create event: "${args.title || ""}" at ${args.date || ""} ${args.time || ""}`,
      "calendar.delete": `Delete event: "${args.title || args.id || ""}"`,
      "calendar.update": `Update event: "${args.title || args.id || ""}"`,
      "task.create": `Create task: "${args.title || ""}"`,
      "task.complete": `Complete task: "${args.title || args.id || ""}"`,
      "task.delete": `Delete task: "${args.title || args.id || ""}"`,
      "email.send": `Send email to ${args.to || ""}: "${args.subject || ""}"`,
      "email.draft": `Draft email to ${args.to || ""}: "${args.subject || ""}"`,
      "device.toggle": `Toggle device: "${args.deviceId || args.name || ""}"`,
      "device.adjust": `Adjust device: "${args.deviceId || args.name || ""}"`,
      "file.delete": `Delete file: "${args.path || args.name || ""}"`,
      "code.execute": `Execute code snippet`,
      "automation.create": `Create automation: "${args.name || ""}"`,
    };

    return summaries[toolName] || `Confirm action: ${toolName}`;
  }
}

/** Singleton tool executor instance. */
export const toolExecutor = new ToolExecutorImpl();
