/**
 * Nova Specialist Agents — Types and Definitions
 * Each specialist has its own tool permissions, model preference, and constraints.
 */

import type { ToolCategory } from "../agent/types";
import type { PermissionCapability } from "../security/SecurityTypes";
import type { RiskLevel } from "../security/SecurityTypes";

// ─── Specialist Agent Definition ─────────────────────────────────────────────

export type SpecialistName =
  | "research"
  | "coding"
  | "computer"
  | "calendar"
  | "communication"
  | "memory"
  | "file"
  | "automation";

export interface SpecialistAgent {
  name: SpecialistName;
  displayName: string;
  description: string;
  /** Tools this specialist is allowed to use */
  allowedTools: string[];
  /** Tool categories this specialist can access */
  allowedCategories: ToolCategory[];
  /** Minimum permission capabilities */
  requiredPermissions: PermissionCapability[];
  /** Maximum risk level this specialist can operate at without confirmation */
  maxRiskWithoutConfirmation: RiskLevel;
  /** Model preference: "cloud", "local", or "auto" */
  modelPreference: "cloud" | "local" | "auto";
  /** Special constraints */
  constraints: {
    requiresConfirmationFor: string[];  // tool names requiring user approval
    canAccessExternal: boolean;         // can make network requests
    canModifyData: boolean;             // can write/create/delete
    maxConcurrentTools: number;         // max parallel tool calls
    timeoutMs: number;                  // execution timeout
  };
}

// ─── Specialist Handoff ──────────────────────────────────────────────────────

export interface HandoffRequest {
  from: SpecialistName | "orchestrator";
  to: SpecialistName;
  reason: string;
  userInput: string;
  context: Record<string, unknown>;
  missionId?: string;
}

export interface HandoffResult {
  success: boolean;
  result: string;
  actionsExecuted: Array<{ tool: string; success: boolean; result?: unknown }>;
  nextSpecialist?: SpecialistName; // chain to another specialist
}

// ─── Specialist Registry ─────────────────────────────────────────────────────

export const SPECIALIST_DEFINITIONS: Record<SpecialistName, SpecialistAgent> = {
  research: {
    name: "research",
    displayName: "Research Agent",
    description: "Web search, content extraction, analysis, and knowledge synthesis",
    allowedTools: [
      "search.web", "search.news",
      "browser.open", "browser.extract", "browser.find", "browser.observe",
      "browser.summarize", "browser.navigate", "browser.back", "browser.forward",
      "memory.save", "memory.search",
    ],
    allowedCategories: ["browser", "search"],
    requiredPermissions: ["browser.read", "network.access"],
    maxRiskWithoutConfirmation: "medium",
    modelPreference: "cloud",
    constraints: {
      requiresConfirmationFor: [],
      canAccessExternal: true,
      canModifyData: true,
      maxConcurrentTools: 3,
      timeoutMs: 60_000,
    },
  },

  coding: {
    name: "coding",
    displayName: "Coding Agent",
    description: "Code generation, analysis, debugging, and file operations",
    allowedTools: [
      "file.read", "file.write", "file.list", "file.search",
      "memory.save", "memory.search",
    ],
    allowedCategories: ["files"],
    requiredPermissions: ["file.read", "file.write"],
    maxRiskWithoutConfirmation: "low",
    modelPreference: "cloud",
    constraints: {
      requiresConfirmationFor: ["file.write", "file.delete"],
      canAccessExternal: false,
      canModifyData: true,
      maxConcurrentTools: 2,
      timeoutMs: 30_000,
    },
  },

  computer: {
    name: "computer",
    displayName: "Computer Agent",
    description: "Desktop control, screen perception, mouse, keyboard, and application management",
    allowedTools: [
      "desktop.click", "desktop.doubleClick", "desktop.rightClick",
      "desktop.type", "desktop.press", "desktop.hotkey",
      "desktop.scroll", "desktop.move",
      "desktop.focusWindow", "desktop.listWindows", "desktop.switchWindow",
      "desktop.getActiveWindow", "desktop.launchApp", "desktop.closeApp",
      "desktop.minimizeWindow", "desktop.maximizeWindow",
      "screen.capture", "screen.current", "screen.read",
      "screen.describe", "screen.findText", "screen.findElement",
      "clipboard.read", "clipboard.write", "clipboard.clear",
    ],
    allowedCategories: ["desktop", "perception"],
    requiredPermissions: ["desktop.control", "screen.read"],
    maxRiskWithoutConfirmation: "low",
    modelPreference: "cloud",
    constraints: {
      requiresConfirmationFor: ["desktop.type", "desktop.hotkey", "desktop.launchApp", "desktop.closeApp"],
      canAccessExternal: false,
      canModifyData: true,
      maxConcurrentTools: 1,
      timeoutMs: 15_000,
    },
  },

  calendar: {
    name: "calendar",
    displayName: "Calendar Agent",
    description: "Calendar management, scheduling, availability checks, and event coordination",
    allowedTools: [
      "calendar.create", "calendar.list", "calendar.search",
      "calendar.delete", "calendar.update",
      "memory.search", "memory.save",
    ],
    allowedCategories: ["calendar"],
    requiredPermissions: ["calendar.read", "calendar.write"],
    maxRiskWithoutConfirmation: "medium",
    modelPreference: "auto",
    constraints: {
      requiresConfirmationFor: ["calendar.delete"],
      canAccessExternal: true,
      canModifyData: true,
      maxConcurrentTools: 2,
      timeoutMs: 15_000,
    },
  },

  communication: {
    name: "communication",
    displayName: "Communication Agent",
    description: "Email drafting, sending, reply, and contact resolution",
    allowedTools: [
      "email.draft", "email.send", "email.read", "email.search",
      "email.list", "email.reply", "email.forward",
      "memory.search", "memory.save",
    ],
    allowedCategories: ["email"],
    requiredPermissions: ["email.read", "email.send"],
    maxRiskWithoutConfirmation: "low",
    modelPreference: "cloud",
    constraints: {
      requiresConfirmationFor: ["email.send", "email.forward"],
      canAccessExternal: true,
      canModifyData: true,
      maxConcurrentTools: 1,
      timeoutMs: 20_000,
    },
  },

  memory: {
    name: "memory",
    displayName: "Memory Agent",
    description: "Long-term memory management, search, correction, and recall",
    allowedTools: [
      "memory.save", "memory.search", "memory.list",
      "memory.delete", "memory.correct", "memory.promote", "memory.archive",
    ],
    allowedCategories: ["memory"],
    requiredPermissions: ["memory.read", "memory.write"],
    maxRiskWithoutConfirmation: "low",
    modelPreference: "auto",
    constraints: {
      requiresConfirmationFor: ["memory.delete", "memory.archive"],
      canAccessExternal: false,
      canModifyData: true,
      maxConcurrentTools: 1,
      timeoutMs: 10_000,
    },
  },

  file: {
    name: "file",
    displayName: "File Agent",
    description: "File system operations, search, and organization",
    allowedTools: [
      "file.read", "file.write", "file.list", "file.search",
      "file.delete", "file.copy", "file.move",
    ],
    allowedCategories: ["files"],
    requiredPermissions: ["file.read", "file.write"],
    maxRiskWithoutConfirmation: "low",
    modelPreference: "auto",
    constraints: {
      requiresConfirmationFor: ["file.delete", "file.write", "file.move"],
      canAccessExternal: false,
      canModifyData: true,
      maxConcurrentTools: 2,
      timeoutMs: 15_000,
    },
  },

  automation: {
    name: "automation",
    displayName: "Automation Agent",
    description: "Workflow creation, automation management, and scheduled tasks",
    allowedTools: [
      "automation.create", "automation.list", "automation.delete",
      "automation.run",
      "memory.search", "memory.save",
    ],
    allowedCategories: ["automation"],
    requiredPermissions: ["automation.execute"],
    maxRiskWithoutConfirmation: "medium",
    modelPreference: "auto",
    constraints: {
      requiresConfirmationFor: ["automation.create"],
      canAccessExternal: false,
      canModifyData: true,
      maxConcurrentTools: 1,
      timeoutMs: 20_000,
    },
  },
};
