/**
 * Nova Mission Engine — Manager
 * Central orchestrator for autonomous missions.
 * Plans, executes, verifies, re-plans, and manages the full mission lifecycle.
 *
 * Flow:
 *   User Goal → MissionManager.create() → plan → execute steps → verify → replan if needed → complete
 */

import { generatePlan, regeneratePlan } from "./MissionPlanner";
import {
  executeStep,
  executeParallel,
  getReadySteps,
  allStepsDone,
  hasCriticalFailure,
  getRetryableStep,
  incrementRetry,
} from "./MissionExecutor";
import { verifyStep } from "./MissionVerifier";
import { missionStore, missionEventLog } from "./MissionStore";
import type {
  Mission,
  MissionStep,
  MissionStatus,
  MissionEvent,
  MissionEventType,
  ToolContext,
} from "./MissionTypes";
import {
  DEFAULT_MAX_TOOL_CALLS,
  DEFAULT_MAX_EXECUTION_TIME_MS,
  DEFAULT_MAX_STEP_RETRIES,
} from "./MissionTypes";

// ─── ID Generation ───────────────────────────────────────────────────────────

function generateId(): string {
  return `mission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateStepId(index: number): string {
  return `step_${index}`;
}

// ─── Event Emitter ───────────────────────────────────────────────────────────

type MissionEventListener = (event: MissionEvent) => void;

// ─── Mission Manager ─────────────────────────────────────────────────────────

class MissionManagerImpl {
  private listeners: MissionEventListener[] = [];
  private activeMissions = new Map<string, Mission>();
  private abortControllers = new Map<string, AbortController>();

  constructor() {
    // Recover interrupted missions on startup
    this.recover();
  }

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * Create and start a new mission.
   * This is the main entry point for autonomous task execution.
   */
  async create(
    goal: string,
    context: ToolContext,
    source: Mission["source"] = "chat",
    geminiKey: string = ""
  ): Promise<Mission> {
    const mission: Mission = {
      id: generateId(),
      goal,
      status: "PLANNING",
      steps: [],
      toolCallCount: 0,
      maxToolCalls: DEFAULT_MAX_TOOL_CALLS,
      maxExecutionTimeMs: DEFAULT_MAX_EXECUTION_TIME_MS,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      source,
      context: {
        userId: context.userId,
        currentRoute: context.currentRoute,
      },
    };

    this.activeMissions.set(mission.id, mission);
    this.emit("mission.created", mission.id);
    missionStore.save(mission);

    // Start execution in background
    this.run(mission, geminiKey).catch((err) => {
      console.error("[MissionManager] Run failed:", err);
      this.updateMission(mission.id, {
        status: "FAILED",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    });

    return mission;
  }

  /**
   * Pause a running mission.
   */
  pause(missionId: string): void {
    const mission = this.activeMissions.get(missionId);
    if (!mission) return;

    // Abort any running step
    const controller = this.abortControllers.get(missionId);
    if (controller) controller.abort();

    this.updateMission(missionId, { status: "PAUSED" });
    this.emit("mission.paused", missionId);
  }

  /**
   * Resume a paused mission.
   */
  resume(missionId: string, geminiKey: string = ""): void {
    const mission = this.activeMissions.get(missionId);
    if (!mission || mission.status !== "PAUSED") return;

    this.updateMission(missionId, { status: "RUNNING" });
    this.emit("mission.resumed", missionId);

    // Resume execution
    this.run(mission, geminiKey).catch((err) => {
      this.updateMission(missionId, {
        status: "FAILED",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    });
  }

  /**
   * Cancel a mission.
   */
  cancel(missionId: string): void {
    const controller = this.abortControllers.get(missionId);
    if (controller) controller.abort();

    this.updateMission(missionId, { status: "CANCELLED" });
    this.emit("mission.cancelled", missionId);
    this.cleanup(missionId);
  }

  /**
   * Approve a step that requires user approval.
   */
  approve(missionId: string, stepId: string, geminiKey: string = ""): void {
    const mission = this.activeMissions.get(missionId);
    if (!mission || mission.status !== "AWAITING_APPROVAL") return;

    // Find the pending step and mark it ready
    const step = mission.steps.find((s) => s.id === stepId);
    if (step) {
      step.status = "PENDING";
      mission.pendingApproval = undefined;
      this.updateMission(missionId, { status: "RUNNING" });
      this.emit("mission.approved", missionId, stepId);

      this.run(mission, geminiKey).catch((err) => {
        this.updateMission(missionId, {
          status: "FAILED",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      });
    }
  }

  /**
   * Reject a step that requires user approval.
   */
  reject(missionId: string, stepId: string): void {
    const mission = this.activeMissions.get(missionId);
    if (!mission) return;

    const step = mission.steps.find((s) => s.id === stepId);
    if (step) {
      step.status = "SKIPPED";
      step.error = "Rejected by user";
      mission.pendingApproval = undefined;
      this.updateMission(missionId, { status: "RUNNING" });
      this.emit("mission.cancelled", missionId, stepId);
    }
  }

  /**
   * Get a mission by id.
   */
  get(missionId: string): Mission | undefined {
    return this.activeMissions.get(missionId) || missionStore.get(missionId);
  }

  /**
   * Get all active missions.
   */
  getActive(): Mission[] {
    return Array.from(this.activeMissions.values());
  }

  /**
   * Check if a request should become a mission.
   * Complex multi-step requests that involve tool use get elevated to missions.
   */
  shouldCreateMission(text: string): boolean {
    const lower = text.toLowerCase();

    // Multi-step indicators
    const multiStepIndicators = [
      "and then",
      "after that",
      "find.*and.*schedule",
      "find.*and.*create",
      "search.*and.*create",
      "look up.*and",
      "check.*and.*create",
      "get.*and.*send",
      "draft.*and.*schedule",
      "what.*and.*create",
      "list.*and.*create",
      "find a.*slot",
      "find.*free.*time",
      "find.*available",
    ];

    const hasMultiStep = multiStepIndicators.some((indicator) =>
      new RegExp(indicator, "i").test(lower)
    );

    // Complexity indicators (multiple tool domains)
    const domains = [
      { keywords: ["calendar", "event", "meeting", "schedule"], domain: "calendar" },
      { keywords: ["task", "todo", "reminder"], domain: "tasks" },
      { keywords: ["memory", "remember"], domain: "memory" },
      { keywords: ["email", "mail", "send"], domain: "email" },
      { keywords: ["search", "find", "browse", "look up"], domain: "search" },
    ];

    const matchedDomains = new Set(
      domains
        .filter((d) => d.keywords.some((k) => lower.includes(k)))
        .map((d) => d.domain)
    );

    // Mission if: multiple domains OR explicit multi-step language
    return hasMultiStep || matchedDomains.size >= 2;
  }

  // ─── Core Execution Loop ─────────────────────────────────────────────

  /**
   * The main mission execution loop.
   * Plans → executes ready steps → verifies → retries/replans → completes.
   */
  private async run(mission: Mission, geminiKey: string): Promise<void> {
    const controller = new AbortController();
    this.abortControllers.set(mission.id, controller);

    // Phase 1: Planning
    if (mission.steps.length === 0) {
      this.updateMission(mission.id, { status: "PLANNING" });
      const plan = await generatePlan(mission.goal, geminiKey);

      if (controller.signal.aborted) return;

      // Convert plan steps to MissionSteps
      mission.steps = plan.steps.map((s, i) => ({
        id: generateStepId(i),
        description: s.description,
        tool: s.tool,
        args: s.args,
        status: "PENDING" as const,
        dependsOn: s.dependsOn,
        canRunInParallel: s.canRunInParallel,
        retries: 0,
        maxRetries: DEFAULT_MAX_STEP_RETRIES,
      }));

      mission.maxToolCalls = Math.max(
        plan.estimatedToolCalls + 5,
        DEFAULT_MAX_TOOL_CALLS
      );

      this.updateMission(mission.id, { steps: mission.steps });
    }

    // Phase 2: Execute loop
    this.updateMission(mission.id, { status: "RUNNING" });

    let iteration = 0;
    const MAX_ITERATIONS = 15;

    while (iteration < MAX_ITERATIONS) {
      if (controller.signal.aborted) return;

      // Check time limit
      if (Date.now() - mission.startedAt > mission.maxExecutionTimeMs) {
        this.completeMission(mission, "PARTIAL", "Mission timed out");
        return;
      }

      // Check tool call limit
      if (mission.toolCallCount >= mission.maxToolCalls) {
        this.completeMission(mission, "PARTIAL", "Reached maximum tool calls");
        return;
      }

      // Check for critical failures
      if (hasCriticalFailure(mission)) {
        // Try re-plan once
        const retryable = getRetryableStep(mission);
        if (retryable) {
          const retried = incrementRetry(retryable);
          this.updateStep(mission, retried);
          this.emit("mission.step.retrying", mission.id, retried.id);
          continue;
        }

        this.completeMission(mission, "FAILED", "Critical step failed after retries");
        return;
      }

      // Get ready steps
      const readySteps = getReadySteps(mission);

      if (readySteps.length === 0) {
        // Either all done or deadlock
        if (allStepsDone(mission)) {
          // Verify and complete
          await this.verifyAndComplete(mission);
          return;
        }

        // Deadlock: steps exist but none are ready (dependency cycle or all failed)
        const pendingSteps = mission.steps.filter((s) => s.status === "PENDING");
        if (pendingSteps.length > 0) {
          // Mark blocked steps as skipped
          for (const step of pendingSteps) {
            step.status = "SKIPPED";
            step.error = "Blocked by dependency";
          }
          this.updateMission(mission.id, { steps: mission.steps });

          if (allStepsDone(mission)) {
            await this.verifyAndComplete(mission);
            return;
          }
        }

        this.completeMission(mission, "PARTIAL", "Mission deadlocked — no executable steps");
        return;
      }

      // Execute ready steps (parallel if possible)
      const parallelBatch = readySteps.filter((s) => s.canRunInParallel);
      const sequentialSteps = readySteps.filter((s) => !s.canRunInParallel);

      if (parallelBatch.length > 1) {
        // Execute parallel batch
        const results = await executeParallel(parallelBatch, mission.context);
        for (const result of results) {
          this.updateStep(mission, result);
          mission.toolCallCount++;
          this.emitStepEvent(mission, result);
        }
      }

      // Execute sequential steps one by one
      for (const step of sequentialSteps) {
        if (controller.signal.aborted) return;

        this.updateStep(mission, { ...step, status: "RUNNING" });
        this.emit("mission.step.started", mission.id, step.id);

        const result = await executeStep(step, mission.context);
        mission.toolCallCount++;

        this.updateStep(mission, result);
        this.emitStepEvent(mission, result);

        // Check if step needs approval
        if (result.status === "WAITING_APPROVAL") {
          mission.status = "AWAITING_APPROVAL";
          mission.pendingApproval = {
            stepId: result.id,
            description: result.description,
            tool: result.tool,
            args: result.args,
          };
          this.updateMission(mission.id, {
            status: "AWAITING_APPROVAL",
            pendingApproval: mission.pendingApproval,
          });
          this.emit("mission.needs_approval", mission.id, result.id);
          return; // Wait for user approval
        }

        // Verify completed step
        if (result.status === "COMPLETED" && result.tool) {
          const verification = await verifyStep(result, mission.context);
          result.result = { ...result.result, verification };

          if (!verification.verified) {
            result.status = "FAILED";
            result.error = verification.discrepancy || "Verification failed";
            this.updateStep(mission, result);
            this.emit("mission.step.failed", mission.id, result.id);
          }
        }
      }

      iteration++;
    }

    // Exhausted iterations
    if (allStepsDone(mission)) {
      await this.verifyAndComplete(mission);
    } else {
      this.completeMission(mission, "PARTIAL", "Maximum iterations reached");
    }
  }

  /**
   * Verify all steps and complete the mission.
   */
  private async verifyAndComplete(mission: Mission): Promise<void> {
    const allSuccess = mission.steps.every(
      (s) => s.status === "COMPLETED" || s.status === "SKIPPED"
    );
    const anySuccess = mission.steps.some((s) => s.status === "COMPLETED");

    if (allSuccess) {
      this.completeMission(mission, "COMPLETED");
    } else if (anySuccess) {
      this.completeMission(mission, "PARTIAL", "Some steps failed");
    } else {
      this.completeMission(mission, "FAILED", "All steps failed");
    }
  }

  /**
   * Complete a mission with a final status.
   */
  private completeMission(
    mission: Mission,
    status: MissionStatus,
    error?: string
  ): void {
    mission.completedAt = Date.now();
    mission.updatedAt = Date.now();
    mission.status = status;
    if (error) mission.error = error;

    // Build response
    const completedSteps = mission.steps.filter((s) => s.status === "COMPLETED");
    const failedSteps = mission.steps.filter((s) => s.status === "FAILED");

    const parts: string[] = [];
    if (completedSteps.length > 0) {
      parts.push(
        completedSteps.map((s) => `✓ ${s.description}`).join("\n")
      );
    }
    if (failedSteps.length > 0) {
      parts.push(
        failedSteps
          .map((s) => `✗ ${s.description}: ${s.error || "failed"}`)
          .join("\n")
      );
    }

    mission.response = parts.join("\n") || `Mission ${status.toLowerCase()}`;

    this.updateMission(mission.id, {
      status,
      response: mission.response,
      completedAt: mission.completedAt,
      error,
    });

    this.emit(`mission.${status.toLowerCase()}` as MissionEventType, mission.id);
    this.cleanup(mission.id);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private updateMission(id: string, updates: Partial<Mission>): void {
    const mission = this.activeMissions.get(id) || missionStore.get(id);
    if (!mission) return;

    Object.assign(mission, updates, { updatedAt: Date.now() });
    this.activeMissions.set(id, mission);
    missionStore.save(mission);
  }

  private updateStep(mission: Mission, step: MissionStep): void {
    const idx = mission.steps.findIndex((s) => s.id === step.id);
    if (idx >= 0) {
      mission.steps[idx] = step;
    }
    mission.updatedAt = Date.now();
    missionStore.save(mission);
  }

  private emitStepEvent(mission: Mission, step: MissionStep): void {
    if (step.status === "COMPLETED") {
      this.emit("mission.step.completed", mission.id, step.id);
    } else if (step.status === "FAILED") {
      this.emit("mission.step.failed", mission.id, step.id);
    }
  }

  private emit(
    type: MissionEventType,
    missionId: string,
    stepId?: string,
    data?: unknown
  ): void {
    const event: MissionEvent = {
      type,
      missionId,
      stepId,
      timestamp: Date.now(),
      data,
    };

    missionEventLog.log(event);

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch { /* ignore */ }
    }
  }

  private cleanup(missionId: string): void {
    this.abortControllers.delete(missionId);
    // Don't remove from activeMissions immediately — keep for status checks
    // Remove after 30 seconds
    setTimeout(() => {
      const mission = this.activeMissions.get(missionId);
      if (
        mission &&
        ["COMPLETED", "FAILED", "CANCELLED", "PARTIAL"].includes(mission.status)
      ) {
        this.activeMissions.delete(missionId);
        missionStore.remove(missionId);
      }
    }, 30000);
  }

  private recover(): void {
    const interrupted = missionStore.recoverInterrupted();
    for (const mission of interrupted) {
      this.activeMissions.set(mission.id, mission);
      console.log(`[MissionManager] Recovered interrupted mission: ${mission.id}`);
    }
  }

  // ─── Subscription API ────────────────────────────────────────────────

  /**
   * Subscribe to mission events.
   * Returns an unsubscribe function.
   */
  onEvent(listener: MissionEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

/** Singleton mission manager. */
export const missionManager = new MissionManagerImpl();
