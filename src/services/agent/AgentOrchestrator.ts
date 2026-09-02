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
import { callGemini } from "@/lib/gemini";
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
        security: "/security",
        plugins: "/plugins",
        workspace: "/workspace",
        observability: "/observability",
        personalization: "/personalization",
        import: "/import-export",
        export: "/import-export",
      };
      for (const [key, path] of Object.entries(routes)) {
        if (page.includes(key)) return { path };
      }
      return { path: `/${page.replace(/\s+/g, "-")}` };
    },
  },

  // Device operations
  {
    pattern: /^(?:turn on|switch on|enable)\s+(?:the\s+)?(.+)/i,
    tool: "device.toggle",
    extractArgs: (m) => ({ name: m[1].trim(), state: "on" }),
  },
  {
    pattern: /^(?:turn off|switch off|disable)\s+(?:the\s+)?(.+)/i,
    tool: "device.toggle",
    extractArgs: (m) => ({ name: m[1].trim(), state: "off" }),
  },
  {
    pattern: /^(?:toggle|switch)\s+(?:the\s+)?(.+)/i,
    tool: "device.toggle",
    extractArgs: (m) => ({ name: m[1].trim() }),
  },
  {
    pattern: /^(?:set|adjust|change)\s+(?:the\s+)?(.+?)\s+(?:to|at)\s+(\d+)/i,
    tool: "device.adjust",
    extractArgs: (m) => ({ name: m[1].trim(), value: parseInt(m[2]) }),
  },
  {
    pattern: /^(?:what(?:'s| is) the|show)\s+(?:status of |list )?(?:my )?(?:smart )?devices?/i,
    tool: "device.list",
    extractArgs: () => ({}),
  },

  // Email operations
  {
    pattern: /^(?:send|draft|write|compose)\s+(?:an\s+|a\s+)?(?:email|mail)\s+(?:to\s+)?(.+?)(?:\s+with subject\s+(.+?))?(?:\s+(?:about|saying|content)\s+(.+))?$/i,
    tool: "email.draft",
    extractArgs: (m) => ({
      to: m[1]?.trim() || "",
      subject: m[2]?.trim() || "",
      body: m[3]?.trim() || "",
    }),
  },
  {
    pattern: /^(?:show|list|what are|my)\s+(?:my\s+)?(?:email|mail|draft)s?/i,
    tool: "email.list",
    extractArgs: () => ({}),
  },
  {
    pattern: /^(?:search|find)\s+(?:emails?|mail|drafts?)\s+(?:for|about)?\s*(.+)/i,
    tool: "email.search",
    extractArgs: (m) => ({ query: m[1] }),
  },

  // File operations
  {
    pattern: /^(?:show|list|what are|my)\s+(?:my\s+)?files?/i,
    tool: "file.list",
    extractArgs: () => ({}),
  },
  {
    pattern: /^(?:search|find)\s+(?:my\s+)?files?\s+(?:for|about)?\s*(.+)/i,
    tool: "file.search",
    extractArgs: (m) => ({ query: m[1] }),
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

// ─── AI Tool Planner ────────────────────────────────────────────────────────

interface PlannedTool {
  name: string;
  args: Record<string, unknown>;
  reason: string;
}

/**
 * Ask Gemini to plan which tools to execute for a complex user request.
 * Returns an ordered list of tool calls with their arguments.
 */
async function planToolsWithAI(
  userInput: string,
  geminiKey: string,
  toolList: Array<{ name: string; description: string; parameters: string }>
): Promise<PlannedTool[]> {
  const toolDescriptions = toolList
    .map((t) => `- ${t.name}: ${t.description} (params: ${t.parameters})`)
    .join("\n");

  const prompt = `You are Nova's tool planner. Given a user request, decide which tools to call.

Available tools:
${toolDescriptions}

User request: "${userInput}"

Return ONLY a JSON array of tool calls. Each tool call is an object with:
- name: tool name
- args: arguments object
- reason: brief reason

If no tools are needed, return an empty array [].
Do NOT include any explanation outside the JSON array.`;

  try {
    const response = await callGemini(geminiKey, prompt, undefined, "reasoning");
    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.filter((t: any) => t.name && typeof t.name === "string");
      }
    }
  } catch {
    // AI planning failed — return empty
  }
  return [];
}

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
    const emailKeywords = ["email", "mail", "draft", "compose", "send"];
    const fileKeywords = ["file", "files", "document"];
    const deviceKeywords = ["light", "lights", "thermostat", "lock", "camera", "device", "toggle", "turn on", "turn off"];

    const allKeywords = [
      ...memoryKeywords,
      ...calendarKeywords,
      ...taskKeywords,
      ...navKeywords,
      ...emailKeywords,
      ...fileKeywords,
      ...deviceKeywords,
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

  /**
   * Route to AI model for complex requests.
   * Implements the full TOOL LOOP: plan → execute → observe → decide → loop or finish.
   */
  private async routeToAI(
    input: AgentInput,
    context: ToolContext,
    startMs: number
  ): Promise<AgentResult> {
    const actionsExecuted: Array<{ tool: string; success: boolean; result?: ToolResult }> = [];
    const lower = input.text.toLowerCase();

    // ── Phase 1: Deterministic multi-step detection ────────────────────
    const steps = this.detectMultiStepSteps(lower);

    if (steps.length > 1) {
      // Execute detected steps sequentially, then observe
      for (const step of steps) {
        const tool = toolRegistry.get(step.tool);
        if (!tool) continue;
        const args = step.extractArgs(input.text);
        const result = await toolExecutor.execute(step.tool, args, context, {
          source: context.source === "voice" ? "voice" : "chat",
        });
        actionsExecuted.push({ tool: step.tool, success: result.success, result });
      }

      const summary = actionsExecuted
        .map((a) => a.success ? `✓ ${a.result?.message || a.tool}` : `✗ ${a.tool}: ${a.result?.error?.message || "failed"}`)
        .join("\n");

      return {
        response: summary,
        actionsExecuted,
        route: { route: "AI_TOOL", confidence: 0.7 },
        durationMs: Date.now() - startMs,
      };
    }

    // ── Phase 2: AI-driven tool planning + tool loop ───────────────────
    return this.toolLoop(input, context, startMs, actionsExecuted);
  }

  /**
   * TOOL LOOP: plan tools → execute → observe → decide if more → repeat.
   * This is the core agent loop matching the architecture diagram.
   */
  private async toolLoop(
    input: AgentInput,
    context: ToolContext,
    startMs: number,
    initialActions: Array<{ tool: string; success: boolean; result?: ToolResult }>
  ): Promise<AgentResult> {
    const actionsExecuted = [...initialActions];
    const geminiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || localStorage.getItem("nova_gemini_key") || "";
    const MAX_LOOP_STEPS = 3;

    // Get available tools for the planner
    const availableTools = toolRegistry.listAvailable().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: JSON.stringify(t.inputSchema.properties),
    }));

    // Loop: plan → execute → observe → decide
    for (let step = 0; step < MAX_LOOP_STEPS; step++) {
      // PLAN: ask AI which tools to call
      const tools = await planToolsWithAI(input.text, geminiKey, availableTools);

      // No tools planned — break and let AI generate a text response
      if (tools.length === 0) break;

      // EXECUTE: run each planned tool
      let allSucceeded = true;
      for (const planned of tools) {
        const tool = toolRegistry.get(planned.name);
        if (!tool) continue;
        const result = await toolExecutor.execute(planned.name, planned.args, context, {
          source: context.source === "voice" ? "voice" : "chat",
        });
        actionsExecuted.push({ tool: planned.name, success: result.success, result });
        if (!result.success) allSucceeded = false;
      }

      // OBSERVE & DECIDE: if all tools succeeded, check if follow-up is needed
      if (allSucceeded && actionsExecuted.length > 0) {
        const followUp = await this.observeAndDecide(
          input.text,
          actionsExecuted,
          geminiKey
        );
        if (followUp.length > 0) {
          // More actions needed — loop continues
          for (const planned of followUp) {
            const tool = toolRegistry.get(planned.name);
            if (!tool) continue;
            const result = await toolExecutor.execute(planned.name, planned.args, context, {
              source: context.source === "voice" ? "voice" : "chat",
            });
            actionsExecuted.push({ tool: planned.name, success: result.success, result });
          }
        }
      }

      // After first execution cycle, break
      break;
    }

    // Build response from all executed actions
    if (actionsExecuted.length > 0) {
      const summary = actionsExecuted
        .map((a) => a.success ? `✓ ${a.result?.message || a.tool}` : `✗ ${a.tool}: ${a.result?.error?.message || "failed"}`)
        .join("\n");

      return {
        response: summary,
        actionsExecuted,
        route: { route: "AI_TOOL", confidence: 0.7 },
        durationMs: Date.now() - startMs,
      };
    }

    // No tools executed — defer to AI chat pipeline
    return {
      response: "",
      actionsExecuted,
      route: { route: "AI_TOOL", confidence: 0.6 },
      durationMs: Date.now() - startMs,
    };
  }

  /**
   * OBSERVE & DECIDE: after tools execute, check if follow-up actions are needed.
   * For example: after creating a calendar event, check for conflicts.
   */
  private async observeAndDecide(
    userRequest: string,
    executed: Array<{ tool: string; success: boolean; result?: ToolResult }>,
    geminiKey: string
  ): Promise<PlannedTool[]> {
    if (!geminiKey) return [];

    const executedSummary = executed
      .map((a) => `${a.tool}: ${a.success ? "success" : "failed"} - ${a.result?.message || ""}`)
      .join("\n");

    const prompt = `You are Nova's action observer. A user asked: "${userRequest}"

Tools were executed:
${executedSummary}

Based on the results, does any follow-up action make sense? Consider:
- If a calendar event was created, should we check for conflicts?
- If a task was created, should we set a reminder?
- If an email was drafted, should we also create a calendar event for the meeting?

Return ONLY a JSON array of additional tool calls if follow-up is needed, or [] if done.
Format: [{"name": "tool.name", "args": {...}, "reason": "..."}]`;

    try {
      const response = await callGemini(geminiKey, prompt, undefined, "reasoning");
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((t: any) => t.name && typeof t.name === "string");
        }
      }
    } catch {
      // Observation failed — no follow-up
    }
    return [];
  }

  /**
   * Detect multi-step deterministic tool calls from the input.
   * Handles compound commands like "remember X and schedule Y".
   */
  private detectMultiStepSteps(lower: string): Array<{ tool: string; extractArgs: (text: string) => Record<string, unknown> }> {
    const steps: Array<{ tool: string; extractArgs: (text: string) => Record<string, unknown> }> = [];

    // Memory save
    const memMatch = lower.match(/remember\s+(?:that\s+)?(.+?)(?:\s+and\s+|$)/i);
    if (memMatch) {
      steps.push({
        tool: "memory.save",
        extractArgs: () => ({ content: memMatch[1].trim() }),
      });
    }

    // Calendar create (if part of a compound command)
    const calMatch = lower.match(/(?:schedule|create|set up?)\s+(?:a\s+|an\s+)?(.+?)(?:\s+(?:on|for)\s+(\w+\s+\d{1,2}))?(?:\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/i);
    if (calMatch && steps.length > 0) {
      steps.push({
        tool: "calendar.create",
        extractArgs: () => {
          const title = calMatch[1]?.trim() || "New Event";
          const date = calMatch[2] || new Date().toISOString().slice(0, 10);
          const time = calMatch[3] || "09:00";
          return { title, date, time, duration: 60 };
        },
      });
    }

    return steps;
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
