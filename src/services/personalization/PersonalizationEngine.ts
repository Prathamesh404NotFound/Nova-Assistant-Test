/**
 * Nova Personalization Engine — PersonalizationEngine
 * Learns from explicit corrections, accepted suggestions, and behavioral patterns.
 */

import type { Preference, BehaviorSignal, PreferenceCategory } from "./PersonalizationTypes";

// ─── Storage ────────────────────────────────────────────────────────────────

const PREFS_KEY = "nova_preferences";
const SIGNALS_KEY = "nova_behavior_signals";

// ─── Personalization Engine ─────────────────────────────────────────────────

class PersonalizationEngineImpl {
  private preferences: Preference[] = [];
  private signals: BehaviorSignal[] = [];

  constructor() {
    this.preferences = this.loadPreferences();
    this.signals = this.loadSignals();
  }

  // ─── Preferences ──────────────────────────────────────────────────────

  /**
   * Set a preference (explicit user setting).
   */
  set(category: PreferenceCategory, key: string, value: unknown, source: Preference["source"] = "explicit"): Preference {
    const existing = this.preferences.find((p) => p.category === category && p.key === key);
    const now = Date.now();

    if (existing) {
      existing.value = value;
      existing.source = source;
      existing.confidence = source === "explicit" ? 1.0 : Math.max(existing.confidence, 0.7);
      existing.updatedAt = now;
      this.savePreferences();
      return existing;
    }

    const pref: Preference = {
      id: `pref_${now}_${Math.random().toString(36).substring(2, 8)}`,
      category,
      key,
      value,
      confidence: source === "explicit" ? 1.0 : 0.6,
      source,
      createdAt: now,
      updatedAt: now,
    };

    this.preferences.push(pref);
    this.savePreferences();
    return pref;
  }

  /**
   * Get a preference value.
   */
  get(category: PreferenceCategory, key: string): unknown | undefined {
    const pref = this.preferences.find((p) => p.category === category && p.key === key);
    if (pref) {
      pref.lastUsedAt = Date.now();
      this.savePreferences();
      return pref.value;
    }
    return undefined;
  }

  /**
   * Get a preference with type safety.
   */
  getTyped<T>(category: PreferenceCategory, key: string, defaultValue: T): T {
    const value = this.get(category, key);
    return value !== undefined ? (value as T) : defaultValue;
  }

  /**
   * Get all preferences for a category.
   */
  getByCategory(category: PreferenceCategory): Preference[] {
    return this.preferences.filter((p) => p.category === category);
  }

  /**
   * Get all preferences.
   */
  getAll(): Preference[] {
    return [...this.preferences];
  }

  /**
   * Delete a preference.
   */
  delete(category: PreferenceCategory, key: string): boolean {
    const index = this.preferences.findIndex((p) => p.category === category && p.key === key);
    if (index === -1) return false;
    this.preferences.splice(index, 1);
    this.savePreferences();
    return true;
  }

  /**
   * Record a correction (user said "that's wrong, I prefer X").
   */
  correct(category: PreferenceCategory, key: string, newValue: unknown): Preference {
    return this.set(category, key, newValue, "explicit");
  }

  // ─── Behavioral Signals ───────────────────────────────────────────────

  /**
   * Record a behavioral signal.
   */
  recordSignal(type: BehaviorSignal["type"], data: Record<string, unknown>): void {
    const signal: BehaviorSignal = {
      type,
      data,
      timestamp: Date.now(),
    };

    this.signals.push(signal);

    // Keep last 500 signals
    if (this.signals.length > 500) {
      this.signals = this.signals.slice(-500);
    }

    this.saveSignals();

    // Process signal for inference
    this.processSignal(signal);
  }

  /**
   * Record an accepted suggestion.
   */
  recordAccepted(suggestionType: string, context: Record<string, unknown>): void {
    this.recordSignal("accepted_suggestion", { type: suggestionType, ...context });
  }

  /**
   * Record a rejected suggestion.
   */
  recordRejected(suggestionType: string, context: Record<string, unknown>): void {
    this.recordSignal("rejected_suggestion", { type: suggestionType, ...context });
  }

  /**
   * Get behavior signals.
   */
  getSignals(limit = 100): BehaviorSignal[] {
    return this.signals.slice(-limit);
  }

  // ─── Profile ──────────────────────────────────────────────────────────

  /**
   * Get the full personalization profile.
   */
  getProfile(): { preferences: Preference[]; signalCount: number; lastUpdated: number } {
    return {
      preferences: [...this.preferences],
      signalCount: this.signals.length,
      lastUpdated: this.signals.length > 0 ? this.signals[this.signals.length - 1].timestamp : Date.now(),
    };
  }

  /**
   * Export preferences as JSON.
   */
  export(): string {
    return JSON.stringify({ preferences: this.preferences, signals: this.signals.slice(-100) }, null, 2);
  }

  /**
   * Import preferences from JSON.
   */
  import(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (data.preferences) {
        this.preferences = data.preferences;
        this.savePreferences();
      }
      if (data.signals) {
        this.signals = [...this.signals, ...data.signals].slice(-500);
        this.saveSignals();
      }
      return true;
    } catch {
      return false;
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private processSignal(signal: BehaviorSignal): void {
    // Infer preferences from behavioral patterns
    switch (signal.type) {
      case "accepted_suggestion": {
        // If user consistently accepts a suggestion type, increase confidence
        const type = signal.data.type as string;
        if (type) {
          this.set("general", `suggestion_accept_${type}`, true, "behavioral");
        }
        break;
      }

      case "rejected_suggestion": {
        // If user consistently rejects a suggestion type, learn to avoid
        const type = signal.data.type as string;
        if (type) {
          this.set("general", `suggestion_reject_${type}`, true, "behavioral");
        }
        break;
      }

      case "favorite_tool": {
        const tool = signal.data.tool as string;
        if (tool) {
          this.set("general", `favorite_tool_${tool}`, true, "behavioral");
        }
        break;
      }
    }
  }

  private loadPreferences(): Preference[] {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  }

  private savePreferences(): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.preferences));
    } catch { /* ignore */ }
  }

  private loadSignals(): BehaviorSignal[] {
    try {
      const raw = localStorage.getItem(SIGNALS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  }

  private saveSignals(): void {
    try {
      localStorage.setItem(SIGNALS_KEY, JSON.stringify(this.signals));
    } catch { /* ignore */ }
  }
}

export const personalizationEngine = new PersonalizationEngineImpl();
