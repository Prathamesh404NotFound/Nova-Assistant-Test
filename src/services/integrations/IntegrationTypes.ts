/**
 * Nova Integrations Layer — Types
 * System for managing connected accounts and third-party integrations.
 */

export type IntegrationCategory =
  | "email"
  | "calendar"
  | "storage"
  | "communication"
  | "ai"
  | "social"
  | "productivity"
  | "development";

export type IntegrationStatus = "connected" | "disconnected" | "error" | "expired" | "setup_required";

export interface IntegrationCapability {
  name: string;
  description: string;
  granted: boolean;
}

export interface Integration {
  id: string;
  name: string;
  provider: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  icon?: string;
  description?: string;
  email?: string;
  capabilities: IntegrationCapability[];
  lastSyncAt?: number;
  error?: string;
  setupUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface IntegrationEvent {
  id: string;
  integrationId: string;
  type: "connected" | "disconnected" | "error" | "sync" | "token_refreshed";
  message: string;
  timestamp: number;
}
