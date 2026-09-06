/**
 * Nova Agent Architecture — Tool Registration
 * Registers all real tools backed by actual services.
 * Called once at app startup.
 */

import { toolRegistry } from "./ToolRegistry";
import type { NovaTool, ToolContext, ToolResult } from "./types";
import { memoryService } from "../memory/MemoryService";
import { calendarService } from "../calendar/CalendarService";
import { taskService } from "../tasks/TaskService";
import { computerService } from "../computer/ComputerService";
import { perceptionService } from "../perception/PerceptionService";
import { searchService } from "../web/SearchService";
import { browserService } from "../web/BrowserService";
import { emailService } from "../email/EmailService";
import {
  logActivity,
  addEmailDraft,
  getEmailDrafts,
  updateEmailDraft,
  deleteEmailDraft,
  getFiles,
  deleteFile,
  getSmartDevices,
  updateSmartDevice,
} from "@/lib/local-store";

// ─── Helper ──────────────────────────────────────────────────────────────────

function ok(tool: string, data?: unknown, message?: string): ToolResult {
  return { success: true, tool, data, message };
}

function fail(tool: string, code: string, message: string, retryable = false): ToolResult {
  return { success: false, tool, error: { code, message, retryable } };
}

// ─── Memory Tools ────────────────────────────────────────────────────────────

const memorySaveTool: NovaTool = {
  name: "memory.save",
  description: "Save a new memory or preference",
  category: "memory",
  inputSchema: {
    properties: {
      content: { type: "string", description: "Memory content to save", required: true },
      tags: { type: "string", description: "Comma-separated tags" },
      category: { type: "string", description: "Category: preference, fact, context, note" },
    },
    required: ["content"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const memory = await memoryService.save({
      content: args.content as string,
    });
    logActivity("memory", `Saved memory: ${(args.content as string).slice(0, 50)}`, "brain");
    return ok("memory.save", memory, `Memory saved: ${(args.content as string).slice(0, 80)}`);
  },
};

const memorySearchTool: NovaTool = {
  name: "memory.search",
  description: "Search memories by query",
  category: "memory",
  inputSchema: {
    properties: {
      query: { type: "string", description: "Search query", required: true },
    },
    required: ["query"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const results = await memoryService.search({ query: args.query as string });
    return ok("memory.search", results, `Found ${results.length} matching memories`);
  },
};

const memoryListTool: NovaTool = {
  name: "memory.list",
  description: "List all saved memories",
  category: "memory",
  inputSchema: { properties: {} },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async () => {
    const memories = await memoryService.list();
    return ok("memory.list", memories, `You have ${memories.length} saved memories`);
  },
};

const memoryDeleteTool: NovaTool = {
  name: "memory.delete",
  description: "Delete a memory by id",
  category: "memory",
  inputSchema: {
    properties: {
      id: { type: "string", description: "Memory id to delete", required: true },
    },
    required: ["id"],
  },
  riskLevel: "medium",
  confirmationRequired: true,
  execute: async (args) => {
    const deleted = memoryService.delete(args.id as string);
    if (deleted) {
      logActivity("memory", `Deleted memory: ${args.id}`, "brain");
      return ok("memory.delete", null, "Memory deleted");
    }
    return fail("memory.delete", "NOT_FOUND", "Memory not found");
  },
};

// ─── Calendar Tools ──────────────────────────────────────────────────────────

const calendarCreateTool: NovaTool = {
  name: "calendar.create",
  description: "Create a calendar event",
  category: "calendar",
  inputSchema: {
    properties: {
      title: { type: "string", description: "Event title", required: true },
      date: { type: "string", description: "Date in YYYY-MM-DD format", required: true },
      time: { type: "string", description: "Time in HH:mm format", required: true },
      description: { type: "string", description: "Event description" },
      duration: { type: "number", description: "Duration in minutes" },
    },
    required: ["title", "date", "time"],
  },
  riskLevel: "low",
  confirmationRequired: false,
  execute: async (args, context) => {
    const event = calendarService.create({
      title: args.title as string,
      date: args.date as string,
      time: args.time as string,
      description: (args.description as string) || "",
      duration: (args.duration as number) || 60,
    }, context.userId);
    logActivity("calendar", `Created event: ${args.title} on ${args.date} at ${args.time}`, "calendar");
    return ok("calendar.create", event, `Created "${args.title}" on ${args.date} at ${args.time}`);
  },
};

const calendarListTool: NovaTool = {
  name: "calendar.list",
  description: "List calendar events, optionally filtered by date range",
  category: "calendar",
  inputSchema: {
    properties: {
      startDate: { type: "string", description: "Start date filter (YYYY-MM-DD)" },
      endDate: { type: "string", description: "End date filter (YYYY-MM-DD)" },
    },
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const events = calendarService.list({
      startDate: args.startDate as string | undefined,
      endDate: args.endDate as string | undefined,
    });
    return ok("calendar.list", events, `Found ${events.length} events`);
  },
};

const calendarSearchTool: NovaTool = {
  name: "calendar.search",
  description: "Search calendar events by title or description",
  category: "calendar",
  inputSchema: {
    properties: {
      query: { type: "string", description: "Search query", required: true },
    },
    required: ["query"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const events = calendarService.search(args.query as string);
    return ok("calendar.search", events, `Found ${events.length} matching events`);
  },
};

const calendarDeleteTool: NovaTool = {
  name: "calendar.delete",
  description: "Delete a calendar event",
  category: "calendar",
  inputSchema: {
    properties: {
      id: { type: "string", description: "Event id to delete", required: true },
      title: { type: "string", description: "Event title (for confirmation message)" },
    },
    required: ["id"],
  },
  riskLevel: "medium",
  confirmationRequired: true,
  execute: async (args) => {
    const deleted = calendarService.delete(args.id as string);
    if (deleted) {
      logActivity("calendar", `Deleted event: ${args.title || args.id}`, "calendar");
      return ok("calendar.delete", null, `Deleted event: ${args.title || "event"}`);
    }
    return fail("calendar.delete", "NOT_FOUND", "Event not found");
  },
};

const calendarFindSlotTool: NovaTool = {
  name: "calendar.findSlot",
  description: "Find the next available time slot on a given date",
  category: "calendar",
  inputSchema: {
    properties: {
      date: { type: "string", description: "Date to search (YYYY-MM-DD)", required: true },
      duration: { type: "number", description: "Required duration in minutes" },
    },
    required: ["date"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const slot = calendarService.findAvailableSlot(
      args.date as string,
      (args.duration as number) || 60
    );
    if (slot) {
      return ok("calendar.findSlot", { date: args.date, time: slot }, `Available at ${slot}`);
    }
    return fail("calendar.findSlot", "NO_SLOT", `No available slots on ${args.date}`);
  },
};

// ─── Task Tools ──────────────────────────────────────────────────────────────

const taskCreateTool: NovaTool = {
  name: "task.create",
  description: "Create a new task",
  category: "tasks",
  inputSchema: {
    properties: {
      title: { type: "string", description: "Task title", required: true },
      description: { type: "string", description: "Task description" },
      priority: { type: "string", description: "Priority: low, medium, high, urgent" },
    },
    required: ["title"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args, ctx) => {
    const task = await taskService.create(ctx.userId, {
      title: args.title as string,
      description: (args.description as string) || "",
      priority: (args.priority as "low" | "medium" | "high" | "urgent") || "medium",
    });
    logActivity("task", `Created task: ${args.title}`, "check-square");
    return ok("task.create", task, `Task created: "${args.title}"`);
  },
};

const taskListTool: NovaTool = {
  name: "task.list",
  description: "List all tasks",
  category: "tasks",
  inputSchema: { properties: {} },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (_args, ctx) => {
    const tasks = await taskService.list(ctx.userId);
    return ok("task.list", tasks, `You have ${tasks.length} tasks`);
  },
};

const taskSearchTool: NovaTool = {
  name: "task.search",
  description: "Search tasks by title or description",
  category: "tasks",
  inputSchema: {
    properties: {
      query: { type: "string", description: "Search query", required: true },
    },
    required: ["query"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args, ctx) => {
    const tasks = await taskService.search(ctx.userId, args.query as string);
    return ok("task.search", tasks, `Found ${tasks.length} matching tasks`);
  },
};

const taskCompleteTool: NovaTool = {
  name: "task.complete",
  description: "Mark a task as completed",
  category: "tasks",
  inputSchema: {
    properties: {
      id: { type: "string", description: "Task id to complete", required: true },
      title: { type: "string", description: "Task title (for confirmation)" },
    },
    required: ["id"],
  },
  riskLevel: "low",
  confirmationRequired: false,
  execute: async (args, ctx) => {
    await taskService.complete(ctx.userId, args.id as string);
    logActivity("task", `Completed task: ${args.title || args.id}`, "check-square");
    return ok("task.complete", null, `Task completed: "${args.title || "task"}"`);
  },
};

const taskDeleteTool: NovaTool = {
  name: "task.delete",
  description: "Delete a task",
  category: "tasks",
  inputSchema: {
    properties: {
      id: { type: "string", description: "Task id to delete", required: true },
      title: { type: "string", description: "Task title (for confirmation)" },
    },
    required: ["id"],
  },
  riskLevel: "medium",
  confirmationRequired: true,
  execute: async (args, ctx) => {
    await taskService.delete(ctx.userId, args.id as string);
    logActivity("task", `Deleted task: ${args.title || args.id}`, "check-square");
    return ok("task.delete", null, `Task deleted: "${args.title || "task"}"`);
  },
};

// ─── Email Tools ────────────────────────────────────────────────────────────

const emailDraftTool: NovaTool = {
  name: "email.draft",
  description: "Draft an email to a recipient",
  category: "email",
  inputSchema: {
    properties: {
      to: { type: "string", description: "Recipient email address", required: true },
      subject: { type: "string", description: "Email subject", required: true },
      body: { type: "string", description: "Email body content" },
    },
    required: ["to", "subject"],
  },
  riskLevel: "low",
  confirmationRequired: false,
  execute: async (args) => {
    const draft = addEmailDraft({
      to: args.to as string,
      subject: args.subject as string,
      body: (args.body as string) || "",
      status: "draft",
    });
    logActivity("email", `Drafted email to ${args.to}: ${args.subject}`, "mail");
    return ok("email.draft", draft, `Email drafted to ${args.to}`);
  },
};

const emailListTool: NovaTool = {
  name: "email.list",
  description: "List all email drafts and sent emails",
  category: "email",
  inputSchema: { properties: {} },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async () => {
    const drafts = getEmailDrafts();
    return ok("email.list", drafts, `Found ${drafts.length} emails`);
  },
};

const emailSearchTool: NovaTool = {
  name: "email.search",
  description: "Search emails by subject or recipient",
  category: "email",
  inputSchema: {
    properties: {
      query: { type: "string", description: "Search query", required: true },
    },
    required: ["query"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const query = (args.query as string).toLowerCase();
    const drafts = getEmailDrafts().filter(
      (d) => d.subject.toLowerCase().includes(query) || d.to.toLowerCase().includes(query)
    );
    return ok("email.search", drafts, `Found ${drafts.length} matching emails`);
  },
};

const emailDeleteTool: NovaTool = {
  name: "email.delete",
  description: "Delete an email draft",
  category: "email",
  inputSchema: {
    properties: {
      id: { type: "string", description: "Email id to delete", required: true },
    },
    required: ["id"],
  },
  riskLevel: "medium",
  confirmationRequired: true,
  execute: async (args) => {
    deleteEmailDraft(args.id as string);
    logActivity("email", `Deleted email: ${args.id}`, "trash");
    return ok("email.delete", null, "Email deleted");
  },
};

// ─── File Tools ──────────────────────────────────────────────────────────────

const fileListTool: NovaTool = {
  name: "file.list",
  description: "List all stored files",
  category: "files",
  inputSchema: { properties: {} },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async () => {
    const files = getFiles();
    return ok("file.list", files, `Found ${files.length} files`);
  },
};

const fileSearchTool: NovaTool = {
  name: "file.search",
  description: "Search files by name",
  category: "files",
  inputSchema: {
    properties: {
      query: { type: "string", description: "Search query", required: true },
    },
    required: ["query"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const query = (args.query as string).toLowerCase();
    const files = getFiles().filter((f) => f.name.toLowerCase().includes(query));
    return ok("file.search", files, `Found ${files.length} matching files`);
  },
};

const fileDeleteTool: NovaTool = {
  name: "file.delete",
  description: "Delete a file",
  category: "files",
  inputSchema: {
    properties: {
      id: { type: "string", description: "File id to delete", required: true },
    },
    required: ["id"],
  },
  riskLevel: "medium",
  confirmationRequired: true,
  execute: async (args) => {
    deleteFile(args.id as string);
    logActivity("files", `Deleted file: ${args.id}`, "trash");
    return ok("file.delete", null, "File deleted");
  },
};

// ─── Device Tools ────────────────────────────────────────────────────────────

const deviceListTool: NovaTool = {
  name: "device.list",
  description: "List all smart home devices",
  category: "device",
  inputSchema: { properties: {} },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async () => {
    const devices = getSmartDevices();
    return ok("device.list", devices, `Found ${devices.length} devices`);
  },
};

const deviceToggleTool: NovaTool = {
  name: "device.toggle",
  description: "Toggle a smart device on/off",
  category: "device",
  inputSchema: {
    properties: {
      deviceId: { type: "string", description: "Device id to toggle" },
      name: { type: "string", description: "Device name (fuzzy match if no id)" },
      state: { type: "string", description: "Desired state: on or off" },
    },
  },
  riskLevel: "low",
  confirmationRequired: false,
  execute: async (args) => {
    const devices = getSmartDevices();
    const target = args.deviceId
      ? devices.find((d) => d.id === args.deviceId)
      : devices.find((d) => d.name.toLowerCase().includes((args.name as string || "").toLowerCase()));
    if (!target) {
      return fail("device.toggle", "NOT_FOUND", `Device not found: ${args.name || args.deviceId}`);
    }
    const desiredOn = args.state === "on" ? true : args.state === "off" ? false : !target.isOn;
    updateSmartDevice(target.id, { isOn: desiredOn });
    logActivity("device", `${desiredOn ? "Turned on" : "Turned off"} ${target.name}`, "home");
    return ok("device.toggle", { ...target, isOn: desiredOn }, `${target.name} turned ${desiredOn ? "on" : "off"}`);
  },
};

const deviceAdjustTool: NovaTool = {
  name: "device.adjust",
  description: "Adjust a device setting (brightness, temperature, etc.)",
  category: "device",
  inputSchema: {
    properties: {
      deviceId: { type: "string", description: "Device id" },
      name: { type: "string", description: "Device name (fuzzy match if no id)" },
      value: { type: "number", description: "New value (brightness 0-100, temp, etc.)" },
    },
  },
  riskLevel: "low",
  confirmationRequired: false,
  execute: async (args) => {
    const devices = getSmartDevices();
    const target = args.deviceId
      ? devices.find((d) => d.id === args.deviceId)
      : devices.find((d) => d.name.toLowerCase().includes((args.name as string || "").toLowerCase()));
    if (!target) {
      return fail("device.adjust", "NOT_FOUND", `Device not found: ${args.name || args.deviceId}`);
    }
    updateSmartDevice(target.id, { value: args.value as number });
    logActivity("device", `Adjusted ${target.name} to ${args.value}`, "home");
    return ok("device.adjust", { ...target, value: args.value }, `${target.name} set to ${args.value}`);
  },
};

// ─── Navigation Tool ─────────────────────────────────────────────────────────

const navigationGoTool: NovaTool = {
  name: "navigation.go",
  description: "Navigate to a page in the app",
  category: "navigation",
  inputSchema: {
    properties: {
      path: { type: "string", description: "Route path to navigate to", required: true },
    },
    required: ["path"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const raw = (args.path as string) || "/";
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    // SPA navigation: dispatch a custom event that the router (main.tsx
    // RouteSyncer) turns into a real client-side navigate(). The old
    // location.hash approach silently did nothing under BrowserRouter.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nova:navigate", { detail: path }));
    }
    return ok("navigation.go", { path }, `Navigating to ${path}`);
  },
};

// ─── Desktop / Computer Control Tools ───────────────────────────────────────

const desktopClickTool: NovaTool = {
  name: "desktop.click",
  description: "Click at a screen coordinate",
  category: "desktop",
  inputSchema: {
    properties: {
      x: { type: "number", description: "X coordinate", required: true },
      y: { type: "number", description: "Y coordinate", required: true },
      button: { type: "string", description: "Mouse button: left, right, middle (default: left)" },
    },
    required: ["x", "y"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const result = await computerService.click(args.x as number, args.y as number, (args.button as "left" | "right" | "middle") || "left");
    return result.verified
      ? ok("desktop.click", result, `Clicked at (${args.x}, ${args.y})`)
      : fail("desktop.click", "ACTION_FAILED", result.error || "Click failed");
  },
};

const desktopDoubleClickTool: NovaTool = {
  name: "desktop.doubleClick",
  description: "Double-click at a screen coordinate",
  category: "desktop",
  inputSchema: {
    properties: {
      x: { type: "number", description: "X coordinate", required: true },
      y: { type: "number", description: "Y coordinate", required: true },
    },
    required: ["x", "y"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const result = await computerService.doubleClick(args.x as number, args.y as number);
    return result.verified
      ? ok("desktop.doubleClick", result, `Double-clicked at (${args.x}, ${args.y})`)
      : fail("desktop.doubleClick", "ACTION_FAILED", result.error || "Double-click failed");
  },
};

const desktopRightClickTool: NovaTool = {
  name: "desktop.rightClick",
  description: "Right-click at a screen coordinate",
  category: "desktop",
  inputSchema: {
    properties: {
      x: { type: "number", description: "X coordinate", required: true },
      y: { type: "number", description: "Y coordinate", required: true },
    },
    required: ["x", "y"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const result = await computerService.rightClick(args.x as number, args.y as number);
    return result.verified
      ? ok("desktop.rightClick", result, `Right-clicked at (${args.x}, ${args.y})`)
      : fail("desktop.rightClick", "ACTION_FAILED", result.error || "Right-click failed");
  },
};

const desktopTypeTool: NovaTool = {
  name: "desktop.type",
  description: "Type text into the currently focused input",
  category: "desktop",
  inputSchema: {
    properties: {
      text: { type: "string", description: "Text to type", required: true },
      delayMs: { type: "number", description: "Delay between characters in ms" },
    },
    required: ["text"],
  },
  riskLevel: "low",
  confirmationRequired: false,
  execute: async (args) => {
    const result = await computerService.typeText(args.text as string, (args.delayMs as number) || 20);
    return result.verified
      ? ok("desktop.type", result, `Typed ${(args.text as string).length} characters`)
      : fail("desktop.type", "ACTION_FAILED", result.error || "Typing failed");
  },
};

const desktopPressTool: NovaTool = {
  name: "desktop.press",
  description: "Press a keyboard key",
  category: "desktop",
  inputSchema: {
    properties: {
      key: { type: "string", description: "Key name (e.g., Enter, Tab, Escape, Backspace)", required: true },
      modifiers: { type: "string", description: "Comma-separated modifiers (e.g., ctrl,shift)" },
    },
    required: ["key"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const mods = args.modifiers ? (args.modifiers as string).split(",").map((s) => s.trim()) : undefined;
    const result = await computerService.keyPress(args.key as string, mods);
    return result.verified
      ? ok("desktop.press", result, `Pressed ${args.key}`)
      : fail("desktop.press", "ACTION_FAILED", result.error || "Key press failed");
  },
};

const desktopHotkeyTool: NovaTool = {
  name: "desktop.hotkey",
  description: "Press a keyboard shortcut (multiple keys simultaneously)",
  category: "desktop",
  inputSchema: {
    properties: {
      keys: { type: "string", description: "Comma-separated keys (e.g., ctrl,c or alt,tab)", required: true },
    },
    required: ["keys"],
  },
  riskLevel: "low",
  confirmationRequired: false,
  execute: async (args) => {
    const keys = (args.keys as string).split(",").map((s) => s.trim().toLowerCase());
    const result = await computerService.hotkey(keys);
    return result.verified
      ? ok("desktop.hotkey", result, `Pressed hotkey: ${keys.join("+")}`)
      : fail("desktop.hotkey", "ACTION_FAILED", result.error || "Hotkey failed");
  },
};

const desktopScrollTool: NovaTool = {
  name: "desktop.scroll",
  description: "Scroll the screen",
  category: "desktop",
  inputSchema: {
    properties: {
      x: { type: "number", description: "X coordinate to scroll at" },
      y: { type: "number", description: "Y coordinate to scroll at" },
      deltaY: { type: "number", description: "Scroll amount (positive = down, negative = up)", required: true },
    },
    required: ["deltaY"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const result = await computerService.scroll(args.x as number || 0, args.y as number || 0, args.deltaY as number);
    return result.verified
      ? ok("desktop.scroll", result, `Scrolled ${args.deltaY as number > 0 ? "down" : "up"}`)
      : fail("desktop.scroll", "ACTION_FAILED", result.error || "Scroll failed");
  },
};

const desktopMoveTool: NovaTool = {
  name: "desktop.move",
  description: "Move the mouse cursor to a coordinate",
  category: "desktop",
  inputSchema: {
    properties: {
      x: { type: "number", description: "X coordinate", required: true },
      y: { type: "number", description: "Y coordinate", required: true },
    },
    required: ["x", "y"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const result = await computerService.moveMouse(args.x as number, args.y as number);
    return result.verified
      ? ok("desktop.move", result, `Moved mouse to (${args.x}, ${args.y})`)
      : fail("desktop.move", "ACTION_FAILED", result.error || "Move failed");
  },
};

const desktopCopyTool: NovaTool = {
  name: "desktop.copy",
  description: "Copy text to clipboard",
  category: "desktop",
  inputSchema: {
    properties: {
      text: { type: "string", description: "Text to copy to clipboard", required: true },
    },
    required: ["text"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const result = await computerService.clipboardWrite(args.text as string);
    return result.verified
      ? ok("desktop.copy", result, `Copied ${(args.text as string).length} characters`)
      : fail("desktop.copy", "ACTION_FAILED", result.error || "Copy failed");
  },
};

const desktopPasteTool: NovaTool = {
  name: "desktop.paste",
  description: "Paste from clipboard (types clipboard content)",
  category: "desktop",
  inputSchema: {
    properties: {
      text: { type: "string", description: "Text to paste (if empty, reads from clipboard)" },
    },
  },
  riskLevel: "low",
  confirmationRequired: true,
  execute: async (args) => {
    let text = args.text as string;
    if (!text) {
      const clip = await computerService.clipboardRead();
      text = clip.text || "";
    }
    if (!text) return fail("desktop.paste", "EMPTY", "Clipboard is empty");
    const result = await computerService.typeText(text, 10);
    return result.verified
      ? ok("desktop.paste", result, `Pasted ${text.length} characters`)
      : fail("desktop.paste", "ACTION_FAILED", result.error || "Paste failed");
  },
};

const desktopListWindowsTool: NovaTool = {
  name: "desktop.listWindows",
  description: "List all open windows",
  category: "desktop",
  inputSchema: { properties: {} },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async () => {
    const windows = await computerService.listWindows();
    return ok("desktop.listWindows", windows, `Found ${windows.length} windows`);
  },
};

const desktopFocusWindowTool: NovaTool = {
  name: "desktop.focusWindow",
  description: "Focus a specific window by application name",
  category: "desktop",
  inputSchema: {
    properties: {
      application: { type: "string", description: "Application name to focus", required: true },
    },
    required: ["application"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const result = await computerService.focusWindow(undefined, args.application as string);
    return result.verified
      ? ok("desktop.focusWindow", result, `Focused ${args.application}`)
      : fail("desktop.focusWindow", "WINDOW_NOT_FOUND", result.error || `Could not find window: ${args.application}`);
  },
};

const desktopLaunchAppTool: NovaTool = {
  name: "desktop.launchApp",
  description: "Launch an application",
  category: "desktop",
  inputSchema: {
    properties: {
      application: { type: "string", description: "Application name or path to launch", required: true },
    },
    required: ["application"],
  },
  riskLevel: "low",
  confirmationRequired: false,
  execute: async (args) => {
    const result = await computerService.launchApp(args.application as string);
    return result.verified
      ? ok("desktop.launchApp", result, `Launched ${args.application}`)
      : fail("desktop.launchApp", "APP_NOT_FOUND", result.error || `Could not launch: ${args.application}`);
  },
};

const desktopCloseAppTool: NovaTool = {
  name: "desktop.closeApp",
  description: "Close an application",
  category: "desktop",
  inputSchema: {
    properties: {
      application: { type: "string", description: "Application name to close", required: true },
    },
    required: ["application"],
  },
  riskLevel: "medium",
  confirmationRequired: true,
  execute: async (args) => {
    const result = await computerService.closeApp(args.application as string);
    return result.verified
      ? ok("desktop.closeApp", result, `Closed ${args.application}`)
      : fail("desktop.closeApp", "ACTION_FAILED", result.error || `Could not close: ${args.application}`);
  },
};

const desktopGetActiveWindowTool: NovaTool = {
  name: "desktop.getActiveWindow",
  description: "Get information about the currently active window",
  category: "desktop",
  inputSchema: { properties: {} },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async () => {
    const window = await computerService.getActiveWindow();
    if (!window) return ok("desktop.getActiveWindow", null, "No active window detected");
    return ok("desktop.getActiveWindow", window, `Active: ${window.application} - ${window.title}`);
  },
};

const desktopMinimizeTool: NovaTool = {
  name: "desktop.minimizeWindow",
  description: "Minimize a window",
  category: "desktop",
  inputSchema: {
    properties: {
      application: { type: "string", description: "Application name", required: true },
    },
    required: ["application"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const windows = await computerService.listWindows();
    const win = windows.find((w) => w.application.toLowerCase().includes((args.application as string).toLowerCase()));
    if (!win) return fail("desktop.minimizeWindow", "WINDOW_NOT_FOUND", `No window found for ${args.application}`);
    const result = await computerService.minimizeWindow(win.id);
    return result.verified
      ? ok("desktop.minimizeWindow", result, `Minimized ${args.application}`)
      : fail("desktop.minimizeWindow", "ACTION_FAILED", result.error || "Minimize failed");
  },
};

const desktopMaximizeTool: NovaTool = {
  name: "desktop.maximizeWindow",
  description: "Maximize a window",
  category: "desktop",
  inputSchema: {
    properties: {
      application: { type: "string", description: "Application name", required: true },
    },
    required: ["application"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const windows = await computerService.listWindows();
    const win = windows.find((w) => w.application.toLowerCase().includes((args.application as string).toLowerCase()));
    if (!win) return fail("desktop.maximizeWindow", "WINDOW_NOT_FOUND", `No window found for ${args.application}`);
    const result = await computerService.maximizeWindow(win.id);
    return result.verified
      ? ok("desktop.maximizeWindow", result, `Maximized ${args.application}`)
      : fail("desktop.maximizeWindow", "ACTION_FAILED", result.error || "Maximize failed");
  },
};

// ─── Perception / Screen Tools ──────────────────────────────────────────────

const screenCaptureTool: NovaTool = {
  name: "screen.capture",
  description: "Take a screenshot of the screen",
  category: "perception",
  inputSchema: {
    properties: {
      region: { type: "string", description: "Optional region as JSON {x,y,width,height}" },
    },
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const region = args.region ? JSON.parse(args.region as string) : undefined;
    const obs = await perceptionService.captureScreen(region);
    if (obs.error) return fail("screen.capture", "SCREEN_ACCESS_DENIED", obs.error);
    return ok("screen.capture", { hasScreenshot: !!obs.screenshot }, "Screenshot captured");
  },
};

const screenCurrentTool: NovaTool = {
  name: "screen.current",
  description: "Get the current active window information",
  category: "perception",
  inputSchema: { properties: {} },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async () => {
    const obs = await perceptionService.getActiveWindow();
    const info = obs.activeApplication
      ? `${obs.activeApplication}: ${obs.windowTitle || "unknown"}`
      : "No active window detected";
    return ok("screen.current", obs, info);
  },
};

const screenReadTool: NovaTool = {
  name: "screen.read",
  description: "Extract text from the screen using OCR",
  category: "perception",
  inputSchema: { properties: {} },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async () => {
    const result = await perceptionService.extractText();
    if (!result.text) return ok("screen.read", result, "No text detected on screen");
    return ok("screen.read", result, `Extracted ${result.text.length} characters (${Math.round(result.confidence * 100)}% confidence)`);
  },
};

const screenDescribeTool: NovaTool = {
  name: "screen.describe",
  description: "Describe what is currently shown on screen using AI vision",
  category: "perception",
  inputSchema: { properties: {} },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async () => {
    const result = await perceptionService.describeScreen();
    return ok("screen.describe", result, result.description);
  },
};

const screenFindTextTool: NovaTool = {
  name: "screen.findText",
  description: "Find specific text on the screen",
  category: "perception",
  inputSchema: {
    properties: {
      text: { type: "string", description: "Text to find on screen", required: true },
    },
    required: ["text"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const result = await perceptionService.findTextOnScreen(args.text as string);
    if (result.found) return ok("screen.findText", result, `Found "${args.text}" at (${result.location?.x}, ${result.location?.y})`);
    return ok("screen.findText", result, `Text "${args.text}" not found on screen`);
  },
};

const screenAnalyzeTool: NovaTool = {
  name: "screen.analyze",
  description: "Analyze the screen content in detail (OCR + vision)",
  category: "perception",
  inputSchema: { properties: {} },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async () => {
    const [ocr, vision] = await Promise.all([
      perceptionService.extractText(),
      perceptionService.describeScreen(),
    ]);
    return ok("screen.analyze", { ocr, vision }, `${vision.description}\n\nDetected text: ${ocr.text.slice(0, 200)}`);
  },
};

// ─── Clipboard Tools ────────────────────────────────────────────────────────

const clipboardReadTool: NovaTool = {
  name: "clipboard.read",
  description: "Read the current clipboard content",
  category: "desktop",
  inputSchema: { properties: {} },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async () => {
    const content = await computerService.clipboardRead();
    return ok("clipboard.read", content, content.text ? `Clipboard: ${content.text.slice(0, 100)}` : "Clipboard is empty");
  },
};

const clipboardWriteTool: NovaTool = {
  name: "clipboard.write",
  description: "Write text to the clipboard",
  category: "desktop",
  inputSchema: {
    properties: {
      text: { type: "string", description: "Text to write to clipboard", required: true },
    },
    required: ["text"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    const result = await computerService.clipboardWrite(args.text as string);
    return result.verified
      ? ok("clipboard.write", result, `Copied ${(args.text as string).length} characters to clipboard`)
      : fail("clipboard.write", "ACTION_FAILED", result.error || "Clipboard write failed");
  },
};

const clipboardClearTool: NovaTool = {
  name: "clipboard.clear",
  description: "Clear the clipboard",
  category: "desktop",
  inputSchema: { properties: {} },
  riskLevel: "low",
  confirmationRequired: true,
  execute: async () => {
    const result = await computerService.clipboardClear();
    return result.verified
      ? ok("clipboard.clear", result, "Clipboard cleared")
      : fail("clipboard.clear", "ACTION_FAILED", result.error || "Clipboard clear failed");
  },
};

// ─── Web Search Tools ─────────────────────────────────────────────────────

const searchWebTool: NovaTool = {
  name: "search.web",
  description: "Search the web for information. Returns real search results from the internet.",
  category: "browser",
  inputSchema: {
    properties: {
      query: { type: "string", description: "Search query", required: true },
      maxResults: { type: "number", description: "Maximum results (default 10)" },
    },
    required: ["query"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    if (!searchService.isAvailable()) {
      return fail("search.web", "UNAVAILABLE", "Search service is not available offline.");
    }
    try {
      const response = await searchService.search({
        query: args.query as string,
        type: "web",
        maxResults: (args.maxResults as number) || 10,
      });
      logActivity("search", `Searched web: ${args.query}`, "search");
      return ok("search.web", response, `Found ${response.results.length} results in ${response.searchTimeMs}ms`);
    } catch (err) {
      return fail("search.web", "SEARCH_FAILED", err instanceof Error ? err.message : "Search failed");
    }
  },
};

const searchNewsTool: NovaTool = {
  name: "search.news",
  description: "Search for recent news articles.",
  category: "browser",
  inputSchema: {
    properties: {
      query: { type: "string", description: "News search query", required: true },
      maxResults: { type: "number", description: "Maximum results (default 5)" },
    },
    required: ["query"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    if (!searchService.isAvailable()) {
      return fail("search.news", "UNAVAILABLE", "Search service is not available offline.");
    }
    try {
      const response = await searchService.searchNews(
        args.query as string,
        (args.maxResults as number) || 5
      );
      logActivity("search", `Searched news: ${args.query}`, "newspaper");
      return ok("search.news", response, `Found ${response.results.length} news articles`);
    } catch (err) {
      return fail("search.news", "SEARCH_FAILED", err instanceof Error ? err.message : "News search failed");
    }
  },
};

// ─── Browser Tools ──────────────────────────────────────────────────────────

const browserOpenTool: NovaTool = {
  name: "browser.open",
  description: "Open a URL in the browser and return a session.",
  category: "browser",
  inputSchema: {
    properties: {
      url: { type: "string", description: "URL to open", required: true },
    },
    required: ["url"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    if (!browserService.isAvailable()) {
      return fail("browser.open", "UNAVAILABLE", "Browser service is not available offline.");
    }
    try {
      const session = await browserService.open(args.url as string);
      logActivity("browser", `Opened ${session.currentUrl}`, "globe");
      return ok("browser.open", session, `Opened ${session.title || session.currentUrl}`);
    } catch (err) {
      return fail("browser.open", "OPEN_FAILED", err instanceof Error ? err.message : "Failed to open URL");
    }
  },
};

const browserExtractTool: NovaTool = {
  name: "browser.extract",
  description: "Extract text content, links, and metadata from a web page.",
  category: "browser",
  inputSchema: {
    properties: {
      url: { type: "string", description: "URL to extract content from", required: true },
    },
    required: ["url"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    if (!browserService.isAvailable()) {
      return fail("browser.extract", "UNAVAILABLE", "Browser service is not available offline.");
    }
    try {
      const content = await browserService.extract(args.url as string);
      logActivity("browser", `Extracted content from ${content.title || content.url}`, "file-text");
      return ok("browser.extract", content, `Extracted ${content.text.length} characters from ${content.title}`);
    } catch (err) {
      return fail("browser.extract", "EXTRACT_FAILED", err instanceof Error ? err.message : "Failed to extract content");
    }
  },
};

const browserFindTool: NovaTool = {
  name: "browser.find",
  description: "Find UI elements on a page by text, tag, or selector.",
  category: "browser",
  inputSchema: {
    properties: {
      url: { type: "string", description: "Page URL", required: true },
      selector: { type: "string", description: "Text or selector to find", required: true },
    },
    required: ["url", "selector"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    if (!browserService.isAvailable()) {
      return fail("browser.find", "UNAVAILABLE", "Browser service is not available offline.");
    }
    try {
      const elements = await browserService.find(args.url as string, args.selector as string);
      return ok("browser.find", elements, `Found ${elements.length} matching elements`);
    } catch (err) {
      return fail("browser.find", "FIND_FAILED", err instanceof Error ? err.message : "Failed to find elements");
    }
  },
};

const browserObserveTool: NovaTool = {
  name: "browser.observe",
  description: "Get a full observation of a web page including content, links, and UI elements.",
  category: "browser",
  inputSchema: {
    properties: {
      url: { type: "string", description: "URL to observe", required: true },
    },
    required: ["url"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    if (!browserService.isAvailable()) {
      return fail("browser.observe", "UNAVAILABLE", "Browser service is not available offline.");
    }
    try {
      const observation = await browserService.observe(args.url as string);
      return ok("browser.observe", observation, `Observed: ${observation.title}`);
    } catch (err) {
      return fail("browser.observe", "OBSERVE_FAILED", err instanceof Error ? err.message : "Failed to observe page");
    }
  },
};

const browserSummarizeTool: NovaTool = {
  name: "browser.summarize",
  description: "Fetch and summarize the content of a web page.",
  category: "browser",
  inputSchema: {
    properties: {
      url: { type: "string", description: "URL to summarize", required: true },
    },
    required: ["url"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    if (!browserService.isAvailable()) {
      return fail("browser.summarize", "UNAVAILABLE", "Browser service is not available offline.");
    }
    try {
      const summary = await browserService.summarize(args.url as string);
      logActivity("browser", `Summarized ${args.url}`, "align-left");
      return ok("browser.summarize", { summary, url: args.url }, summary.substring(0, 200) + "...");
    } catch (err) {
      return fail("browser.summarize", "SUMMARIZE_FAILED", err instanceof Error ? err.message : "Failed to summarize page");
    }
  },
};

const browserNavigateTool: NovaTool = {
  name: "browser.navigate",
  description: "Navigate to a URL within an existing browser session.",
  category: "browser",
  inputSchema: {
    properties: {
      sessionId: { type: "string", description: "Browser session ID", required: true },
      url: { type: "string", description: "URL to navigate to", required: true },
    },
    required: ["sessionId", "url"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    try {
      const session = await browserService.navigate(args.sessionId as string, args.url as string);
      return ok("browser.navigate", session, `Navigated to ${session.title || session.currentUrl}`);
    } catch (err) {
      return fail("browser.navigate", "NAVIGATE_FAILED", err instanceof Error ? err.message : "Failed to navigate");
    }
  },
};

const browserBackTool: NovaTool = {
  name: "browser.back",
  description: "Go back in browser history.",
  category: "browser",
  inputSchema: {
    properties: {
      sessionId: { type: "string", description: "Browser session ID", required: true },
    },
    required: ["sessionId"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    try {
      const session = browserService.back(args.sessionId as string);
      return ok("browser.back", session, `Back to ${session.currentUrl}`);
    } catch (err) {
      return fail("browser.back", "BACK_FAILED", err instanceof Error ? err.message : "Failed to go back");
    }
  },
};

const browserForwardTool: NovaTool = {
  name: "browser.forward",
  description: "Go forward in browser history.",
  category: "browser",
  inputSchema: {
    properties: {
      sessionId: { type: "string", description: "Browser session ID", required: true },
    },
    required: ["sessionId"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    try {
      const session = browserService.forward(args.sessionId as string);
      return ok("browser.forward", session, `Forward to ${session.currentUrl}`);
    } catch (err) {
      return fail("browser.forward", "FORWARD_FAILED", err instanceof Error ? err.message : "Failed to go forward");
    }
  },
};

// ─── Email Send Tools ───────────────────────────────────────────────────────

const emailSendTool: NovaTool = {
  name: "email.send",
  description: "Send an email. Requires an authenticated email provider (Gmail/Outlook).", // 
  category: "email",
  inputSchema: {
    properties: {
      to: { type: "string", description: "Recipient email address", required: true },
      subject: { type: "string", description: "Email subject", required: true },
      body: { type: "string", description: "Email body content", required: true },
      cc: { type: "string", description: "CC recipients (comma-separated)" },
    },
    required: ["to", "subject", "body"],
  },
  riskLevel: "high",
  confirmationRequired: true,
  execute: async (args) => {
    if (!emailService.isAvailable()) {
      return fail("email.send", "PROVIDER_NOT_CONNECTED",
        "No email provider connected. Connect Gmail in Settings → Integrations first.");
    }
    try {
      const to = (args.to as string).split(",").map((e: string) => ({ email: e.trim() }));
      const cc = args.cc ? (args.cc as string).split(",").map((e: string) => ({ email: e.trim() })) : undefined;

      const draft = await emailService.draft({
        to,
        cc,
        subject: args.subject as string,
        body: args.body as string,
      });

      const sent = await emailService.send(draft);

      if (sent.status === "sent") {
        logActivity("email", `Sent email to ${args.to}: ${args.subject}`, "send");
        return ok("email.send", sent, `Email sent to ${args.to}`);
      } else {
        return fail("email.send", "SEND_FAILED",
          `Email failed to send. Status: ${sent.status}. Check your email provider connection.`);
      }
    } catch (err) {
      return fail("email.send", "SEND_FAILED", err instanceof Error ? err.message : "Failed to send email");
    }
  },
};

const emailReadTool: NovaTool = {
  name: "email.read",
  description: "Read an email by its ID. Requires an authenticated email provider.",
  category: "email",
  inputSchema: {
    properties: {
      messageId: { type: "string", description: "Email message ID", required: true },
    },
    required: ["messageId"],
  },
  riskLevel: "safe",
  confirmationRequired: false,
  execute: async (args) => {
    try {
      const message = await emailService.read(args.messageId as string);
      if (!message) {
        return fail("email.read", "NOT_FOUND", "Email not found.");
      }
      return ok("email.read", message, `Read: ${message.subject}`);
    } catch (err) {
      return fail("email.read", "READ_FAILED", err instanceof Error ? err.message : "Failed to read email");
    }
  },
};

// ─── Registration ────────────────────────────────────────────────────────────

let registered = false;

export function registerAllTools(): void {
  if (registered) return;
  registered = true;

  // Memory
  toolRegistry.register(memorySaveTool);
  toolRegistry.register(memorySearchTool);
  toolRegistry.register(memoryListTool);
  toolRegistry.register(memoryDeleteTool);

  // Calendar
  toolRegistry.register(calendarCreateTool);
  toolRegistry.register(calendarListTool);
  toolRegistry.register(calendarSearchTool);
  toolRegistry.register(calendarDeleteTool);
  toolRegistry.register(calendarFindSlotTool);

  // Tasks
  toolRegistry.register(taskCreateTool);
  toolRegistry.register(taskListTool);
  toolRegistry.register(taskSearchTool);
  toolRegistry.register(taskCompleteTool);
  toolRegistry.register(taskDeleteTool);

  // Navigation
  toolRegistry.register(navigationGoTool);

  // Email
  toolRegistry.register(emailDraftTool);
  toolRegistry.register(emailListTool);
  toolRegistry.register(emailSearchTool);
  toolRegistry.register(emailDeleteTool);

  // Files
  toolRegistry.register(fileListTool);
  toolRegistry.register(fileSearchTool);
  toolRegistry.register(fileDeleteTool);

  // Device
  toolRegistry.register(deviceListTool);
  toolRegistry.register(deviceToggleTool);
  toolRegistry.register(deviceAdjustTool);

  // Desktop / Computer Control
  toolRegistry.register(desktopClickTool);
  toolRegistry.register(desktopDoubleClickTool);
  toolRegistry.register(desktopRightClickTool);
  toolRegistry.register(desktopTypeTool);
  toolRegistry.register(desktopPressTool);
  toolRegistry.register(desktopHotkeyTool);
  toolRegistry.register(desktopScrollTool);
  toolRegistry.register(desktopMoveTool);
  toolRegistry.register(desktopCopyTool);
  toolRegistry.register(desktopPasteTool);
  toolRegistry.register(desktopListWindowsTool);
  toolRegistry.register(desktopFocusWindowTool);
  toolRegistry.register(desktopLaunchAppTool);
  toolRegistry.register(desktopCloseAppTool);
  toolRegistry.register(desktopGetActiveWindowTool);
  toolRegistry.register(desktopMinimizeTool);
  toolRegistry.register(desktopMaximizeTool);

  // Perception / Screen
  toolRegistry.register(screenCaptureTool);
  toolRegistry.register(screenCurrentTool);
  toolRegistry.register(screenReadTool);
  toolRegistry.register(screenDescribeTool);
  toolRegistry.register(screenFindTextTool);
  toolRegistry.register(screenAnalyzeTool);

  // Clipboard
  toolRegistry.register(clipboardReadTool);
  toolRegistry.register(clipboardWriteTool);
  toolRegistry.register(clipboardClearTool);

  // Web Search
  toolRegistry.register(searchWebTool);
  toolRegistry.register(searchNewsTool);

  // Browser
  toolRegistry.register(browserOpenTool);
  toolRegistry.register(browserExtractTool);
  toolRegistry.register(browserFindTool);
  toolRegistry.register(browserObserveTool);
  toolRegistry.register(browserSummarizeTool);
  toolRegistry.register(browserNavigateTool);
  toolRegistry.register(browserBackTool);
  toolRegistry.register(browserForwardTool);

  // Email (real send)
  toolRegistry.register(emailSendTool);
  toolRegistry.register(emailReadTool);

  console.log(`[ToolRegistry] Registered ${toolRegistry.list().length} tools`);
}
