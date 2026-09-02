/**
 * Nova Mission Engine — Core Types
 * Defines all statuses, interfaces, and data structures for autonomous missions.
 */

// Re-export ToolContext from agent types for convenience
export type { ToolContext } from "@/services/agent/types";

// ─── Mission Status ──────────────────────────────────────────────────────────

export type MissionStatus =
  | "PLANNING"
  | "RUNNING"
  | "WAITING"
  | "AWAITING_APPROVAL"
  | "PAUSED"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED";

export type StepStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED"
  | "WAITING_APPROVAL";

// ─── Mission Step ────────────────────────────────────────────────────────────

export interface MissionStep {
  /** Unique step identifier */
  id: string;
  /** Human-readable description of what this step does */
  description: string;
  /** Tool to execute */
  tool: string;
  /** Arguments to pass to the tool */
  args: Record<string, unknown>;
  /** Current status */
  status: StepStatus;
  /** Result after execution */
  result?: StepResult;
  /** Steps that must complete before this one (by step id) */
  dependsOn: string[];
  /** Whether this step can run in parallel with other independent steps */
  canRunInParallel: boolean;
  /** Retry count */
  retries: number;
  /** Max retries allowed */
  maxRetries: number;
  /** Error message if failed */
  error?: string;
  /** Timestamp when step started */
  startedAt?: number;
  /** Timestamp when step completed */
  completedAt?: number;
}

export interface StepResult {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
  /** Verification result if verified */
  verification?: VerificationResult;
}

// ─── Mission ─────────────────────────────────────────────────────────────────

export interface Mission {
  /** Unique mission identifier */
  id: string;
  /** The original user goal in natural language */
  goal: string;
  /** Current status */
  status: MissionStatus;
  /** Ordered (but dependency-aware) steps */
  steps: MissionStep[];
  /** Final response text when mission completes */
  response?: string;
  /** Total tool calls made */
  toolCallCount: number;
  /** Maximum allowed tool calls */
  maxToolCalls: number;
  /** Maximum execution time in ms */
  maxExecutionTimeMs: number;
  /** Start timestamp */
  startedAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Completion timestamp */
  completedAt?: number;
  /** Source of the mission */
  source: "voice" | "chat" | "quick-action";
  /** User context */
  context: {
    userId: string;
    currentRoute?: string;
  };
  /** Whether this mission needs user approval for next step */
  pendingApproval?: {
    stepId: string;
    description: string;
    tool: string;
    args: Record<string, unknown>;
  };
  /** Error summary if failed */
  error?: string;
}

// ─── Verification ────────────────────────────────────────────────────────────

export interface VerificationResult {
  verified: boolean;
  /** How we verified (tool call, state check, etc.) */
  method: string;
  /** Evidence that the step succeeded */
  evidence: string;
  /** If not verified, what went wrong */
  discrepancy?: string;
}

// ─── Plan ────────────────────────────────────────────────────────────────────

export interface MissionPlan {
  /** Steps to execute in dependency order */
  steps: Omit<MissionStep, "id" | "status" | "retries" | "maxRetries">[];
  /** Estimated number of tool calls */
  estimatedToolCalls: number;
  /** Reasoning about the plan */
  reasoning: string;
}

// ─── Mission Events ──────────────────────────────────────────────────────────

export type MissionEventType =
  | "mission.created"
  | "mission.started"
  | "mission.step.started"
  | "mission.step.completed"
  | "mission.step.failed"
  | "mission.step.retrying"
  | "mission.completed"
  | "mission.partial"
  | "mission.failed"
  | "mission.cancelled"
  | "mission.paused"
  | "mission.resumed"
  | "mission.needs_approval"
  | "mission.approved"
  | "mission.replanning";

export interface MissionEvent {
  type: MissionEventType;
  missionId: string;
  stepId?: string;
  timestamp: number;
  data?: unknown;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_MAX_TOOL_CALLS = 20;
export const DEFAULT_MAX_EXECUTION_TIME_MS = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_MAX_STEP_RETRIES = 2;
