/**
 * Nova Scheduler — Types
 * Durable job scheduling that survives application restarts.
 */

export type JobType = "one_time" | "delayed" | "recurring" | "cron" | "calendar_relative";

export type JobStatus = "queued" | "running" | "waiting" | "completed" | "failed" | "cancelled";

export interface ScheduledJob {
  id: string;
  name: string;
  type: JobType;
  status: JobStatus;
  // Schedule definition
  executeAt?: number; // for one_time/delayed
  intervalMs?: number; // for recurring
  cronExpression?: string; // for cron
  calendarEventId?: string; // for calendar_relative
  calendarOffsetMs?: number; // offset from calendar event
  // Execution
  payload: JobPayload;
  lastRunAt?: number;
  nextRunAt?: number;
  runCount: number;
  maxRuns?: number;
  // Results
  lastResult?: JobResult;
  // Metadata
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface JobPayload {
  type: "reminder" | "briefing" | "task_check" | "email_check" | "automation" | "custom";
  title: string;
  message: string;
  actionType?: string;
  actionPayload?: unknown;
}

export interface JobResult {
  success: boolean;
  output?: string;
  error?: string;
  executedAt: number;
  durationMs: number;
}
