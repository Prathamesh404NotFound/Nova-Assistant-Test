/**
 * Gemini Interactions API adapter.
 *
 * Google recommends the Interactions API for new agentic workflows. This
 * module provides an agent-mode path alongside the existing generateContent
 * REST client (GeminiClient.ts), which continues to serve normal chat.
 *
 * The adapter:
 *  - uses conversation state + tool declarations
 *  - normalizes errors into the same AIErrorCode family
 *  - degrades gracefully: when Interactions is unavailable the caller keeps
 *    using the legacy path (never a hard dependency)
 */

import { resolveGeminiKey, AIError } from "@/services/ai/gemini/GeminiClient";

const INTERACTIONS_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

/** Tools the agent may call, in Interactions API declaration format. */
export interface InteractionToolDeclaration {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface InteractionTurn {
  role: "user" | "model";
  content: string;
}

export interface InteractionRequest {
  model: string;
  systemInstruction?: string;
  history: InteractionTurn[];
  userMessage: string;
  tools?: InteractionToolDeclaration[];
  abortSignal?: AbortSignal;
  /** 10s default — agentic calls may take longer than plain chat. */
  timeoutMs?: number;
}

export interface InteractionFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface InteractionResult {
  text: string;
  functionCalls: InteractionFunctionCall[];
  /** Interaction/thread id for stateful follow-ups. */
  interactionId?: string;
  raw?: unknown;
}

function normalizeHttpError(status: number, body: string): AIError {
  const lower = body.toLowerCase();
  if (status === 400 && /api key|api_key/.test(lower)) {
    return new AIError("INVALID_API_KEY", "The Gemini API key was rejected.", { retryable: false });
  }
  if (status === 403) {
    return new AIError("INVALID_API_KEY", "Gemini rejected this key (permission denied).", { retryable: false });
  }
  if (status === 404) {
    return new AIError("MODEL_NOT_FOUND", "The requested model is not available for Interactions.", { retryable: true });
  }
  if (status === 429) {
    return new AIError("RATE_LIMITED", "Gemini rate limit reached. Try again shortly.", { retryable: true });
  }
  if (status >= 500) {
    return new AIError("SERVER_ERROR", "Gemini server error. Try again shortly.", { retryable: true });
  }
  return new AIError("UNKNOWN", `Gemini request failed (${status}).`, { retryable: true });
}

class GeminiInteractionsAdapter {
  private unavailableUntil = 0;

  /** Circuit breaker: skip Interactions for 5 minutes after a 404/501. */
  isAvailable(): boolean {
    return Date.now() > this.unavailableUntil;
  }

  markUnavailable(): void {
    this.unavailableUntil = Date.now() + 5 * 60_000;
  }

  async run(request: InteractionRequest): Promise<InteractionResult> {
    const key = resolveGeminiKey("");
    if (!key) throw new AIError("NO_API_KEY", "No Gemini API key configured.", { retryable: false });
    if (!this.isAvailable()) {
      throw new AIError("UNKNOWN", "Interactions API temporarily unavailable — use legacy path.", { retryable: true });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 10_000);
    if (request.abortSignal) {
      request.abortSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      const res = await fetch(INTERACTIONS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: `models/${request.model}`,
          input: [
            ...request.history.map((t) => ({
              role: t.role === "user" ? "user" : "model",
              content: t.content,
            })),
            { role: "user", content: request.userMessage },
          ],
          ...(request.systemInstruction
            ? { systemInstruction: { parts: [{ text: request.systemInstruction }] } }
            : {}),
          ...(request.tools && request.tools.length > 0
            ? { tools: [{ functionDeclarations: request.tools }] }
            : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 404 || res.status === 501) this.markUnavailable();
        throw normalizeHttpError(res.status, body);
      }

      const data = (await res.json()) as {
        id?: string;
        outputs?: Array<{
          type?: string;
          text?: string;
          functionCall?: { name?: string; arguments?: Record<string, unknown> | string };
        }>;
      };

      let text = "";
      const functionCalls: InteractionFunctionCall[] = [];
      for (const output of data.outputs ?? []) {
        if (output.type === "text" && output.text) text += output.text;
        if (output.functionCall?.name) {
          let args: Record<string, unknown> = {};
          const rawArgs = output.functionCall.arguments;
          if (typeof rawArgs === "string") {
            try {
              args = JSON.parse(rawArgs) as Record<string, unknown>;
            } catch {
              args = {};
            }
          } else if (rawArgs && typeof rawArgs === "object") {
            args = rawArgs;
          }
          functionCalls.push({ name: output.functionCall.name, args });
        }
      }

      return { text, functionCalls, interactionId: data.id, raw: data };
    } catch (err) {
      if (err instanceof AIError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new AIError("TIMEOUT", "The request timed out.", { retryable: true });
      }
      throw new AIError("NETWORK_ERROR", "Could not reach Gemini. Check your connection.", { retryable: true });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const geminiInteractions = new GeminiInteractionsAdapter();
