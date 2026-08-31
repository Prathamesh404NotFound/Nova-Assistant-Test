import { useState, useCallback, useRef, useEffect } from "react";
import { ResponseOrchestrator } from "@/services/ai/response-orchestrator";
import { NovaResponse, Intent } from "@/services/ai/types";
import {
  getConversations,
  createConversation,
  addMessageToConversation,
  updateConversation,
  type LocalConversation,
  type LocalMessage,
} from "@/lib/local-store";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  source?: "local" | "gemini";
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
  const abortRef = useRef(false);

  // Load conversations on mount
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
          source: m.source as "local" | "gemini" | undefined,
          intent: m.intent as Intent | undefined,
          latencyMs: m.latencyMs,
        }))
      );
      setActiveConvId(convId);
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      // Create or use active conversation
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

      // Persist user message
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

      // Placeholder assistant message
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

      try {
        const response: NovaResponse = await ResponseOrchestrator.processInput({
          input: content.trim(),
          apiKey,
          onAcknowledgement: (ack) => {
            if (abortRef.current) return;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: ack, isStreaming: true } : m
              )
            );
          },
          onChunk: (chunk) => {
            if (abortRef.current) return;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: chunk, isStreaming: true } : m
              )
            );
          },
        });

        if (abortRef.current) return;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: response.text,
                  source: response.source,
                  intent: response.intent,
                  latencyMs: response.latencyMs,
                  isStreaming: false,
                }
              : m
          )
        );

        // Persist assistant message
        addMessageToConversation(convId, {
          id: assistantId,
          role: "assistant",
          content: response.text,
          timestamp: Date.now(),
          source: response.source,
          intent: response.intent,
          latencyMs: response.latencyMs,
        });

        // Update conversation list
        setConversations(getConversations());

        if (response.shouldSpeak && onSpeak) {
          onSpeak(response.text);
        }

        if (response.navigationTarget && onNavigate) {
          setTimeout(() => {
            onNavigate(response.navigationTarget!);
          }, 500);
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
    [apiKey, isStreaming, activeConvId, onNavigate, onSpeak]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setActiveConvId(null);
  }, []);

  const deleteConversationById = useCallback((id: string) => {
    const convs = getConversations().filter((c) => c.id !== id);
    localStorage.setItem("nova_conversations", JSON.stringify(convs));
    setConversations(convs);
    if (activeConvId === id) {
      setMessages([]);
      setActiveConvId(null);
    }
  }, [activeConvId]);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
    conversations,
    activeConvId,
    loadConversation,
    deleteConversationById,
  };
}
