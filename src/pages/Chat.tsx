import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NovaAvatar, type AvatarState } from "@/components/nova/avatar";
import { useOfflineSTT } from "@/hooks/use-offline-stt";
import { useOfflineTTS } from "@/hooks/use-offline-tts";
import { useChat } from "@/hooks/use-chat";
import { useNavigate } from "react-router";
import { getAIMode, type AIMode } from "@/ai/local/LocalAISettings";
import { logActivity } from "@/lib/local-store";
import ReactMarkdown from "react-markdown";
import { Collaboration } from "@/components/Collaboration";
import {
  Send,
  Mic,
  MicOff,
  Trash2,
  Zap,
  Sparkles,
  Clock,
  CheckCircle2,
  MessageSquare,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Square,
  Download,
  Copy,
  Check,
} from "lucide-react";

export default function Chat() {
  const [input, setInput] = useState("");
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [geminiKey] = useState(() => (import.meta.env.VITE_GEMINI_API_KEY as string) || localStorage.getItem("nova_gemini_key") || "");
  const [showSidebar, setShowSidebar] = useState(false);
  const [aiMode, setAiMode] = useState<AIMode>(getAIMode());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  const { isSpeaking, speak, stop: stopTTS } = useOfflineTTS();

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  const {
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
    retryLastMessage,
  } = useChat({
    apiKey: geminiKey,
    onNavigate: handleNavigate,
    onSpeak: (text) => {
      speak(text);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isStreaming) {
      setAvatarState("thinking");
    } else if (isSpeaking) {
      setAvatarState("speaking");
    } else {
      setAvatarState("idle");
    }
  }, [isStreaming, isSpeaking]);

  // Refresh mode when chat mounts
  useEffect(() => {
    setAiMode(getAIMode());
  }, []);

  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (isFinal && text.trim()) {
        sendMessage(text.trim());
        logActivity("chat", `Voice: "${text.trim().slice(0, 40)}"`, "mic");
      } else if (text.trim()) {
        setInput(text);
      }
    },
    [sendMessage]
  );

  const { isListening, isSupported, start: startSTT, stop: stopSTT } = useOfflineSTT({
    onTranscript: handleTranscript,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    logActivity("chat", `Sent: "${input.trim().slice(0, 40)}"`, "send");
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isStreaming) return;
      logActivity("chat", `Sent: "${input.trim().slice(0, 40)}"`, "send");
      sendMessage(input);
      setInput("");
    }
  };

  const handleNewChat = () => {
    clearMessages();
    stopTTS();
    setAvatarState("idle");
  };

  // Source indicator component
  const SourceBadge = ({ source }: { source?: string }) => {
    if (!source) return null;
    const isLocal = source === "local";
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
          isLocal
            ? "bg-[#10b981]/15 text-[#10b981]"
            : "bg-[#8b5cf6]/15 text-[#8b5cf6]"
        }`}
      >
        {isLocal ? "●" : "☁"} {isLocal ? "On-device" : "Gemini"}
      </span>
    );
  };

  const quickPrompts = [
    { label: "What time is it?", icon: <Clock className="w-3 h-3" />, local: true },
    { label: "Create task: Check server logs", icon: <CheckCircle2 className="w-3 h-3" />, local: true },
    { label: "Remember that I love dark themes", icon: <Zap className="w-3 h-3" />, local: true },
    { label: "Open Settings", icon: <Zap className="w-3 h-3" />, local: true },
    { label: "Explain quantum computing", icon: <Sparkles className="w-3 h-3" />, local: false },
  ];

  return (
    <main className="min-h-screen bg-[#06060c] flex flex-col">
      {/* Header */}
      <div className="border-b border-[#252540] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-[#6e6e8a] hover:text-white lg:hidden"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#6e6e8a] hover:text-white hidden lg:flex"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          <NovaAvatar state={avatarState} size={40} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-white">Nova Hybrid OS</h1>
              {lastSource && <SourceBadge source={lastSource} />}
              {!lastSource && (
                <Badge className={`border-0 text-[10px] font-mono ${
                  aiMode === "local"
                    ? "bg-[#10b981]/15 text-[#10b981]"
                    : aiMode === "gemini"
                    ? "bg-[#8b5cf6]/15 text-[#8b5cf6]"
                    : "bg-cyan-500/15 text-cyan-400"
                }`}>
                  {aiMode === "local" ? "● LOCAL" : aiMode === "gemini" ? "☁ GEMINI" : "AUTO"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-[#6e6e8a]">
              {isStreaming
                ? "Generating response..."
                : lastSource
                ? `Last response: ${lastSource === "local" ? "on-device" : "cloud AI"}`
                : "Ready to chat"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Collaboration conversationId={activeConvId || undefined} messages={messages} />
          {isStreaming && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[#f43f5e] hover:text-[#f43f5e]/80 hover:bg-[#f43f5e]/10"
              onClick={stopGeneration}
            >
              <Square className="h-3.5 w-3.5 mr-1 fill-current" />
              Stop
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-[#6e6e8a] hover:text-white"
            onClick={handleNewChat}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#6e6e8a] hover:text-white"
            onClick={() => {
              clearMessages();
              stopTTS();
              setAvatarState("idle");
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation Sidebar */}
        {showSidebar && (
          <div className="w-64 border-r border-[#252540] bg-[#0a0a14] overflow-y-auto shrink-0 hidden lg:block">
            <div className="p-3 space-y-1">
              <Button
                onClick={handleNewChat}
                className="w-full justify-start gap-2 text-[#6e6e8a] hover:text-white hover:bg-[#1e1e38]"
                variant="ghost"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                    activeConvId === conv.id
                      ? "bg-[#00d4ff]/10 text-[#00d4ff]"
                      : "text-[#6e6e8a] hover:text-[#e8e8f8] hover:bg-[#1e1e38]"
                  }`}
                  onClick={() => loadConversation(conv.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs truncate flex-1">{conv.title || "New Chat"}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-[#6e6e8a] hover:text-[#f43f5e] transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversationById(conv.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="text-xs text-[#6e6e8a]/50 text-center py-4">No conversations yet</p>
              )}
            </div>
          </div>
        )}

        {/* Mobile Sidebar Overlay */}
        {showSidebar && (
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setShowSidebar(false)}
          >
            <div
              className="w-64 h-full bg-[#0a0a14] border-r border-[#252540] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 space-y-1">
                <Button
                  onClick={() => {
                    handleNewChat();
                    setShowSidebar(false);
                  }}
                  className="w-full justify-start gap-2 text-[#6e6e8a] hover:text-white hover:bg-[#1e1e38]"
                  variant="ghost"
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  New Chat
                </Button>
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      activeConvId === conv.id
                        ? "bg-[#00d4ff]/10 text-[#00d4ff]"
                        : "text-[#6e6e8a] hover:text-[#e8e8f8] hover:bg-[#1e1e38]"
                    }`}
                    onClick={() => {
                      loadConversation(conv.id);
                      setShowSidebar(false);
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs truncate flex-1">{conv.title || "New Chat"}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-[#6e6e8a] hover:text-[#f43f5e] transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversationById(conv.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <p className="text-xs text-[#6e6e8a]/50 text-center py-4">No conversations yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto py-8">
              <NovaAvatar state="idle" size={90} />
              <h2 className="text-lg font-bold text-white mt-4">Nova Personal Operating System</h2>
              <p className="text-[#6e6e8a] mt-2 text-sm max-w-md">
                {aiMode === "local"
                  ? "Running in Local AI mode. Casual conversations stay on your device."
                  : aiMode === "gemini"
                  ? "Running in Gemini mode. All requests go to cloud AI."
                  : "Auto mode: Nova routes simple chats locally, complex tasks to Gemini."}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full">
                {quickPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      logActivity("chat", `Quick: "${p.label.slice(0, 30)}"`, "zap");
                      sendMessage(p.label);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#121222] hover:bg-[#1a1a32] border border-[#252540] text-xs text-slate-300 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2">
                      {p.icon}
                      {p.label}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded ${
                        p.local ? "bg-cyan-500/20 text-cyan-400" : "bg-purple-500/20 text-purple-400"
                      }`}
                    >
                      {p.local ? "LOCAL" : "GEMINI"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && !isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-3 rounded-lg bg-[#f43f5e]/10 border border-[#f43f5e]/20"
            >
              <p className="text-xs text-[#f43f5e]">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-[#f43f5e] hover:text-[#f43f5e]/80 text-xs"
                onClick={retryLastMessage}
              >
                Retry
              </Button>
            </motion.div>
          )}

          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <Card
                className={`max-w-[85%] sm:max-w-[75%] p-3.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#00d4ff]/10 border-[#00d4ff]/30 text-[#e8e8f8]"
                    : "bg-[#111122] border-[#252540] text-[#e8e8f8]"
                }`}
              >
                {msg.role === "assistant" && msg.content ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        code: ({ className, children, ...props }) => {
                          const match = /language-(\w+)/.exec(className || "");
                          if (match) {
                            return (
                              <code className="block bg-[#0a0a14] rounded-lg p-3 my-2 text-xs overflow-x-auto">
                                {children}
                              </code>
                            );
                          }
                          return (
                            <code className="bg-[#1e1e38] px-1.5 py-0.5 rounded text-[#00d4ff]" {...props}>
                              {children}
                            </code>
                          );
                        },
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="text-[#6e6e8a]">{children}</em>,
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#00d4ff] hover:underline">
                            {children}
                          </a>
                        ),
                        h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold text-white mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold text-white mb-2">{children}</h3>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-[#6e6e8a] pl-3 italic text-[#6e6e8a] mb-2">
                            {children}
                          </blockquote>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content || (msg.isStreaming ? "..." : "")}</p>
                )}
                {msg.role === "assistant" && (msg.source || msg.latencyMs !== undefined) && (
                  <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <SourceBadge source={msg.source} />
                    </div>
                    {msg.latencyMs !== undefined && (
                      <span className="text-slate-500 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-cyan-400" />
                        {msg.latencyMs}ms
                      </span>
                    )}
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[#252540] px-4 py-3 bg-[#0a0a14]">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-3xl mx-auto">
          {isSupported && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={isListening ? stopSTT : startSTT}
              className={`shrink-0 ${isListening ? "text-red-400 bg-red-500/10" : "text-[#6e6e8a]"}`}
            >
              {isListening ? <MicOff className="h-5 w-5 animate-pulse" /> : <Mic className="h-5 w-5" />}
            </Button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              aiMode === "local"
                ? "Chat locally (e.g. 'hello', 'tell me a joke', 'what should I watch')..."
                : aiMode === "gemini"
                ? "Chat with Gemini (e.g. 'search for...', 'what happened today?')..."
                : "Type a message (Nova decides local vs cloud)..."
            }
            rows={1}
            className="flex-1 bg-[#16162a] border border-[#252540] rounded-xl px-4 py-2.5 text-sm text-[#e8e8f8] placeholder:text-[#6e6e8a] focus:outline-none focus:border-[#00d4ff]/40 resize-none"
          />
          {isStreaming ? (
            <Button
              type="button"
              size="sm"
              onClick={stopGeneration}
              className="bg-[#f43f5e] text-white hover:bg-[#f43f5e]/80 shrink-0 font-semibold h-9"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim()}
              className="bg-[#00d4ff] text-[#06060c] hover:bg-[#00d4ff]/80 shrink-0 font-semibold"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </main>
  );
}
