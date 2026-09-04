/**
 * Nova AI OS — Chat Hook
 * Complete state machine for chat interactions.
 * Handles message sending, streaming, errors, and conversation persistence.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { routeMessage, type AIRouterSource } from "@/ai/AIRouter";
import { getAIMode, type AIMode } from "@/ai/local/LocalAISettings";
import { IntentRouter } from "@/services/ai/intent-router";
import { responseCache } from "@/services/ai/response-cache";
import { LocalConversationEngine } from "@/services/ai/local-conversation";
import { agentOrchestrator } from "@/services/agent/AgentOrchestrator";
import { type Intent } from "@/services/ai/types";
import {
  getConversations,
  createConversation,
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

  // Refs for abort control and preventing stale updates
  const abortRef = useRef(false);
  const activeRequestRef = useRef<string | null>(null);

  // Load conversations on mount
  useEffect(() => {
    setConversations(getConversations());
  }, []);

  // Derived state
  const isStreaming = status === "streaming";

  /**
   * Load a conversation by ID.
   */
  const loadConversation = useCallback((convId: string) => {
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

      // Set last source from last assistant message
      const lastAssistant = [...conv.messages].reverse().find((m) => m.role === "assistant");
      if (lastAssistant?.source) setLastSource(lastAssistant.source as AIRouterSource);
    }
  }, []);

  /**
   * Send a message and handle the AI response.
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      // Generate unique request ID to prevent stale updates
      const requestId = crypto.randomUUID();
      activeRequestRef.current = requestId;

      // Ensure we have an active conversation
      let convId = activeConvId;
      if (!convId) {
        const conv = createConversation(content.trim().slice(0, 60));
        convId = conv.id;
        setActiveConvId(convId);
        setConversations(getConversations());
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      addMessageToConversation(convId, {
        id: userMsg.id,
        role: "user",
        content: userMsg.content,
        timestamp: userMsg.timestamp,
      });

      setMessages((prev) => [...prev, userMsg]);

      // Update status to streaming
      setStatus("streaming");
      setError(null);
      abortRef.current = false;

      // Add placeholder for assistant response
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
          isStreaming: true,
        },
      ]);        // Build conversation history for context (include current user message)
        const conversationHistory = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));

      try {
        const mode = getAIMode();

        // ── Agent Orchestrator: try local tool execution first ──
        try {
          const agentResult = await agentOrchestrator.process({
            text: content.trim(),
            source: "chat",
            context: { userId },
          });

          if (agentResult.response) {
            // Orchestrator handled it — show result directly
            setLastSource("local");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: agentResult.response,
                      source: "local",
                      latencyMs: agentResult.durationMs,
                      isStreaming: false,
                    }
                  : m
              )
            );
            addMessageToConversation(convId, {
              id: assistantId,
              role: "assistant",
              content: agentResult.response,
              timestamp: Date.now(),
              source: "local",
              latencyMs: agentResult.durationMs,
            });
            setConversations(getConversations());
            if (onSpeak) onSpeak(agentResult.response);
            return; // Skip AI pipeline
          }
          // Empty response = orchestrator deferred to AI — continue below
        } catch {
          // Orchestrator error — fall through to AI pipeline
        }

        // Check cache first
        const cachedResponse = responseCache.get(content.trim(), mode);
        if (cachedResponse) {
          setLastSource("gemini");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: cachedResponse, source: "gemini", latencyMs: 0, isStreaming: false }
                : m
            )
          );
          setStatus("idle");
          return;
        }

        // Classify intent for routing
        const intentResult = IntentRouter.classify(content.trim());

        const response = await routeMessage(content.trim(), conversationHistory, apiKey, {
          mode,
          onChunk: (chunk) => {
            // Check if this request is still active
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
        });

        // Check if this request was aborted
        if (abortRef.current || activeRequestRef.current !== requestId) return;

        // Handle empty response with local fallback
        let finalText = response.text;
        if (!finalText || finalText.trim().length === 0) {
          finalText = LocalConversationEngine.generateResponse(content.trim());
        }

        // Update with final response
        setLastSource(response.source);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: finalText,
                  source: response.source,
                  latencyMs: response.latencyMs,
                  isStreaming: false,
                }
              : m
          )
        );

        // Cache the response
        responseCache.set(content.trim(), mode, response.text, response.source);

        // Persist to conversation
        addMessageToConversation(convId, {
          id: assistantId,
          role: "assistant",
          content: response.text,
          timestamp: Date.now(),
          source: response.source,
          latencyMs: response.latencyMs,
        });

        setConversations(getConversations());

        // Speak response if voice is enabled
        if (onSpeak) {
          onSpeak(response.text);
        }
      } catch (err: unknown) {
        // Only update state if this request is still active
        if (activeRequestRef.current !== requestId) return;

        const errorMessage = err instanceof Error ? err.message : "Error processing request";
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

        addMessageToConversation(convId, {
          id: assistantId,
          role: "assistant",
          content: errContent,
          timestamp: Date.now(),
        });
      } finally {
        // Only clear streaming status if this request is still active
        if (activeRequestRef.current === requestId) {
          setStatus("idle");
        }
      }  }, [apiKey, userId, isStreaming, activeConvId, messages, onNavigate, onSpeak]);

  /**
   * Stop the current generation.
   */
  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    activeRequestRef.current = null;
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
    setMessages([]);
    setError(null);
    setActiveConvId(null);
    setLastSource(null);
    setStatus("idle");
  }, []);

  /**
   * Delete a conversation by ID.
   */
  const deleteConversationById = useCallback(
    (id: string) => {
      const convs = getConversations().filter((c) => c.id !== id);
      localStorage.setItem("nova_conversations", JSON.stringify(convs));
      setConversations(convs);
      if (activeConvId === id) {
        setMessages([]);
        setActiveConvId(null);
        setLastSource(null);
        setStatus("idle");
      }
    },
    [activeConvId]
  );

  return {
    // State
    messages,
    status,
    isStreaming,
    error,
    conversations,
    activeConvId,
    lastSource,

    // Actions
    sendMessage,
    stopGeneration,
    clearMessages,
    loadConversation,
    deleteConversationById,
    retryLastMessage,
  };
}
