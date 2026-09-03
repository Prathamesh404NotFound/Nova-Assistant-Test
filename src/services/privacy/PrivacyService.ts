/**
 * Nova Privacy Service — Data Transparency & User Control
 * Shows what Nova stores, what it sends to cloud, permissions granted,
 * and provides revocation and deletion.
 */

import { securityLayer } from "../security/SecurityLayer";
import type { PermissionCapability } from "../security/SecurityTypes";
import { healthMonitor } from "../supervisor/NovaSupervisor";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PrivacyReport {
  generatedAt: number;
  dataStorage: DataStorageSummary;
  cloudConnections: CloudConnectionSummary[];
  permissions: PermissionSummary[];
  integrations: IntegrationSummary[];
  dataExport: () => Promise<Blob>;
  dataDelete: (categories: string[]) => Promise<{ deleted: string[]; errors: string[] }>;
}

export interface DataStorageSummary {
  totalKeys: number;
  estimatedSizeKB: number;
  categories: Array<{
    name: string;
    keys: string[];
    sizeEstimateKB: number;
    description: string;
  }>;
}

export interface CloudConnectionSummary {
  service: string;
  connected: boolean;
  lastSync?: number;
  dataSent: string;
  purpose: string;
}

export interface PermissionSummary {
  capability: string;
  granted: boolean;
  grantType?: string;
  grantedAt?: number;
  canRevoke: boolean;
}

export interface IntegrationSummary {
  name: string;
  status: "connected" | "disconnected" | "error" | "auth_required";
  permissions: string[];
  lastActivity?: number;
}

// ─── Privacy Categories ──────────────────────────────────────────────────────

const STORAGE_CATEGORIES: Array<{ name: string; keyPattern: RegExp; description: string }> = [
  { name: "Memory", keyPattern: /^nova_(memory|working_memory|short_term)/, description: "Conversational memory, preferences, and learned facts" },
  { name: "Tasks", keyPattern: /^nova_(task|todo)/, description: "User tasks and to-do items" },
  { name: "Calendar", keyPattern: /^nova_calendar/, description: "Calendar events and schedules" },
  { name: "Settings", keyPattern: /^nova_(settings|theme|voice|ai_mode)/, description: "App settings, preferences, and configuration" },
  { name: "Missions", keyPattern: /^nova_mission/, description: "Mission history and active missions" },
  { name: "Automations", keyPattern: /^nova_automation/, description: "User-created automations and workflows" },
  { name: "Scheduler", keyPattern: /^nova_scheduler/, description: "Scheduled jobs and reminders" },
  { name: "Security", keyPattern: /^nova_security/, description: "Permission grants and security settings" },
  { name: "Integrations", keyPattern: /^nova_integration/, description: "Connected service tokens and sync state" },
  { name: "Browser", keyPattern: /^nova_browser/, description: "Browser sessions and history" },
  { name: "Personalization", keyPattern: /^nova_personalization/, description: "Learned preferences and behavior profiles" },
  { name: "Email", keyPattern: /^nova_email/, description: "Email drafts and metadata" },
  { name: "Other", keyPattern: /.*/, description: "Other application data" },
];

const CLOUD_SERVICES: Array<{ service: string; purpose: string; dataSent: string }> = [
  { service: "Gemini API", purpose: "AI inference (text generation, function calling)", dataSent: "User prompts, tool results, conversation context" },
  { service: "DuckDuckGo", purpose: "Web search", dataSent: "Search queries only" },
  { service: "Desktop Bridge", purpose: "Local device control", dataSent: "Commands stay on localhost (not external)" },
  { service: "Hugging Face (Bark)", purpose: "Local text-to-speech", dataSent: "Text stays local (model runs locally)" },
];

// ─── Privacy Service ─────────────────────────────────────────────────────────

class PrivacyServiceImpl {
  /**
   * Generate a complete privacy report.
   */
  getReport(): PrivacyReport {
    return {
      generatedAt: Date.now(),
      dataStorage: this.getDataStorageSummary(),
      cloudConnections: this.getCloudConnections(),
      permissions: this.getPermissionSummaries(),
      integrations: this.getIntegrationSummaries(),
      dataExport: () => this.exportAllData(),
      dataDelete: (categories) => this.deleteData(categories),
    };
  }

  /**
   * Analyze localStorage to show what data Nova stores.
   */
  getDataStorageSummary(): DataStorageSummary {
    const categories = STORAGE_CATEGORIES.map((cat) => {
      const keys: string[] = [];
      let sizeEstimateKB = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && cat.keyPattern.test(key)) {
          keys.push(key);
          const value = localStorage.getItem(key) || "";
          sizeEstimateKB += (key.length + value.length) * 2 / 1024; // UTF-16
        }
      }
      return { name: cat.name, keys, sizeEstimateKB: Math.round(sizeEstimateKB * 10) / 10, description: cat.description };
    }).filter((c) => c.keys.length > 0);

    return {
      totalKeys: categories.reduce((sum, c) => sum + c.keys.length, 0),
      estimatedSizeKB: Math.round(categories.reduce((sum, c) => sum + c.sizeEstimateKB, 0) * 10) / 10,
      categories,
    };
  }

  /**
   * List all external cloud connections and what data they receive.
   */
  getCloudConnections(): CloudConnectionSummary[] {
    return CLOUD_SERVICES.map((s) => ({
      service: s.service,
      connected: this.checkConnected(s.service),
      purpose: s.purpose,
      dataSent: s.dataSent,
    }));
  }

  /**
   * List all granted permissions.
   */
  getPermissionSummaries(): PermissionSummary[] {
    const allCapabilities: PermissionCapability[] = [
      "memory.read", "memory.write", "calendar.read", "calendar.write",
      "task.read", "task.write", "email.read", "email.send",
      "browser.read", "browser.act", "file.read", "file.write",
      "screen.read", "screen.capture", "desktop.control",
      "device.control", "network.access", "notification.send",
      "automation.execute", "voice.control", "ai.infer",
    ];
    const activePermissions = securityLayer.getActivePermissions();
    const grantedCaps = new Set(activePermissions.map((p) => p.capability));

    return allCapabilities.map((cap) => {
      const active = activePermissions.find((p) => p.capability === cap);
      return {
        capability: cap,
        granted: grantedCaps.has(cap),
        grantType: active?.grants[0]?.grantType,
        grantedAt: active?.grants[0]?.grantedAt,
        canRevoke: grantedCaps.has(cap),
      };
    });
  }

  /**
   * Get connected integration status.
   */
  getIntegrationSummaries(): IntegrationSummary[] {
    try {
      const stored = localStorage.getItem("nova_integrations");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch { /* ignore */ }
    return [];
  }

  /**
   * Export all Nova data as a JSON blob.
   */
  async exportAllData(): Promise<Blob> {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("nova_")) {
        try {
          data[key] = JSON.parse(localStorage.getItem(key) || "null");
        } catch {
          data[key] = localStorage.getItem(key);
        }
      }
    }
    return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  }

  /**
   * Delete data by category.
   */
  async deleteData(categories: string[]): Promise<{ deleted: string[]; errors: string[] }> {
    const deleted: string[] = [];
    const errors: string[] = [];

    for (const catName of categories) {
      const cat = STORAGE_CATEGORIES.find((c) => c.name === catName);
      if (!cat) {
        errors.push(`Unknown category: ${catName}`);
        continue;
      }
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && cat.keyPattern.test(key)) {
          try {
            localStorage.removeItem(key);
            deleted.push(key);
          } catch (e) {
            errors.push(`Failed to delete ${key}: ${e}`);
          }
        }
      }
    }

    return { deleted, errors };
  }

  /**
   * Delete ALL Nova data.
   */
  async deleteAllData(): Promise<{ deleted: number; errors: string[] }> {
    let count = 0;
    const errors: string[] = [];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith("nova_")) {
        try {
          localStorage.removeItem(key);
          count++;
        } catch (e) {
          errors.push(`Failed to delete ${key}: ${e}`);
        }
      }
    }
    return { deleted: count, errors };
  }

  private checkConnected(service: string): boolean {
    switch (service) {
      case "Gemini API":
        return !!(import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem("nova_gemini_key"));
      case "Desktop Bridge":
        return navigator.userAgent.includes("Electron");
      default:
        return false;
    }
  }
}

export const privacyService = new PrivacyServiceImpl();
