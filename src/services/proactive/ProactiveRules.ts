/**
 * Nova Proactive Engine — Rules.
 * Each rule conservatively maps an event to a decision. Rules never bypass
 * cooldowns/budget — the engine applies those after the rule fires.
 */

import type { ProactiveEvent, ProactiveUrgency } from "./ProactiveTypes";

/** Priority order used for budget decisions (higher survives first). */
export const URGENCY_RANK: Record<ProactiveUrgency, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

export interface RuleResult {
  /** false → event is not worth surfacing at all. */
  relevant: boolean;
  urgency: ProactiveUrgency;
  body?: string;
  spokenText?: string;
  suggestion?: {
    id: string;
    label: string;
    route?: string;
    tool?: string;
    args?: Record<string, unknown>;
  };
  reason: string;
}

type Rule = (event: ProactiveEvent) => RuleResult;

const rules: Record<string, Rule> = {
  // ── Calendar ─────────────────────────────────────────────────────────────
  "meeting_upcoming": (event) => {
    const startInMin = Number(event.data?.startInMin ?? 999);
    // Only the pre-meeting window matters; far-future events are noise.
    if (startInMin > 15 || startInMin < -5) {
      return { relevant: false, urgency: "low", reason: "meeting not imminent" };
    }
    const minutes = Math.max(0, startInMin);
    return {
      relevant: true,
      urgency: minutes <= 5 ? "urgent" : "high",
      body: `"${event.title}" starts in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      spokenText: `You have a meeting in ${minutes} minutes.`,
      suggestion: { id: "join-meeting", label: "Open Calendar", route: "/calendar" },
      reason: `meeting in ${minutes} min`,
    };
  },

  // ── Tasks ────────────────────────────────────────────────────────────────
  "task_overdue": (event) => {
    const priority = String(event.data?.priority ?? "medium");
    const urgency: ProactiveUrgency =
      priority === "urgent" ? "high" : priority === "high" ? "medium" : "low";
    return {
      relevant: urgency !== "low", // low-priority overdue tasks stay quiet
      urgency,
      body: `Task "${event.title}" is overdue.`,
      suggestion: { id: "open-tasks", label: "View Tasks", route: "/tasks" },
      reason: `overdue task (${priority})`,
    };
  },

  // ── Email ────────────────────────────────────────────────────────────────
  "email_important": (event) => {
    // Only notify for marked-important senders; everything else is ignored.
    const important = event.data?.important === true;
    return {
      relevant: important,
      urgency: "medium",
      body: `New email: ${event.title}`,
      suggestion: { id: "open-email", label: "Open Mail", route: "/email" },
      reason: important ? "important contact" : "not an important contact",
    };
  },

  // ── System / browser ─────────────────────────────────────────────────────
  "download_finished": (event) => {
    return {
      relevant: true,
      urgency: "low",
      body: `Downloaded ${event.title}.`,
      reason: "download finished (low urgency — budget may drop it)",
    };
  },

  "network_changed": (event) => {
    const online = event.data?.online === true;
    if (online) {
      return { relevant: false, urgency: "low", reason: "network recovered — no need to interrupt" };
    }
    return {
      relevant: true,
      urgency: "medium",
      body: "You're offline. Nova will queue changes and sync when you reconnect.",
      reason: "went offline",
    };
  },

  // ── Devices ──────────────────────────────────────────────────────────────
  "device_disconnected": (event) => {
    // Only significant devices (not phones/idle sensors) warrant a ping.
    const kind = String(event.data?.kind ?? "unknown");
    const significant = ["thermostat", "camera", "lock", "hub", "security"].includes(kind);
    return {
      relevant: significant,
      urgency: significant ? "medium" : "low",
      body: `${event.title} disconnected.`,
      reason: significant ? `significant device (${kind})` : `minor device (${kind})`,
    };
  },

  // ── Automation ───────────────────────────────────────────────────────────
  "automation_completed": (event) => {
    return {
      relevant: true,
      urgency: "low",
      body: `Automation "${event.title}" finished.`,
      reason: "automation completed",
    };
  },

  "automation_failed": (event) => {
    return {
      relevant: true,
      urgency: "high",
      body: `Automation "${event.title}" failed.`,
      suggestion: { id: "open-automations", label: "Review", route: "/automations" },
      reason: "automation failure needs attention",
    };
  },
};

export function evaluateRule(event: ProactiveEvent): RuleResult {
  const rule = rules[event.type];
  if (!rule) {
    return { relevant: false, urgency: "low", reason: `no rule for "${event.type}"` };
  }
  return rule(event);
}

export function listRuleTypes(): string[] {
  return Object.keys(rules);
}
