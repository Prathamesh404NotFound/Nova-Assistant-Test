/**
 * Nova Automation Engine — AutomationEngine
 * Evaluates triggers, checks conditions, and executes actions.
 */

import type { Automation, AutomationRun, TriggerType, ConditionType, ActionType, AutomationAction, AutomationCondition } from "./AutomationTypes";

// ─── Storage ────────────────────────────────────────────────────────────────

const AUTOMATIONS_KEY = "nova_automations";
const RUNS_KEY = "nova_automation_runs";

// ─── Condition Evaluator ────────────────────────────────────────────────────

function evaluateCondition(condition: AutomationCondition, context: Record<string, unknown>): boolean {
  const fieldValue = context[condition.field];

  switch (condition.type) {
    case "equals":
      return fieldValue === condition.value;
    case "not_equals":
      return fieldValue !== condition.value;
    case "contains":
      return String(fieldValue).includes(String(condition.value));
    case "greater_than":
      return Number(fieldValue) > Number(condition.value);
    case "less_than":
      return Number(fieldValue) < Number(condition.value);
    case "is_true":
      return fieldValue === true;
    case "is_false":
      return fieldValue === false;
    case "time_between": {
      const hour = new Date().getHours();
      const [start, end] = condition.value as [number, number];
      return hour >= start && hour < end;
    }
    case "day_of_week": {
      const day = new Date().getDay();
      return day === condition.value;
    }
    default:
      return true;
  }
}

// ─── Automation Engine ──────────────────────────────────────────────────────

class AutomationEngineImpl {
  private automations: Automation[] = [];
  private runs: AutomationRun[] = [];
  private eventListeners: Map<TriggerType, ((context: Record<string, unknown>) => void)[]> = new Map();

  constructor() {
    this.automations = this.loadAutomations();
    this.runs = this.loadRuns();
  }

  /**
   * Create a new automation.
   */
  create(automation: Omit<Automation, "id" | "createdAt" | "updatedAt" | "triggerCount">): Automation {
    const now = Date.now();
    const newAutomation: Automation = {
      ...automation,
      id: `auto_${now}_${Math.random().toString(36).substring(2, 8)}`,
      triggerCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.automations.push(newAutomation);
    this.saveAutomations();
    return newAutomation;
  }

  /**
   * Update an automation.
   */
  update(automationId: string, partial: Partial<Automation>): boolean {
    const automation = this.automations.find((a) => a.id === automationId);
    if (!automation) return false;

    Object.assign(automation, partial, { updatedAt: Date.now() });
    this.saveAutomations();
    return true;
  }

  /**
   * Delete an automation.
   */
  delete(automationId: string): boolean {
    const index = this.automations.findIndex((a) => a.id === automationId);
    if (index === -1) return false;
    this.automations.splice(index, 1);
    this.saveAutomations();
    return true;
  }

  /**
   * Enable/disable an automation.
   */
  setEnabled(automationId: string, enabled: boolean): boolean {
    const automation = this.automations.find((a) => a.id === automationId);
    if (!automation) return false;
    automation.enabled = enabled;
    automation.updatedAt = Date.now();
    this.saveAutomations();
    return true;
  }

  /**
   * Trigger an automation by event type.
   */
  async trigger(triggerType: TriggerType, context: Record<string, unknown> = {}): Promise<AutomationRun[]> {
    const matchingAutomations = this.automations.filter(
      (a) => a.enabled && a.trigger.type === triggerType
    );

    const results: AutomationRun[] = [];

    for (const automation of matchingAutomations) {
      const result = await this.executeAutomation(automation, context);
      results.push(result);
    }

    return results;
  }

  /**
   * Manually run an automation.
   */
  async runManually(automationId: string, context: Record<string, unknown> = {}): Promise<AutomationRun | null> {
    const automation = this.automations.find((a) => a.id === automationId);
    if (!automation) return null;
    return this.executeAutomation(automation, context);
  }

  /**
   * Get all automations.
   */
  getAll(): Automation[] {
    return [...this.automations];
  }

  /**
   * Get a specific automation.
   */
  get(automationId: string): Automation | undefined {
    return this.automations.find((a) => a.id === automationId);
  }

  /**
   * Get run history.
   */
  getRuns(automationId?: string, limit = 50): AutomationRun[] {
    let runs = this.runs;
    if (automationId) {
      runs = runs.filter((r) => r.automationId === automationId);
    }
    return runs.sort((a, b) => b.triggeredAt - a.triggeredAt).slice(0, limit);
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private async executeAutomation(automation: Automation, context: Record<string, unknown>): Promise<AutomationRun> {
    const run: AutomationRun = {
      id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      automationId: automation.id,
      triggeredAt: Date.now(),
      status: "running",
      actionsExecuted: 0,
    };

    try {
      // Check all conditions
      for (const condition of automation.conditions) {
        if (!evaluateCondition(condition, context)) {
          run.status = "completed";
          run.result = "Conditions not met";
          run.completedAt = Date.now();
          this.runs.push(run);
          this.saveRuns();
          return run;
        }
      }

      // Execute actions
      for (const action of automation.actions) {
        await this.executeAction(action, context);
        run.actionsExecuted++;
      }

      run.status = "completed";
      run.result = `Executed ${run.actionsExecuted} actions`;
      run.completedAt = Date.now();

      // Update automation
      automation.lastTriggeredAt = Date.now();
      automation.triggerCount++;
      this.saveAutomations();
    } catch (err) {
      run.status = "failed";
      run.error = err instanceof Error ? err.message : "Unknown error";
      run.completedAt = Date.now();
    }

    this.runs.push(run);
    this.saveRuns();
    return run;
  }

  private async executeAction(action: AutomationAction, context: Record<string, unknown>): Promise<void> {
    switch (action.type) {
      case "notify":
        // Will be connected to NotificationService
        console.log(`[Automation] Notify: ${action.config.message || "Event triggered"}`);
        break;

      case "create_task":
        // Will be connected to TaskService
        console.log(`[Automation] Create task: ${action.config.title}`);
        break;

      case "create_calendar_event":
        // Will be connected to CalendarService
        console.log(`[Automation] Create event: ${action.config.title}`);
        break;

      case "send_email":
        // Will be connected to EmailService
        console.log(`[Automation] Send email to: ${action.config.to}`);
        break;

      case "run_mission":
        // Will be connected to MissionManager
        console.log(`[Automation] Run mission: ${action.config.goal}`);
        break;

      case "webhook":
        // Webhook call
        if (action.config.url) {
          try {
            await fetch(action.config.url as string, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(context),
            });
          } catch (err) {
            console.error(`[Automation] Webhook failed:`, err);
          }
        }
        break;

      case "custom":
        // Custom action placeholder
        console.log(`[Automation] Custom action:`, action.config);
        break;
    }
  }

  private loadAutomations(): Automation[] {
    try {
      const raw = localStorage.getItem(AUTOMATIONS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  }

  private saveAutomations(): void {
    try {
      localStorage.setItem(AUTOMATIONS_KEY, JSON.stringify(this.automations));
    } catch { /* ignore */ }
  }

  private loadRuns(): AutomationRun[] {
    try {
      const raw = localStorage.getItem(RUNS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  }

  private saveRuns(): void {
    try {
      localStorage.setItem(RUNS_KEY, JSON.stringify(this.runs.slice(-500)));
    } catch { /* ignore */ }
  }
}

export const automationEngine = new AutomationEngineImpl();
