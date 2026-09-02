/**
 * Nova Notification Service — Types
 */

export type NotificationChannel = "in_app" | "desktop" | "push" | "voice";

export interface NovaNotification {
  id: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  icon?: string;
  actionLabel?: string;
  actionPayload?: unknown;
  silent: boolean;
  createdAt: number;
  read: boolean;
  dismissed: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  channels: NotificationChannel[];
  quietHoursStart: number; // hour 0-23
  quietHoursEnd: number;
  focusModeBlock: boolean;
  minPriority: "critical" | "high" | "medium" | "low";
}
