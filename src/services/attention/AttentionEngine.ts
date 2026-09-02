/**
 * Nova Attention Engine — AttentionEngine
 * Evaluates events, computes attention scores, and filters based on policy.
 */

import type { AttentionEvent, AttentionPolicy, AttentionEventType, AttentionPriority } from "./AttentionTypes";

// ─── Storage ────────────────────────────────────────────────────────────────

const EVENTS_KEY = "nova_attention_events";
const POLICY_KEY = "nova_attention_policy";

const DEFAULT_POLICY: AttentionPolicy = {
  minScore: 0.4,
  quietHoursMinScore: 0.8,
  focusModeMinScore: 0.9,
  maxEventsPerMinute: 5,
  deduplicationWindowMs: 300_000, // 5 min
  allowedTypes: [],
  blockedTypes: [],
};

// ─── Scoring Weights ────────────────────────────────────────────────────────

const WEIGHTS = {
  importance: 0.3,
  urgency: 0.25,
  confidence: 0.1,
  userRelevance: 0.2,
  timeSensitivity: 0.15,
};

// ─── Priority Thresholds ────────────────────────────────────────────────────

function computePriority(score: number): AttentionPriority {
  if (score >= 0.9) return "critical";
  if (score >= 0.7) return "high";
  if (score >= 0.5) return "medium";
  if (score >= 0.3) return "low";
  return "info";
}

// ─── Attention Engine ───────────────────────────────────────────────────────

class AttentionEngineImpl {
  private events: AttentionEvent[] = [];
  private policy: AttentionPolicy;
  private recentEventTypes: Map<string, number> = new Map();

  constructor() {
    this.policy = this.loadPolicy();
    this.events = this.loadEvents();
  }

  /**
   * Submit an event for attention evaluation.
   * Returns the scored event, or null if filtered out.
   */
  submit(event: Omit<AttentionEvent, "id" | "score" | "priority" | "createdAt" | "acknowledged">): AttentionEvent | null {
    // Compute attention score
    const score = this.computeScore(event);

    // Check if score meets threshold
    const threshold = this.getThreshold();
    if (score < threshold) return null;

    // Deduplication check
    if (this.isDuplicate(event.type, event.title)) return null;

    // Rate limiting
    if (this.isRateLimited()) return null;

    // Build full event
    const fullEvent: AttentionEvent = {
      ...event,
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      score,
      priority: computePriority(score),
      createdAt: Date.now(),
      acknowledged: false,
    };

    // Store
    this.events.push(fullEvent);
    this.saveEvents();

    // Track for dedup
    this.recentEventTypes.set(`${event.type}:${event.title}`, Date.now());

    return fullEvent;
  }

  /**
   * Compute attention score from event attributes.
   */
  computeScore(event: {
    importance: number;
    urgency: number;
    confidence: number;
    userRelevance: number;
    timeSensitivity: number;
  }): number {
    return (
      event.importance * WEIGHTS.importance +
      event.urgency * WEIGHTS.urgency +
      event.confidence * WEIGHTS.confidence +
      event.userRelevance * WEIGHTS.userRelevance +
      event.timeSensitivity * WEIGHTS.timeSensitivity
    );
  }

  /**
   * Get unacknowledged events above threshold.
   */
  getPending(): AttentionEvent[] {
    const threshold = this.getThreshold();
    return this.events
      .filter((e) => !e.acknowledged && e.score >= threshold && (!e.expiresAt || e.expiresAt > Date.now()))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Acknowledge an event.
   */
  acknowledge(eventId: string): void {
    const event = this.events.find((e) => e.id === eventId);
    if (event) {
      event.acknowledged = true;
      this.saveEvents();
    }
  }

  /**
   * Get all events (for diagnostics).
   */
  getAll(): AttentionEvent[] {
    return [...this.events];
  }

  /**
   * Clear old events.
   */
  cleanup(maxAge = 86400000): void {
    const cutoff = Date.now() - maxAge;
    this.events = this.events.filter((e) => e.createdAt > cutoff || !e.acknowledged);
    this.saveEvents();
  }

  /**
   * Update policy.
   */
  updatePolicy(partial: Partial<AttentionPolicy>): void {
    this.policy = { ...this.policy, ...partial };
    localStorage.setItem(POLICY_KEY, JSON.stringify(this.policy));
  }

  /**
   * Get current policy.
   */
  getPolicy(): AttentionPolicy {
    return { ...this.policy };
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private getThreshold(): number {
    // Will be enhanced with world state checks
    return this.policy.minScore;
  }

  private isDuplicate(type: AttentionEventType, title: string): boolean {
    const key = `${type}:${title}`;
    const lastSeen = this.recentEventTypes.get(key);
    if (!lastSeen) return false;
    return Date.now() - lastSeen < this.policy.deduplicationWindowMs;
  }

  private isRateLimited(): boolean {
    const oneMinuteAgo = Date.now() - 60000;
    const recentCount = this.events.filter((e) => e.createdAt > oneMinuteAgo).length;
    return recentCount >= this.policy.maxEventsPerMinute;
  }

  private loadPolicy(): AttentionPolicy {
    try {
      const raw = localStorage.getItem(POLICY_KEY);
      if (raw) return { ...DEFAULT_POLICY, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULT_POLICY };
  }

  private loadEvents(): AttentionEvent[] {
    try {
      const raw = localStorage.getItem(EVENTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  }

  private saveEvents(): void {
    try {
      // Keep last 200 events
      const toStore = this.events.slice(-200);
      localStorage.setItem(EVENTS_KEY, JSON.stringify(toStore));
    } catch { /* ignore */ }
  }
}

export const attentionEngine = new AttentionEngineImpl();
