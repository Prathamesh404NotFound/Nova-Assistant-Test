/**
 * Nova Proactive Engine — Types
 * The engine notices meaningful changes, reasons about them conservatively,
 * and decides: ignore / suggest / notify / execute. Anti-spam is mandatory:
 * cooldowns, deduplication, quiet hours, priority floors and a notification
 * budget gate every emission.
 */

export type ProactiveCategory =
  | "calendar"
  | "tasks"
  | "email"
  | "system"
  | "devices"
  | "browser"
  | "automation"
  | "memory"
  | "activity";

export type ProactiveUrgency = "low" | "medium" | "high" | "urgent";

export type ProactiveAction = "ignore" | "suggest" | "notify" | "execute";

export interface ProactiveEvent {
  id: string;                    // dedup key base, e.g. "calendar:evt123:10min"
  category: ProactiveCategory;
  type: string;                  // e.g. "meeting_upcoming", "task_overdue"
  title: string;
  body: string;
  urgency: ProactiveUrgency;
  /** Optional spoken text for high/urgent events when proactive voice is enabled. */
  spokenText?: string;
  /** Structured payload the suggestion/automation may act on. */
  data?: Record<string, unknown>;
  occurredAt: number;
}

export interface ProactiveDecision {
  event: ProactiveEvent;
  action: ProactiveAction;
  reason: string;                // human-readable why (shown in diagnostics)
  /** For "suggest": a runnable suggestion Nova presents (not auto-executed). */
  suggestion?: {
    id: string;
    label: string;               // CTA text, e.g. "Join now"
    /** Route or tool call the user can accept. */
    route?: string;
    tool?: string;
    args?: Record<string, unknown>;
  };
  notified: boolean;
  spoke: boolean;
}

export interface ProactiveSettings {
  enabled: boolean;
  /** Global floor: events below this urgency never notify. */
  minUrgency: ProactiveUrgency;         // "low" | "medium" | "high" | "urgent"
  quietHoursStart: number;              // hour 0-23
  quietHoursEnd: number;
  quietHoursEnabled: boolean;
  /** Per-category opt-in — a disabled category is always "ignore". */
  categories: Record<ProactiveCategory, boolean>;
  /** Default confirmation mode for any "execute"-level decision. */
  confirmationMode: "always" | "for_high_risk" | "never";
  /** Opt-in for Nova speaking urgent events aloud. */
  proactiveVoice: boolean;
  /** Max notifications per hour (budget). */
  budgetPerHour: number;
}

export const DEFAULT_PROACTIVE_SETTINGS: ProactiveSettings = {
  enabled: true,
  minUrgency: "medium",
  quietHoursStart: 22,
  quietHoursEnd: 7,
  quietHoursEnabled: true,
  categories: {
    calendar: true,
    tasks: true,
    email: true,
    system: false,   // conservative default
    devices: false,
    browser: false,
    automation: true,
    memory: false,
    activity: false,
  },
  confirmationMode: "for_high_risk",
  proactiveVoice: false,
  budgetPerHour: 6,
};

// ─── Learned feedback (memory) ──────────────────────────────────────────────

export interface ProactiveFeedback {
  /** Per-category + per-type accept/dismiss tallies. */
  accepted: Record<string, number>;
  dismissed: Record<string, number>;
  /** Preferred quiet hours shifts learned implicitly from dismissals. */
  updatedAt: number;
}
