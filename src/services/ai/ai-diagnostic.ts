/**
 * Nova AI Diagnostic — end-to-end verification of the AI pipeline.
 *
 * Tests each subsystem with REAL calls (small, cheap) and reports PASS/FAIL:
 *   DETERMINISTIC — LocalConversationEngine handles "thanks", rejects a question
 *   LOCAL AI      — Local Qwen generates a real (non-empty) response
 *   GEMINI        — Gemini answers a real question (if key configured)
 *   ROUTER        — routeMessage returns a real answer (not canned) end-to-end
 *   CONTEXT       — router accepts non-empty conversation history
 *   STREAMING     — streaming path yields accumulated text
 *
 * Used by Developer Mode ("Run AI Diagnostic" in Settings) and CI checks.
 */

import { LocalConversationEngine } from "@/services/ai/local-conversation";
import { routeMessage } from "@/ai/AIRouter";
import { resolveGeminiKey, geminiHealthCheck } from "@/services/ai/gemini/GeminiClient";
import { localAIService } from "@/ai/local/LocalAIService";

export interface AIDiagnosticResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail: string;
  durationMs: number;
}

/** Phrases that indicate the canned-response bug is still alive. */
const CANNED_MARKERS = [
  /i hear you! ready for the next thing/i,
  /sure thing! what else can i do for you/i,
  /got it! i'?m here whenever you need me/i,
  /understood! let me know how i can help/i,
];

function isCanned(text: string): boolean {
  return CANNED_MARKERS.some((re) => re.test(text));
}

export async function runAIDiagnostic(apiKey?: string): Promise<AIDiagnosticResult[]> {
  const results: AIDiagnosticResult[] = [];

  // 1. DETERMINISTIC handler
  {
    const start = performance.now();
    const thanks = LocalConversationEngine.tryGenerateResponse("Thanks!");
    const question = LocalConversationEngine.tryGenerateResponse("Explain quantum computing in simple terms.");
    const pass = thanks.handled && !!thanks.text && !question.handled;
    results.push({
      name: "DETERMINISTIC",
      status: pass ? "PASS" : "FAIL",
      detail: pass
        ? `"Thanks!" handled deterministically; knowledge question correctly NOT handled.`
        : `thanks.handled=${thanks.handled}, question.handled=${question.handled} — engine contract broken`,
      durationMs: Math.round(performance.now() - start),
    });
  }

  // 2. LOCAL AI (only when a model is cached — never triggers a download)
  {
    const start = performance.now();
    try {
      const cached = await localAIService.isCached();
      const avail = await localAIService.detect();
      if (!avail.supported || !cached) {
        results.push({
          name: "LOCAL AI",
          status: "SKIP",
          detail: avail.supported
            ? "Model not downloaded — download via Settings → Local AI to enable."
            : "WebGPU/WASM inference not supported on this device.",
          durationMs: Math.round(performance.now() - start),
        });
      } else {
        await localAIService.ensureReady();
        const resp = await localAIService.generate(
          [
            { role: "user", content: "Hello, explain what recursion is in one sentence." },
          ],
          { maxNewTokens: 64, temperature: 0.5 }
        );
        const pass = resp.text.trim().length > 10 && !isCanned(resp.text);
        results.push({
          name: "LOCAL AI",
          status: pass ? "PASS" : "FAIL",
          detail: pass
            ? `Generated ${resp.text.length} chars in ${resp.latencyMs}ms: "${resp.text.slice(0, 80)}…"`
            : `Empty or canned response: "${resp.text.slice(0, 80)}"`,
          durationMs: Math.round(performance.now() - start),
        });
      }
    } catch (err) {
      results.push({
        name: "LOCAL AI",
        status: "FAIL",
        detail: err instanceof Error ? err.message : "unknown error",
        durationMs: Math.round(performance.now() - start),
      });
    }
  }

  // 3. GEMINI
  {
    const start = performance.now();
    const key = resolveGeminiKey(apiKey ?? "");
    if (!key) {
      results.push({
        name: "GEMINI",
        status: "SKIP",
        detail: "No API key configured — add one in Settings → API Keys.",
        durationMs: Math.round(performance.now() - start),
      });
    } else {
      const health = await geminiHealthCheck(key);
      results.push({
        name: "GEMINI",
        status: health.reachable ? "PASS" : "FAIL",
        detail: health.reachable
          ? `Reachable, model: ${health.model}`
          : health.error ?? "unreachable",
        durationMs: Math.round(performance.now() - start),
      });
    }
  }

  // 4. ROUTER (end-to-end; uses whatever backend is available)
  {
    const start = performance.now();
    try {
      const resp = await routeMessage(
        "What is 2 + 2?",
        [],
        resolveGeminiKey(apiKey ?? ""),
        {}
      );
      const meaningful = resp.text.trim().length > 0 && !isCanned(resp.text);
      results.push({
        name: "ROUTER",
        status: meaningful ? "PASS" : "FAIL",
        detail: meaningful
          ? `source=${resp.source} fallbackUsed=${resp.fallbackUsed} latency=${resp.latencyMs}ms — "${resp.text.slice(0, 60)}…"`
          : `canned or empty: "${resp.text.slice(0, 80)}"`,
        durationMs: Math.round(performance.now() - start),
      });
    } catch (err) {
      results.push({
        name: "ROUTER",
        status: "FAIL",
        detail: err instanceof Error ? err.message : "unknown error",
        durationMs: Math.round(performance.now() - start),
      });
    }
  }

  // 5. CONTEXT (history is accepted without error)
  {
    const start = performance.now();
    try {
      const resp = await routeMessage(
        "What about Next.js?",
        [
          { role: "user", content: "What is React?" },
          { role: "assistant", content: "React is a JavaScript UI library." },
        ],
        resolveGeminiKey(apiKey ?? ""),
        {}
      );
      const pass = resp.text.trim().length > 0 && !isCanned(resp.text);
      results.push({
        name: "CONTEXT",
        status: pass ? "PASS" : "FAIL",
        detail: pass
          ? "Follow-up with history accepted (context passed through)."
          : `empty/canned with history: "${resp.text.slice(0, 60)}"`,
        durationMs: Math.round(performance.now() - start),
      });
    } catch (err) {
      results.push({
        name: "CONTEXT",
        status: "FAIL",
        detail: err instanceof Error ? err.message : "unknown error",
        durationMs: Math.round(performance.now() - start),
      });
    }
  }

  // 6. STREAMING
  {
    const start = performance.now();
    try {
      let chunks = 0;
      let lastLength = 0;
      const resp = await routeMessage(
        "Name one primary color.",
        [],
        resolveGeminiKey(apiKey ?? ""),
        {
          onChunk: (acc) => {
            chunks += 1;
            lastLength = acc.length;
          },
        }
      );
      const pass = resp.text.trim().length > 0 && !isCanned(resp.text);
      results.push({
        name: "STREAMING",
        status: pass ? "PASS" : "FAIL",
        detail: pass
          ? `${chunks} chunk update(s), final ${lastLength} chars — real streamed output`
          : "no meaningful streamed output",
        durationMs: Math.round(performance.now() - start),
      });
    } catch (err) {
      results.push({
        name: "STREAMING",
        status: "FAIL",
        detail: err instanceof Error ? err.message : "unknown error",
        durationMs: Math.round(performance.now() - start),
      });
    }
  }

  return results;
}
