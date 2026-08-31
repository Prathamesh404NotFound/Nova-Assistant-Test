import { IntentRouter } from "./intent-router";
import { LocalResponseEngine } from "./local-response-engine";
import { EscalationEngine } from "./escalation-engine";
import { requestDeduplicator } from "./request-deduplicator";
import { latencyMonitor } from "./latency-monitor";
import { usageManager } from "./usage-manager";
import { MemoryRetriever } from "../memory/memory-retriever";
import { callGemini, streamGeminiResponse } from "@/lib/gemini";
import { NovaResponse } from "./types";

export interface ProcessInputOptions {
  input: string;
  context?: string;
  apiKey?: string;
  onChunk?: (chunk: string) => void;
  onAcknowledgement?: (text: string) => void;
}

export class ResponseOrchestrator {
  static async processInput(options: ProcessInputOptions): Promise<NovaResponse> {
    const startTime = performance.now();
    const { input, context, apiKey, onChunk, onAcknowledgement } = options;

    // 1. Check duplicate request cache
    const fingerprint = requestDeduplicator.generateFingerprint(input, context);
    const cached = requestDeduplicator.getCached(fingerprint);
    if (cached) {
      return cached;
    }

    const pending = requestDeduplicator.getPending(fingerprint);
    if (pending) {
      return pending;
    }

    const processPromise = (async (): Promise<NovaResponse> => {
      // 2. Intent Routing (<20ms)
      const routeStart = performance.now();
      const intentResult = IntentRouter.classify(input);
      const routingMs = Math.round(performance.now() - routeStart);

      const requiresGemini = EscalationEngine.shouldEscalateToGemini(input, intentResult);

      if (!requiresGemini) {
        // LOCAL EXECUTION PATH (<100ms)
        const localStart = performance.now();
        const localRes = await LocalResponseEngine.handle(input, intentResult);
        const toolMs = Math.round(performance.now() - localStart);

        const totalMs = Math.round(performance.now() - startTime);
        latencyMonitor.record({
          routingMs,
          memoryMs: 0,
          toolMs,
          geminiMs: 0,
          totalMs,
        });

        const response: NovaResponse = {
          text: localRes.text,
          source: "local",
          intent: intentResult.intent,
          latencyMs: totalMs,
          shouldSpeak: true,
          navigationTarget: localRes.navigationTarget,
          toolResult: localRes.toolResult,
        };

        requestDeduplicator.setCached(fingerprint, response);
        return response;
      }

      // GEMINI ESCALATION PATH
      // Provide immediate local acknowledgement for perceived responsiveness (<150ms)
      const acknowledgementText = "Analyzing your request...";
      if (onAcknowledgement) {
        onAcknowledgement(acknowledgementText);
      }

      // Retrieve only relevant memories in parallel
      const memStart = performance.now();
      const memories = await MemoryRetriever.retrieveRelevant(input, 5);
      const memoryContext = MemoryRetriever.formatMemoriesForContext(memories);
      const memoryMs = Math.round(performance.now() - memStart);

      const systemInstruction =
        "You are Nova, an AI Personal Operating System. Provide direct, intelligent, and concise responses." +
        (memoryContext ? `\n\n${memoryContext}` : "");

      const geminiStart = performance.now();
      let textResponse = "";

      try {
        usageManager.trackGeminiUsage(200);

        if (onChunk) {
          let accumulated = "";
          await new Promise<void>((resolve, reject) => {
            streamGeminiResponse({
              messages: [{ role: "user", parts: [{ text: input }] }],
              apiKey: apiKey || "",
              systemInstruction,
              onChunk: (chunk) => {
                accumulated += chunk;
                onChunk(accumulated);
              },
              onDone: () => resolve(),
              onError: (err) => reject(err),
            });
          });
          textResponse = accumulated;
        } else {
          textResponse = await callGemini(apiKey || "", input, systemInstruction);
        }
      } catch (err: any) {
        if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
          console.error("[Nova Gemini Escalation Error]", err);
        }
        textResponse = `Gemini is unavailable right now (${err?.message || "offline"}), but all your local Nova OS capabilities remain fully active.`;
      }

      const geminiMs = Math.round(performance.now() - geminiStart);
      const totalMs = Math.round(performance.now() - startTime);

      latencyMonitor.record({
        routingMs,
        memoryMs,
        toolMs: 0,
        geminiMs,
        totalMs,
      });

      const response: NovaResponse = {
        text: textResponse,
        source: "gemini",
        intent: intentResult.intent,
        latencyMs: totalMs,
        shouldSpeak: true,
        acknowledgement: acknowledgementText,
      };

      requestDeduplicator.setCached(fingerprint, response);
      return response;
    })();

    requestDeduplicator.setPending(fingerprint, processPromise);
    return processPromise;
  }
}
