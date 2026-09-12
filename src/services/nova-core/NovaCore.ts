/**
 * Nova Core — central orchestration layer.
 * The single entry point for every user request, regardless of modality.
 *
 *   USER / EVENT → NovaCore.handle() →
 *   classify (supervisor) → plan (if multi-step) → execute tools (gated +
 *   verified) → generate response (existing AIRouter) → return NovaResponse
 *
 * The UI calls `novaCore.handle(request)`; it never coordinates IntentRouter,
 * AgentOrchestrator, AIRouter, TTS and Memory itself.
 */

import { resolveGeminiKey } from "@/services/ai/gemini/GeminiClient";
import { routeMessage, type AIRouterResponse } from "@/ai/AIRouter";
import { agentOrchestrator } from "@/services/agent/AgentOrchestrator";
import { novaSupervisor } from "./NovaSupervisor";
import { novaPlanner } from "./NovaPlanner";
import { novaToolExecutor } from "./NovaToolExecutor";
import { novaObserver, toActionRecord } from "./NovaObserver";
import { novaWorld } from "./NovaContext";
import { novaEventBus } from "./NovaEventBus";
import type {
  NovaRequest,
  NovaResponse,
  NovaActionRecord,
  NovaTaskClass,
} from "./NovaTypes";

let requestCounter = 0;
function nextRequestId(): string {
  requestCounter += 1;
  return `nova-${Date.now().toString(36)}-${requestCounter.toString(36)}`;
}

/** Speech-friendly conversion of markdown-heavy responses. */
export function toSpokenText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " I've prepared a code snippet for you. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\|/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

interface TraceEntry {
  at: number;
  stage: string;
  detail: string;
}

class NovaCore {
  /** Dev-only trace of the most recent request pipeline. */
  private lastTrace: TraceEntry[] = [];
  private traceEnabled = import.meta.env.DEV;

  private trace(stage: string, detail: string): void {
    if (!this.traceEnabled) return;
    this.lastTrace.push({ at: Date.now(), stage, detail });
    console.debug(`[Nova Core] ${stage}: ${detail}`);
  }

  getTrace(): TraceEntry[] {
    return this.lastTrace;
  }

  /**
   * Handle a request end-to-end. Never throws — every failure becomes a
   * structured NovaResponse so the UI always has something honest to show.
   */
  async handle(
    request: NovaRequest,
    stream?: {
      onChunk?: (text: string) => void;
      onAcknowledgement?: (text: string) => void;
    }
  ): Promise<NovaResponse> {
    const started = Date.now();
    this.lastTrace = [];
    novaWorld.start();

    const requestId = request.id || nextRequestId();
    this.trace("request", `${request.source}: "${request.input.slice(0, 60)}"`);

    novaEventBus.emit("ai.started", { requestId, taskClass: "pending" });

    try {
      // 1. Classify
      const decision = novaSupervisor.classify(request);
      this.trace("classify", `${decision.taskClass} → ${decision.backend} (${decision.reason})`);
      novaEventBus.emit("ai.started", { requestId, taskClass: decision.taskClass });

      // 2. Plan for multi-step / reasoning tasks
      const plan =
        decision.taskClass === "multi_step" || decision.taskClass === "reasoning"
          ? novaPlanner.createPlan(request.input, decision.taskClass, requestId)
          : null;
      if (plan) this.trace("plan", plan.steps.map((s) => s.description).join(" → "));

      // 3. Try deterministic tool execution first (agent orchestrator fast path)
      const toolActions: NovaActionRecord[] = [];
      let toolResponseText: string | null = null;

      if (decision.taskClass === "tool_action") {
        const agentResult = await this.runAgentPath(request, requestId);
        if (agentResult) {
          toolResponseText = agentResult.text;
          toolActions.push(...agentResult.actions);
        }
      }

      if (toolResponseText !== null) {
        this.trace("tools", `${toolActions.length} executed`);
        return this.buildResponse({
          requestId,
          text: toolResponseText,
          status: "success",
          source: "tools",
          actions: toolActions,
          startedAt: started,
          confidence: 0.9,
          shouldSpeak: request.source === "voice" || request.source === "wake_word",
        });
      }

      // 4. Execute plan steps for multi-step requests (observe + verify each)
      if (plan) {
        for (const step of plan.steps) {
          if (step.tool === "ai" || !step.tool) continue;
          novaPlanner.markStep(plan.id, step.index, "running");
          const record = await novaToolExecutor.execute(step.tool, {}, {
            userId: request.userId,
            requestId,
          });
          toolActions.push(record);
          novaPlanner.markStep(
            plan.id,
            step.index,
            record.success ? "done" : "failed",
            record,
            record.error
          );
        }
      }

      // 5. Generate the natural-language response via the existing router
      const geminiKey = resolveGeminiKey("");
      const aiResponse = await routeMessage(
        request.input,
        request.context?.conversationHistory ?? [],
        geminiKey,
        {
          mode: request.mode === "gemini" ? "gemini" : request.mode === "local" ? "local" : undefined,
          onChunk: stream?.onChunk,
          onAcknowledgement: stream?.onAcknowledgement,
        }
      );
      this.trace("ai", `${aiResponse.source} ${aiResponse.latencyMs}ms`);

      novaEventBus.emit("ai.completed", {
        requestId,
        text: aiResponse.text,
        source: aiResponse.source,
      });

      // If tools ran during a multi-step plan, append an honest action summary
      let text = aiResponse.text;
      if (toolActions.length > 0) {
        const ok = toolActions.filter((a) => a.success && a.verified).length;
        const failed = toolActions.length - ok;
        if (failed > 0) {
          text += `\n\n${failed} of ${toolActions.length} requested actions could not be completed.`;
        } else if (ok > 0 && !/\b(done|created|completed|scheduled)\b/i.test(text)) {
          text += `\n\n(${ok} action${ok > 1 ? "s" : ""} executed and verified.)`;
        }
      }

      const status: NovaResponse["status"] = aiResponse.errorCode
        ? "fallback"
        : "success";
      return this.buildResponse({
        requestId,
        text,
        status,
        source: aiResponse.source === "gemini" ? "gemini" : "local",
        actions: toolActions,
        startedAt: started,
        confidence: status === "success" ? 0.85 : 0.5,
        shouldSpeak: request.source === "voice" || request.source === "wake_word",
        errorCode: aiResponse.errorCode,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      this.trace("error", message);
      novaEventBus.emit("ai.failed", { requestId, errorCode: "UNKNOWN" });
      return this.buildResponse({
        requestId,
        text: `I ran into a problem while processing that: ${message}`,
        status: "error",
        source: "system",
        actions: [],
        startedAt: started,
        confidence: 0,
        shouldSpeak: false,
        errorCode: "UNKNOWN",
      });
    }
  }

  /** Run the existing agent orchestrator for deterministic tool intents. */
  private async runAgentPath(
    request: NovaRequest,
    requestId: string
  ): Promise<{ text: string; actions: NovaActionRecord[] } | null> {
    try {
      const result = await agentOrchestrator.process({
        text: request.input,
        source: request.source === "voice" || request.source === "wake_word" ? "voice" : "chat",
        context: {
          userId: request.userId,
          currentRoute: request.context?.currentRoute,
          currentPage: request.context?.currentPage,
        },
      });
      if (!result.response) return null; // deferred to AI
      const actions = result.actionsExecuted.map((a) => ({
        tool: a.tool,
        args: {},
        success: a.success,
        verified: a.success,
        durationMs: result.durationMs,
        error: a.success ? undefined : a.result?.error?.message,
      }));
      void requestId;
      return { text: result.response, actions };
    } catch (err) {
      this.trace("agent", `failed: ${err instanceof Error ? err.message : "unknown"}`);
      return null;
    }
  }

  private buildResponse(opts: {
    requestId: string;
    text: string;
    status: NovaResponse["status"];
    source: NovaResponse["source"];
    actions: NovaActionRecord[];
    startedAt: number;
    confidence: number;
    shouldSpeak: boolean;
    errorCode?: string;
  }): NovaResponse {
    const latencyMs = Date.now() - opts.startedAt;
    const shouldAskConfirmation =
      opts.status === "needs_confirmation" ||
      opts.actions.some((a) => !a.success && /confirm/i.test(a.error ?? ""));

    return {
      requestId: opts.requestId,
      text: opts.text,
      spokenText: toSpokenText(opts.text),
      status: shouldAskConfirmation ? "needs_confirmation" : opts.status,
      source: opts.source,
      toolsUsed: opts.actions.map((a) => a.tool),
      actions: opts.actions,
      confidence: opts.confidence,
      shouldSpeak: opts.shouldSpeak && opts.text.trim().length > 0,
      shouldAskConfirmation,
      metadata: {
        latencyMs,
        errorCode: opts.errorCode,
        model: novaWorld.getState().currentAIModel,
      },
    };
  }
}

export const novaCore = new NovaCore();
