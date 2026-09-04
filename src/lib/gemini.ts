import { z } from "zod";

export const MessageSchema = z.object({
  role: z.enum(["user", "model"]),
  parts: z.array(z.object({ text: z.string() })),
});

export type GeminiMessage = z.infer<typeof MessageSchema>;

const DEFAULT_SYSTEM = `You are Nova, a voice-first AI personal operating system. You are helpful, intelligent, and friendly. You help with daily tasks, answer questions, manage calendars, write emails, control smart home devices, and more. Keep responses concise and conversational.`;

// ── Model Registry (verified Sept 2026) ────────────────────────
// Sorted lightest → heaviest for text/chat tasks.
export interface GeminiModel {
  id: string;
  label: string;
  purpose: string;
  tier: "lite" | "standard" | "advanced" | "specialized";
}

export const GEMINI_MODELS: GeminiModel[] = [
  { id: "gemini-3.1-flash-lite", label: "Flash Lite", purpose: "Fast/lightweight text & multimodal", tier: "lite" },
  { id: "gemini-3.5-flash", label: "3.5 Flash", purpose: "General AI, agents, coding", tier: "standard" },
  { id: "gemini-3.6-flash", label: "3.6 Flash", purpose: "General AI, agents, coding", tier: "standard" },
  { id: "gemini-3.7-flash", label: "3.7 Flash", purpose: "General AI, reasoning, coding", tier: "standard" },
  { id: "gemini-3-flash-preview", label: "3 Flash", purpose: "General multimodal AI", tier: "standard" },
  { id: "gemini-3.1-pro-preview", label: "3.1 Pro", purpose: "Advanced reasoning/coding", tier: "advanced" },
  { id: "gemini-3-pro-preview", label: "3 Pro", purpose: "Advanced reasoning/multimodal", tier: "advanced" },
];

// Specialized models (not in fallback chain — selected explicitly)
export const SPECIALIZED_MODELS: GeminiModel[] = [
  { id: "gemini-3.5-transcribe", label: "3.5 Transcribe", purpose: "Speech → text", tier: "specialized" },
  { id: "gemini-3.1-flash-live-preview", label: "Flash Live", purpose: "Real-time voice conversations", tier: "specialized" },
  { id: "gemini-3.1-flash-tts-preview", label: "Flash TTS", purpose: "Text → speech", tier: "specialized" },
  { id: "gemini-3.1-flash-image", label: "Flash Image", purpose: "Image generation/editing", tier: "specialized" },
  { id: "gemini-3.1-flash-lite-image", label: "Flash Lite Image", purpose: "Faster/lower-cost image generation", tier: "specialized" },
];

// ── Fallback Chain ──────────────────────────────────────────────
// General chat fallback: lightest → heaviest
const CHAT_FALLBACK_CHAIN = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3-flash-preview",
];

// Code/reasoning fallback: heavier models first
const CODE_FALLBACK_CHAIN = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.1-pro-preview",
];

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Cache the verified model to avoid re-discovering on every call
let verifiedModel: string | null = null;
let verifiedCodeModel: string | null = null;

// ── Timeout Configuration ──────────────────────────────────────
const REQUEST_TIMEOUT_MS = 30_000; // 30s for non-streaming
const STREAM_TIMEOUT_MS = 60_000;   // 60s max streaming window

// ── Response Cleanup ───────────────────────────────────────────
/** Strip common Gemini artifacts and clean up response text. */
function cleanResponse(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();
  // Remove common Gemini preamble artifacts
  cleaned = cleaned.replace(/^(?:Here(?:'s| is| are)|Sure,?|Of course,?|Certainly,?|Let me|i'll|i will|I'll|I will)\s*/i, "");
  // Remove trailing code fences that weren't properly closed
  if ((cleaned.match(/```/g) || []).length % 2 !== 0) {
    cleaned = cleaned.replace(/```\s*$/, "");
  }
  return cleaned;
}

// ── Key Resolution ──────────────────────────────────────────────
function resolveApiKey(overrideKey?: string): string {
  if (overrideKey && overrideKey.length > 10) return overrideKey;
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || "";
  if (envKey && envKey.length > 10) return envKey;
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("nova_gemini_key") || "";
    if (stored && stored.length > 10) return stored;
  }
  return "";
}

// ── Smart Model Routing ─────────────────────────────────────────
// Select the lightest model that can handle the input's complexity.
export type TaskType = "chat" | "code" | "reasoning" | "transcribe" | "tts" | "image" | "live";

/**
 * Analyze user input and classify the task complexity.
 */
export function classifyTask(input: string): TaskType {
  const lower = input.toLowerCase().trim();
  const wordCount = input.split(/\s+/).length;

  // Code-related
  if (/\b(code|script|function|class|import|export|debug|lint|compile|typescript|python|javascript|react|component)\b/i.test(lower)) {
    return "code";
  }

  // Transcription
  if (/\b(transcribe|speech.?to.?text|audio.?to.?text|what.?did.?i.?say|dictation)\b/i.test(lower)) {
    return "transcribe";
  }

  // TTS
  if (/\b(speak|say aloud|read aloud|text.?to.?speech|convert.?to.?speech|say this|voice output)\b/i.test(lower)) {
    return "tts";
  }

  // Image generation
  if (/\b(generate.?image|create.?image|draw|illustration|picture of|image of|photo of|design a)\b/i.test(lower)) {
    return "image";
  }

  // Complex reasoning
  if (wordCount > 30 || /\b(analyze|explain.?in.?detail|step.?by.?step|compare.?and.?contrast|pros.?and.?cons|write.?an? essay|research|deep.?dive)\b/i.test(lower)) {
    return "reasoning";
  }

  return "chat";
}

/**
 * Select the optimal Gemini model for a given task.
 * Returns the lightest model that handles the complexity.
 */
export function selectModelForTask(task: TaskType): string {
  switch (task) {
    case "transcribe": return "gemini-3.5-transcribe";
    case "tts": return "gemini-3.1-flash-tts-preview";
    case "image": return "gemini-3.1-flash-lite-image";
    case "live": return "gemini-3.1-flash-live-preview";
    case "reasoning": return "gemini-3.7-flash";
    case "code": return "gemini-3.5-flash";
    case "chat":
    default: return "gemini-3.1-flash-lite";
  }
}

/**
 * Get the appropriate fallback chain for a task type.
 */
function getFallbackChain(task: TaskType): string[] {
  if (task === "code" || task === "reasoning") return CODE_FALLBACK_CHAIN;
  return CHAT_FALLBACK_CHAIN;
}

// ── Model Discovery ─────────────────────────────────────────────
export interface ModelInfo {
  name: string;
  displayName: string;
  supportedMethods: string[];
}

export async function listGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  const key = resolveApiKey(apiKey);
  if (!key) return [];

  try {
    const response = await fetch(`${GEMINI_API_BASE}/models?key=${key}`);
    if (!response.ok) return [];
    const data = await response.json();
    const models: ModelInfo[] = (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: any) => ({
        name: m.name?.replace("models/", "") || "",
        displayName: m.displayName || "",
        supportedMethods: m.supportedGenerationMethods || [],
      }));
    return models;
  } catch {
    return [];
  }
}

/**
 * Discover the best available model for a given task.
 * Tries the task's preferred model, then falls back through the chain.
 */
export async function discoverWorkingModel(
  apiKey: string,
  task: TaskType = "chat"
): Promise<string> {
  // Return cached if same task type
  if (task === "code" && verifiedCodeModel) return verifiedCodeModel;
  if (task !== "code" && verifiedModel) return verifiedModel;

  const preferred = selectModelForTask(task);
  const available = await listGeminiModels(apiKey);
  const availableNames = new Set(available.map((m) => m.name));

  // Try preferred model first
  if (availableNames.has(preferred)) {
    if (task === "code") verifiedCodeModel = preferred;
    else verifiedModel = preferred;
    return preferred;
  }

  // Try fallback chain
  const chain = getFallbackChain(task);
  for (const candidate of chain) {
    if (availableNames.has(candidate)) {
      if (task === "code") verifiedCodeModel = candidate;
      else verifiedModel = candidate;
      return candidate;
    }
  }

  // Discovery inconclusive — use first in chain
  const fallback = chain[0];
  if (task === "code") verifiedCodeModel = fallback;
  else verifiedModel = fallback;
  return fallback;
}

// ── Health Check ────────────────────────────────────────────────
export interface GeminiHealthResult {
  apiKeyConfigured: boolean;
  apiReachable: boolean;
  modelsDiscovered: number;
  selectedModel: string;
  generationSupported: boolean;
  testPassed: boolean;
  error?: string;
}

export async function checkGeminiHealth(apiKey?: string): Promise<GeminiHealthResult> {
  const key = resolveApiKey(apiKey);
  const result: GeminiHealthResult = {
    apiKeyConfigured: !!key,
    apiReachable: false,
    modelsDiscovered: 0,
    selectedModel: "",
    generationSupported: false,
    testPassed: false,
  };

  if (!key) {
    result.error = "No API key configured";
    return result;
  }

  const models = await listGeminiModels(key);
  result.modelsDiscovered = models.length;
  result.apiReachable = true;

  const model = await discoverWorkingModel(key, "chat");
  result.selectedModel = model;

  const modelInfo = models.find((m) => m.name === model);
  result.generationSupported = modelInfo
    ? modelInfo.supportedMethods.includes("generateContent")
    : true;

  try {
    const testResult = await callGemini(key, "Reply with exactly: NOVA_OK");
    result.testPassed = testResult.includes("NOVA_OK");
    if (!result.testPassed) {
      result.error = `Generation returned unexpected response: "${testResult.slice(0, 100)}"`;
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

// ── Streaming Response ──────────────────────────────────────────
export async function streamGeminiResponse({
  messages,
  apiKey,
  systemInstruction = DEFAULT_SYSTEM,
  taskType,
  onChunk,
  onDone,
  onError,
}: {
  messages: GeminiMessage[];
  apiKey: string;
  systemInstruction?: string;
  taskType?: TaskType;
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}) {
  const effectiveKey = resolveApiKey(apiKey);

  if (!effectiveKey) {
    onError(
      new Error("No Gemini API key configured. Add your key in Settings → API Keys, or enable Local AI for offline chat.")
    );
    return;
  }

  const task = taskType || classifyTask(messages[messages.length - 1]?.parts?.[0]?.text || "");

  let model: string;
  try {
    model = await discoverWorkingModel(effectiveKey, task);
  } catch {
    model = getFallbackChain(task)[0];
  }

  try {
    const body = {
      contents: messages,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 2048 },
    };

    const url = `${GEMINI_API_BASE}/models/${model}:streamGenerateContent?key=${effectiveKey}`;
    // Use AbortController for timeout
    const streamAbort = new AbortController();
    const streamTimer = setTimeout(() => streamAbort.abort(), STREAM_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: streamAbort.signal,
      });
    } catch (err: unknown) {
      clearTimeout(streamTimer);
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error("Gemini API request timed out. Please try again.");
      }
      throw err;
    }

    if (!response.ok) {
      clearTimeout(streamTimer);
      const errText = await response.text();
      const status = response.status;

      if (status === 404) {
        const fallbackChain = getFallbackChain(task);
        const fallbackModel = fallbackChain.find((m) => m !== model);
        if (fallbackModel) {
          verifiedModel = null;
          verifiedCodeModel = null;
          const retryUrl = `${GEMINI_API_BASE}/models/${fallbackModel}:streamGenerateContent?key=${effectiveKey}`;
          const retryResponse = await fetch(retryUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: streamAbort.signal,
          });
          if (retryResponse.ok) {
            await processStreamResponse(retryResponse, onChunk, onDone);
            clearTimeout(streamTimer);
            return;
          }
        }
      }

      clearTimeout(streamTimer);
      const category =
        status === 404 ? "MODEL_NOT_FOUND" :
        status === 401 || status === 403 ? "INVALID_API_KEY" :
        status >= 500 ? "GOOGLE_API_FAILURE" :
        "UNKNOWN_ERROR";

      throw new Error(`Gemini API error ${status} (${category}): ${errText.slice(0, 200)}`);
    }

    await processStreamResponse(response, onChunk, onDone);
    clearTimeout(streamTimer);
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

async function processStreamResponse(
  response: Response,
  onChunk: (text: string) => void,
  onDone: () => void
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) onChunk(text);
        } catch {
          /* skip malformed chunks */
        }
      }
    }
  }

  if (buffer.startsWith("data: ")) {
    try {
      const data = JSON.parse(buffer.slice(6));
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) onChunk(text);
    } catch { /* skip */ }
  }

  onDone();
}

// ── Non-Streaming Call ──────────────────────────────────────────
export async function callGemini(
  apiKey: string,
  prompt: string,
  systemInstruction = DEFAULT_SYSTEM,
  taskType?: TaskType
): Promise<string> {
  const effectiveKey = resolveApiKey(apiKey);

  if (!effectiveKey) {
    throw new Error("No Gemini API key configured. Add your key in Settings → API Keys, or enable Local AI for offline chat.");
  }

  const task = taskType || classifyTask(prompt);

  let model: string;
  try {
    model = await discoverWorkingModel(effectiveKey, task);
  } catch {
    model = getFallbackChain(task)[0];
  }

  try {    // Use AbortController for timeout
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);

    const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${effectiveKey}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
        signal: abort.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error("Gemini API request timed out. Please try again.");
      }
      throw new Error(`Gemini request failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!response.ok) {
      clearTimeout(timer);
      const status = response.status;
      const errText = await response.text();

      if (status === 404) {
        const fallbackChain = getFallbackChain(task);
        const fallbackModel = fallbackChain.find((m) => m !== model);
        if (fallbackModel) {
          verifiedModel = null;
          verifiedCodeModel = null;
          const retryUrl = `${GEMINI_API_BASE}/models/${fallbackModel}:generateContent?key=${effectiveKey}`;
          try {
            const retryResponse = await fetch(retryUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
              }),
              signal: abort.signal,
            });
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              clearTimeout(timer);
              return cleanResponse(retryData.candidates?.[0]?.content?.parts?.[0]?.text || "");
            }
          } catch { /* fall through */ }
        }
      }

      throw new Error(`Gemini API error ${status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    clearTimeout(timer);
    return cleanResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || "");
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Gemini API error")) throw err;
    throw new Error(`Gemini request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Specialized Model Calls ─────────────────────────────────────
/**
 * Call a specific specialized model (TTS, transcription, image, etc.)
 */
export async function callSpecializedModel(
  apiKey: string,
  modelId: string,
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const effectiveKey = resolveApiKey(apiKey);
  if (!effectiveKey) throw new Error("No Gemini API key configured.");

  const url = `${GEMINI_API_BASE}/models/${modelId}:generateContent?key=${effectiveKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } }),
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini ${modelId} error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
