/**
 * Nova World State — Types
 * Permission-aware context tracking for the entire system.
 */

export interface WorldState {
  timestamp: number;
  time: TimeContext;
  network: NetworkContext;
  battery: BatteryContext;
  activeApp: AppContext;
  screen: ScreenContext;
  calendar: CalendarContext;
  tasks: TaskContext;
  email: EmailContext;
  missions: MissionContext;
  notifications: NotificationContext;
  integrations: IntegrationContext;
  focus: FocusContext;
}

export interface TimeContext {
  now: Date;
  hour: number;
  minute: number;
  dayOfWeek: string;
  isWeekend: boolean;
  timezone: string;
  isQuietHours: boolean;
  isFocusMode: boolean;
}

export interface NetworkContext {
  online: boolean;
  type: "wifi" | "cellular" | "ethernet" | "none" | "unknown";
  effectiveType?: string;
}

export interface BatteryContext {
  level: number; // 0-1
  charging: boolean;
  chargingTime?: number;
  dischargingTime?: number;
}

export interface AppContext {
  name: string;
  title: string;
  url?: string;
  isNova: boolean;
}

export interface ScreenContext {
  width: number;
  height: number;
  isActive: boolean;
  lastInteraction: number;
}

export interface CalendarContext {
  nextEvent: CalendarEvent | null;
  todayEventCount: number;
  freeMinutesUntilNext: number;
  hasConflicts: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  location?: string;
  attendees?: string[];
}

export interface TaskContext {
  pendingCount: number;
  overdueCount: number;
  completedToday: number;
  nextTask: { id: string; title: string; dueAt?: number } | null;
}

export interface EmailContext {
  unreadCount: number;
  importantCount: number;
  lastReceivedAt: number | null;
}

export interface MissionContext {
  activeCount: number;
  pausedCount: number;
  failedCount: number;
  nextMission: { id: string; name: string; status: string } | null;
}

export interface NotificationContext {
  unreadCount: number;
  lastNotificationAt: number | null;
  suppressedCount: number;
}

export interface IntegrationContext {
  connected: number;
  errors: number;
  expired: number;
}

export interface FocusContext {
  isActive: boolean;
  mode: "none" | "work" | "personal" | "meeting" | "deep";
  startedAt: number | null;
  allowedNotifications: string[];
}
