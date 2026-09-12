/**
 * Nova Gemini Client
 * Dedicated abstraction over the Gemini REST API.
 * - Capability-based model selection (never picks a TTS/vision model for chat)
 * - Structured, normalized errors
 * - Timeouts, transient retry, cancellation
 * - Temporary failure cache per model
 */

// ── Structured errors ───────────────────────────────────────────────────────

export type AIErrorCode =
  | "NO_API_KEY"
  | "INVALID_API_KEY"
  | "RATE_LIMITED"
  | "MODEL_NOT_FOUND"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "CONTENT_BLOCKED"
  | "SERVER_ERROR"
  | "UNKNOWN";

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(code: AIErrorCode, message: string, opts?: { retryable?: boolean; status?: number }) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.retryable = opts?.retryable ?? false;
    this.status = opts?.status;
  }
}

// ── Task types and capabilities ─────────────────────────────────────────────

export type AITaskType =
  | "chat"
  | "code"
  | "reasoning"
  | "vision"
  | "image"
  | "transcription"
  | "tts"
  | "live";

/** Models grouped by verified capability. Text models are listed lightest → heaviest. */
const TEXT_CAPABLE = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

const REASONING_CAPABLE = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

/** Maps a task to an ordered chain of compatible model candidates. */
function modelChainFor(task: AITaskType): string[] {
  switch (task) {
    case "reasoning":
      return REASONING_CAPABLE;
    case "code":
      return ["gemini-2.5-flash", ...TEXT_CAPABLE];
    case "chat":
    default:
      // Non-text tasks must NEVER appear in the text chain.
      return TEXT_CAPABLE;
  }
}

// ── Model failure cache ─────────────────────────────────────────────────────

const MODEL_FAIL_TTL_MS = 60_000;
const modelFailures = new Map<string, { at: number; code: AIErrorCode }>();

function markModelFailed(model: string, code: AIErrorCode): void {
  modelFailures.set(model, { at: Date.now(), code });
}

function clearModelFailure(model: string): void {
  modelFailures.delete(model);
}

function isModelBlocked(model: string): boolean {
  const f = modelFailures.get(model);
  if (!f) return false;
  if (Date.now() - f.at > MODEL_FAIL_TTL_MS) {
    modelFailures.delete(model);
    return false;
  }
  return true;
}

/** Last known-good model per task type, remembered for fast selection. */
const knownGood = new Map<AITaskType, string>();

export function getLastGoodModel(task: AITaskType): string | null {
  return knownGood.get(task) ?? null;
}

export function resetModelFailures(): void {
  modelFailures.clear();
}

// ── Key resolution ──────────────────────────────────────────────────────────

let cachedKey: { key: string; source: "override" | "env" | "storage" } | null = null;

export function resolveGeminiKey(overrideKey?: string): string {
  if (overrideKey && overrideKey.trim().length > 10) {
    return overrideKey.trim();
  }
  if (cachedKey && cachedKey.source !== "storage") return cachedKey.key;

  const envKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || "";
  if (envKey.trim().length > 10) {
    cachedKey = { key: envKey.trim(), source: "env" };
    return cachedKey.key;
  }
  if (typeof localStorage !== "undefined") {
    const stored = (localStorage.getItem("nova_gemini_key") || "").trim();
    if (stored.length > 10) {
      cachedKey = { key: stored, source: "storage" };
      return stored;
    }
  }
  return "";
}

// ── Error normalization ─────────────────────────────────────────────────────

function normalizeHttpError(status: number, body: string): AIError {
  const snippet = body.slice(0, 200);
  if (status === 400 && /API key not valid/i.test(body)) {
    return new AIError("INVALID_API_KEY", "The Gemini API key is invalid.", { status });
  }
  if (status === 401 || status === 403) {
    return new AIError("INVALID_API_KEY", "Gemini rejected the API key (permission denied).", { status });
  }
  if (status === 404) {
    return new AIError("MODEL_NOT_FOUND", "The selected Gemini model is unavailable.", { retryable: true, status });
  }
  if (status === 429) {
    return new AIError("RATE_LIMITED", "Gemini rate limit reached. Try again shortly.", { retryable: true, status });
  }
  if (status === 400 && /blocked|safety/i.test(body)) {
    return new AIError("CONTENT_BLOCKED", "The response was blocked by safety filters.", { status });
  }
  if (status >= 500) {
    return new AIError("SERVER_ERROR", `Gemini server error (${status}).`, { retryable: true, status });
  }
  return new AIError("UNKNOWN", `Gemini API error ${status}: ${snippet}`, { status });
}

function normalizeFetchError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  if (err instanceof DOMException && err.name === "AbortError") {
    return new AIError("TIMEOUT", "Gemini request timed out.", { retryable: true });
  }
  const msg = err instanceof Error ? err.message : String(err);
  return new AIError("NETWORK_ERROR", `Gemini request failed: ${msg}`, { retryable: true });
}

// ── Core request helpers ────────────────────────────────────────────────────

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const REQUEST_TIMEOUT_MS = 30_000;
const STREAM_IDLE_TIMEOUT_MS = 60_000;

interface GenerateParams {
  apiKey?: string;
  task: AITaskType;
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  systemInstruction?: string;
  generationConfig?: Record<string, unknown>;
  signal?: AbortSignal;
}

async function generateWithModel(
  model: string,
  params: GenerateParams,
  streaming: boolean
): Promise<Response> {
  const key = resolveGeminiKey(params.apiKey);
  if (!key) {
    throw new AIError("NO_API_KEY", "No Gemini API key configured. Add one in Settings → API Keys.");
  }

  const method = streaming ? "streamGenerateContent" : "generateContent";
  const url = `${API_BASE}/models/${model}:${method}?key=${key}&alt=sse`;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), streaming ? STREAM_IDLE_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  // Chain external cancellation
  const onExternalAbort = () => abort.abort();
  params.signal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: params.contents,
        ...(params.systemInstruction && { systemInstruction: { parts: [{ text: params.systemInstruction }] } }),
        generationConfig: params.generationConfig ?? { temperature: 0.7, maxOutputTokens: 2048 },
      }),
      signal: abort.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw normalizeHttpError(response.status, body);
    }
    return response;
  } catch (err) {
    throw normalizeFetchError(err);
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener("abort", onExternalAbort);
  }
}

/** Try the model chain in order; remember the first model that works. */
async function withModelFallback<T>(
  params: GenerateParams,
  streaming: boolean,
  run: (model: string, response: Response) => Promise<T>
): Promise<{ result: T; model: string }> {
  const chain = modelChainFor(params.task);
  const preferred = knownGood.get(params.task);
  const ordered = preferred
    ? [preferred, ...chain.filter((m) => m !== preferred)]
    : chain;

  let lastError: AIError | null = null;

  for (const model of ordered) {
    if (isModelBlocked(model) && model !== preferred) continue;
    try {
      const response = await generateWithModel(model, params, streaming);
      const result = await run(model, response);
      clearModelFailure(model);
      knownGood.set(params.task, model);
      return { result, model };
    } catch (err) {
      const aiErr = err instanceof AIError ? err : normalizeFetchError(err);
      lastError = aiErr;
      if (aiErr.code === "NO_API_KEY" || aiErr.code === "INVALID_API_KEY" || aiErr.code === "CONTENT_BLOCKED") {
        throw aiErr; // Not model-specific — don't burn the chain
      }
      markModelFailed(model, aiErr.code);
      // Retryable (model/network/server) → try next compatible model
      if (!aiErr.retryable) throw aiErr;
    }
  }

  throw lastError ?? new AIError("UNKNOWN", "All Gemini models failed.");
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface GeminiResult {
  text: string;
  model: string;
}

/** Non-streaming generation. Returns empty text as "" — callers decide fallback. */
export async function geminiGenerate(params: GenerateParams): Promise<GeminiResult> {
  const { result, model } = await withModelFallback(params, false, async (m, response) => {
    const data = await response.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { text: text.trim(), model: m };
  });
  return result;
}

/** Streaming generation via SSE. onChunk receives the accumulated text so far. */
export async function geminiStream(
  params: GenerateParams,
  onChunk: (accumulated: string) => void
): Promise<GeminiResult> {
  const { result } = await withModelFallback(params, true, async (_model, response) => {
    const reader = response.body?.getReader();
    if (!reader) throw new AIError("NETWORK_ERROR", "Gemini stream returned no body.", { retryable: true });

    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const data = JSON.parse(payload);
          const piece: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (piece) {
            accumulated += piece;
            onChunk(accumulated);
          }
        } catch {
          // Skip malformed SSE chunks — never crash the stream
        }
      }
    }

    return accumulated;
  });

  return { text: result.trim(), model: "streamed" };
}

/** Quick availability probe used by Settings/diagnostics. Never throws. */
export async function geminiHealthCheck(apiKey?: string): Promise<{
  configured: boolean;
  reachable: boolean;
  model: string | null;
  error?: string;
}> {
  const key = resolveGeminiKey(apiKey);
  if (!key) return { configured: false, reachable: false, model: null, error: "No API key" };
  try {
    const res = await fetch(`${API_BASE}/models?key=${key}`);
    if (!res.ok) {
      const err = normalizeHttpError(res.status, await res.text().catch(() => ""));
      return { configured: true, reachable: false, model: null, error: `${err.code}: ${err.message}` };
    }
    const data = await res.json();
    const available = new Set<string>(
      (data.models ?? [])
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: any) => (m.name ?? "").replace("models/", ""))
    );
    const model = modelChainFor("chat").find((m) => available.has(m)) ?? null;
    return { configured: true, reachable: true, model, error: model ? undefined : "No compatible chat model found" };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      model: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
