import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type AvatarState } from "@/components/nova/avatar";
import { SpriteNovaAvatar } from "@/components/nova/SpriteNovaAvatar";
import { VOICE_STATE_TO_SPRITE, type NovaSpriteState } from "@/config/novaSprites";
import {
  EmotionHoldQueue,
  circadianBaseline,
  detectCorrection,
  sentimentToEmotion,
  type NovaEmotion,
} from "@/services/nova/expression-engine";
import {
  recordTaskDebt,
  addAssumptions,
  rejectAssumption,
  getAssumptions,
  scheduleFutureLetter,
  type AssumptionRecord,
  WHISPER_NOTICE,
} from "@/services/nova/labs";
import { useOfflineSTT, type STTError } from "@/hooks/use-offline-stt";
import { ttsRouter } from "@/services/tts/tts-router";
import { useChat } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { getAIMode, type AIMode } from "@/ai/local/LocalAISettings";
import { logActivity } from "@/lib/local-store";
import { addMemory } from "@/lib/rtdb";
import { permissionsService } from "@/services/permissions";
import ReactMarkdown from "react-markdown";
import { Collaboration } from "@/components/Collaboration";
import { ExportChat } from "@/components/ExportChat";
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
  const { user } = useAuth();
  const userId = user?.uid ?? "";
  const [input, setInput] = useState("");
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [geminiKey] = useState(() => (import.meta.env.VITE_GEMINI_API_KEY as string) || localStorage.getItem("nova_gemini_key") || "");
  const [showSidebar, setShowSidebar] = useState(false);
  const [aiMode, setAiMode] = useState<AIMode>(getAIMode());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  // Voice mode: when true, Nova auto-restarts listening after TTS finishes.
  // Ref mirrors the state so TTS callbacks never read a stale closure value.
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceModeActiveRef = useRef(false);
  const setVoiceMode = useCallback((active: boolean) => {
    voiceModeActiveRef.current = active;
    setVoiceModeActive(active);
  }, []);

  // Initialize TTS router with callbacks
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);

  const startSTTRef = useRef<() => void>(() => {});

  useEffect(() => {
    ttsRouter.setCallbacks({
      onPlay: () => {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
      },
      onEnd: () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        // Auto-restart STT if voice mode is active — enables continuous conversation.
        // Reads refs, never stale state captured at mount.
        if (voiceModeActiveRef.current) {
          setTimeout(() => {
            if (voiceModeActiveRef.current && !isSpeakingRef.current) {
              if (import.meta.env.DEV) console.debug("[VOICE] TTS ended — restarting STT");
              startSTTRef.current();
            }
          }, 300);
        }
      },
    });
    ttsRouter.initialize();
  }, []);

  const indicSpeak = useCallback(async (text: string) => {
    try {
      await ttsRouter.speak(text);
    } catch (err) {
      console.warn("[TTS] Speak failed:", err);
    }
  }, []);

  const stopTTS = useCallback(() => {
    ttsRouter.stop();
    setIsSpeaking(false);
    isSpeakingRef.current = false;
  }, []);

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
    userId,
    onNavigate: handleNavigate,
    onSpeak: (text) => {
      indicSpeak(text);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Keep latest stop/start available to callbacks without stale closures
  const stopSTTRef = useRef<() => void>(() => {});

  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (isFinal && text.trim()) {
        // Stop listening while Nova processes & speaks — prevents self-hearing races.
        stopSTTRef.current();
        logActivity("chat", `Voice: "${text.trim().slice(0, 40)}"`, "mic");
        sendMessage(text.trim());
      } else if (text.trim()) {
        setInput(text);
      }
    },
    [sendMessage]
  );

  const handleVoiceError = useCallback((err: STTError) => {
    setVoiceError(err.message);
    // Fatal errors cancel the voice session
    if (err.kind === "not-allowed" || err.kind === "not-supported" || err.kind === "audio-capture" || err.kind === "service-not-allowed") {
      setVoiceMode(false);
    }
  }, [setVoiceMode]);

  const { isListening, isSupported, start: startSTT, stop: stopSTT } = useOfflineSTT({
    onTranscript: handleTranscript,
    onError: handleVoiceError,
    continuous: true,
  });

  // Keep latest start/stop available to TTS & transcript callbacks without stale closures
  startSTTRef.current = startSTT;
  stopSTTRef.current = stopSTT;

  const toggleVoiceMode = useCallback(() => {
    if (voiceModeActiveRef.current) {
      // Deactivate voice mode — stop mic and speech cleanly
      setVoiceMode(false);
      stopSTT();
      stopTTS();
      setVoiceError(null);
    } else {
      setVoiceError(null);
      setVoiceMode(true);
      startSTT();
    }
  }, [setVoiceMode, stopSTT, stopTTS, startSTT]);

  // Voice state machine: idle → listening → processing → speaking → (listening | error)
  type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";
  const voiceState: VoiceState = voiceError
    ? "error"
    : isStreaming
    ? "processing"
    : isSpeaking
    ? "speaking"
    : isListening
    ? "listening"
    : "idle";

  // Sprite follows the voice state via the centralized registry
  const spriteState: NovaSpriteState = VOICE_STATE_TO_SPRITE[voiceState] ?? "idle";

  // ── Expression engine (hold-queue, halo, shimmer, celebrations) ──
  const emotionQueueRef = useRef<EmotionHoldQueue | null>(null);
  if (!emotionQueueRef.current) emotionQueueRef.current = new EmotionHoldQueue(circadianBaseline());
  const emotionQueue = emotionQueueRef.current;

  const [emotion, setEmotion] = useState<NovaEmotion>(() => circadianBaseline());
  const [shimmerOn, setShimmerOn] = useState(false);

  useEffect(() => {
    const unsub = emotionQueue.subscribe((e) => setEmotion(e));
    return () => {
      unsub();
      emotionQueue.dispose();
    };
  }, [emotionQueue]);

  // Voice-state → performable emotion (curiosity tilt while listening, focus while generating)
  useEffect(() => {
    if (voiceState === "listening") emotionQueue.express("curiosity");
    else if (voiceState === "speaking") emotionQueue.express("joy");
  }, [voiceState, emotionQueue]);

  // React to the latest user message: empathy halo, humble recalibration
  const lastUserMsgRef = useRef<string>("");
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  useEffect(() => {
    if (!lastUserMessage || lastUserMessage.id === lastUserMsgRef.current) return;
    lastUserMsgRef.current = String(lastUserMessage.id);
    const text = typeof lastUserMessage.content === "string" ? lastUserMessage.content : "";
    if (detectCorrection(text)) {
      emotionQueue.express("humble");
      setShimmerOn(true);
      const t = setTimeout(() => setShimmerOn(false), 700);
      return () => clearTimeout(t);
    }
    emotionQueue.express(sentimentToEmotion(text));
  }, [lastUserMessage, emotionQueue]);

  // Focused computation face while streaming (§5 thought particles via cue)
  useEffect(() => {
    if (isStreaming) emotionQueue.express("processing");
    else if (!isSpeaking && !isListening && emotionQueue.currentEmotion === "processing") {
      emotionQueue.express(circadianBaseline());
    }
  }, [isStreaming, isSpeaking, isListening, emotionQueue]);

  useEffect(() => {
    const state: AvatarState =
      voiceState === "error" ? "error"
      : voiceState === "processing" ? "thinking"
      : voiceState === "speaking" ? "speaking"
      : voiceState === "listening" ? "listening"
      : "idle";
    setAvatarState(state);
  }, [voiceState]);

  // ── Nova Labs: whisper mode + assumption ledger ──
  const [whisperMode, setWhisperMode] = useState(false);
  const [assumptionsByMessage, setAssumptionsByMessage] = useState<Record<string, AssumptionRecord[]>>({});

  const toggleAssumption = (rec: AssumptionRecord) => {
    if (rec.rejected) return;
    rejectAssumption(rec.id);
    setAssumptionsByMessage((prev) => ({
      ...prev,
      [rec.messageId]: (prev[rec.messageId] ?? []).map((a) =>
        a.id === rec.id ? { ...a, rejected: true } : a
      ),
    }));
    emotionQueue.express("humble");
    setShimmerOn(true);
    setTimeout(() => setShimmerOn(false), 700);
  };

  // Record assumption chips + time-debt for the latest assistant reply
  const lastAssistantMsgRef = useRef<string>("");
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant" && m.content);
  useEffect(() => {
    if (!lastAssistantMessage || whisperMode) return;
    if (lastAssistantMessage.id === lastAssistantMsgRef.current) return;
    lastAssistantMsgRef.current = lastAssistantMessage.id;
    // Assumption chips from simple heuristic detection in the reply
    const texts: string[] = [];
    const am = /\bI(?:'m| am) (?:assuming|guessing) ([^.!?]*)/i.exec(lastAssistantMessage.content);
    if (am) texts.push(`I assumed: ${am[1].trim()}`);
    if (texts.length > 0) {
      const recs = addAssumptions(lastAssistantMessage.id, texts);
      setAssumptionsByMessage((prev) => ({ ...prev, [lastAssistantMessage.id]: recs }));
    }
    // Time-debt ledger: estimate manual cost for substantial replies
    if (lastAssistantMessage.content.length > 400) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      recordTaskDebt(lastUser?.content ?? lastAssistantMessage.content);
    }
  }, [lastAssistantMessage, messages, whisperMode]);

  // Time-debt for user tasks even without long replies
  useEffect(() => {
    if (whisperMode || !lastUserMessage) return;
    if (lastUserMsgRef.current !== String(lastUserMessage.id)) return;
    const text = typeof lastUserMessage.content === "string" ? lastUserMessage.content : "";
    if (/\b(?:help me|research|summar|write|draft|plan|compare)\b/i.test(text) && text.length > 30) {
      recordTaskDebt(text);
    }
  }, [lastUserMessage, whisperMode]);

  // Refresh mode when chat mounts
  useEffect(() => {
    setAiMode(getAIMode());
  }, []);

  // Stop any in-flight speech when leaving the page so audio never bleeds
  // across routes.
  useEffect(() => {
    return () => {
      ttsRouter.stop();
    };
  }, []);

  // "Remember that ..." → save to the Memory panel (requires memory_saving permission).
  const REMEMBER_RE = /^(?:remember|note)\s+(?:that\s+)?(.+)$/i;

  const trySaveMemory = useCallback(
    async (text: string): Promise<boolean> => {
      const match = REMEMBER_RE.exec(text.trim());
      if (!match || !userId) return false;
      if (!permissionsService.isGranted("memory_saving")) {
        logActivity("memory", "Memory save blocked — grant Memory Saving in Settings → Security", "lock");
        return false;
      }
      const content = match[1].trim();
      if (!content) return false;
      // Split "key: content" if present, else use the first few words as key.
      const sepIdx = content.indexOf(":");
      const key = sepIdx > 0 && sepIdx < 48 ? content.slice(0, sepIdx).trim() : content.split(/\s+/).slice(0, 5).join(" ");
      const body = sepIdx > 0 && sepIdx < 48 ? content.slice(sepIdx + 1).trim() : content;
      const isPerson = /\b(my (friend|wife|husband|mom|dad|sister|brother|colleague)|meets?|called)\b/i.test(content);
      const isPref = /\b(i (like|love|prefer|hate|don't like)|i always|i never|my favorite)\b/i.test(content);
      const category = isPref ? "preference" : isPerson ? "person" : "note";
      try {
        await addMemory(userId, { category, key, content: body || content });
        logActivity("memory", `Saved memory: ${key}`, "brain");
        return true;
      } catch (err) {
        console.warn("[MEMORY] Failed to save memory from chat:", err);
        return false;
      }
    },
    [userId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const text = input.trim();

    // Vision trigger phrase — route to the Vision page.
    if (/^see,?\s*this is me,?\s*this is what i have\b/i.test(text)) {
      setInput("");
      sendMessage(text);
      navigate("/vision");
      return;
    }
    if (whisperMode) {
      // Zero retention: no activity log, no memory save, no conversation persistence
      sendMessage(text);
      setInput("");
      setWhisperMode(false);
      return;
    }
    // Future-Self Letters (Nova Labs §4): "mail my future self …" schedules a letter
    const futureSelfMatch = /^mail my future self[:,]?\s*(.+)/i.exec(text);
    if (futureSelfMatch && futureSelfMatch[1].trim()) {
      scheduleFutureLetter(futureSelfMatch[1].trim(), Date.now() + 14 * 864e5);
      logActivity("labs", "Scheduled a future-self letter (delivering in 2 weeks)", "mail");
    }
    logActivity("chat", `Sent: "${text.slice(0, 40)}"`, "send");
    void trySaveMemory(text);
    sendMessage(text);
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
    <main className="min-h-screen bg-[#060e1a] jarvis-grid-bg flex flex-col">
      {/* Header */}
      <div className="border-b border-[#1a2f4a] px-4 py-3 flex items-center justify-between bg-[#081422]/80 backdrop-blur-sm">
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
          <SpriteNovaAvatar
            emotion={voiceState === "error" ? undefined : emotion}
            state={voiceState === "error" ? "error" : spriteState}
            size={40}
            glow={false}
            shimmer={shimmerOn}
          />
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
          <ExportChat messages={messages} />
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
          <div className="w-64 border-r border-[#1a2f4a] bg-[#081422]/90 overflow-y-auto shrink-0 hidden lg:block">
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
        {showSidebar && (        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setShowSidebar(false)}
          >
            <div
              className="w-64 h-full bg-[#081422] border-r border-[#1a2f4a] overflow-y-auto"
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
            <SpriteNovaAvatar
              emotion={isStreaming ? "processing" : emotion}
              state="idle"
              size={90}
              glow
              shimmer={shimmerOn}
            />
            <h2 className="text-lg font-bold text-[#e0ecf5] mt-4">Nova Personal Operating System</h2>
              <p className="text-[#5a7a9a] mt-2 text-sm max-w-md">
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
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#0f2035]/60 hover:bg-[#162a42] border border-[#1a2f4a]/50 text-xs text-[#c8d6e5] transition-colors text-left"
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
                    ? "bg-[#00d4ff]/10 border-[#00d4ff]/20 text-[#c8d6e5]"
                    : "bg-[#0b1929] border-[#1a2f4a] text-[#c8d6e5]"
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
                {/* Assumption Ledger chips (Nova Labs §2) */}
                {msg.role === "assistant" && !msg.isStreaming && (assumptionsByMessage[msg.id]?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(assumptionsByMessage[msg.id] ?? []).map((a) => (
                      <button
                        key={a.id}
                        onClick={() => toggleAssumption(a)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                          a.rejected
                            ? "bg-[#fb7185]/15 border-[#fb7185]/30 text-[#fb7185] line-through"
                            : "bg-[#a78bfa]/10 border-[#a78bfa]/30 text-[#c4b5fd] hover:bg-[#a78bfa]/20"
                        }`}
                        title={a.rejected ? "Corrected" : "Tap to correct this assumption"}
                      >
                        {a.rejected ? "✗ corrected · " : "🤔 "}{a.text}
                      </button>
                    ))}
                  </div>
                )}
                {/* Whisper zero-retention notice (Nova Labs §6) */}
                {msg.content?.startsWith("👻") && (
                  <p className="mt-2 text-[10px] font-mono text-[#6e6e8a] italic">{WHISPER_NOTICE}</p>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[#1a2f4a] px-4 py-3 bg-[#081422]/90 backdrop-blur-sm">          {voiceError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mb-2 max-w-3xl flex items-center justify-between p-2.5 rounded-lg bg-[#f97316]/10 border border-[#f97316]/25"
            >
              <p className="text-xs text-[#fdba74]">⚠️ {voiceError}</p>
              <Button variant="ghost" size="sm" className="text-[#fdba74] text-xs" onClick={toggleVoiceMode}>
                Retry
              </Button>
            </motion.div>
          )}
          <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-3xl mx-auto">
            {isSupported && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleVoiceMode}
                className={`shrink-0 ${
                  voiceModeActive
                    ? isSpeaking
                      ? "text-[#00d4ff] bg-[#00d4ff]/10"
                      : "text-red-400 bg-red-500/10"
                    : "text-[#6e6e8a]"
                }`}
                title={voiceModeActive ? "Voice mode active — click to stop" : "Click to start voice conversation"}
              >
              {voiceModeActive ? (
                isSpeaking ? (
                  <span className="relative flex h-5 w-5 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00d4ff] opacity-30" />
                    <Mic className="h-5 w-5 relative z-10" />
                  </span>
                ) : (
                  <MicOff className="h-5 w-5 animate-pulse" />
                )
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          )}
          {/* Whisper (zero-retention) toggle — Nova Labs §6 */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setWhisperMode((v) => !v)}
            className={`shrink-0 ${whisperMode ? "text-[#a78bfa] bg-[#a78bfa]/10" : "text-[#6e6e8a]"}`}
            title={whisperMode ? "Whisper mode ON — messages will not be saved" : "Whisper mode: send this message without saving it anywhere"}
          >
            👻
          </Button>
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
            className="flex-1 bg-[#0f2035] border border-[#1a2f4a] rounded-xl px-4 py-2.5 text-sm text-[#c8d6e5] placeholder:text-[#5a7a9a] focus:outline-none focus:border-[#00d4ff]/40 resize-none"
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
