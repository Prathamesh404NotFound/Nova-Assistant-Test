/**
 * Nova Scheduler — SchedulerService
 * Durable job scheduling that survives application restarts.
 * Uses localStorage for persistence and interval-based execution.
 */

import type { ScheduledJob, JobType, JobStatus, JobPayload, JobResult } from "./SchedulerTypes";

// ─── Storage ────────────────────────────────────────────────────────────────

const JOBS_KEY = "nova_scheduled_jobs";
const CHECK_INTERVAL = 10_000; // Check every 10 seconds

// ─── Simple Cron Parser ─────────────────────────────────────────────────────

function parseCron(expression: string, now: Date): number | null {
  // Simple cron: "minute hour dayOfMonth month dayOfWeek"
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minExpr, hourExpr, domExpr, monExpr, dowExpr] = parts;

  // Check if this cron matches the given time
  const matchField = (expr: string, value: number): boolean => {
    if (expr === "*") return true;
    if (expr.includes(",")) return expr.split(",").some((v) => matchField(v.trim(), value));
    if (expr.includes("-")) {
      const [start, end] = expr.split("-").map(Number);
      return value >= start && value <= end;
    }
    if (expr.includes("/")) {
      const [, step] = expr.split("/");
      return value % parseInt(step, 10) === 0;
    }
    return parseInt(expr, 10) === value;
  };

  if (!matchField(minExpr, now.getMinutes())) return false as unknown as null;
  if (!matchField(hourExpr, now.getHours())) return false as unknown as null;
  if (!matchField(domExpr, now.getDate())) return false as unknown as null;
  if (!matchField(monExpr, now.getMonth() + 1)) return false as unknown as null;
  if (!matchField(dowExpr, now.getDay())) return false as unknown as null;

  return now.getTime();
}

function getNextCronTime(expression: string, after: Date): number | null {
  // Check next 7 days, minute by minute (simplified)
  const check = new Date(after.getTime() + 60000);
  for (let i = 0; i < 7 * 24 * 60; i++) {
    const result = parseCron(expression, check);
    if (result) return result;
    check.setTime(check.getTime() + 60000);
  }
  return null;
}

// ─── Scheduler Service ──────────────────────────────────────────────────────

class SchedulerServiceImpl {
  private jobs: ScheduledJob[] = [];
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private jobExecutors: Map<string, (job: ScheduledJob) => Promise<void>> = new Map();

  constructor() {
    this.jobs = this.loadJobs();
  }

  /**
   * Start the scheduler.
   */
  start(): void {
    if (this.checkTimer) return;

    // Recalculate next run times
    for (const job of this.jobs) {
      if (job.status === "queued" || job.status === "waiting") {
        this.updateNextRun(job);
      }
    }

    this.checkTimer = setInterval(() => this.checkJobs(), CHECK_INTERVAL);
    this.checkJobs(); // Immediate check
  }

  /**
   * Stop the scheduler.
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Register a job executor function.
   */
  registerExecutor(type: string, executor: (job: ScheduledJob) => Promise<void>): void {
    this.jobExecutors.set(type, executor);
  }

  /**
   * Schedule a one-time job.
   */
  scheduleOneTime(
    name: string,
    executeAt: number,
    payload: JobPayload,
    createdBy = "user"
  ): ScheduledJob {
    return this.createJob({
      name,
      type: "one_time",
      executeAt,
      payload,
      createdBy,
    });
  }

  /**
   * Schedule a delayed job.
   */
  scheduleDelayed(
    name: string,
    delayMs: number,
    payload: JobPayload,
    createdBy = "user"
  ): ScheduledJob {
    return this.createJob({
      name,
      type: "delayed",
      executeAt: Date.now() + delayMs,
      payload,
      createdBy,
    });
  }

  /**
   * Schedule a recurring job.
   */
  scheduleRecurring(
    name: string,
    intervalMs: number,
    payload: JobPayload,
    createdBy = "user",
    maxRuns?: number
  ): ScheduledJob {
    return this.createJob({
      name,
      type: "recurring",
      intervalMs,
      payload,
      createdBy,
      maxRuns,
      nextRunAt: Date.now() + intervalMs,
    });
  }

  /**
   * Schedule a cron job.
   */
  scheduleCron(
    name: string,
    cronExpression: string,
    payload: JobPayload,
    createdBy = "user"
  ): ScheduledJob {
    const nextRun = getNextCronTime(cronExpression, new Date());
    return this.createJob({
      name,
      type: "cron",
      cronExpression,
      payload,
      createdBy,
      nextRunAt: nextRun || undefined,
    });
  }

  /**
   * Cancel a job.
   */
  cancel(jobId: string): boolean {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) return false;
    job.status = "cancelled";
    job.updatedAt = Date.now();
    this.saveJobs();
    return true;
  }

  /**
   * Get all jobs.
   */
  getAll(): ScheduledJob[] {
    return [...this.jobs];
  }

  /**
   * Get active jobs.
   */
  getActive(): ScheduledJob[] {
    return this.jobs.filter((j) => j.status === "queued" || j.status === "waiting");
  }

  /**
   * Get a specific job.
   */
  get(jobId: string): ScheduledJob | undefined {
    return this.jobs.find((j) => j.id === jobId);
  }

  /**
   * Get job history.
   */
  getHistory(limit = 50): ScheduledJob[] {
    return this.jobs
      .filter((j) => j.status === "completed" || j.status === "failed")
      .sort((a, b) => (b.lastRunAt || 0) - (a.lastRunAt || 0))
      .slice(0, limit);
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private createJob(partial: Partial<ScheduledJob>): ScheduledJob {
    const now = Date.now();
    const job: ScheduledJob = {
      id: `job_${now}_${Math.random().toString(36).substring(2, 8)}`,
      name: partial.name || "Unnamed Job",
      type: partial.type || "one_time",
      status: "queued",
      executeAt: partial.executeAt,
      intervalMs: partial.intervalMs,
      cronExpression: partial.cronExpression,
      calendarEventId: partial.calendarEventId,
      calendarOffsetMs: partial.calendarOffsetMs,
      payload: partial.payload || { type: "custom", title: "", message: "" },
      nextRunAt: partial.nextRunAt || partial.executeAt,
      runCount: 0,
      maxRuns: partial.maxRuns,
      createdAt: now,
      updatedAt: now,
      createdBy: partial.createdBy || "user",
    };

    this.jobs.push(job);
    this.saveJobs();
    return job;
  }

  private async checkJobs(): Promise<void> {
    const now = Date.now();

    for (const job of this.jobs) {
      if (job.status !== "queued" && job.status !== "waiting") continue;
      if (job.maxRuns && job.runCount >= job.maxRuns) {
        job.status = "completed";
        continue;
      }

      const shouldRun = job.nextRunAt && job.nextRunAt <= now;
      if (!shouldRun) continue;

      await this.executeJob(job);
    }

    this.saveJobs();
  }

  private async executeJob(job: ScheduledJob): Promise<void> {
    job.status = "running";
    job.lastRunAt = Date.now();
    this.saveJobs();

    const startTime = Date.now();

    try {
      // Get executor
      const executor = this.jobExecutors.get(job.payload.type);
      if (executor) {
        await executor(job);
      } else {
        // Default: just log it
        console.log(`[Scheduler] Job executed: ${job.name}`);
      }

      job.runCount++;
      job.status = job.type === "recurring" || job.type === "cron" ? "queued" : "completed";
      job.lastResult = {
        success: true,
        executedAt: Date.now(),
        durationMs: Date.now() - startTime,
      };

      // Schedule next run
      this.updateNextRun(job);
    } catch (err) {
      job.status = "failed";
      job.lastResult = {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        executedAt: Date.now(),
        durationMs: Date.now() - startTime,
      };
    }

    job.updatedAt = Date.now();
    this.saveJobs();
  }

  private updateNextRun(job: ScheduledJob): void {
    switch (job.type) {
      case "delayed":
      case "one_time":
        // No next run after execution
        job.nextRunAt = undefined;
        break;

      case "recurring":
        if (job.intervalMs) {
          job.nextRunAt = Date.now() + job.intervalMs;
        }
        break;

      case "cron":
        if (job.cronExpression) {
          job.nextRunAt = getNextCronTime(job.cronExpression, new Date()) || undefined;
        }
        break;

      case "calendar_relative":
        // Will be recalculated when calendar data is available
        break;
    }
  }

  private loadJobs(): ScheduledJob[] {
    try {
      const raw = localStorage.getItem(JOBS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  }

  private saveJobs(): void {
    try {
      localStorage.setItem(JOBS_KEY, JSON.stringify(this.jobs.slice(-500)));
    } catch { /* ignore */ }
  }
}

export const schedulerService = new SchedulerServiceImpl();
