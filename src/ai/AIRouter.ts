/**
 * Nova AI Router
 * Coordinates routing between local Qwen3 and Gemini.
 * Gemini HTTP details live in services/ai/gemini/GeminiClient.
 * Memory/emotion/personality are best-effort context — failures never break chat.
 */

import { localAIService, type ChatMessage as LocalChatMessage } from "./local/LocalAIService";
import { getAIMode, type AIMode } from "./local/LocalAISettings";
import {
  geminiGenerate,
  geminiStream,
  resolveGeminiKey,
  AIError,
  type AITaskType,
} from "@/services/ai/gemini/GeminiClient";
import { LocalConversationEngine } from "@/services/ai/local-conversation";
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
 * Build a compact conversation history for the local model.
 */
function buildLocalMessages(
  conversationHistory: Array<{ role: string; content: string }>,
  currentInput: string
): LocalChatMessage[] {
  const messages: LocalChatMessage[] = [];
  const recentHistory = conversationHistory.slice(-6);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }
  messages.push({ role: "user", content: currentInput });
  return messages;
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

// ── Context prompt (non-blocking, cached by state fingerprint) ─────────────

const BASE_PROMPT =
  "You are Nova, a voice-first AI personal operating system. You are helpful, intelligent, and friendly. Keep responses concise and conversational.\n\nIMPORTANT RULES:\n- When asked to create a task, calendar event, or send an email, only confirm success if the system actually executed it — do NOT fabricate results.\n- CRITICAL: Match the user's language. Hindi input → respond entirely in Hindi. English input → English. Mixed → dominant language.\n- Never prepend meta-commentary or emotion labels to your reply.";

/**
 * Build an enriched system prompt. Every sub-step is individually guarded:
 * a failure in memory, personality, goals, or proactive context degrades
 * gracefully to the base prompt instead of failing the request.
 */
async function buildEnrichedPrompt(userInput: string): Promise<string> {
  let prompt = BASE_PROMPT;

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

async function getSystemPrompt(input: string): Promise<string> {
  const fp = await fingerprint();
  const cacheKey = `${input.slice(0, 120)}|${fp}`;
  const cached = _promptCache.get(cacheKey);
  if (cached && Date.now() - (_promptCacheTs.get(cacheKey) ?? 0) < PROMPT_CACHE_TTL) {
    return cached;
  }
  const prompt = await buildEnrichedPrompt(input);
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
  const localMessages = buildLocalMessages(conversationHistory, input);
  const response = await localAIService.generate(
    localMessages,
    { maxNewTokens: 256, temperature: 0.7 },
    { onToken: options?.onChunk, onDone: () => {}, onError: (err) => devLog("local error:", err.message) }
  );
  recordSuccess("local-ai", response.latencyMs);
  return response;
}

// ── Gemini route ────────────────────────────────────────────────────────────

async function routeToGemini(
  input: string,
  geminiKey: string,
  options?: AIRouterCallbacks
): Promise<AIRouterResponse> {
  const startTime = performance.now();

  options?.onAcknowledgement?.("Analyzing your request...");

  const systemInstruction = await getSystemPrompt(input);
  const task = toGeminiTask(input);
  const contents = [{ role: "user", parts: [{ text: input }] }];

  let textResponse = "";
  let errorCode: string | undefined;

  try {
    if (options?.onChunk) {
      let accumulated = "";
      await geminiStream(
        { apiKey: geminiKey, task, contents, systemInstruction },
        (acc) => {
          accumulated = acc;
          options.onChunk?.(acc);
        }
      );
      textResponse = accumulated;
    } else {
      textResponse = (await geminiGenerate({ apiKey: geminiKey, task, contents, systemInstruction })).text;
    }

    if (!textResponse.trim()) {
      throw new AIError("UNKNOWN", "Gemini returned an empty response", { retryable: true });
    }
    recordSuccess("gemini-api", Math.round(performance.now() - startTime));
  } catch (err) {
    const aiErr = err instanceof AIError ? err : new AIError("UNKNOWN", String(err));
    errorCode = aiErr.code;
    recordFailure("gemini-api", `${aiErr.code}: ${aiErr.message}`);
    devLog("gemini failed → local fallback:", aiErr.code, aiErr.message);

    const fallback = LocalConversationEngine.generateResponse(input);
    textResponse =
      fallback ||
      (aiErr.code === "NO_API_KEY"
        ? "I need a Gemini API key for complex questions. Add one in Settings → API Keys, or switch to Local AI mode."
        : "I'm having trouble reaching cloud AI right now. Your question may work in Local AI mode — try Settings → AI Mode.");
  }

  const latencyMs = Math.round(performance.now() - startTime);
  return { text: textResponse, source: "gemini", latencyMs, errorCode, speakText: textResponse };
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

  // MODE: Force Gemini
  if (mode === "gemini") {
    return routeToGemini(input, geminiKey, options);
  }

  // MODE: Force Local
  if (mode === "local") {
    const avail = await localAIService.detect();
    if (!avail.supported) {
      return {
        text: "Local AI is not available on this device. Switch to Auto or Gemini mode in Settings.",
        source: "local",
        latencyMs: 0,
        errorCode: "LOCAL_UNAVAILABLE",
      };
    }
    try {
      await localAIService.ensureReady();
      return await routeToLocal(input, conversationHistory, options);
    } catch (err) {
      devLog("local failed → gemini fallback:", err);
      const geminiResult = await routeToGemini(input, geminiKey, options);
      return { ...geminiResult, errorCode: geminiResult.errorCode ?? "LOCAL_FAILED_FALLBACK" };
    }
  }

  // MODE: Auto — classify then route, with cross-fallback both ways
  const classification = localAIService.classify(input);

  const tryLocal = async (): Promise<AIRouterResponse | null> => {
    if (healthRoute === "gemini") return null;
    if (classification.decision !== "local") return null;
    try {
      const avail = await localAIService.detect();
      if (!avail.supported) return null;
      await localAIService.ensureReady();
      return await routeToLocal(input, conversationHistory, options);
    } catch (err) {
      devLog("local route failed, escalating:", err);
      recordFailure("local-ai", err instanceof Error ? err.message : "unknown");
      return null;
    }
  };

  if (classification.decision === "local") {
    const localResult = await tryLocal();
    if (localResult) return localResult;
  }

  // No key configured and local didn't apply → deterministic local fallback
  const hasKey = resolveGeminiKey(geminiKey).length > 0;
  if (!hasKey) {
    const fallback = LocalConversationEngine.generateResponse(input);
    return {
      text: fallback || "I need a Gemini API key for this. Add one in Settings → API Keys, or enable Local AI.",
      source: "local",
      latencyMs: 0,
      errorCode: "NO_API_KEY",
    };
  }

  return routeToGemini(input, geminiKey, options);
}
