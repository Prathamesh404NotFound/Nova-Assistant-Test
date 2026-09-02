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
import { logActivity } from "@/lib/local-store";

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
  execute: async (args) => {
    const event = calendarService.create({
      title: args.title as string,
      date: args.date as string,
      time: args.time as string,
      description: (args.description as string) || "",
      duration: (args.duration as number) || 60,
    });
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
    const path = args.path as string;
    // Perform client-side navigation
    if (typeof window !== "undefined") {
      window.location.hash = `#${path}`;
    }
    return ok("navigation.go", { path }, `Navigating to ${path}`);
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

  console.log(`[ToolRegistry] Registered ${toolRegistry.list().length} tools`);
}
