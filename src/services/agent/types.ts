/**
 * Nova Agent Architecture — Core Types
 * Shared types for ToolRegistry, ToolExecutor, and AgentOrchestrator.
 */

// ─── Tool Categories ────────────────────────────────────────────────────────

export type ToolCategory =
  | "memory"
  | "calendar"
  | "tasks"
  | "email"
  | "browser"
  | "search"
  | "files"
  | "navigation"
  | "device"
  | "notifications"
  | "plugins"
  | "automation"
  | "system";

// ─── Risk & Confirmation ────────────────────────────────────────────────────

export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export type ConfirmationMode = "none" | "prompt" | "explicit";

// ─── Tool Definition ────────────────────────────────────────────────────────

export interface ToolSchema {
  /** JSON Schema-like property definitions */
  properties: Record<string, { type: string; description?: string; required?: boolean }>;
  required?: string[];
}

export interface NovaTool {
  /** Unique tool identifier, e.g. "memory.save" */
  name: string;
  /** Human-readable description */
  description: string;
  /** Tool category for grouping and filtering */
  category: ToolCategory;
  /** Input parameter schema */
  inputSchema: ToolSchema;
  /** Risk level of this action */
  riskLevel: RiskLevel;
  /** Whether confirmation is needed (can be dynamic based on args) */
  confirmationRequired: boolean | ((args: Record<string, unknown>) => boolean);
  /** Whether the tool is currently available */
  availability?: () => boolean;
  /** Execute the tool with validated arguments and context */
  execute(
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult>;
}

// ─── Tool Execution ─────────────────────────────────────────────────────────

export interface ToolContext {
  userId: string;
  currentRoute?: string;
  currentPage?: string;
  source?: "voice" | "chat" | "quick-action" | "system";
  recentActions?: ActionLogEntry[];
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface ToolResult {
  success: boolean;
  tool: string;
  data?: unknown;
  message?: string;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
  metadata?: {
    executionMs?: number;
    source?: string;
  };
}

// ─── Action Log ─────────────────────────────────────────────────────────────

export interface ActionLogEntry {
  id: string;
  timestamp: number;
  tool: string;
  action: string;
  argumentsSummary: string;
  success: boolean;
  error?: string;
  duration: number;
  source: "voice" | "chat" | "quick-action" | "system";
}

// ─── Routing ────────────────────────────────────────────────────────────────

export type RouteDecision =
  | { route: "LOCAL_ACTION"; confidence: number; intent: string; tool?: string; args?: Record<string, unknown> }
  | { route: "AI_TOOL"; confidence: number }
  | { route: "CHAT"; confidence: number };

// ─── Agent Input/Output ─────────────────────────────────────────────────────

export interface AgentInput {
  text: string;
  source: "voice" | "chat" | "quick-action";
  context?: Partial<ToolContext>;
}

export interface AgentResult {
  /** Final response text to display */
  response: string;
  /** Whether any tools were executed */
  actionsExecuted: Array<{ tool: string; success: boolean; result?: ToolResult }>;
  /** Routing decision made */
  route: RouteDecision;
  /** Total processing time */
  durationMs: number;
  /** Whether the result is streaming */
  isStreaming?: boolean;
  /** Pending confirmation if needed */
  pendingConfirmation?: {
    actionId: string;
    tool: string;
    args: Record<string, unknown>;
    message: string;
  };
}

// ─── Confirmation ───────────────────────────────────────────────────────────

export interface PendingConfirmation {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  riskLevel: RiskLevel;
  message: string;
  createdAt: number;
  expiresAt: number;
}
