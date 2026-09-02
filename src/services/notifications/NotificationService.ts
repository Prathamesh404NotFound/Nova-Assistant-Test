/**
 * Nova Notification Service — NotificationService
 * Delivers notifications through multiple channels with quiet hours and focus mode.
 */

import type { NovaNotification, NotificationChannel, NotificationSettings } from "./NotificationTypes";

// ─── Storage ────────────────────────────────────────────────────────────────

const NOTIFICATIONS_KEY = "nova_notifications";
const SETTINGS_KEY = "nova_notification_settings";

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  channels: ["in_app"],
  quietHoursStart: 23,
  quietHoursEnd: 7,
  focusModeBlock: true,
  minPriority: "low",
};

// ─── Notification Service ───────────────────────────────────────────────────

class NotificationServiceImpl {
  private notifications: NovaNotification[] = [];
  private settings: NotificationSettings;
  private listeners: ((n: NovaNotification) => void)[] = [];

  constructor() {
    this.settings = this.loadSettings();
    this.notifications = this.loadNotifications();
  }

  /**
   * Send a notification through available channels.
   */
  send(notification: Omit<NovaNotification, "id" | "createdAt" | "read" | "dismissed">): NovaNotification | null {
    if (!this.settings.enabled) return null;

    // Check quiet hours
    if (this.isQuietHours() && notification.priority !== "critical") {
      return null;
    }

    // Check focus mode
    if (this.isFocusMode() && this.settings.focusModeBlock && notification.priority !== "critical") {
      return null;
    }

    // Check priority threshold
    if (!this.meetsPriorityThreshold(notification.priority)) {
      return null;
    }

    const fullNotification: NovaNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      createdAt: Date.now(),
      read: false,
      dismissed: false,
    };

    // Store
    this.notifications.push(fullNotification);
    this.saveNotifications();

    // Deliver through channels
    this.deliver(fullNotification);

    // Notify listeners
    for (const listener of this.listeners) {
      try { listener(fullNotification); } catch { /* ignore */ }
    }

    return fullNotification;
  }

  /**
   * Get all notifications.
   */
  getAll(): NovaNotification[] {
    return [...this.notifications].sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get unread notifications.
   */
  getUnread(): NovaNotification[] {
    return this.notifications.filter((n) => !n.read && !n.dismissed);
  }

  /**
   * Get unread count.
   */
  getUnreadCount(): number {
    return this.getUnread().length;
  }

  /**
   * Mark a notification as read.
   */
  markRead(notificationId: string): void {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (notif) {
      notif.read = true;
      this.saveNotifications();
    }
  }

  /**
   * Dismiss a notification.
   */
  dismiss(notificationId: string): void {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (notif) {
      notif.dismissed = true;
      notif.read = true;
      this.saveNotifications();
    }
  }

  /**
   * Mark all as read.
   */
  markAllRead(): void {
    for (const n of this.notifications) {
      n.read = true;
    }
    this.saveNotifications();
  }

  /**
   * Subscribe to new notifications.
   */
  onNotification(listener: (n: NovaNotification) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Update settings.
   */
  updateSettings(partial: Partial<NotificationSettings>): void {
    this.settings = { ...this.settings, ...partial };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  /**
   * Get settings.
   */
  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  /**
   * Clean old notifications.
   */
  cleanup(maxAge = 604800000): void { // 7 days
    const cutoff = Date.now() - maxAge;
    this.notifications = this.notifications.filter((n) => n.createdAt > cutoff);
    this.saveNotifications();
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private deliver(notification: NovaNotification): void {
    for (const channel of this.settings.channels) {
      this.deliverToChannel(notification, channel);
    }
  }

  private deliverToChannel(notification: NovaNotification, channel: NotificationChannel): void {
    switch (channel) {
      case "in_app":
        // Already stored and emitted to listeners
        break;

      case "desktop":
        this.deliverDesktop(notification);
        break;

      case "voice":
        // Voice delivery would go through TTS service
        break;
    }
  }

  private deliverDesktop(notification: NovaNotification): void {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      new Notification(notification.title, {
        body: notification.body,
        icon: notification.icon,
        silent: notification.silent,
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(notification.title, {
            body: notification.body,
            icon: notification.icon,
            silent: notification.silent,
          });
        }
      });
    }
  }

  private isQuietHours(): boolean {
    const hour = new Date().getHours();
    const { quietHoursStart, quietHoursEnd } = this.settings;
    if (quietHoursStart > quietHoursEnd) {
      return hour >= quietHoursStart || hour < quietHoursEnd;
    }
    return hour >= quietHoursStart && hour < quietHoursEnd;
  }

  private isFocusMode(): boolean {
    try {
      const raw = localStorage.getItem("nova_focus_mode");
      if (raw) {
        const focus = JSON.parse(raw);
        return focus.isActive || false;
      }
    } catch { /* ignore */ }
    return false;
  }

  private meetsPriorityThreshold(priority: string): boolean {
    const levels = ["low", "medium", "high", "critical"];
    const minIndex = levels.indexOf(this.settings.minPriority);
    const notifIndex = levels.indexOf(priority);
    return notifIndex >= minIndex;
  }

  private loadSettings(): NotificationSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULT_SETTINGS };
  }

  private loadNotifications(): NovaNotification[] {
    try {
      const raw = localStorage.getItem(NOTIFICATIONS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  }

  private saveNotifications(): void {
    try {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(this.notifications.slice(-500)));
    } catch { /* ignore */ }
  }
}

export const notificationService = new NotificationServiceImpl();
