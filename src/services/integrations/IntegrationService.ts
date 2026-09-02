/**
 * Nova Integrations Layer — IntegrationService
 * Manages connected accounts, provider status, and integration events.
 */

import type { Integration, IntegrationCategory, IntegrationEvent, IntegrationStatus } from "./IntegrationTypes";

// ─── Storage ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "nova_integrations";
const EVENTS_KEY = "nova_integration_events";

function loadIntegrations(): Integration[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveIntegrations(integrations: Integration[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(integrations));
  } catch { /* ignore */ }
}

function loadEvents(): IntegrationEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveEvents(events: IntegrationEvent[]): void {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-200)));
  } catch { /* ignore */ }
}

// ─── Built-in Integrations ──────────────────────────────────────────────────

const BUILTIN_INTEGRATIONS: Omit<Integration, "id" | "status" | "createdAt" | "updatedAt">[] = [
  {
    name: "Gmail",
    provider: "gmail",
    category: "email",
    icon: "mail",
    description: "Read, compose, and send emails via Gmail",
    capabilities: [
      { name: "read", description: "Read emails", granted: false },
      { name: "compose", description: "Compose emails", granted: false },
      { name: "send", description: "Send emails", granted: false },
      { name: "search", description: "Search emails", granted: false },
      { name: "delete", description: "Delete emails", granted: false },
    ],
  },
  {
    name: "Google Calendar",
    provider: "google-calendar",
    category: "calendar",
    icon: "calendar",
    description: "Manage calendar events and schedules",
    capabilities: [
      { name: "read", description: "Read events", granted: false },
      { name: "write", description: "Create/edit events", granted: false },
      { name: "delete", description: "Delete events", granted: false },
    ],
  },
  {
    name: "Google Drive",
    provider: "google-drive",
    category: "storage",
    icon: "hard-drive",
    description: "Access and manage files in Google Drive",
    capabilities: [
      { name: "read", description: "Read files", granted: false },
      { name: "write", description: "Upload/create files", granted: false },
      { name: "search", description: "Search files", granted: false },
    ],
  },
  {
    name: "GitHub",
    provider: "github",
    category: "development",
    icon: "github",
    description: "Manage repositories, issues, and pull requests",
    capabilities: [
      { name: "read", description: "Read repos/issues", granted: false },
      { name: "write", description: "Create issues/PRs", granted: false },
    ],
  },
  {
    name: "Slack",
    provider: "slack",
    category: "communication",
    icon: "message-square",
    description: "Send and read Slack messages",
    capabilities: [
      { name: "read", description: "Read messages", granted: false },
      { name: "send", description: "Send messages", granted: false },
    ],
  },
  {
    name: "Discord",
    provider: "discord",
    category: "communication",
    icon: "gamepad-2",
    description: "Send and read Discord messages",
    capabilities: [
      { name: "read", description: "Read messages", granted: false },
      { name: "send", description: "Send messages", granted: false },
    ],
  },
];

// ─── Integration Service ────────────────────────────────────────────────────

class IntegrationServiceImpl {
  private integrations: Integration[] = [];
  private events: IntegrationEvent[] = [];

  constructor() {
    this.integrations = this.loadOrCreate();
    this.events = loadEvents();
  }

  /**
   * Load integrations from storage, merging with built-in definitions.
   */
  private loadOrCreate(): Integration[] {
    const stored = loadIntegrations();
    const now = Date.now();

    // Merge stored status with built-in definitions
    return BUILTIN_INTEGRATIONS.map((builtin) => {
      const existing = stored.find((s) => s.provider === builtin.provider);
      return {
        ...builtin,
        id: existing?.id || `${builtin.provider}_${now}`,
        status: existing?.status || "disconnected" as IntegrationStatus,
        email: existing?.email,
        capabilities: builtin.capabilities.map((cap) => ({
          ...cap,
          granted: existing?.capabilities?.find((c) => c.name === cap.name)?.granted || false,
        })),
        lastSyncAt: existing?.lastSyncAt,
        error: existing?.error,
        createdAt: existing?.createdAt || now,
        updatedAt: existing?.updatedAt || now,
      };
    });
  }

  /**
   * Get all integrations.
   */
  getAll(): Integration[] {
    return [...this.integrations];
  }

  /**
   * Get integrations by category.
   */
  getByCategory(category: IntegrationCategory): Integration[] {
    return this.integrations.filter((i) => i.category === category);
  }

  /**
   * Get a specific integration.
   */
  get(provider: string): Integration | undefined {
    return this.integrations.find((i) => i.provider === provider);
  }

  /**
   * Get connected integrations.
   */
  getConnected(): Integration[] {
    return this.integrations.filter((i) => i.status === "connected");
  }

  /**
   * Update integration status.
   */
  updateStatus(
    provider: string,
    status: IntegrationStatus,
    options?: { email?: string; error?: string; capabilities?: { name: string; granted: boolean }[] }
  ): void {
    const integration = this.integrations.find((i) => i.provider === provider);
    if (!integration) return;

    const now = Date.now();
    integration.status = status;
    integration.updatedAt = now;

    if (options?.email) integration.email = options.email;
    if (options?.error) integration.error = options.error;
    if (options?.capabilities) {
      integration.capabilities = integration.capabilities.map((cap) => ({
        ...cap,
        granted: options.capabilities?.find((c) => c.name === cap.name)?.granted ?? cap.granted,
      }));
    }

    if (status === "connected") {
      integration.lastSyncAt = now;
      integration.error = undefined;
    }

    saveIntegrations(this.integrations);
    this.logEvent(integration.id, status === "connected" ? "connected" : status === "disconnected" ? "disconnected" : "error", `${provider} → ${status}`);
  }

  /**
   * Disconnect an integration.
   */
  disconnect(provider: string): void {
    this.updateStatus(provider, "disconnected");
  }

  /**
   * Get recent events.
   */
  getEvents(limit = 20): IntegrationEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Log an integration event.
   */
  private logEvent(integrationId: string, type: IntegrationEvent["type"], message: string): void {
    const event: IntegrationEvent = {
      id: `evt_${Date.now()}_${crypto.randomUUID().substring(0, 6)}`,
      integrationId,
      type,
      message,
      timestamp: Date.now(),
    };

    this.events.push(event);
    saveEvents(this.events);
  }

  /**
   * Get summary stats.
   */
  getStats(): { total: number; connected: number; errors: number } {
    return {
      total: this.integrations.length,
      connected: this.integrations.filter((i) => i.status === "connected").length,
      errors: this.integrations.filter((i) => i.status === "error").length,
    };
  }
}

export const integrationService = new IntegrationServiceImpl();
