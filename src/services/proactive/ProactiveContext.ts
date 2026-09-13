/**
 * Nova Proactive Engine — Context.
 * Aggregates the user's current situation (calendar, tasks, network, hour,
 * preferences) so every decision is contextual, not just event-triggered.
 * Also persists settings + learned feedback to Firebase (cloud-authoritative,
 * local cache for offline).
 */

import type { ProactiveSettings, ProactiveFeedback } from "./ProactiveTypes";
import { DEFAULT_PROACTIVE_SETTINGS } from "./ProactiveTypes";
import { saveSettingCloud } from "@/services/data/NovaCloudDataService";

const SETTINGS_KEY = "nova_proactive_settings";
const FEEDBACK_KEY = "nova_proactive_feedback";

export interface ProactiveSnapshot {
  hour: number;
  networkOnline: boolean;
  upcomingEvent: { title: string; startInMin: number; id: string } | null;
  overdueTasks: Array<{ id: string; title: string; priority: string }>;
}

class ProactiveContextImpl {
  private settings: ProactiveSettings = this.loadSettings();
  private feedback: ProactiveFeedback = this.loadFeedback();

  getSettings(): ProactiveSettings {
    return { ...this.settings, categories: { ...this.settings.categories } };
  }

  async updateSettings(partial: Partial<ProactiveSettings>, userId?: string): Promise<void> {
    this.settings = { ...this.settings, ...partial };
    this.saveSettings();
    if (userId) {
      // Cloud persistence — failure is fine here (local is the cache), but we
      // don't pretend it synced.
      await saveSettingCloud(userId, SETTINGS_KEY, JSON.stringify(this.settings));
    }
  }

  getFeedback(): ProactiveFeedback {
    return { ...this.feedback, accepted: { ...this.feedback.accepted }, dismissed: { ...this.feedback.dismissed } };
  }

  recordFeedback(eventKey: string, accepted: boolean): void {
    const bucket = accepted ? this.feedback.accepted : this.feedback.dismissed;
    bucket[eventKey] = (bucket[eventKey] ?? 0) + 1;
    this.feedback.updatedAt = Date.now();
    this.saveFeedback();
  }

  /** Acceptance ratio for an event type; defaults neutral (0.5). */
  acceptanceFor(eventKey: string): number {
    const a = this.feedback.accepted[eventKey] ?? 0;
    const d = this.feedback.dismissed[eventKey] ?? 0;
    const total = a + d;
    if (total < 3) return 0.5; // not enough signal — neutral
    return a / total;
  }

  /** Gather live context for decisions. Never throws. */
  async snapshot(): Promise<ProactiveSnapshot> {
    const snapshot: ProactiveSnapshot = {
      hour: new Date().getHours(),
      networkOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      upcomingEvent: null,
      overdueTasks: [],
    };

    try {
      const { calendarService } = await import("@/services/calendar/CalendarService");
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const events = calendarService.list({ startDate: today });
      for (const evt of events) {
        const [h, m] = evt.time.split(":").map(Number);
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0);
        const diffMin = Math.round((start.getTime() - now.getTime()) / 60000);
        if (diffMin > -60 && (snapshot.upcomingEvent === null || diffMin < snapshot.upcomingEvent.startInMin)) {
          snapshot.upcomingEvent = { title: evt.title, startInMin: diffMin, id: evt.id };
        }
      }
    } catch { /* calendar unavailable — context simply lacks it */ }

    return snapshot;
  }

  private loadSettings(): ProactiveSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ProactiveSettings>;
        return {
          ...DEFAULT_PROACTIVE_SETTINGS,
          ...parsed,
          categories: { ...DEFAULT_PROACTIVE_SETTINGS.categories, ...(parsed.categories ?? {}) },
        };
      }
    } catch { /* ignore */ }
    return { ...DEFAULT_PROACTIVE_SETTINGS };
  }

  private saveSettings(): void {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* ignore */ }
  }

  private loadFeedback(): ProactiveFeedback {
    try {
      const raw = localStorage.getItem(FEEDBACK_KEY);
      if (raw) return JSON.parse(raw) as ProactiveFeedback;
    } catch { /* ignore */ }
    return { accepted: {}, dismissed: {}, updatedAt: Date.now() };
  }

  private saveFeedback(): void {
    try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(this.feedback)); } catch { /* ignore */ }
  }
}

export const proactiveContext = new ProactiveContextImpl();
