/**
 * Nova AI Router
 * Coordinates routing between local Qwen2.5-0.5B and Gemini.
 * Gemini HTTP details live in services/ai/gemini/GeminiClient.
 * Memory/emotion/personality are best-effort context — failures never break chat.
 *
 * FALLBACK POLICY (strict — never mask model failure):
 *   Gemini success → return Gemini answer.
 *   Gemini failure → classify the error:
 *     - transient (NETWORK_ERROR / TIMEOUT / RATE_LIMITED / MODEL_NOT_FOUND / SERVER_ERROR)
 *         → try Local Qwen if available & suitable
 *         → otherwise return an HONEST technical error
 *     - configuration (NO_API_KEY / INVALID_API_KEY)
 *         → try Local Qwen if available, else a clear configuration error
 *     - CONTENT_BLOCKED → honest blocked-content message (no fake answer)
 *   Deterministic intents (greetings/thanks) are handled by
 *   LocalConversationEngine.tryGenerateResponse BEFORE any model call —
 *   never as a substitute for model inference.
 *
 * Every response carries source/model/latency/fallbackUsed metadata so the
 * UI never labels a fallback as the primary backend.
 */

import { localAIService, type ChatMessage as LocalChatMessage } from "../ai/local/LocalAIService";
import { getAIMode, type AIMode } from "./local/LocalAISettings";
import {
  geminiGenerate,
  geminiStream,
  resolveGeminiKey,
  AIError,
  type AITaskType,
} from "@/services/ai/gemini/GeminiClient";
import { LocalConversationEngine, type DeterministicResult } from "@/services/ai/local-conversation";
import { buildProactiveContext } from "@/services/ai/proactive-context";
import { buildPersonalityPromptSuffix } from "@/services/ai/personality-engine";
import { getGoalsContext, getUpcomingDeadlines } from "@/services/ai/goal-tracker";
import { recordSuccess, recordFailure, getRecommendedRoute, autoRecover } from "@/services/ai/health-monitor";

export type AIRouterSource = "local" | "gemini";

export interface AIRouterResponse {
  text: string;
  source: AIRouterSource;
  latencyMs: number;
  /** Structured error code when the response came from a fallback path. */
  errorCode?: string;
  /** Human-readable reason a fallback was used (dev diagnostics + UI). */
  fallbackReason?: string;
  /** True when the answer came from a fallback backend, not the primary. */
  fallbackUsed: boolean;
  /** Actual model identifier that produced the text. */
  model?: string;
  /** Optional explicit text to speak in voice mode. If omitted, `text` is used. */
  speakText?: string;
}

export interface AIRouterCallbacks {
  onChunk?: (text: string) => void;
  onAcknowledgement?: (text: string) => void;
}

function devLog(...args: unknown[]): void {
  if (import.meta.env.DEV) console.debug("[Nova Router]", ...args);
}

/**
 * Map internal task classification to the GeminiClient task type.
 * Only text-capable tasks are ever sent to Gemini chat.
 */
function toGeminiTask(input: string): AITaskType {
  const lower = input.toLowerCase();
  const wordCount = input.split(/\s+/).length;
  if (/\b(analyze|explain.?in.?detail|step.?by.?step|compare|essay|research|deep.?dive)\b/i.test(lower) || wordCount > 40) {
    return "reasoning";
  }
  if (/\b(code|script|function|debug|refactor|typescript|python|javascript)\b/i.test(lower)) {
    return "code";
  }
  return "chat";
}

/** User-facing honest error text per structured error code. */
function honestErrorMessage(code: string, detail?: string): string {
  switch (code) {
    case "NO_API_KEY":
      return "I can't reach cloud AI — no Gemini API key is configured. Add one in Settings → API Keys, or switch to Local AI mode in Settings → AI Mode.";
    case "INVALID_API_KEY":
      return "The configured Gemini API key was rejected. Please check it in Settings → API Keys.";
    case "CONTENT_BLOCKED":
      return "I can't answer that — the content was blocked by safety filters. Try rephrasing your question.";
    case "RATE_LIMITED":
      return "Cloud AI is rate-limited right now. Please try again in a moment, or switch to Local AI mode.";
    case "MODEL_NOT_FOUND":
      return "The selected AI model is currently unavailable. Try again shortly or switch models in Settings.";
    case "NETWORK_ERROR":
    case "TIMEOUT":
      return `I couldn't reach cloud AI${detail ? ` (${detail})` : ""} and local AI isn't available on this device. Check your connection and try again.`;
    case "SERVER_ERROR":
      return "The AI service reported a server error. Please try again shortly.";
    default:
      return `I couldn't generate an answer${detail ? `: ${detail}` : ""}. This is a technical issue, not a missing feature — try again or switch AI modes in Settings.`;
  }
}

// ── Context prompt (non-blocking, cached by state fingerprint) ─────────────

const BASE_PROMPT =
  "You are Nova, a voice-first AI personal operating system. You are helpful, intelligent, and friendly. Keep responses concise and conversational.\n\nIMPORTANT RULES:\n- When asked to create a task, calendar event, or send an email, only confirm success if the system actually executed it — do NOT fabricate results.\n- CRITICAL: Match the user's language. Hindi input → respond entirely in Hindi. English input → English. Mixed → dominant language.\n- Never prepend meta-commentary or emotion labels to your reply.";

/**
 * Build an enriched system prompt. Every sub-step is individually guarded:
 * a failure in memory, personality, goals, or proactive context degrades
 * gracefully to the base prompt instead of failing the request.
 */
async function buildEnrichedPrompt(userInput: string, conversationHistory: Array<{ role: string; content: string }>): Promise<string> {
  let prompt = BASE_PROMPT;

  // Conversation context — so follow-ups like "what about Next.js?" resolve.
  if (conversationHistory.length > 1) {
    const recent = conversationHistory.slice(-8)
      .map((m) => `${m.role === "user" ? "User" : "Nova"}: ${m.content.slice(0, 300)}`)
      .join("\n");
    prompt += `\n\nRecent conversation (use for follow-up context like "what about it?"):\n${recent}`;
  }

  // Memory — best effort, must never block chat
  try {
    const { unifiedMemory } = await import("@/services/memory/MemoryService");
    await Promise.race([
      unifiedMemory.initialize(),
      new Promise((_, reject) => setTimeout(reject, 1500)),
    ]);
    const contextMemories = await unifiedMemory.recall({
      currentMessage: userInput,
      maxMemories: 6,
    });
    if (contextMemories.length > 0) {
      prompt += `\n\nStored User Context (use to personalize responses):\n${unifiedMemory.formatForContext(contextMemories)}`;
    }
  } catch (err) {
    devLog("memory context unavailable:", err instanceof Error ? err.message : err);
  }

  // Personality — decorative
  try {
    const suffix = buildPersonalityPromptSuffix();
    if (suffix) prompt += suffix;
  } catch { /* non-critical */ }

  // Goals — decorative
  try {
    const goals = getGoalsContext();
    if (goals) prompt += `\n\n${goals}`;
    const deadlines = getUpcomingDeadlines(3);
    if (deadlines.length > 0) {
      prompt += `\n\nUpcoming Deadlines (mention if relevant):\n${deadlines
        .map((g) => `- "${g.title}" (${g.priority} priority)`)
        .join("\n")}`;
    }
  } catch { /* non-critical */ }

  // Proactive context — decorative
  try {
    const proactiveCtx = await buildProactiveContext();
    if (proactiveCtx) prompt += proactiveCtx;
  } catch { /* non-critical */ }

  return prompt;
}

/**
 * Cache keyed by a state fingerprint (input + memory/session state), not raw
 * input alone — prevents stale memory from leaking into unrelated requests.
 * Small LRU with TTL avoids unbounded growth.
 */
const _promptCache = new Map<string, string>();
const _promptCacheTs = new Map<string, number>();
const PROMPT_CACHE_TTL = 30_000;
const PROMPT_CACHE_MAX = 30;

async function fingerprint(): Promise<string> {
  try {
    const { unifiedMemory } = await import("@/services/memory/MemoryService");
    const anyMem = unifiedMemory as unknown as { getAllMemories?: () => unknown[] };
    const count = typeof anyMem.getAllMemories === "function" ? anyMem.getAllMemories().length : 0;
    return `${count}:${Math.floor(Date.now() / PROMPT_CACHE_TTL)}`;
  } catch {
    return "nomem";
  }
}

async function getSystemPrompt(input: string, conversationHistory: Array<{ role: string; content: string }>): Promise<string> {
  const fp = await fingerprint();
  const cacheKey = `${input.slice(0, 120)}|${conversationHistory.length}|${fp}`;
  const cached = _promptCache.get(cacheKey);
  if (cached && Date.now() - (_promptCacheTs.get(cacheKey) ?? 0) < PROMPT_CACHE_TTL) {
    return cached;
  }
  const prompt = await buildEnrichedPrompt(input, conversationHistory);
  if (_promptCache.size >= PROMPT_CACHE_MAX) {
    const oldest = _promptCacheTs.keys().next().value;
    if (oldest) {
      _promptCache.delete(oldest);
      _promptCacheTs.delete(oldest);
    }
  }
  _promptCache.set(cacheKey, prompt);
  _promptCacheTs.set(cacheKey, Date.now());
  return prompt;
}

// ── Local route ─────────────────────────────────────────────────────────────

async function routeToLocal(
  input: string,
  conversationHistory: Array<{ role: string; content: string }>,
  options?: AIRouterCallbacks
): Promise<AIRouterResponse> {
  const startTime = performance.now();
  // Input string + history → the service applies the Nova system prompt,
  // chat template and sliding history window internally.
  const response = await localAIService.generate(
    input,
    { maxNewTokens: 256, temperature: 0.7 },
    { onToken: options?.onChunk, onDone: () => {}, onError: (err) => devLog("local error:", err.message) },
    conversationHistory
  );
  recordSuccess("local-ai", response.latencyMs);
  return {
    text: response.text,
    source: response.source,
    latencyMs: response.latencyMs,
    fallbackUsed: false,
    model: "Qwen2.5-0.5B-Instruct",
  };
}

/**
 * Try local Qwen as a genuine fallback generator. Returns null when local AI
 * is unavailable or fails — the caller then surfaces an honest error.
 */
async function tryLocalFallback(
  input: string,
  conversationHistory: Array<{ role: string; content: string }>,
  reason: string,
  options?: AIRouterCallbacks
): Promise<AIRouterResponse | null> {
  try {
    const avail = await localAIService.detect();
    if (!avail.supported) {
      devLog(`local fallback skipped (${reason}): model not available`);
      return null;
    }
    await localAIService.ensureReady();
    const result = await routeToLocal(input, conversationHistory, options);
    return {
      ...result,
      fallbackUsed: true,
      fallbackReason: reason,
      errorCode: reason,
    };
  } catch (err) {
    recordFailure("local-ai", err instanceof Error ? err.message : "unknown");
    devLog(`local fallback failed (${reason}):`, err);
    return null;
  }
}

// ── Gemini route ────────────────────────────────────────────────────────────

async function routeToGemini(
  input: string,
  geminiKey: string,
  conversationHistory: Array<{ role: string; content: string }>,
  options?: AIRouterCallbacks
): Promise<AIRouterResponse> {
  const startTime = performance.now();

  options?.onAcknowledgement?.("Analyzing your request...");

  const systemInstruction = await getSystemPrompt(input, conversationHistory);
  const task = toGeminiTask(input);
  const contents = [{ role: "user", parts: [{ text: input }] }];

  let textResponse = "";
  let errorCode: string | undefined;
  let usedModel = "gemini";

  try {
    if (options?.onChunk) {
      let accumulated = "";
      const streamResult = await geminiStream(
        { apiKey: geminiKey, task, contents, systemInstruction },
        (acc) => {
          accumulated = acc;
          options.onChunk?.(acc);
        }
      );
      textResponse = streamResult.text;
      if (streamResult.model && streamResult.model !== "streamed") usedModel = streamResult.model;
    } else {
      const genResult = await geminiGenerate({ apiKey: geminiKey, task, contents, systemInstruction });
      textResponse = genResult.text;
      usedModel = genResult.model;
    }

    if (!textResponse.trim()) {
      throw new AIError("UNKNOWN", "Gemini returned an empty response", { retryable: true });
    }
    recordSuccess("gemini-api", Math.round(performance.now() - startTime));
  } catch (err) {
    const aiErr = err instanceof AIError ? err : new AIError("UNKNOWN", String(err));
    errorCode = aiErr.code;
    recordFailure("gemini-api", `${aiErr.code}: ${aiErr.message}`);
    devLog("gemini failed:", aiErr.code, aiErr.message);

    // ── Structured fallback policy — NEVER a canned acknowledgement ──
    const transient = aiErr.code === "NETWORK_ERROR" || aiErr.code === "TIMEOUT"
      || aiErr.code === "RATE_LIMITED" || aiErr.code === "MODEL_NOT_FOUND"
      || aiErr.code === "SERVER_ERROR" || aiErr.code === "UNKNOWN";
    const configError = aiErr.code === "NO_API_KEY" || aiErr.code === "INVALID_API_KEY";

    if (aiErr.code === "CONTENT_BLOCKED") {
      // Honest blocked-content message — no fake answer.
      return {
        text: honestErrorMessage("CONTENT_BLOCKED"),
        source: "gemini",
        latencyMs: Math.round(performance.now() - startTime),
        errorCode: aiErr.code,
        fallbackUsed: false,
        model: usedModel,
      };
    }

    if (transient || configError) {
      const local = await tryLocalFallback(input, conversationHistory, aiErr.code, options);
      if (local) return local;
    }

    // No local fallback available → honest technical error.
    return {
      text: honestErrorMessage(aiErr.code, aiErr.message),
      source: "gemini",
      latencyMs: Math.round(performance.now() - startTime),
      errorCode: aiErr.code,
      fallbackUsed: false,
      model: usedModel,
    };
  }

  const latencyMs = Math.round(performance.now() - startTime);
  return { text: textResponse, source: "gemini", latencyMs, fallbackUsed: false, model: usedModel, speakText: textResponse };
}

// ── Orchestrator ────────────────────────────────────────────────────────────

export async function routeMessage(
  input: string,
  conversationHistory: Array<{ role: string; content: string }>,
  geminiKey: string,
  options?: {
    mode?: AIMode;
    onChunk?: (text: string) => void;
    onAcknowledgement?: (text: string) => void;
  }
): Promise<AIRouterResponse> {
  const mode = options?.mode || getAIMode();
  autoRecover();
  const healthRoute = getRecommendedRoute();

  // ── Deterministic layer FIRST (greetings/thanks only — never a substitute
  //    for model inference on arbitrary questions). ──
  const deterministic: DeterministicResult = LocalConversationEngine.tryGenerateResponse(input);
  if (deterministic.handled && deterministic.text) {
    devLog("deterministic match:", deterministic.category, JSON.stringify(input.slice(0, 40)));
    return {
      text: deterministic.text,
      source: "local",
      latencyMs: 0,
      fallbackUsed: false,
      model: "deterministic",
    };
  }

  // MODE: Force Gemini
  if (mode === "gemini") {
    return routeToGemini(input, geminiKey, conversationHistory, options);
  }

  // MODE: Force Local
  if (mode === "local") {
    const avail = await localAIService.detect();
    if (!avail.supported) {
      // Honest capability error — no canned filler.
      return {
        text: "Local AI is not available on this device. Switch to Auto or Gemini mode in Settings → AI Mode.",
        source: "local",
        latencyMs: 0,
        errorCode: "LOCAL_UNAVAILABLE",
        fallbackUsed: false,
        model: "none",
      };
    }
    try {
      await localAIService.ensureReady();
      return await routeToLocal(input, conversationHistory, options);
    } catch (err) {
      devLog("local failed → gemini fallback:", err);
      const geminiResult = await routeToGemini(input, geminiKey, conversationHistory, options);
      return {
        ...geminiResult,
        fallbackUsed: geminiResult.errorCode === undefined,
        fallbackReason: geminiResult.errorCode ? geminiResult.fallbackReason : "LOCAL_FAILED",
        errorCode: geminiResult.errorCode ?? "LOCAL_FAILED_FALLBACK",
      };
    }
  }

  // MODE: Auto — classify then route, with cross-fallback both ways
  const classification = localAIService.classify(input);
  devLog("auto classification:", classification.decision, classification.reason);

  // Local route only for genuinely local-suitable messages (simple
  // conversation), AND when local AI is actually healthy. Unknown/general
  // questions go to the real AI — "unknown" never means canned response.
  if (classification.decision === "local" && healthRoute !== "gemini") {
    try {
      const avail = await localAIService.detect();
      if (avail.supported) {
        await localAIService.ensureReady();
        return await routeToLocal(input, conversationHistory, options);
      }
    } catch (err) {
      devLog("local route failed, escalating:", err);
      recordFailure("local-ai", err instanceof Error ? err.message : "unknown");
    }
  }

  // No key configured → try local Qwen for a REAL generated answer first,
  // then an honest configuration error. Never a canned filler.
  const hasKey = resolveGeminiKey(geminiKey).length > 0;
  if (!hasKey) {
    const local = await tryLocalFallback(input, conversationHistory, "NO_API_KEY", options);
    if (local) return local;
    return {
      text: honestErrorMessage("NO_API_KEY"),
      source: "local",
      latencyMs: 0,
      errorCode: "NO_API_KEY",
      fallbackUsed: false,
      model: "none",
    };
  }

  return routeToGemini(input, geminiKey, conversationHistory, options);
}
