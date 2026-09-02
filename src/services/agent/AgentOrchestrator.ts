/**
 * Nova Agent Architecture — Agent Orchestrator
 * Central routing and execution engine.
 * Receives user input, classifies intent, routes to tools or AI,
 * executes tools via ToolExecutor, and returns structured results.
 *
 * Flow:
 *   User input → IntentRouter (fast regex) → ToolExecutor → Result
 *   If ambiguous → AI model (Gemini/local) → Tool calls → Result
 */

import { toolRegistry } from "./ToolRegistry";
import { toolExecutor } from "./ToolExecutor";
import { registerAllTools } from "./register-tools";
import type {
  AgentInput,
  AgentResult,
  RouteDecision,
  ToolResult,
  ToolContext,
} from "./types";

// ─── Intent Patterns ─────────────────────────────────────────────────────────

interface IntentPattern {
  pattern: RegExp;
  tool: string;
  extractArgs: (match: RegExpMatchArray) => Record<string, unknown>;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // Memory operations
  {
    pattern: /^(?:remember|save|store)\s+(?:that\s+)?(.+)/i,
    tool: "memory.save",
    extractArgs: (m) => ({ content: m[1] }),
  },
  {
    pattern: /^(?:forget|delete memory|remove memory)\s+(?:that\s+)?(.+)/i,
    tool: "memory.delete",
    extractArgs: (m) => ({ content: m[1] }),
  },
  {
    pattern: /^(?:what do you remember|show (?:my )?memories|list memories)/i,
    tool: "memory.list",
    extractArgs: () => ({}),
  },
  {
    pattern: /^(?:search|find) memories?\s+(?:about |for |containing )?(.+)/i,
    tool: "memory.search",
    extractArgs: (m) => ({ query: m[1] }),
  },

  // Calendar operations
  {
    pattern: /^(?:schedule|create|add|set up?)\s+(?:a\s+|an\s+)?(.+?)(?:\s+(?:on|for)\s+(\d{4}-\d{2}-\d{2}|\w+\s+\d{1,2}))?(?:\s+(?:at)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?$/i,
    tool: "calendar.create",
    extractArgs: (m) => {
      const title = m[1]?.trim() || "";
      let date = m[2] || new Date().toISOString().slice(0, 10);
      let time = m[3] || "09:00";
      // Normalize time
      if (time.match(/^\d{1,2}\s*(am|pm)$/i)) {
        const [h, period] = time.split(/\s+/);
        const hour = parseInt(h);
        time = `${String(period.toLowerCase() === "pm" && hour < 12 ? hour + 12 : hour === 12 && period.toLowerCase() === "am" ? 0 : hour).padStart(2, "0")}:00`;
      }
      return { title, date, time, duration: 60 };
    },
  },
  {
    pattern: /^(?:what'?s? on (?:my )?calendar|show (?:my )?calendar|my events|upcoming events)/i,
    tool: "calendar.list",
    extractArgs: () => ({}),
  },
  {
    pattern: /^(?:search|find) (?:calendar|events?)\s+(?:for|about|named?)?\s*(.+)/i,
    tool: "calendar.search",
    extractArgs: (m) => ({ query: m[1] }),
  },
  {
    pattern: /^(?:cancel|delete|remove)\s+(?:the\s+)?(?:event|meeting)\s+(.+)/i,
    tool: "calendar.delete",
    extractArgs: (m) => ({ title: m[1], id: "" }),
  },

  // Task operations
  {
    pattern: /^(?:create|add|make)\s+(?:a\s+)?task\s+(?:to\s+|for\s+)?(.+)/i,
    tool: "task.create",
    extractArgs: (m) => ({ title: m[1] }),
  },
  {
    pattern: /^(?:remind me to|remind me)\s+(.+)/i,
    tool: "task.create",
    extractArgs: (m) => ({ title: m[1] }),
  },
  {
    pattern: /^(?:show|list|what are) (?:my )?tasks?/i,
    tool: "task.list",
    extractArgs: () => ({}),
  },
  {
    pattern: /^(?:complete|finish|done with|mark done)\s+(?:the\s+)?task\s+(?:called\s+|named\s+|"?)(.+)/i,
    tool: "task.complete",
    extractArgs: (m) => ({ title: m[1].replace(/"$/, ""), id: "" }),
  },
  {
    pattern: /^(?:search|find) tasks?\s+(?:for|about|containing)\s+(.+)/i,
    tool: "task.search",
    extractArgs: (m) => ({ query: m[1] }),
  },
  {
    pattern: /^(?:delete|remove)\s+(?:the\s+)?task\s+(.+)/i,
    tool: "task.delete",
    extractArgs: (m) => ({ title: m[1], id: "" }),
  },

  // Navigation
  {
    pattern: /^(?:open|go to|navigate to|show)\s+(?:the\s+)?(?:page\s+)?(.+)/i,
    tool: "navigation.go",
    extractArgs: (m) => {
      const page = m[1].toLowerCase().trim();
      const routes: Record<string, string> = {
        calendar: "/calendar",
        tasks: "/tasks",
        memory: "/memory",
        email: "/email",
        chat: "/chat",
        settings: "/settings",
        agents: "/agents",
        dashboard: "/",
        home: "/",
        files: "/files",
        browser: "/browser",
        smart: "/smart-home",
        "smart home": "/smart-home",
        automations: "/automations",
        activity: "/activity",
        voice: "/voice-experience",
        coding: "/coding-workspace",
      };
      for (const [key, path] of Object.entries(routes)) {
        if (page.includes(key)) return { path };
      }
      return { path: `/${page.replace(/\s+/g, "-")}` };
    },
  },

  // Utility
  {
    pattern: /^(?:what time is it|current time|time now)/i,
    tool: "__local_time__",
    extractArgs: () => ({}),
  },
  {
    pattern: /^(?:what('?s| is) (?:today'?s?)? date|today'?\s?date)/i,
    tool: "__local_date__",
    extractArgs: () => ({}),
  },
];

// ─── Confidence Thresholds ───────────────────────────────────────────────────

const HIGH_CONFIDENCE = 0.85;
const MEDIUM_CONFIDENCE = 0.6;

// ─── Agent Orchestrator ──────────────────────────────────────────────────────

class AgentOrchestratorImpl {
  private initialized = false;
  private maxToolSteps = 3;

  /** Initialize: register all tools. */
  init(): void {
    if (this.initialized) return;
    registerAllTools();
    this.initialized = true;
  }

  /** Main entry point: process user input and return a result. */
  async process(input: AgentInput): Promise<AgentResult> {
    const start = Date.now();
    this.init();

    const context: ToolContext = {
      userId: input.context?.userId || "",
      currentRoute: input.context?.currentRoute,
      source: input.source,
    };

    // 1. Classify intent
    const decision = this.classifyIntent(input.text);

    // 2. Route based on decision
    switch (decision.route) {
      case "LOCAL_ACTION": {
        // Fast path: execute tool directly
        return this.executeLocalAction(decision, context, start);
      }

      case "AI_TOOL": {
        // Medium path: structured AI tool planning
        // For now, fall through to AI model for complex requests
        return this.routeToAI(input, context, start);
      }

      case "CHAT": {
        // Pure conversation: route to AI model
        return {
          response: "", // Let the existing AI handle it
          actionsExecuted: [],
          route: decision,
          durationMs: Date.now() - start,
        };
      }
    }
  }

  /** Classify user intent via deterministic regex patterns. */
  private classifyIntent(text: string): RouteDecision {
    const trimmed = text.trim();

    // Exact utility commands — instant, no AI needed
    if (/^(?:what time is it|time now|current time)/i.test(trimmed)) {
      const now = new Date();
      return {
        route: "LOCAL_ACTION",
        confidence: 1.0,
        intent: "utility.time",
        tool: "__local_time__",
        args: {},
      };
    }
    if (/^(?:what('?s| is) (?:today'?s?)? date|today)/i.test(trimmed)) {
      return {
        route: "LOCAL_ACTION",
        confidence: 1.0,
        intent: "utility.date",
        tool: "__local_date__",
        args: {},
      };
    }

    // Try each pattern
    for (const { pattern, tool, extractArgs } of INTENT_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        return {
          route: "LOCAL_ACTION",
          confidence: HIGH_CONFIDENCE,
          intent: tool,
          tool,
          args: extractArgs(match),
        };
      }
    }

    // Fuzzy check for medium confidence
    const lower = trimmed.toLowerCase();
    const memoryKeywords = ["remember", "forget", "memory", "memories"];
    const calendarKeywords = ["calendar", "event", "meeting", "schedule", "appointment"];
    const taskKeywords = ["task", "todo", "to-do", "reminder", "remind"];
    const navKeywords = ["open", "go to", "navigate", "show page"];

    const allKeywords = [
      ...memoryKeywords,
      ...calendarKeywords,
      ...taskKeywords,
      ...navKeywords,
    ];

    if (allKeywords.some((k) => lower.includes(k))) {
      // Has action keywords but didn't match a pattern — send to AI for tool planning
      return {
        route: "AI_TOOL",
        confidence: MEDIUM_CONFIDENCE,
      };
    }

    // No action keywords — pure chat
    return {
      route: "CHAT",
      confidence: 0.7,
    };
  }

  /** Execute a local action (fast path). */
  private async executeLocalAction(
    decision: RouteDecision & { route: "LOCAL_ACTION"; tool?: string; args?: Record<string, unknown> },
    context: ToolContext,
    startMs: number
  ): Promise<AgentResult> {
    const toolName = decision.tool;
    const args = decision.args || {};

    // Handle pure local utilities
    if (toolName === "__local_time__") {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return {
        response: `It's ${timeStr}.`,
        actionsExecuted: [],
        route: decision,
        durationMs: Date.now() - startMs,
      };
    }

    if (toolName === "__local_date__") {
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return {
        response: `Today is ${dateStr}.`,
        actionsExecuted: [],
        route: decision,
        durationMs: Date.now() - startMs,
      };
    }

    if (!toolName) {
      return {
        response: "I'm not sure what you'd like me to do.",
        actionsExecuted: [],
        route: decision,
        durationMs: Date.now() - startMs,
      };
    }

    // Execute via ToolExecutor
    const result = await toolExecutor.execute(toolName, args, context, {
      source: context.source === "voice" ? "voice" : "chat",
    });

    // Build response from result
    let response: string;
    if (result.success) {
      response = result.message || `Done — ${toolName} completed successfully.`;
    } else if (result.error?.code === "CONFIRMATION_REQUIRED") {
      response = result.error.message;
    } else {
      response = `I couldn't complete that action: ${result.error?.message || "Unknown error"}. No changes were made.`;
    }

    return {
      response,
      actionsExecuted: [{ tool: toolName, success: result.success, result }],
      route: decision,
      durationMs: Date.now() - startMs,
    };
  }

  /** Route to AI model for complex requests (tool planning). */
  private async routeToAI(
    input: AgentInput,
    context: ToolContext,
    startMs: number
  ): Promise<AgentResult> {
    // For now, return empty response so the existing AI pipeline handles it
    // In future: call Gemini with tool declarations, parse function calls,
    // execute via ToolExecutor, feed results back, generate final response
    return {
      response: "",
      actionsExecuted: [],
      route: { route: "AI_TOOL", confidence: 0.6 },
      durationMs: Date.now() - startMs,
    };
  }

  /** Execute a tool by name (for use by Chat and other consumers). */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    this.init();
    return toolExecutor.execute(toolName, args, context, {
      source: context.source === "voice" ? "voice" : "chat",
    });
  }

  /** Confirm a pending action. */
  async confirmAction(
    confirmationId: string,
    context: ToolContext
  ): Promise<ToolResult> {
    return toolExecutor.confirmPending(confirmationId, context);
  }

  /** Reject a pending action. */
  rejectAction(confirmationId: string): void {
    toolExecutor.rejectPending(confirmationId);
  }

  /** Get action log. */
  getActionLog() {
    return toolExecutor.getActionLog();
  }
}

/** Singleton orchestrator. */
export const agentOrchestrator = new AgentOrchestratorImpl();
