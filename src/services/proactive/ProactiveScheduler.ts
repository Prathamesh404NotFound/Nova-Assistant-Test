/**
 * Nova Proactive Engine — Scheduler.
 * Owns anti-spam: per-event cooldowns, exact deduplication, quiet hours,
 * urgency floor and an hourly notification budget. Decisions made here are
 * final — the engine never emits against the scheduler's verdict.
 */

import type { ProactiveEvent, ProactiveSettings } from "./ProactiveTypes";
import { URGENCY_RANK } from "./ProactiveRules";

const DEFAULT_COOLDOWN_MS = 30 * 60 * 1000; // 30 min between same-event pings

class ProactiveSchedulerImpl {
  /** Last time each event id was surfaced. */
  private lastSeen = new Map<string, number>();
  /** Exact event ids already handled (dedup — never twice). */
  private handled = new Set<string>();
  /** Timestamps of notifications sent in the current hour window. */
  private budgetWindow: number[] = [];
  /** Captured pending suggestions (dedup for suggestion cards). */
  private pendingSuggestions = new Set<string>();

  shouldNotify(event: ProactiveEvent, settings: ProactiveSettings): { allowed: boolean; reason: string } {
    const now = Date.now();

    // 1. Engine off / category off — checked by the engine before rules, kept
    //    here too so every consumer is safe.
    if (!settings.enabled) return { allowed: false, reason: "proactive intelligence disabled" };
    if (!settings.categories[event.category]) {
      return { allowed: false, reason: `category "${event.category}" disabled` };
    }

    // 2. Priority floor
    if (URGENCY_RANK[event.urgency] < URGENCY_RANK[settings.minUrgency]) {
      return { allowed: false, reason: `urgency "${event.urgency}" below floor "${settings.minUrgency}"` };
    }

    // 3. Exact dedup — the same event id never surfaces twice
    if (this.handled.has(event.id)) {
      return { allowed: false, reason: "duplicate event (already handled)" };
    }

    // 4. Cooldown per event id
    const last = this.lastSeen.get(event.id);
    if (last !== undefined && now - last < DEFAULT_COOLDOWN_MS) {
      return { allowed: false, reason: `cooldown (${Math.round((DEFAULT_COOLDOWN_MS - (now - last)) / 60000)}m left)` };
    }

    // 5. Quiet hours (urgent always passes — genuinely time-critical)
    if (settings.quietHoursEnabled && this.isQuietHour(settings) && event.urgency !== "urgent") {
      return { allowed: false, reason: "quiet hours" };
    }

    // 6. Notification budget (urgent bypasses)
    if (event.urgency !== "urgent" && this.budgetWindow.length >= settings.budgetPerHour) {
      return { allowed: false, reason: `hourly budget exhausted (${settings.budgetPerHour})` };
    }

    return { allowed: true, reason: "allowed" };
  }

  /** Record that an event was actually surfaced. */
  markSent(event: ProactiveEvent): void {
    const now = Date.now();
    this.handled.add(event.id);
    this.lastSeen.set(event.id, now);
    this.budgetWindow.push(now);
    // Prune budget window (keep only the last hour)
    this.budgetWindow = this.budgetWindow.filter((t) => now - t < 60 * 60 * 1000);
  }

  /** Record a decision even when not notified (prevents re-evaluation churn). */
  markHandled(event: ProactiveEvent): void {
    this.handled.add(event.id);
  }

  canSuggest(suggestionId: string): boolean {
    if (this.pendingSuggestions.has(suggestionId)) return false;
    return true;
  }

  markSuggested(suggestionId: string): void {
    this.pendingSuggestions.add(suggestionId);
  }

  clearSuggestion(suggestionId: string): void {
    this.pendingSuggestions.delete(suggestionId);
  }

  isQuietHour(settings: ProactiveSettings): boolean {
    const h = new Date().getHours();
    const { quietHoursStart: s, quietHoursEnd: e } = settings;
    if (s === e) return false;
    return s < e ? h >= s && h < e : h >= s || h < e;
  }

  /** Diagnostics: reset all anti-spam state (used by tests / settings). */
  reset(): void {
    this.lastSeen.clear();
    this.handled.clear();
    this.budgetWindow = [];
    this.pendingSuggestions.clear();
  }

  stats(): { handled: number; sentLastHour: number } {
    const now = Date.now();
    return {
      handled: this.handled.size,
      sentLastHour: this.budgetWindow.filter((t) => now - t < 60 * 60 * 1000).length,
    };
  }
}

export const proactiveScheduler = new ProactiveSchedulerImpl();
