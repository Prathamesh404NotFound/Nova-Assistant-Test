import { useState, useCallback, useRef } from "react";
import { ResponseOrchestrator } from "@/services/ai/response-orchestrator";
import { NovaResponse, Intent } from "@/services/ai/types";

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
  const abortRef = useRef(false);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

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
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `⚠️ ${err.message || "Error processing request"}`, isStreaming: false }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [apiKey, isStreaming, onNavigate, onSpeak]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isStreaming, error, sendMessage, clearMessages };
}
