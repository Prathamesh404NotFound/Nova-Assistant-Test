/**
 * Nova AI Router
 * Central routing hub that decides between local Qwen3 and Gemini.
 * Integrates with the existing ResponseOrchestrator architecture.
 */

import { localAIService, type ChatMessage as LocalChatMessage } from "./local/LocalAIService";
import { getAIMode, type AIMode } from "./local/LocalAISettings";
import { callGemini, streamGeminiResponse, classifyTask } from "@/lib/gemini";
import { MemoryRetriever } from "@/services/memory/memory-retriever";
import { unifiedMemory } from "@/services/memory/MemoryService";
import { LocalConversationEngine } from "@/services/ai/local-conversation";
import { buildProactiveContext } from "@/services/ai/proactive-context";
import { learnFromMessage, buildPersonalityPromptSuffix } from "@/services/ai/personality-engine";
import { detectEmotion, getEmotionPrefix, getEmotionGuidelines } from "@/services/ai/emotion-engine";
import { getGoalsContext, getUpcomingDeadlines } from "@/services/ai/goal-tracker";
import { recordSuccess, recordFailure, getRecommendedRoute, autoRecover } from "@/services/ai/health-monitor";

export type AIRouterSource = "local" | "gemini";

export interface AIRouterResponse {
  text: string;
  source: AIRouterSource;
  latencyMs: number;
}

export interface AIRouterCallbacks {
  onChunk?: (text: string) => void;
  onAcknowledgement?: (text: string) => void;
}

/**
 * Build a compact conversation history for the local model.
 * Keeps only recent turns to fit within context budget.
 */
function buildLocalMessages(
  conversationHistory: Array<{ role: string; content: string }>,
  currentInput: string
): LocalChatMessage[] {
  const messages: LocalChatMessage[] = [];

  // System prompt is built into LocalAIModel.buildPrompt, so we skip it here
  // Take last 6 turns max to keep context compact for the 0.6B model
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
 * Route a message to the appropriate backend.
 */
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

  // Learn from user message for personality adaptation
  learnFromMessage(input);

  // Auto-recover any degraded components
  autoRecover();

  // Check health-based routing recommendation
  const healthRoute = getRecommendedRoute();

  // Detect emotion for response modulation
  const emotion = detectEmotion(input);
  const emotionPrefix = getEmotionPrefix(emotion);

  // MODE: Force Gemini
  if (mode === "gemini") {
    const result = await routeToGemini(input, geminiKey, options);
    return emotionPrefix ? { ...result, text: emotionPrefix + result.text } : result;
  }

  // MODE: Force Local
  if (mode === "local") {
    const avail = await localAIService.detect();
    if (!avail.supported) {
      return {
        text: "Local AI is not available on this device. Switch to Auto or Gemini mode in Settings.",
        source: "local",
        latencyMs: 0,
      };
    }
    try {
      await localAIService.ensureReady();
      const result = await routeToLocal(input, conversationHistory, options);
      return emotionPrefix ? { ...result, text: emotionPrefix + result.text } : result;
    } catch (err) {
      return {
        text: `Local AI couldn't start: ${err instanceof Error ? err.message : "Unknown error"}. Switch to Auto or Gemini mode.`,
        source: "local",
        latencyMs: 0,
      };
    }
  }

  // MODE: Auto (default) — classify and route
  const classification = localAIService.classify(input);

  // If health says local-only, skip classification
  if (healthRoute === "gemini" && classification.decision === "local") {
    // Health says use Gemini — override local preference
  } else if (classification.decision === "local") {
    try {
      const avail = await localAIService.detect();
      if (avail.supported) {
        await localAIService.ensureReady();
        const result = await routeToLocal(input, conversationHistory, options);
        return emotionPrefix ? { ...result, text: emotionPrefix + result.text } : result;
      }
    } catch {
      // Fall through to Gemini
    }
  }

  // Route to Gemini
  const result = await routeToGemini(input, geminiKey, options);
  return emotionPrefix ? { ...result, text: emotionPrefix + result.text } : result;
}

/**
 * Route to the local model.
 */
async function routeToLocal(
  input: string,
  conversationHistory: Array<{ role: string; content: string }>,
  options?: AIRouterCallbacks
): Promise<AIRouterResponse> {
  const localMessages = buildLocalMessages(conversationHistory, input);

  const response = await localAIService.generate(
    localMessages,
    { maxNewTokens: 256, temperature: 0.7 },
    {
      onToken: options?.onChunk,
      onDone: () => {},
      onError: (err) => {
        console.error("[Nova Local AI Error]", err);
      },
    }
  );

  return response;
}

/**
 * Route to Gemini (existing cloud path).
 */
/**
 * Build a memory-aware system prompt for Gemini.
 * Retrieves relevant stored memories and injects them so Nova
 * can personalize responses and recall user preferences.
 */
async function buildMemoryAwarePrompt(userInput: string): Promise<string> {
  const BASE =
    "You are Nova, a voice-first AI personal operating system. You are helpful, intelligent, and friendly. You help with daily tasks, answer questions, manage calendars, write emails, control smart home devices, and more. Keep responses concise and conversational.\n\nIMPORTANT RULES:\n- When the user asks you to remember something, confirm it was saved and do not pretend you can remember without the memory tool.\n- When asked to create a task, calendar event, or send an email, confirm the action was completed by the system — do NOT fabricate results.\n- Use the user's name and preferences when available.\n- Be direct: give the answer, then optionally ask if they want more detail.\n- CRITICAL: Match the user's language. If they write in Hindi (Devanagari script), respond entirely in Hindi. If they write in English, respond in English. If mixed, match their primary language.\n- Never reply in English when the user writes in Hindi or vice versa.\n- If the user corrects something, update your understanding and acknowledge the correction.";

  try {
    await unifiedMemory.initialize();
    
    // Use hybrid retrieval: context-aware recall for relevant memories + key preferences
    const contextMemories = await unifiedMemory.recall({
      currentMessage: userInput,
      maxMemories: 6,
    });
    
    if (contextMemories.length === 0) return BASE;
    const memoryContext = unifiedMemory.formatForContext(contextMemories);
    return `${BASE}\n\nStored User Context (use to personalize responses):\n${memoryContext}`;
  } catch {
    return BASE;
  }
}

/**
 * Build an enriched system prompt with personality, emotion, goals, and proactive context.
 */
async function buildEnrichedPrompt(userInput: string): Promise<string> {
  // Start with memory-aware base
  let prompt = await buildMemoryAwarePrompt(userInput);

  // Add personality adaptation
  const personalitySuffix = buildPersonalityPromptSuffix();
  if (personalitySuffix) prompt += personalitySuffix;

  // Add emotion-aware guidelines
  const emotion = detectEmotion(userInput);
  const emotionGuidelines = getEmotionGuidelines(emotion);
  if (emotionGuidelines) prompt += emotionGuidelines;

  // Add active goals context
  const goalsContext = getGoalsContext();
  if (goalsContext) prompt += `\n\n${goalsContext}`;

  // Add upcoming deadlines as proactive nudge
  const deadlines = getUpcomingDeadlines(3);
  if (deadlines.length > 0) {
    const deadlineLines = deadlines.map((g) =>
      `- "${g.title}" is due soon (${g.priority} priority)`
    );
    prompt += `\n\nUpcoming Deadlines (mention if relevant):\n${deadlineLines.join("\n")}`;
  }

  // Add proactive context
  try {
    const proactiveCtx = await buildProactiveContext();
    if (proactiveCtx) prompt += proactiveCtx;
  } catch { /* non-critical */ }

  return prompt;
}

// Cache system prompt per input to avoid rebuilding on retries/retries
const _systemPromptCache = new Map<string, string>();
const SYSTEM_PROMPT_CACHE_TTL = 30_000; // 30s TTL
const _systemPromptTimestamps = new Map<string, number>();

function getCachedSystemPrompt(input: string): string | null {
  const cached = _systemPromptCache.get(input);
  if (!cached) return null;
  const ts = _systemPromptTimestamps.get(input) || 0;
  if (Date.now() - ts > SYSTEM_PROMPT_CACHE_TTL) {
    _systemPromptCache.delete(input);
    _systemPromptTimestamps.delete(input);
    return null;
  }
  return cached;
}

function setCachedSystemPrompt(input: string, prompt: string): void {
  // Evict oldest if cache is large
  if (_systemPromptCache.size > 50) {
    const oldest = _systemPromptTimestamps.keys().next().value;
    if (oldest) {
      _systemPromptCache.delete(oldest);
      _systemPromptTimestamps.delete(oldest);
    }
  }
  _systemPromptCache.set(input, prompt);
  _systemPromptTimestamps.set(input, Date.now());
}

async function routeToGemini(
  input: string,
  geminiKey: string,
  options?: AIRouterCallbacks
): Promise<AIRouterResponse> {
  const startTime = performance.now();

  if (options?.onAcknowledgement) {
    options.onAcknowledgement("Analyzing your request...");
  }

  let textResponse = "";

  // Use cached system prompt if available, otherwise build enriched prompt
  let systemInstruction = getCachedSystemPrompt(input);
  if (!systemInstruction) {
    systemInstruction = await buildEnrichedPrompt(input);
    setCachedSystemPrompt(input, systemInstruction);
  }    try {
      if (options?.onChunk) {
        let accumulated = "";
        await new Promise<void>((resolve, reject) => {
          streamGeminiResponse({
            messages: [{ role: "user", parts: [{ text: input }] }],
            apiKey: geminiKey,
            taskType: classifyTask(input),
            systemInstruction,
            onChunk: (chunk) => {
              accumulated += chunk;
              options.onChunk?.(accumulated);
            },
            onDone: () => resolve(),
            onError: (err) => reject(err),
          });
        });
        textResponse = accumulated;
      } else {
        textResponse = await callGemini(geminiKey, input, systemInstruction, classifyTask(input));
      }
    } catch (err) {
      // Record failure for health monitoring
      recordFailure("gemini-api", err instanceof Error ? err.message : "unknown error");
      // On Gemini failure, fall back to local conversation engine for basic response
      const fallbackText = LocalConversationEngine.generateResponse(input);
      textResponse = fallbackText || `Gemini is unavailable right now (${
        err instanceof Error ? err.message : "offline"
      }). Try enabling Local AI in Settings.`;
    }

    // Handle empty responses — fall back to local conversation engine
    if (!textResponse || textResponse.trim().length === 0) {
      recordFailure("gemini-api", "empty response");
      textResponse = LocalConversationEngine.generateResponse(input) || "I'm not sure how to respond to that. Can you try rephrasing?";
    } else {
      // Record success
      recordSuccess("gemini-api", Math.round(performance.now() - startTime));
    }

    const latencyMs = Math.round(performance.now() - startTime);
    return { text: textResponse, source: "gemini", latencyMs };
}
