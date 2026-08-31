export type Intent =
  | "GREETING"
  | "CONVERSATION"
  | "MEMORY_READ"
  | "MEMORY_WRITE"
  | "TASK_CREATE"
  | "TASK_READ"
  | "TASK_UPDATE"
  | "TASK_DELETE"
  | "TIME"
  | "DATE"
  | "CALCULATION"
  | "NAVIGATION"
  | "DEVICE_ACTION"
  | "AUTOMATION"
  | "TOOL_EXECUTION"
  | "COMPLEX_REASONING"
  | "KNOWLEDGE_QUERY"
  | "UNKNOWN";

export interface IntentResult {
  intent: Intent;
  confidence: number;
  requiresGemini: boolean;
  requiresTool: boolean;
  extractedData?: Record<string, any>;
}

export type NovaState =
  | "IDLE"
  | "LISTENING"
  | "THINKING_LOCAL"
  | "THINKING_GEMINI"
  | "EXECUTING"
  | "SPEAKING"
  | "ERROR";

export interface NovaResponse {
  text: string;
  source: "local" | "gemini";
  intent: Intent;
  latencyMs: number;
  shouldSpeak: boolean;
  toolResult?: unknown;
  navigationTarget?: string;
  acknowledgement?: string;
}

export interface LatencyMetrics {
  sttMs?: number;
  routingMs: number;
  memoryMs: number;
  toolMs: number;
  geminiMs: number;
  ttsStartMs?: number;
  totalMs: number;
}
