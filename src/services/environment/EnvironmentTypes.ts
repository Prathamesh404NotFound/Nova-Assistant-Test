/**
 * Nova Environment Layer — Types
 * Permissioned, observable, reversible computer-control primitives.
 * The environment layer NEVER grants shell/process execution; every capability
 * is an explicit, allowlisted action with a risk level and verification.
 */

import type { RiskLevel } from "@/services/agent/types";

// ─── Environment Events ──────────────────────────────────────────────────────

export type EnvironmentEventType =
  | "screen.changed"
  | "app.opened"
  | "app.closed"
  | "network.changed"
  | "battery.changed"
  | "file.created"
  | "file.modified"
  | "file.downloaded";

export interface EnvironmentEvent {
  type: EnvironmentEventType;
  timestamp: number;
  detail: Record<string, unknown>;
}

// ─── Action Safety ───────────────────────────────────────────────────────────

export interface EnvironmentActionSafety {
  risk: RiskLevel;
  permission: string;
  confirmationRequired: boolean;
  reversible: boolean;
}

// ─── Runtime Capabilities ────────────────────────────────────────────────────

/**
 * What the actual runtime can do. A browser-only deployment reports
 * `desktopBridge: false` — tools must report this limitation instead of
 * pretending an action succeeded.
 */
export interface EnvironmentCapabilities {
  desktopBridge: boolean;
  screenshot: boolean;
  screenVision: boolean;
  clipboard: boolean;
  battery: boolean;
  networkInfo: boolean;
  fileSystem: boolean; // app-scoped file store (not arbitrary FS)
  notifications: boolean;
  unsupportedInBrowser: string[];
}

// ─── System Status ───────────────────────────────────────────────────────────

export interface SystemStatus {
  os: string;
  browser: string;
  platform: string;
  cpuCores: number;
  memory: {
    deviceMemoryGB: number | null;
    heapUsedMB: number | null;
    heapLimitMB: number | null;
  };
  disk: { available: boolean; note: string };
  battery: {
    supported: boolean;
    level: number | null; // 0..1
    charging: boolean | null;
  };
  network: {
    online: boolean;
    effectiveType: string | null;
    downlinkMbps: number | null;
    rttMs: number | null;
  };
  uptimeMs: number;
}

// ─── Screen Understanding ────────────────────────────────────────────────────

export interface ScreenUnderstanding {
  capturedAt: number;
  description: string;
  elements: Array<{
    kind: "text" | "button" | "window" | "dialog" | "chart" | "image" | "error" | "link";
    label: string;
    location?: { x: number; y: number };
  }>;
  ocrText: string;
  confidence: number;
  error?: string;
}

// ─── File System (app-scoped, safe) ─────────────────────────────────────────

export interface EnvFile {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
}

export interface EnvActionResult<T = unknown> {
  success: boolean;
  verified: boolean;
  data?: T;
  message: string;
  error?: string;
  risk: RiskLevel;
}
