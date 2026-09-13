/**
 * Nova Proactive Engine.
 * Notices meaningful changes, reasons about them conservatively, and decides:
 *   event → context → rule → priority → cooldown/budget → user preference → action
 *
 * Possible outcomes: ignore | suggest | notify | execute.
 * This engine NEVER spam-notifies: the scheduler gates every emission, and
 * per-event rules decide relevance. Voice is opt-in via `proactiveVoice`.
 * Live decisions surface on the Dashboard as dismissible suggestion cards and
 * the user's accept/dismiss choices are learned over time.
 */

import { novaEventBus } from "@/services/nova-core/NovaEventBus";
import { notificationService } from "@/services/notifications/NotificationService";
import { ttsRouter } from "@/services/tts/tts-router";
import { proactiveContext } from "./ProactiveContext";
import { proactiveScheduler } from "./ProactiveScheduler";
import { evaluateRule, URGENCY_RANK } from "./ProactiveRules";
import type {
  ProactiveEvent,
  ProactiveDecision,
  ProactiveCategory,
  ProactiveUrgency,
} from "./ProactiveTypes";

type DecisionListener = (decision: ProactiveDecision) => void;

class ProactiveEngine {
  private listeners = new Set<DecisionListener>();
  private unsubs: Array<() => void> = [];
  private started = false;

  /** Live decisions for UI (suggestion cards, diagnostics). */
  onDecision(listener: DecisionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(userId?: string): void {
    if (this.started) return;
    this.started = true;
    this.userId = userId;
    this.subscribeToEvents();
  }

  setUser(userId?: string): void {
    this.userId = userId;
  }

  private userId: string | undefined = undefined;

  /** Core pipeline. Every event funnels through here exactly once. */
  async processEvent(event: ProactiveEvent): Promise<ProactiveDecision> {
    const settings = proactiveContext.getSettings();

    // 1. Engine + category gates
    if (!settings.enabled || !settings.categories[event.category]) {
      const decision: ProactiveDecision = {
        event, action: "ignore", reason: "proactive disabled or category off", notified: false, spoke: false,
      };
      proactiveScheduler.markHandled(event);
      return decision;
    }

    // 2. Rule evaluation (is this event worth surfacing at all?)
    const ruleResult = evaluateRule(event);
    if (!ruleResult.relevant) {
      const decision: ProactiveDecision = {
        event, action: "ignore", reason: ruleResult.reason, notified: false, spoke: false,
      };
      proactiveScheduler.markHandled(event);
      return decision;
    }

    const urgency: ProactiveUrgency = ruleResult.urgency;

    // 3. Scheduler gates: dedup, cooldown, quiet hours, floor, budget
    const gate = proactiveScheduler.shouldNotify(
      { ...event, urgency },
      settings
    );
    if (!gate.allowed) {
      const decision: ProactiveDecision = {
        event, action: "ignore", reason: gate.reason, notified: false, spoke: false,
      };
      proactiveScheduler.markHandled(event);
      return decision;
    }

    // 4. Learned preference: consistently-dismissed event types decay to "suggest"
    const acceptance = proactiveContext.acceptanceFor(event.type);
    const wouldNotify = URGENCY_RANK[urgency] >= URGENCY_RANK[settings.minUrgency];

    let action: ProactiveDecision["action"];
    let suggestion = ruleResult.suggestion;

    if (!wouldNotify) {
      action = "ignore";
    } else if (acceptance < 0.25) {
      // User almost always dismisses this type — downgrade to a passive suggestion
      action = "suggest";
    } else {
      action = "notify";
    }

    // 5. Emit
    let notified = false;
    let spoke = false;

    if (action === "notify") {
      const sent = notificationService.send({
        title: `Nova · ${event.title}`,
        body: ruleResult.body ?? event.body,
        channel: "in_app",
        priority: urgency === "urgent" ? "critical" : urgency === "high" ? "high" : "medium",
        category: event.category,
        silent: false,
      });
      notified = sent !== null;
      if (!notified) {
        // Notification service suppressed it (its own quiet hours / focus mode)
        action = "ignore";
      }
    }

    if ((action === "notify" || action === "suggest") && suggestion) {
      const suggestionKey = `${event.id}:${suggestion.id}`;
      if (proactiveScheduler.canSuggest(suggestionKey)) {
        proactiveScheduler.markSuggested(suggestionKey);
        this.emitToUI({ event, action: "suggest", reason: ruleResult.reason, notified, spoke: false, suggestion });
      }
    }

    // 6. Proactive voice — strictly opt-in, urgent/high only
    if (
      action === "notify" &&
      settings.proactiveVoice &&
      (urgency === "urgent" || (urgency === "high" && acceptance >= 0.5)) &&
      ruleResult.spokenText
    ) {
      try {
        await ttsRouter.speak(ruleResult.spokenText);
        spoke = true;
      } catch { /* TTS unavailable — text path still works */ }
    }

    if (action === "notify" || spoke) {
      proactiveScheduler.markSent(event);
    } else {
      proactiveScheduler.markHandled(event);
    }

    const decision: ProactiveDecision = {
      event, action, reason: ruleResult.reason, notified, spoke, suggestion,
    };
    this.emitToUI(decision);
    return decision;
  }

  /** User accepted a suggestion — learn from it. */
  acceptSuggestion(decision: ProactiveDecision): void {
    proactiveContext.recordFeedback(decision.event.type, true);
    if (decision.suggestion) {
      proactiveScheduler.clearSuggestion(`${decision.event.id}:${decision.suggestion.id}`);
    }
    // Accepted suggestions may execute a route (UI navigation) — never a tool
    // without the normal permission flow.
  }

  /** User dismissed a suggestion — learn from it. */
  dismissSuggestion(decision: ProactiveDecision): void {
    proactiveContext.recordFeedback(decision.event.type, false);
    if (decision.suggestion) {
      proactiveScheduler.clearSuggestion(`${decision.event.id}:${decision.suggestion.id}`);
    }
  }

  /** Fire a simulated/live event into the engine (used by tests + demos). */
  async simulate(type: string, category: ProactiveCategory, title: string, data?: Record<string, unknown>): Promise<ProactiveDecision> {
    const event: ProactiveEvent = {
      id: `${category}:${type}:${Date.now()}`,
      category,
      type,
      title,
      body: title,
      urgency: "medium",
      data,
      occurredAt: Date.now(),
    };
    return this.processEvent(event);
  }

  private emitToUI(decision: ProactiveDecision): void {
    for (const listener of this.listeners) {
      try { listener(decision); } catch { /* listener error never breaks engine */ }
    }
  }

  // ─── Event subscriptions ─────────────────────────────────────────────────

  private subscribeToEvents(): void {
    // Calendar: upcoming meetings (event bus broadcast by calendar checks)
    this.unsubs.push(
      novaEventBus.on("calendar.upcoming", (p) => {
        void this.processEvent({
          id: `calendar:upcoming:${p.eventId}:10min`,
          category: "calendar",
          type: "meeting_upcoming",
          title: p.title,
          body: p.title,
          urgency: "high",
          data: { startInMin: Math.round((p.startAt - Date.now()) / 60000), eventId: p.eventId },
          occurredAt: Date.now(),
        });
      })
    );

    // Tasks: overdue
    this.unsubs.push(
      novaEventBus.on("task.overdue", (p) => {
        void this.processEvent({
          id: `task:overdue:${p.taskId}`,
          category: "tasks",
          type: "task_overdue",
          title: p.title,
          body: p.title,
          urgency: "medium",
          data: { priority: "medium", taskId: p.taskId },
          occurredAt: Date.now(),
        });
      })
    );

    // Email received (important contacts only pass the rule)
    this.unsubs.push(
      novaEventBus.on("email.received", (p) => {
        void this.processEvent({
          id: `email:received:${p.subject}:${p.from}`,
          category: "email",
          type: "email_important",
          title: p.subject,
          body: `${p.subject} — from ${p.from}`,
          urgency: "medium",
          data: { important: true, from: p.from },
          occurredAt: Date.now(),
        });
      })
    );

    // Network changes
    this.unsubs.push(
      novaEventBus.on("network.offline", () => {
        void this.processEvent({
          id: `network:offline:${new Date().toISOString().slice(0, 13)}`, // per-hour dedup
          category: "system",
          type: "network_changed",
          title: "Network",
          body: "offline",
          urgency: "medium",
          data: { online: false },
          occurredAt: Date.now(),
        });
      })
    );

    // Device disconnects
    this.unsubs.push(
      novaEventBus.on("device.disconnected", (p) => {
        void this.processEvent({
          id: `device:disconnected:${p.deviceId}`,
          category: "devices",
          type: "device_disconnected",
          title: p.deviceId,
          body: p.deviceId,
          urgency: "medium",
          data: { kind: "unknown", deviceId: p.deviceId },
          occurredAt: Date.now(),
        });
      })
    );

    // Automation completed
    this.unsubs.push(
      novaEventBus.on("automation.triggered", (p) => {
        void this.processEvent({
          id: `automation:triggered:${p.automationId}:${new Date().toISOString().slice(0, 13)}`,
          category: "automation",
          type: "automation_completed",
          title: p.automationId,
          body: p.automationId,
          urgency: "low",
          data: { automationId: p.automationId },
          occurredAt: Date.now(),
        });
      })
    );
  }

  stop(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    this.started = false;
  }
}

export const proactiveEngine = new ProactiveEngine();
