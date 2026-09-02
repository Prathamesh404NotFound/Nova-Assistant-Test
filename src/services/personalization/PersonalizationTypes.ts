/**
 * Nova Personalization Engine — Types
 * Learns from user preferences and behavior.
 */

export type PreferenceCategory =
  | "response_style"
  | "scheduling"
  | "notifications"
  | "voice"
  | "calendar"
  | "email"
  | "ui"
  | "privacy"
  | "general";

export interface Preference {
  id: string;
  category: PreferenceCategory;
  key: string;
  value: unknown;
  confidence: number; // 0-1
  source: "explicit" | "inferred" | "behavioral";
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

export interface BehaviorSignal {
  type: "accepted_suggestion" | "rejected_suggestion" | "correction" | "favorite_tool" | "scheduling_pattern";
  data: Record<string, unknown>;
  timestamp: number;
}

export interface PersonalizationProfile {
  preferences: Preference[];
  signals: BehaviorSignal[];
  lastUpdated: number;
}
