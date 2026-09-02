/**
 * Nova Mission Engine — Executor
 * Executes mission steps, supports parallel independent steps,
 * handles retries, and respects timeouts.
 */

import { toolRegistry } from "@/services/agent/ToolRegistry";
import { toolExecutor } from "@/services/agent/ToolExecutor";
import type { Mission, MissionStep, StepResult, ToolContext } from "./MissionTypes";
import { DEFAULT_MAX_STEP_RETRIES } from "./MissionTypes";

// ─── Step Execution ──────────────────────────────────────────────────────────

/**
 * Execute a single mission step.
 * Returns the step with updated status and result.
 */
export async function executeStep(
  step: MissionStep,
  context: ToolContext
): Promise<MissionStep> {
  const updated = { ...step, status: "RUNNING" as const, startedAt: Date.now() };

  // If no tool is specified, this is a pass-through step
  if (!step.tool) {
    return {
      ...updated,
      status: "COMPLETED",
      result: { success: true, message: "Pass-through step completed" },
      completedAt: Date.now(),
    };
  }

  // Check tool exists
  const tool = toolRegistry.get(step.tool);
  if (!tool) {
    return {
      ...updated,
      status: "FAILED",
      error: `Tool not found: ${step.tool}`,
      result: { success: false, error: `Tool not found: ${step.tool}` },
      completedAt: Date.now(),
    };
  }

  // Execute via ToolExecutor (handles validation, confirmations, logging)
  try {
    const result = await toolExecutor.execute(step.tool, step.args, context, {
      skipConfirmation: false,
      source: context.source === "voice" ? "voice" : "chat",
    });

    const stepResult: StepResult = {
      success: result.success,
      data: result.data,
      message: result.message,
      error: result.error?.message,
    };

    return {
      ...updated,
      status: result.success ? "COMPLETED" : "FAILED",
      result: stepResult,
      error: result.success ? undefined : result.error?.message,
      completedAt: Date.now(),
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown execution error";
    return {
      ...updated,
      status: "FAILED",
      error: errorMsg,
      result: { success: false, error: errorMsg },
      completedAt: Date.now(),
    };
  }
}

// ─── Batch Execution ─────────────────────────────────────────────────────────

/**
 * Execute a batch of steps that can run in parallel.
 * Returns updated steps with results.
 */
export async function executeParallel(
  steps: MissionStep[],
  context: ToolContext
): Promise<MissionStep[]> {
  return Promise.all(steps.map((step) => executeStep(step, context)));
}

// ─── Ready Steps ─────────────────────────────────────────────────────────────

/**
 * Get steps that are ready to execute:
 * - Status is PENDING
 * - All dependencies are COMPLETED
 */
export function getReadySteps(mission: Mission): MissionStep[] {
  const completedIds = new Set(
    mission.steps
      .filter((s) => s.status === "COMPLETED" || s.status === "SKIPPED")
      .map((s) => s.id)
  );

  return mission.steps.filter((step) => {
    if (step.status !== "PENDING") return false;
    return step.dependsOn.every((depId) => completedIds.has(depId));
  });
}

/**
 * Check if all steps in a mission are done (completed, failed, or skipped).
 */
export function allStepsDone(mission: Mission): boolean {
  return mission.steps.every((s) =>
    ["COMPLETED", "FAILED", "SKIPPED"].includes(s.status)
  );
}

/**
 * Check if any critical step failed (non-skippable failure).
 */
export function hasCriticalFailure(mission: Mission): boolean {
  return mission.steps.some(
    (s) => s.status === "FAILED" && s.retries >= s.maxRetries
  );
}

/**
 * Get the next step to retry (if any).
 */
export function getRetryableStep(mission: Mission): MissionStep | undefined {
  return mission.steps.find(
    (s) => s.status === "FAILED" && s.retries < s.maxRetries
  );
}

/**
 * Increment retry count for a failed step.
 */
export function incrementRetry(step: MissionStep): MissionStep {
  return {
    ...step,
    status: "PENDING",
    retries: step.retries + 1,
    error: undefined,
    result: undefined,
    startedAt: undefined,
    completedAt: undefined,
  };
}
