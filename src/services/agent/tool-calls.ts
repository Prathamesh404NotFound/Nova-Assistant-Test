/**
 * Nova Agent Architecture — Structured Tool Calls
 *
 * Replaces the old "return JSON in plain text and regex-parse it" approach
 * with a validated, provider-agnostic structured tool-call protocol.
 *
 * Flow:
 *   AI Model → Provider Adapter → Parser → Validator → ToolExecutor
 *
 * The model must never directly mutate application state.
 * Only ToolExecutor can do that.
 */

import { toolRegistry } from "./ToolRegistry";
import { toolExecutor } from "./ToolExecutor";
import { callGemini } from "@/lib/gemini";
import type { ToolContext, ToolResult as AgentToolResult } from "./types";

// ═══════════════════════════════════════════════════════════════════════════════
// §1. CANONICAL TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** A single tool call requested by the AI model. */
export interface ToolCall {
  /** Unique call identifier — preserved across execution for result attachment. */
  id: string;
  /** Tool name — must exist in ToolRegistry. */
  name: string;
  /** Arguments to pass to the tool — must validate against the tool's schema. */
  arguments: Record<string, unknown>;
}

/** The result of executing a single tool call. */
export interface ToolCallResult {
  /** Matches the ToolCall.id this result belongs to. */
  id: string;
  /** Tool name that was executed. */
  tool: string;
  /** Whether execution succeeded. */
  success: boolean;
  /** Result data from the tool. */
  data?: unknown;
  /** Human-readable result message. */
  message?: string;
  /** Error details if failed. */
  error?: { code: string; message: string; retryable?: boolean };
  /** Execution metadata. */
  metadata?: { executionMs: number };
}

/** Validation error for a single tool call. */
export interface ToolCallError {
  id: string;
  type: "UNKNOWN_TOOL" | "INVALID_ARGS" | "MALFORMED_CALL" | "UNAVAILABLE_TOOL";
  message: string;
}

/** Result of parsing + validating a batch of tool calls from AI output. */
export interface ParsedToolCalls {
  /** Validated tool calls ready for execution. */
  valid: ToolCall[];
  /** Rejected calls with reasons. */
  errors: ToolCallError[];
  /** The raw provider-specific output, for debugging. */
  raw?: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2. VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates a single ToolCall against the ToolRegistry.
 * Returns null if valid, or a ToolCallError if invalid.
 */
export function validateToolCall(call: unknown): ToolCallError | null {
  // ── Structural checks ────────────────────────────────────────────────
  if (!call || typeof call !== "object") {
    return { id: "unknown", type: "MALFORMED_CALL", message: "Tool call is not an object" };
  }

  const obj = call as Record<string, unknown>;

  // ID
  if (typeof obj.id !== "string" || obj.id.length === 0) {
    return { id: String(obj.id || "unknown"), type: "MALFORMED_CALL", message: "Missing or invalid 'id'" };
  }

  // Name
  if (typeof obj.name !== "string" || obj.name.length === 0) {
    return { id: obj.id as string, type: "MALFORMED_CALL", message: "Missing or invalid 'name'" };
  }

  // Arguments
  if (obj.arguments !== undefined && obj.arguments !== null) {
    if (typeof obj.arguments !== "object" || Array.isArray(obj.arguments)) {
      return { id: obj.id as string, type: "MALFORMED_CALL", message: "'arguments' must be an object" };
    }
  }

  const id = obj.id as string;
  const name = obj.name as string;
  const args = (obj.arguments as Record<string, unknown>) || {};

  // ── Registry checks ──────────────────────────────────────────────────

  // Unknown tool
  const tool = toolRegistry.get(name);
  if (!tool) {
    return { id, type: "UNKNOWN_TOOL", message: `Unknown tool: '${name}'` };
  }

  // Unavailable tool
  if (tool.availability && !tool.availability()) {
    return { id, type: "UNAVAILABLE_TOOL", message: `Tool '${name}' is currently unavailable` };
  }

  // ── Schema validation ────────────────────────────────────────────────
  const schema = tool.inputSchema;
  const required = schema.required || [];

  // Missing required fields
  for (const field of required) {
    if (args[field] === undefined || args[field] === null || args[field] === "") {
      return { id, type: "INVALID_ARGS", message: `Missing required field: '${field}'` };
    }
  }

  // Type checking
  for (const [key, def] of Object.entries(schema.properties)) {
    if (key in args && args[key] !== undefined && args[key] !== null) {
      const val = args[key];
      if (def.type === "string" && typeof val !== "string") {
        return { id, type: "INVALID_ARGS", message: `Field '${key}' must be a string, got ${typeof val}` };
      }
      if (def.type === "number" && typeof val !== "number") {
        return { id, type: "INVALID_ARGS", message: `Field '${key}' must be a number, got ${typeof val}` };
      }
      if (def.type === "boolean" && typeof val !== "boolean") {
        return { id, type: "INVALID_ARGS", message: `Field '${key}' must be a boolean, got ${typeof val}` };
      }
    }
  }

  // Unknown arguments — reject args not in schema (defense against injection)
  const knownKeys = new Set(Object.keys(schema.properties));
  for (const key of Object.keys(args)) {
    if (!knownKeys.has(key)) {
      return { id, type: "INVALID_ARGS", message: `Unknown argument: '${key}'` };
    }
  }

  return null; // Valid
}

/**
 * Validate a batch of tool calls.
 * Returns validated calls and rejection errors.
 */
export function validateToolCalls(calls: unknown[]): ParsedToolCalls {
  const valid: ToolCall[] = [];
  const errors: ToolCallError[] = [];

  if (!Array.isArray(calls)) {
    return { valid, errors: [{ id: "batch", type: "MALFORMED_CALL", message: "Tool calls must be an array" }] };
  }

  for (const call of calls) {
    const error = validateToolCall(call);
    if (error) {
      errors.push(error);
    } else {
      const obj = call as Record<string, unknown>;
      valid.push({
        id: obj.id as string,
        name: obj.name as string,
        arguments: ((obj.arguments as Record<string, unknown>) || {}),
      });
    }
  }

  return { valid, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3. PARSER — Normalizes provider-specific output into ToolCall[]
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse tool calls from various formats into canonical ToolCall[].
 * Handles: arrays of objects, function_call style, text-embedded JSON.
 */
export function parseToolCalls(raw: unknown, source: string = "unknown"): ParsedToolCalls {
  let calls: unknown[] = [];

  if (Array.isArray(raw)) {
    calls = raw;
  } else if (raw && typeof raw === "object") {
    // Single tool call or function_call format
    const obj = raw as Record<string, unknown>;

    // Gemini function_call format: { name, arguments }
    if (obj.name && typeof obj.name === "string") {
      calls = [raw];
    }

    // { tool_calls: [...] } format
    if (Array.isArray(obj.tool_calls)) {
      calls = obj.tool_calls;
    }

    // { tools: [...] } format
    if (Array.isArray(obj.tools)) {
      calls = obj.tools;
    }
  }

  // Assign IDs to calls that lack them
  const numbered = calls.map((call, i) => {
    if (call && typeof call === "object") {
      const obj = call as Record<string, unknown>;
      if (!obj.id) {
        obj.id = `tc_${Date.now()}_${i}`;
      }
      // Normalize 'arguments' / 'args' / 'parameters' → 'arguments'
      if (!obj.arguments && obj.args) obj.arguments = obj.args;
      if (!obj.arguments && obj.parameters) obj.arguments = obj.parameters;
    }
    return call;
  });

  const result = validateToolCalls(numbered);
  result.raw = raw;
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4. FALLBACK PARSER — Regex extraction from plain text (dev/compat only)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fallback parser: extracts JSON tool calls from plain text responses.
 * Used only when structured output is unavailable (development/compat mode).
 * NEVER the primary mechanism.
 */
export function fallbackParseToolCalls(text: string): ParsedToolCalls {
  const calls: unknown[] = [];

  // Try to find JSON arrays in the text
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        calls.push(...parsed);
      }
    } catch { /* not valid JSON */ }
  }

  // Try to find JSON objects with tool-like structure
  const objectMatches = text.matchAll(/\{[^{}]*"(?:name|tool)"\s*:\s*"[^"]+"[^{}]*\}/g);
  for (const match of objectMatches) {
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed && (parsed.name || parsed.tool) && !calls.some((c: any) => c.id === parsed.id)) {
        calls.push(parsed);
      }
    } catch { /* not valid JSON */ }
  }

  return parseToolCalls(calls, "fallback");
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5. PROVIDER ADAPTERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Context for a tool-planning request. */
export interface ToolPlanRequest {
  userInput: string;
  geminiKey: string;
  toolDeclarations: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  /** Previous tool results, for continuation calls. */
  previousResults?: ToolCallResult[];
}

// ─── Gemini Adapter ──────────────────────────────────────────────────────────

/**
 * Ask Gemini to produce structured tool calls for a user request.
 * Uses a prompt that explicitly requests JSON output matching the ToolCall schema.
 * Validates and parses the response into canonical ToolCall[].
 */
export async function geminiToolPlanner(request: ToolPlanRequest): Promise<ParsedToolCalls> {
  const { userInput, geminiKey, toolDeclarations, previousResults } = request;

  const toolDescriptions = toolDeclarations
    .map((t) => {
      const params = Object.entries(t.parameters.properties || {})
        .map(([k, v]: [string, any]) => `  "${k}": ${v.type}${v.description ? ` // ${v.description}` : ""}`)
        .join("\n");
      const required = ((t.parameters as any).required || []).join(", ");
      return `- ${t.name}: ${t.description}\n  Parameters:\n${params || "  (none)"}\n  Required: ${required || "none"}`;
    })
    .join("\n\n");

  const previousContext = previousResults?.length
    ? `\n\nPrevious tool results:\n${previousResults.map((r) => `- ${r.tool} (${r.id}): ${r.success ? "SUCCESS" : "FAILED"} — ${r.message || r.error?.message || "no details"}`).join("\n")}`
    : "";

  const prompt = `You are Nova's structured tool planner. Given a user request, produce a JSON array of tool calls.

AVAILABLE TOOLS:
${toolDescriptions}
${previousContext}

USER REQUEST: "${userInput}"

RULES:
1. Return ONLY a valid JSON array. No explanation, no markdown, no code fences.
2. Each element must have exactly: "id" (string, unique), "name" (tool name from above), "arguments" (object matching the tool's parameters).
3. Tool names MUST be exactly as listed above (e.g. "memory.save", not "save_memory").
4. Arguments MUST match the tool's parameter types (string fields get strings, number fields get numbers).
5. Required fields MUST be provided.
6. Do NOT include arguments not listed in the tool's parameters.
7. If no tools are needed, return [].
8. Preserve tool call IDs across continuation calls if previousResults are provided.

RESPOND WITH ONLY THE JSON ARRAY:`;

  try {
    const response = await callGemini(geminiKey, prompt, undefined, "reasoning");

    // Try structured parse first
    const parsed = tryParseJSON(response);
    if (parsed !== null) {
      return parseToolCalls(parsed, "gemini");
    }

    // Fallback to regex extraction
    return fallbackParseToolCalls(response);
  } catch (err) {
    console.warn("[ToolCallParser] Gemini planning failed:", err);
    return { valid: [], errors: [], raw: err };
  }
}

// ─── Local Model Adapter ─────────────────────────────────────────────────────

/**
 * Normalize local model structured output into canonical ToolCall[].
 * Local models may use different JSON schemas or formats.
 */
export function normalizeLocalModelOutput(raw: unknown): ParsedToolCalls {
  if (!raw) return { valid: [], errors: [] };

  // Direct array
  if (Array.isArray(raw)) {
    return parseToolCalls(raw, "local-model");
  }

  // Object with various key names
  const obj = raw as Record<string, unknown>;

  // { function_call: { name, arguments } }
  if (obj.function_call && typeof obj.function_call === "object") {
    const fc = obj.function_call as Record<string, unknown>;
    return parseToolCalls([{
      id: `tc_${Date.now()}_0`,
      name: fc.name,
      arguments: fc.arguments || fc.parameters || {},
    }], "local-model");
  }

  // { tool_call: { name, arguments } }
  if (obj.tool_call && typeof obj.tool_call === "object") {
    const tc = obj.tool_call as Record<string, unknown>;
    return parseToolCalls([{
      id: `tc_${Date.now()}_0`,
      name: tc.name,
      arguments: tc.arguments || tc.parameters || {},
    }], "local-model");
  }

  // { tools: [...] } or { tool_calls: [...] }
  const arr = obj.tools || obj.tool_calls || obj.calls;
  if (Array.isArray(arr)) {
    return parseToolCalls(arr, "local-model");
  }

  return { valid: [], errors: [], raw };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §6. EXECUTOR — Runs validated tool calls through ToolExecutor
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute a batch of validated tool calls sequentially.
 * Preserves call IDs in results for correct attachment.
 * Returns results in the same order as input calls.
 */
export async function executeToolCalls(
  calls: ToolCall[],
  context: ToolContext,
  source: "voice" | "chat" | "quick-action" = "chat"
): Promise<ToolCallResult[]> {
  const results: ToolCallResult[] = [];

  for (const call of calls) {
    const start = Date.now();

    try {
      const result = await toolExecutor.execute(call.name, call.arguments, context, {
        source,
      });

      results.push({
        id: call.id,
        tool: call.name,
        success: result.success,
        data: result.data,
        message: result.message,
        error: result.error,
        metadata: { executionMs: Date.now() - start },
      });
    } catch (err) {
      results.push({
        id: call.id,
        tool: call.name,
        success: false,
        error: {
          code: "EXECUTION_ERROR",
          message: err instanceof Error ? err.message : "Unknown error",
        },
        metadata: { executionMs: Date.now() - start },
      });
    }
  }

  return results;
}

/**
 * Execute tool calls that can run in parallel (no dependencies between them).
 */
export async function executeToolCallsParallel(
  calls: ToolCall[],
  context: ToolContext,
  source: "voice" | "chat" | "quick-action" = "chat"
): Promise<ToolCallResult[]> {
  return Promise.all(calls.map((call) => executeToolCalls([call], context, source).then((r) => r[0])));
}

/**
 * High-level: plan tools with AI, validate, execute, return results.
 * This is the primary entry point replacing the old planToolsWithAI.
 */
export async function planAndExecuteTools(
  request: ToolPlanRequest,
  context: ToolContext,
  options?: { parallel?: boolean; source?: "voice" | "chat" | "quick-action" }
): Promise<{ calls: ToolCall[]; results: ToolCallResult[]; errors: ToolCallError[] }> {
  // Plan
  const planned = await geminiToolPlanner(request);

  if (planned.valid.length === 0 && planned.errors.length === 0) {
    return { calls: [], results: [], errors: [] };
  }

  // Execute
  const results = options?.parallel
    ? await executeToolCallsParallel(planned.valid, context, options?.source)
    : await executeToolCalls(planned.valid, context, options?.source);

  return {
    calls: planned.valid,
    results,
    errors: planned.errors,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7. UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/** Safely parse JSON, returning null on failure. */
function tryParseJSON(text: string): unknown | null {
  try {
    // Try to extract JSON from potential wrapper text
    const trimmed = text.trim();

    // Direct array or object
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      return JSON.parse(trimmed);
    }

    // Find first JSON structure in text
    const firstBracket = trimmed.indexOf("[");
    const firstBrace = trimmed.indexOf("{");
    const start = firstBracket >= 0 && (firstBrace < 0 || firstBracket < firstBrace)
      ? firstBracket
      : firstBrace;

    if (start >= 0) {
      return JSON.parse(trimmed.slice(start));
    }
  } catch { /* not valid JSON */ }
  return null;
}

/**
 * Build Gemini function declarations from ToolRegistry.
 * Used by providers that support structured function calling.
 */
export function buildFunctionDeclarations(): Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return toolRegistry.listAvailable().map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(tool.inputSchema.properties).map(([k, v]) => [
          k,
          { type: v.type, description: v.description || "" },
        ])
      ),
      required: tool.inputSchema.required || [],
    },
  }));
}
