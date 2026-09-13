/**
 * Nova Proactive Engine — Watcher.
 * Polls calendar and tasks on a slow interval and emits typed events on the
 * Nova event bus when a threshold is crossed (meeting within 10 minutes,
 * task overdue). Emits each trigger only once — the engine's scheduler
 * handles the rest of the anti-spam stack.
 */

import { novaEventBus } from "@/services/nova-core/NovaEventBus";

const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute — plenty for 10-minute lead
const MEETING_LEAD_MINUTES = 10;

class ProactiveWatcher {
  private interval: number | null = null;
  private alertedMeetings = new Set<string>();
  private alertedTasks = new Set<string>();

  start(): void {
    if (this.interval !== null) return;
    this.interval = window.setInterval(() => void this.check(), CHECK_INTERVAL_MS);
    // First check after a short delay so app startup isn't blocked.
    window.setTimeout(() => void this.check(), 5000);
  }

  stop(): void {
    if (this.interval !== null) {
      window.clearInterval(this.interval);
      this.interval = null;
    }
  }

  async check(): Promise<void> {
    try {
      await this.checkCalendar();
      await this.checkTasks();
    } catch { /* never crash on background checks */ }
  }

  private async checkCalendar(): Promise<void> {
    const { calendarService } = await import("@/services/calendar/CalendarService");
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const events = calendarService.list({ startDate: today });

    for (const evt of events) {
      const [h, m] = evt.time.split(":").map(Number);
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0);
      const startInMin = Math.round((start.getTime() - now.getTime()) / 60000);

      // Fire once when the event crosses into the 10-minute window
      if (startInMin > 0 && startInMin <= MEETING_LEAD_MINUTES && !this.alertedMeetings.has(evt.id)) {
        this.alertedMeetings.add(evt.id);
        novaEventBus.emit("calendar.upcoming", {
          eventId: evt.id,
          title: evt.title,
          startAt: start.getTime(),
        });
      }
      // Clean up past events from the alert set
      if (startInMin < -30) this.alertedMeetings.delete(evt.id);
    }
  }

  private async checkTasks(): Promise<void> {
    // Overdue detection works on tasks with a due date in the past.
    // The RTDB task model has no dueAt field yet, so this reads the local
    // calendar-independent task store via TaskService when a dueAt exists.
    const { taskService } = await import("@/services/tasks/TaskService");
    const userId = this.currentUserId;
    if (!userId) return;

    const tasks = await taskService.list(userId);
    const now = Date.now();
    for (const task of tasks) {
      if (task.status === "completed") continue;
      const dueAt = (task as { dueAt?: number }).dueAt;
      if (typeof dueAt !== "number" || dueAt >= now) continue;
      if (this.alertedTasks.has(task.id)) continue;
      this.alertedTasks.add(task.id);
      novaEventBus.emit("task.overdue", { taskId: task.id, title: task.title });
    }
  }

  private currentUserId: string | undefined = undefined;

  setUser(userId?: string): void {
    this.currentUserId = userId;
  }
}

export const proactiveWatcher = new ProactiveWatcher();
