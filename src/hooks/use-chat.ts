import { useState, useCallback, useRef, useEffect } from "react";
import { routeMessage, type AIRouterSource } from "@/ai/AIRouter";
import { getAIMode, type AIMode } from "@/ai/local/LocalAISettings";
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

interface UseChatOptions {
  apiKey?: string;
  onNavigate?: (path: string) => void;
  onSpeak?: (text: string) => void;
}

export function useChat({ apiKey = "", onNavigate, onSpeak }: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<AIRouterSource | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    setConversations(getConversations());
  }, []);

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
      // Set last source from last assistant message
      const lastAssistant = [...conv.messages].reverse().find((m) => m.role === "assistant");
      if (lastAssistant?.source) setLastSource(lastAssistant.source as AIRouterSource);
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      let convId = activeConvId;
      if (!convId) {
        const conv = createConversation(content.trim().slice(0, 60));
        convId = conv.id;
        setActiveConvId(convId);
        setConversations(getConversations());
      }

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
      setIsStreaming(true);
      setError(null);
      abortRef.current = false;

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
      ]);

      // Build conversation history for context
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const mode = getAIMode();
        const response = await routeMessage(content.trim(), conversationHistory, apiKey, {
          mode,
          onChunk: (chunk) => {
            if (abortRef.current) return;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: chunk, isStreaming: true } : m
              )
            );
          },
          onAcknowledgement: (ack) => {
            if (abortRef.current) return;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: ack, isStreaming: true } : m
              )
            );
          },
        });

        if (abortRef.current) return;

        setLastSource(response.source);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: response.text,
                  source: response.source,
                  latencyMs: response.latencyMs,
                  isStreaming: false,
                }
              : m
          )
        );

        addMessageToConversation(convId, {
          id: assistantId,
          role: "assistant",
          content: response.text,
          timestamp: Date.now(),
          source: response.source,
          latencyMs: response.latencyMs,
        });

        setConversations(getConversations());

        if (onSpeak) {
          onSpeak(response.text);
        }

        if (onNavigate) {
          // Only navigate for explicit navigation intents from local router
          // The AI Router handles most routing internally
        }
      } catch (err: any) {
        setError(err.message);
        const errContent = `⚠️ ${err.message || "Error processing request"}`;
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
        setIsStreaming(false);
      }
    },
    [apiKey, isStreaming, activeConvId, messages, onNavigate, onSpeak]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    setIsStreaming(false);
    // Try to cancel local inference
    try {
      import("@/ai/local/LocalAIModel").then((mod) => mod.cancelGeneration());
    } catch { /* ignore */ }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setActiveConvId(null);
    setLastSource(null);
  }, []);

  const deleteConversationById = useCallback((id: string) => {
    const convs = getConversations().filter((c) => c.id !== id);
    localStorage.setItem("nova_conversations", JSON.stringify(convs));
    setConversations(convs);
    if (activeConvId === id) {
      setMessages([]);
      setActiveConvId(null);
      setLastSource(null);
    }
  }, [activeConvId]);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopGeneration,
    clearMessages,
    conversations,
    activeConvId,
    lastSource,
    loadConversation,
    deleteConversationById,
  };
}
