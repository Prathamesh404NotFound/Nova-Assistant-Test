/**
 * Nova Automation Engine — Types
 * Trigger → Conditions → Actions → Verification framework.
 */

export type TriggerType =
  | "time"
  | "event"
  | "calendar_event_starting"
  | "task_overdue"
  | "email_received"
  | "mission_completed"
  | "integration_error"
  | "world_state_change";

export type ConditionType =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than"
  | "is_true"
  | "is_false"
  | "time_between"
  | "day_of_week";

export type ActionType =
  | "notify"
  | "send_email"
  | "create_task"
  | "create_calendar_event"
  | "run_mission"
  | "update_memory"
  | "webhook"
  | "custom";

export interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  lastTriggeredAt?: number;
  triggerCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface AutomationTrigger {
  type: TriggerType;
  config: Record<string, unknown>;
}

export interface AutomationCondition {
  type: ConditionType;
  field: string;
  value: unknown;
}

export interface AutomationAction {
  type: ActionType;
  config: Record<string, unknown>;
  confirmationRequired: boolean;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  triggeredAt: number;
  completedAt?: number;
  status: "running" | "completed" | "failed";
  actionsExecuted: number;
  result?: string;
  error?: string;
}
