/**
 * Nova Environment Layer — Tool registration.
 * Registers environment tools so Nova can observe and control the user's
 * computing environment through NovaCore: permission-gated, risk-levelled,
 * and verified. Existing desktop/screen tools are reused; this adds system
 * status, safe file operations, notifications, and capability introspection.
 */

import { toolRegistry } from "@/services/agent/ToolRegistry";
import type { NovaTool, ToolResult } from "@/services/agent/types";
import { environmentService } from "./EnvironmentService";

function ok(tool: string, data?: unknown, message?: string): ToolResult {
  return { success: true, tool, data, message };
}

function fail(tool: string, code: string, message: string): ToolResult {
  return { success: false, tool, error: { code, message } };
}

// ─── System status ───────────────────────────────────────────────────────────

const systemStatusTool: NovaTool = {
  name: "system.status",
  description: "Get system status: OS, browser, CPU cores, memory, battery, network, uptime.",
  category: "system",
  inputSchema: { properties: {} },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async () => {
    const [status, summary] = await Promise.all([
      environmentService.systemStatus(),
      environmentService.systemSummary(),
    ]);
    return ok("system.status", status, summary);
  },
};

const systemCapabilitiesTool: NovaTool = {
  name: "system.capabilities",
  description: "Report which environment capabilities are available in this runtime and which are unsupported.",
  category: "system",
  inputSchema: { properties: {} },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async () => {
    const caps = await environmentService.capabilities();
    const message = caps.desktopBridge
      ? `Desktop bridge connected. Full desktop control available. Unsupported: ${caps.unsupportedInBrowser.length || "none"}.`
      : `Browser-only session — desktop control needs the Nova desktop bridge. Unavailable here: ${caps.unsupportedInBrowser.join("; ")}.`;
    return ok("system.capabilities", caps, message);
  },
};

// ─── Notifications ───────────────────────────────────────────────────────────

const notifySendTool: NovaTool = {
  name: "notify.send",
  description: "Notify the user (in-app notification). Use when a task completes, an automation fires, or a meeting approaches.",
  category: "notifications",
  inputSchema: {
    properties: {
      title: { type: "string", description: "Notification title", required: true },
      body: { type: "string", description: "Notification body", required: true },
      priority: { type: "string", description: "Priority: critical, high, medium, low" },
    },
    required: ["title", "body"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const priority = (args.priority as "critical" | "high" | "medium" | "low") || "medium";
    const sent = environmentService.system.notifyUser(
      args.title as string,
      args.body as string,
      priority
    );
    if (!sent) {
      return fail("notify.send", "SUPPRESSED", "Notification was suppressed by the user's notification settings (quiet hours, focus mode, or threshold).");
    }
    return ok("notify.send", null, `Notified: ${args.title}`);
  },
};

// ─── Safe file operations (app-scoped store) ─────────────────────────────────

const fileCreateTool: NovaTool = {
  name: "files.create",
  description: "Create a file in Nova's app-scoped file store. Allowed types: txt, md, json, csv, html, css, js, ts, py, log, yaml, yml, xml, svg.",
  category: "files",
  inputSchema: {
    properties: {
      name: { type: "string", description: "File name with extension, e.g. meeting-notes.txt", required: true },
      content: { type: "string", description: "File content", required: true },
    },
    required: ["name", "content"],
  },
  riskLevel: "low",
  confirmationRequired: false,
  execute: async (args) => {
    const result = environmentService.files.create(args.name as string, args.content as string);
    if (!result.success) return fail("files.create", "REJECTED", result.error ?? "File creation failed.");
    return ok("files.create", result.data, result.message);
  },
};

const fileReadTool: NovaTool = {
  name: "files.read",
  description: "Read a file from Nova's app-scoped file store by name.",
  category: "files",
  inputSchema: {
    properties: { name: { type: "string", description: "File name", required: true } },
    required: ["name"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const result = environmentService.files.read(args.name as string);
    if (!result.success) return fail("files.read", "NOT_FOUND", result.error ?? "File not found.");
    return ok("files.read", result.data, result.message);
  },
};

const fileRenameTool: NovaTool = {
  name: "files.rename",
  description: "Rename a file in Nova's app-scoped file store.",
  category: "files",
  inputSchema: {
    properties: {
      from: { type: "string", description: "Current file name", required: true },
      to: { type: "string", description: "New file name", required: true },
    },
    required: ["from", "to"],
  },
  riskLevel: "low",
  confirmationRequired: false,
  execute: async (args) => {
    const result = environmentService.files.rename(args.from as string, args.to as string);
    if (!result.success) return fail("files.rename", "REJECTED", result.error ?? "Rename failed.");
    return ok("files.rename", result.data, result.message);
  },
};

const fileCopyTool: NovaTool = {
  name: "files.copy",
  description: "Copy a file to a new name in Nova's app-scoped file store.",
  category: "files",
  inputSchema: {
    properties: {
      from: { type: "string", description: "Source file name", required: true },
      to: { type: "string", description: "Target file name", required: true },
    },
    required: ["from", "to"],
  },
  riskLevel: "low",
  confirmationRequired: false,
  execute: async (args) => {
    const result = environmentService.files.copy(args.from as string, args.to as string);
    if (!result.success) return fail("files.copy", "REJECTED", result.error ?? "Copy failed.");
    return ok("files.copy", result.data, result.message);
  },
};

// ─── Environment tool registration ───────────────────────────────────────────

let registered = false;

export function registerEnvironmentTools(): void {
  if (registered) return;
  registered = true;

  toolRegistry.register(systemStatusTool);
  toolRegistry.register(systemCapabilitiesTool);
  toolRegistry.register(notifySendTool);
  toolRegistry.register(fileCreateTool);
  toolRegistry.register(fileReadTool);
  toolRegistry.register(fileRenameTool);
  toolRegistry.register(fileCopyTool);
}
