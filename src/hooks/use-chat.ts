/**
 * Nova AI OS — Chat Hook
 * Complete state machine for chat interactions.
 *
 * Persistence: Firebase RTDB (via NovaCloudDataService) is authoritative when
 * a user is authenticated. localStorage remains an offline cache. Sync status
 * is honest — we never claim "saved" when the cloud write failed.
 *
 * Voice: every response path (agent, cached, AI, error) calls onSpeak exactly
 * once with the FINAL text — never placeholders, never per-chunk.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { routeMessage, type AIRouterSource } from "@/ai/AIRouter";
import { getAIMode, type AIMode } from "@/ai/local/LocalAISettings";
import { IntentRouter } from "@/services/ai/intent-router";
import { responseCache } from "@/services/ai/response-cache";
import { LocalConversationEngine } from "@/services/ai/local-conversation";
import { novaCore } from "@/services/nova-core/NovaCore";
import { type Intent } from "@/services/ai/types";
import {
  createConversation as cloudCreateConversation,
  addMessage as cloudAddMessage,
  getConversations as cloudGetConversations,
  getMessages as cloudGetMessages,
  deleteConversation as cloudDeleteConversation,
  type CloudConversation,
  type CloudMessage,
} from "@/services/data/NovaCloudDataService";
import {
  getConversations,
  addMessageToConversation,
  type LocalConversation,
  type LocalMessage,
} from "@/lib/local-store";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  source?: AIRouterSource | "local";
  intent?: Intent;
  latencyMs?: number;
  isStreaming?: boolean;
}

export type ChatStatus = "idle" | "streaming" | "error";

/** Honest per-message cloud persistence state, surfaced to the UI. */
export type MessageSyncStatus = "SYNCED" | "PENDING" | "OFFLINE" | "FAILED" | "LOCAL_ONLY";

/**
 * Generate a unique id. `crypto.randomUUID` is only available in secure
 * contexts — fall back to a timestamp+random id so chat never fails outright
 * in non-HTTPS previews or embedded webviews.
 */
function makeId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch { /* fall through */ }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Convert an RTDB CloudMessage to a UI ChatMessage. */
function cloudToChatMessage(m: CloudMessage): ChatMessage {
  return {
    id: m.id,
    role: m.role === "system" ? "assistant" : m.role,
    content: m.content,
    timestamp: m.createdAt,
    source: (m.source as AIRouterSource | "local" | undefined) ?? undefined,
    latencyMs: m.latencyMs,
  };
}

interface UseChatOptions {
  apiKey?: string;
  userId?: string;
  onNavigate?: (path: string) => void;
  onSpeak?: (text: string) => void;
}

export function useChat({ apiKey = "", userId = "", onNavigate, onSpeak }: UseChatOptions = {}) {
  // Core state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<AIRouterSource | null>(null);
  /** Cloud persistence status of the most recent write, for the UI. */
  const [syncStatus, setSyncStatus] = useState<MessageSyncStatus>("LOCAL_ONLY");

  // Refs for abort control and preventing stale updates
  const abortRef = useRef(false);
  const activeRequestRef = useRef<string | null>(null);
  // Message queued while a generation is in flight (e.g. a voice transcript
  // spoken while Nova is still replying) — flushed as soon as we're free.
  const pendingInputRef = useRef<string | null>(null);
  const sendMessageRef = useRef<(content: string, force?: boolean) => void>(() => {});
  /** Latest onSpeak without stale closure risk. */
  const onSpeakRef = useRef(onSpeak);
  useEffect(() => {
    onSpeakRef.current = onSpeak;
  }, [onSpeak]);

  /** Single speech helper used by every response path — no early return skips it. */
  const speakResponse = useCallback((text: string) => {
    // Never speak placeholders or empty text
    if (!text || !text.trim() || text === "..." || text.startsWith("⚠️ Analyzing")) return;
    const spoken = text.replace(/^⚠️\s*/, ""); // speak the reason, not the marker
    try {
      onSpeakRef.current?.(spoken);
    } catch (err) {
      console.warn("[Chat] onSpeak callback failed:", err);
    }
  }, []);

  /**
   * Persist a message to Firebase (authoritative) + localStorage (cache).
   * Returns the honest sync status.
   */
  const persistMessage = useCallback(
    async (
      convId: string,
      msg: { id: string; role: "user" | "assistant"; content: string; source?: string; latencyMs?: number }
    ): Promise<MessageSyncStatus> => {
      // Local cache always (offline support)
      addMessageToConversation(convId, {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: Date.now(),
        source: msg.source as LocalMessage["source"],
        latencyMs: msg.latencyMs,
      });

      // Cloud write when authenticated
      if (userId) {
        const result = await cloudAddMessage(userId, convId, {
          role: msg.role,
          content: msg.content,
          source: msg.source,
          latencyMs: msg.latencyMs,
        });
        if (result.success) return "SYNCED";
        if (result.pending) return "PENDING";
        // Hard failure (permission/config) — honest, NOT silent success
        console.warn(`[Chat] Firebase message write failed (${result.errorCode}): ${result.message}`);
        return "FAILED";
      }
      return "LOCAL_ONLY";
    },
    [userId]
  );

  /** Ensure a conversation exists in Firebase and localStorage. Returns cloud conv id. */
  const ensureConversation = useCallback(
    async (firstMessage: string): Promise<string | null> => {
      if (activeConvId) return activeConvId;
      const title = firstMessage.trim().slice(0, 60);

      // Local conversation always created (offline cache + sidebar while offline)
      const { createConversation } = await import("@/lib/local-store");
      const conv = createConversation(title);
      setActiveConvId(conv.id);
      setConversations(getConversations());

      // Cloud conversation — the id becomes the canonical conversation id when
      // it succeeds so messages land in the same node.
      if (userId) {
        const result = await cloudCreateConversation(userId, title);
        if (result.success && result.id) {
          setActiveConvId(result.id);
          return result.id;
        }
        console.warn(`[Chat] Firebase conversation create failed (${result.errorCode}): ${result.message}`);
        setSyncStatus(result.pending ? "PENDING" : "FAILED");
      }
      return conv.id;
    },
    [activeConvId, userId]
  );

  // Load conversations on mount + when user changes (Firebase first, local cache fallback)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (userId) {
        const result = await cloudGetConversations(userId);
        if (!cancelled && result.success) {
          // Map cloud conversations into the sidebar shape (messages load on select)
          setConversations(
            result.data.map((c) => ({
              id: c.id,
              title: c.title,
              createdAt: c.createdAt,
              updatedAt: c.updatedAt,
              messages: [],
            }))
          );
          return;
        }
        if (!cancelled && !result.success && "errorCode" in result) {
          console.warn(`[Chat] Firebase conversation load failed (${result.errorCode}): ${result.message}`);
        }
      }
      if (!cancelled) setConversations(getConversations());
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /**
   * Load a conversation by ID — Firebase first, localStorage fallback.
   */
  const loadConversation = useCallback(
    (convId: string) => {
      void (async () => {
        if (userId) {
          const result = await cloudGetMessages(userId, convId);
          if (result.success) {
            setMessages(result.data.map(cloudToChatMessage));
            setActiveConvId(convId);
            setError(null);
            setStatus("idle");
            const lastAssistant = [...result.data].reverse().find((m) => m.role === "assistant");
            if (lastAssistant?.source) setLastSource(lastAssistant.source as AIRouterSource);
            return;
          }
          if (!result.success && "errorCode" in result) {
            console.warn(`[Chat] Firebase message load failed (${result.errorCode}): ${result.message}`);
          }
        }
        // localStorage fallback
        const convs = getConversations();
        const conv = convs.find((c) => c.id === convId);
        if (conv) {
          setMessages(
            conv.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
              source: m.source as AIRouterSource | "local" | undefined,
              intent: m.intent as Intent | undefined,
              latencyMs: m.latencyMs,
            }))
          );
          setActiveConvId(convId);
          setError(null);
          setStatus("idle");
          const lastAssistant = [...conv.messages].reverse().find((m) => m.role === "assistant");
          if (lastAssistant?.source) setLastSource(lastAssistant.source as AIRouterSource);
        }
      })();
    },
    [userId]
  );

  /** Request logging (dev diagnostics). */
  const logRequest = (info: Record<string, unknown>) => {
    if (import.meta.env.DEV) console.info("[Nova Chat]", info);
  };

  /**
   * Send a message and handle the AI response.
   * Sequence: persist user msg → agent layer → AI router → finalize →
   * persist assistant msg → speak (never per-chunk).
   */
  const sendMessage = useCallback(
    async (content: string, force = false) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      // While a generation is in flight, queue the message and send it as soon
      // as the current one finishes instead of silently dropping it.
      if (status === "streaming" && !force) {
        pendingInputRef.current = trimmed;
        return;
      }

      // Generate unique request ID to prevent stale updates
      const requestId = makeId();
      activeRequestRef.current = requestId;
      const startedAt = Date.now();

      // Ensure we have an active conversation (Firebase when authenticated)
      const convId = await ensureConversation(trimmed);
      if (!convId) return;

      // Add user message + assistant placeholder in a single batch
      const userMsg: ChatMessage = {
        id: makeId(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      // Persist user message BEFORE generating (do not claim saved until Firebase confirms)
      void persistMessage(convId, {
        id: userMsg.id,
        role: "user",
        content: userMsg.content,
      }).then((s) => {
        setSyncStatus(s);
        logRequest({ requestId, userId, conversationId: convId, phase: "user-write", status: s });
      });

      const assistantId = makeId();
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };

      // Single batched state update instead of two separate ones
      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      setStatus("streaming");
      setError(null);
      abortRef.current = false;

      // Build conversation history for context (include current user message)
      const conversationHistory = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      /** Finalize the assistant message: UI + persistence + speech. */
      const finalizeAssistant = async (
        finalText: string,
        source: AIRouterSource | "local",
        latencyMs?: number
      ) => {
        // 1. UI shows final text
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: finalText, source, latencyMs, isStreaming: false }
              : m
          )
        );

        // 2. Persist BEFORE speaking — never wait for TTS to save
        const sync = await persistMessage(convId, {
          id: assistantId,
          role: "assistant",
          content: finalText,
          source,
          latencyMs,
        });
        setSyncStatus(sync);
        setConversations(getConversations());

        // 3. Speak the finalized text exactly once
        speakResponse(finalText);

        logRequest({
          requestId,
          userId,
          conversationId: convId,
          intent: "chat",
          source,
          generationLatencyMs: Date.now() - startedAt,
          assistantWriteStatus: sync,
          ttsProvider: "routed",
        });
      };

      try {
        const mode = getAIMode();

        // ── Nova Core: single orchestration entry point ──
        // Core classifies, runs deterministic tools, plans multi-step work,
        // and generates the response — all with permission gating and honest
        // verification. Streaming callbacks keep the UI progressive.
        const coreResponse = await novaCore.handle(
          {
            id: requestId,
            userId: userId || "anonymous",
            input: trimmed,
            source: "text",
            timestamp: Date.now(),
            conversationId: convId ?? undefined,
            mode,
            context: { conversationHistory },
          },
          {
            onChunk: (chunk) => {
              if (abortRef.current || activeRequestRef.current !== requestId) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: chunk, isStreaming: true } : m
                )
              );
            },
            onAcknowledgement: (ack) => {
              if (abortRef.current || activeRequestRef.current !== requestId) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: ack, isStreaming: true } : m
                )
              );
            },
          }
        );

        // Check if this request was aborted
        if (abortRef.current || activeRequestRef.current !== requestId) return;

        // Handle empty response with local fallback
        let finalText = coreResponse.text;
        if (!finalText || finalText.trim().length === 0) {
          finalText = LocalConversationEngine.generateResponse(trimmed) || "I couldn't generate a response. Please try rephrasing.";
        }

        setLastSource(coreResponse.source === "gemini" ? "gemini" : "local");
        await finalizeAssistant(finalText, coreResponse.source === "gemini" ? "gemini" : "local", coreResponse.metadata?.latencyMs ?? 0);

        // Cache successful AI-generated responses (not tool/error paths)
        if (coreResponse.status === "success") {
          responseCache.set(trimmed, mode, finalText, coreResponse.source === "gemini" ? "gemini" : "local");
        }
      } catch (err: unknown) {
        // Only update state if this request is still active
        if (activeRequestRef.current !== requestId) return;

        const errorMessage = err instanceof Error ? err.message : "Error processing request";
        // Structured AI errors already carry user-friendly messages — show them as-is.
        setError(errorMessage);
        setStatus("error");

        const errContent = `⚠️ ${errorMessage}`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: errContent, isStreaming: false }
              : m
          )
        );

        // Persist the error as the assistant message (honest history)
        const sync = await persistMessage(convId, {
          id: assistantId,
          role: "assistant",
          content: errContent,
        });
        setSyncStatus(sync);
        setConversations(getConversations());

        // Speak errors too so the voice loop never silently dies
        speakResponse(errContent);

        logRequest({ requestId, userId, conversationId: convId, error: errorMessage, assistantWriteStatus: sync });
      } finally {
        // Only clear streaming status if this request is still active
        if (activeRequestRef.current === requestId) {
          setStatus("idle");

          // Flush a queued message (e.g. voice overlap) now that we're free.
          const pending = pendingInputRef.current;
          if (pending) {
            pendingInputRef.current = null;
            setTimeout(() => {
              sendMessageRef.current(pending, true);
            }, 0);
          }
        }
      }
    },
    // `status` tracked via isStreaming to avoid re-creating on every status flip
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiKey, userId, status, activeConvId, messages, ensureConversation, persistMessage, speakResponse]
  );

  // Keep the latest sendMessage available to the finally-flush without stale closures.
  sendMessageRef.current = sendMessage;

  /**
   * Stop the current generation.
   */
  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    activeRequestRef.current = null;
    pendingInputRef.current = null;
    setStatus("idle");

    // Try to cancel local inference
    try {
      import("@/ai/local/LocalAIModel").then((mod) => mod.cancelGeneration());
    } catch { /* ignore */ }
  }, []);

  /**
   * Retry the last failed message.
   */
  const retryLastMessage = useCallback(() => {
    if (status !== "error" || messages.length < 2) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    // Remove the error placeholder
    setMessages((prev) => prev.filter((m) => !m.content.startsWith("⚠️")));
    setError(null);
    sendMessage(lastUserMsg.content);
  }, [status, messages, sendMessage]);

  /**
   * Clear all messages and start fresh.
   */
  const clearMessages = useCallback(() => {
    pendingInputRef.current = null;
    setMessages([]);
    setError(null);
    setActiveConvId(null);
    setLastSource(null);
    setStatus("idle");
  }, []);

  /**
   * Delete a conversation — Firebase first (authoritative), local always.
   */
  const deleteConversationById = useCallback(
    (id: string) => {
      // Local removal always (offline cache consistency)
      const convs = getConversations().filter((c) => c.id !== id);
      localStorage.setItem("nova_conversations", JSON.stringify(convs));
      setConversations(convs);
      if (activeConvId === id) {
        setMessages([]);
        setActiveConvId(null);
        setLastSource(null);
        setStatus("idle");
      }
      // Cloud removal when authenticated
      if (userId) {
        void cloudDeleteConversation(userId, id).then((result) => {
          if (!result.success && !result.pending) {
            console.warn(`[Chat] Firebase conversation delete failed (${result.errorCode}): ${result.message}`);
          }
        });
      }
    },
    [activeConvId, userId]
  );

  return {
    // State
    messages,
    status,
    isStreaming: status === "streaming",
    error,
    conversations,
    activeConvId,
    lastSource,
    syncStatus,

    // Actions
    sendMessage,
    stopGeneration,
    clearMessages,
    loadConversation,
    deleteConversationById,
    retryLastMessage,
  };
}
