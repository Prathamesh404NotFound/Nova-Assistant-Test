/**
 * Nova Core — shared types.
 * Nova Core is the central supervisor of the entire application.
 * The UI never coordinates multiple services directly; it calls NovaCore.handle().
 */

// ─── Request / Response ──────────────────────────────────────────────────────

export type NovaInputSource =
  | "text"
  | "voice"
  | "wake_word"
  | "camera"
  | "screen"
  | "notification"
  | "automation"
  | "system_event";

export interface NovaRequest {
  id: string;
  userId: string;
  /** Logical session (browser tab / voice session) grouping related requests. */
  sessionId?: string;
  input: string;
  source: NovaInputSource;
  timestamp: number;
  conversationId?: string;
  /** "auto" lets Core pick local vs cloud; otherwise forced. */
  mode?: "auto" | "local" | "gemini";
  attachments?: Array<{ kind: "image" | "file" | "audio"; ref?: string; mimeType?: string }>;
  context?: {
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
    currentPage?: string;
    currentRoute?: string;
  };
}

export interface NovaActionRecord {
  tool: string;
  args: Record<string, unknown>;
  success: boolean;
  verified: boolean;
  durationMs: number;
  error?: string;
}

export interface NovaResponse {
  requestId: string;
  text: string;
  /** Text actually spoken when different from displayed text (speech-friendly). */
  spokenText?: string;
  status: "success" | "error" | "fallback" | "needs_confirmation";
  source: "local" | "gemini" | "tools" | "system";
  toolsUsed: string[];
  actions: NovaActionRecord[];
  confidence: number;
  /** Whether the caller should speak this response (voice source or auto-speak). */
  shouldSpeak: boolean;
  /** True when a side-effecting action awaits explicit user confirmation. */
  shouldAskConfirmation: boolean;
  metadata?: {
    sessionId?: string;
    latencyMs?: number;
    errorCode?: string;
    model?: string;
    planId?: string;
  };
}

// ─── World State ─────────────────────────────────────────────────────────────

export type VoicePhase =
  | "sleeping"
  | "wake_detected"
  | "listening"
  | "processing"
  | "speaking"
  | "interrupted"
  | "error";

export interface NovaWorldState {
  currentUser: string | null;
  currentPage: string;
  currentRoute: string;
  currentConversationId: string | null;
  voiceState: VoicePhase;
  activeTaskCount: number;
  currentTime: number;
  networkOnline: boolean;
  connectedServices: string[];
  connectedDevices: string[];
  pendingNotifications: number;
  upcomingCalendarEvents: Array<{ id: string; title: string; start: string }>;
  activeAutomations: number;
  recentActions: Array<{ tool: string; success: boolean; at: number }>;
  currentAIModel: string;
  systemHealth: "healthy" | "degraded" | "unknown";
}

// ─── Tool contract (Core-level, wraps existing registry tools) ───────────────

export type ToolCategory =
  | "system"
  | "desktop"
  | "browser"
  | "files"
  | "calendar"
  | "email"
  | "memory"
  | "vision"
  | "voice"
  | "smart_home"
  | "automation"
  | "notifications";

export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: Record<string, { type: string; description?: string; required?: boolean }>;
  permissions: string[];
  riskLevel: RiskLevel;
  execute: (args: Record<string, unknown>, ctx: { userId: string; requestId: string }) => Promise<{
    success: boolean;
    data?: unknown;
    message?: string;
    error?: string;
  }>;
  /** Optional pre-flight check; Core still enforces permissions regardless. */
  canExecute?: (ctx: { userId: string }) => boolean;
}

// ─── Planning ────────────────────────────────────────────────────────────────

export type PlanStepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface PlanStep {
  index: number;
  description: string;
  /** Tool to run, or "ai" for a reasoning step. */
  tool?: string;
  status: PlanStepStatus;
  result?: unknown;
  error?: string;
}

export interface NovaPlan {
  id: string;
  goal: string;
  steps: PlanStep[];
  createdAt: number;
}

/** Core task classification for routing. */
export type NovaTaskClass =
  | "simple_answer"
  | "conversation"
  | "tool_action"
  | "multi_step"
  | "reasoning"
  | "code"
  | "unknown";
