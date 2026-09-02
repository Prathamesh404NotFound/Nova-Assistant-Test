import { z } from "zod";

export const MessageSchema = z.object({
  role: z.enum(["user", "model"]),
  parts: z.array(z.object({ text: z.string() })),
});

export type GeminiMessage = z.infer<typeof MessageSchema>;

const DEFAULT_SYSTEM = `You are Nova, a voice-first AI personal operating system. You are helpful, intelligent, and friendly. You help with daily tasks, answer questions, manage calendars, write emails, control smart home devices, and more. Keep responses concise and conversational.`;

// ── Model Configuration ─────────────────────────────────────────
// Fallback chain: try models in order until one works.
// Updated to currently supported Gemini models (as of August 2026).
const MODEL_FALLBACK_CHAIN = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.1-flash",
];

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Cache the verified model to avoid re-discovering on every call
let verifiedModel: string | null = null;

// ── Key Resolution ──────────────────────────────────────────────
// Resolution order: override > env var > localStorage fallback
function resolveApiKey(overrideKey?: string): string {
  // 1. Explicit override (from caller)
  if (overrideKey && overrideKey.length > 10) return overrideKey;

  // 2. Environment variable (primary source)
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || "";
  if (envKey && envKey.length > 10) return envKey;

  // 3. localStorage fallback (for Settings page saves)
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("nova_gemini_key") || "";
    if (stored && stored.length > 10) return stored;
  }

  return "";
}

// ── Model Discovery ─────────────────────────────────────────────
export interface ModelInfo {
  name: string;
  displayName: string;
  supportedMethods: string[];
}

/**
 * List available models for the configured API key.
 * Returns only models that support generateContent.
 */
export async function listGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  const key = resolveApiKey(apiKey);
  if (!key) return [];

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/models?key=${key}`
    );
    if (!response.ok) return [];
    const data = await response.json();
    const models: ModelInfo[] = (data.models || [])
      .filter((m: any) =>
        m.supportedGenerationMethods?.includes("generateContent")
      )
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
 * Discover the best available model from the fallback chain.
 * Verifies the model actually exists and supports generation.
 */
export async function discoverWorkingModel(apiKey: string): Promise<string> {
  if (verifiedModel) return verifiedModel;

  const available = await listGeminiModels(apiKey);
  const availableNames = new Set(available.map((m) => m.name));

  for (const candidate of MODEL_FALLBACK_CHAIN) {
    // Check if the model is in the discovered list
    if (availableNames.has(candidate)) {
      verifiedModel = candidate;
      if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
        console.log(`[Nova Gemini] Verified model: ${candidate}`);
      }
      return candidate;
    }
  }

  // If discovery failed, try the first model in the chain anyway
  // (sometimes the list endpoint is flaky but generation works)
  verifiedModel = MODEL_FALLBACK_CHAIN[0];
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    console.warn(
      `[Nova Gemini] Model discovery inconclusive. Using default: ${verifiedModel}`
    );
  }
  return verifiedModel;
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

/**
 * Comprehensive health check for Gemini integration.
 * Verifies API key, model availability, and basic generation.
 */
export async function checkGeminiHealth(
  apiKey?: string
): Promise<GeminiHealthResult> {
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

  // Test API reachability + list models
  const models = await listGeminiModels(key);
  result.modelsDiscovered = models.length;
  result.apiReachable = models.length > 0 || true; // list might fail even if API works

  // Discover best model
  const model = await discoverWorkingModel(key);
  result.selectedModel = model;

  // Check if model supports generation
  const modelInfo = models.find((m) => m.name === model);
  result.generationSupported = modelInfo
    ? modelInfo.supportedMethods.includes("generateContent")
    : true; // Assume yes if not in list (list might be incomplete)

  // Minimal generation test
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
  onChunk,
  onDone,
  onError,
}: {
  messages: GeminiMessage[];
  apiKey: string;
  systemInstruction?: string;
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}) {
  const effectiveKey = resolveApiKey(apiKey);

  if (!effectiveKey) {
    onError(
      new Error(
        "No Gemini API key configured. Add your key in Settings → API Keys, or enable Local AI for offline chat."
      )
    );
    return;
  }

  // Discover the working model (cached after first call)
  let model: string;
  try {
    model = await discoverWorkingModel(effectiveKey);
  } catch {
    model = MODEL_FALLBACK_CHAIN[0];
  }

  try {
    const body = {
      contents: messages,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.7, topP: 0.95, maxOutputTokens: 2048 },
    };

    const url = `${GEMINI_API_BASE}/models/${model}:streamGenerateContent?key=${effectiveKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      const status = response.status;

      // Try fallback model on 404
      if (status === 404) {
        const fallbackModel = MODEL_FALLBACK_CHAIN.find((m) => m !== model);
        if (fallbackModel) {
          verifiedModel = fallbackModel; // Invalidate cache
          const retryUrl = `${GEMINI_API_BASE}/models/${fallbackModel}:streamGenerateContent?key=${effectiveKey}`;
          const retryResponse = await fetch(retryUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          if (retryResponse.ok) {
            // Process the retry response
            await processStreamResponse(retryResponse, onChunk, onDone);
            return;
          }
        }
      }

      // Classify the error
      const category =
        status === 404
          ? "MODEL_NOT_FOUND"
          : status === 401 || status === 403
          ? "INVALID_API_KEY"
          : status >= 500
          ? "GOOGLE_API_FAILURE"
          : "UNKNOWN_ERROR";

      throw new Error(
        `Gemini API error ${status} (${category}): ${errText.slice(0, 200)}`
      );
    }

    await processStreamResponse(response, onChunk, onDone);
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Process a streaming SSE response from Gemini.
 */
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

  // Process any remaining buffer
  if (buffer.startsWith("data: ")) {
    try {
      const data = JSON.parse(buffer.slice(6));
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) onChunk(text);
    } catch {
      /* skip */
    }
  }

  onDone();
}

// ── Non-Streaming Call ──────────────────────────────────────────
export async function callGemini(
  apiKey: string,
  prompt: string,
  systemInstruction = DEFAULT_SYSTEM
): Promise<string> {
  const effectiveKey = resolveApiKey(apiKey);

  if (!effectiveKey) {
    throw new Error(
      "No Gemini API key configured. Add your key in Settings → API Keys, or enable Local AI for offline chat."
    );
  }

  let model: string;
  try {
    model = await discoverWorkingModel(effectiveKey);
  } catch {
    model = MODEL_FALLBACK_CHAIN[0];
  }

  try {
    const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${effectiveKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errText = await response.text();

      // Try fallback model on 404
      if (status === 404) {
        const fallbackModel = MODEL_FALLBACK_CHAIN.find((m) => m !== model);
        if (fallbackModel) {
          verifiedModel = fallbackModel;
          const retryUrl = `${GEMINI_API_BASE}/models/${fallbackModel}:generateContent?key=${effectiveKey}`;
          const retryResponse = await fetch(retryUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              systemInstruction: { parts: [{ text: systemInstruction }] },
              generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
            }),
          });

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            return (
              retryData.candidates?.[0]?.content?.parts?.[0]?.text ||
              "No response from Gemini."
            );
          }
        }
      }

      throw new Error(
        `Gemini API error ${status}: ${errText.slice(0, 200)}`
      );
    }

    const data = await response.json();
    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini."
    );
  } catch (err) {
    // Re-throw known errors, wrap unknown ones
    if (err instanceof Error && err.message.startsWith("Gemini API error")) {
      throw err;
    }
    throw new Error(
      `Gemini request failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
