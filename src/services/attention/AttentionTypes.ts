/**
 * Nova Attention Engine — Types
 * Evaluates what deserves the user's attention.
 */

export type AttentionPriority = "critical" | "high" | "medium" | "low" | "info";

export interface AttentionEvent {
  id: string;
  type: AttentionEventType;
  title: string;
  message: string;
  priority: AttentionPriority;
  importance: number; // 0-1
  urgency: number; // 0-1
  confidence: number; // 0-1
  userRelevance: number; // 0-1
  timeSensitivity: number; // 0-1
  score: number; // computed attention score
  source: string;
  actionable: boolean;
  actionLabel?: string;
  actionPayload?: unknown;
  createdAt: number;
  expiresAt?: number;
  acknowledged: boolean;
}

export type AttentionEventType =
  | "meeting_starting"
  | "task_overdue"
  | "important_email"
  | "deadline_approaching"
  | "automation_failed"
  | "device_problem"
  | "mission_completed"
  | "mission_failed"
  | "integration_error"
  | "reminder"
  | "weather_alert"
  | "system_health"
  | "suggestion";

export interface AttentionPolicy {
  minScore: number;
  quietHoursMinScore: number;
  focusModeMinScore: number;
  maxEventsPerMinute: number;
  deduplicationWindowMs: number;
  allowedTypes: AttentionEventType[];
  blockedTypes: AttentionEventType[];
}
