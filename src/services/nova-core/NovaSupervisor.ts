/**
 * Nova Core — supervisor.
 * Owns task classification and model routing decisions. NovaCore delegates the
 * "which brain handles this?" decision here so routing lives in one place.
 * Classification is deterministic and fast — no network calls.
 */

import type { NovaRequest, NovaTaskClass } from "./NovaTypes";

export interface SupervisorDecision {
  taskClass: NovaTaskClass;
  /** Which backend should generate the final natural-language response. */
  backend: "local" | "gemini";
  reason: string;
}

/** Tool intents that the AgentOrchestrator handles deterministically. */
const TOOL_HINTS: Array<{ re: RegExp; klass: NovaTaskClass; tools: string[] }> = [
  { re: /^(?:remember|save|store|forget)\b/i, klass: "tool_action", tools: ["memory.save", "memory.delete"] },
  { re: /^(?:schedule|create|add|set up)\b.*\b(event|meeting|appointment)\b/i, klass: "tool_action", tools: ["calendar.create"] },
  { re: /\b(what'?s on my calendar|my events|upcoming events|my tasks|remind me|add task)\b/i, klass: "tool_action", tools: ["calendar.list", "task.create"] },
  { re: /\b(send|compose|draft)\b.*\b(email|mail)\b/i, klass: "tool_action", tools: ["email.compose"] },
];

/** Signals for heavier reasoning / long-form generation. */
const HEAVY_HINTS: RegExp[] = [
  /\b(analyze|analyse|explain in detail|step[- ]by[- ]step|compare|essay|research|deep dive|design|architecture|strategy)\b/i,
];

class NovaSupervisor {
  classify(request: NovaRequest): SupervisorDecision {
    const input = request.input.trim();
    const words = input.split(/\s+/).length;

    // Multi-step: conjunctions of multiple action verbs
    const actionVerbs = (input.match(/\b(create|schedule|send|add|find|summar|compose)\b/gi) ?? []).length;
    if (actionVerbs >= 2 || /\b(then|after that|and also|briefing)\b/i.test(input)) {
      return { taskClass: "multi_step", backend: "gemini", reason: "multiple actions requested" };
    }

    // Deterministic tool intents first
    for (const hint of TOOL_HINTS) {
      if (hint.re.test(input)) {
        return { taskClass: hint.klass, backend: "local", reason: `matches ${hint.tools[0]}` };
      }
    }

    // Heavy reasoning → Gemini
    if (HEAVY_HINTS.some((re) => re.test(input)) || words > 60) {
      return { taskClass: "reasoning", backend: "gemini", reason: "complex reasoning" };
    }

    // Short greetings/smalltalk stay local/fast
    if (words <= 6 && /^(hi|hello|hey|thanks|thank you|good (morning|evening|night)|namaste)\b/i.test(input)) {
      return { taskClass: "conversation", backend: "local", reason: "smalltalk" };
    }

    // Default: normal chat — backend decided by the existing AIRouter mode.
    return { taskClass: "conversation", backend: request.mode === "gemini" ? "gemini" : "local", reason: "general conversation" };
  }
}

export const novaSupervisor = new NovaSupervisor();
