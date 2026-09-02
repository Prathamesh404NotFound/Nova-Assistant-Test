/**
 * Nova AI Router
 * Central routing hub that decides between local Qwen3 and Gemini.
 * Integrates with the existing ResponseOrchestrator architecture.
 */

import { localAIService, type ChatMessage as LocalChatMessage } from "./local/LocalAIService";
import { getAIMode, type AIMode } from "./local/LocalAISettings";
import { callGemini, streamGeminiResponse, classifyTask } from "@/lib/gemini";
import { MemoryRetriever } from "@/services/memory/memory-retriever";

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
      };
    }
    try {
      await localAIService.ensureReady();
      return routeToLocal(input, conversationHistory, options);
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

  // If classifier says local, try local first
  if (classification.decision === "local") {
    const avail = await localAIService.detect();
    if (avail.supported) {
      try {
        await localAIService.ensureReady();
        return routeToLocal(input, conversationHistory, options);
      } catch {
        // Fall through to Gemini
      }
    }
    // If local not available, fall through to Gemini
  }

  // Route to Gemini
  return routeToGemini(input, geminiKey, options);
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
    "You are Nova, a voice-first AI personal operating system. You are helpful, intelligent, and friendly. You help with daily tasks, answer questions, manage calendars, write emails, control smart home devices, and more. Keep responses concise and conversational.\n\nIMPORTANT RULES:\n- When the user asks you to remember something, confirm it was saved and do not pretend you can remember without the memory tool.\n- When asked to create a task, calendar event, or send an email, confirm the action was completed by the system — do NOT fabricate results.\n- Use the user's name and preferences when available.\n- Be direct: give the answer, then optionally ask if they want more detail.";

  try {
    const memories = await MemoryRetriever.retrieveRelevant(userInput, 5);
    if (memories.length === 0) return BASE;
    const memoryContext = MemoryRetriever.formatMemoriesForContext(memories);
    return `${BASE}\n\nStored User Context (use to personalize responses):\n${memoryContext}`;
  } catch {
    return BASE;
  }
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

  // Build memory-aware system prompt in parallel with streaming start
  const systemInstruction = await buildMemoryAwarePrompt(input);

  try {
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
    textResponse = `Gemini is unavailable right now (${
      err instanceof Error ? err.message : "offline"
    }). Try enabling Local AI in Settings.`;
  }

  const latencyMs = Math.round(performance.now() - startTime);
  return { text: textResponse, source: "gemini", latencyMs };
}
