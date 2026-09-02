/**
 * Nova AI OS — Tool & Connector Registry
 * Shows available tools/connectors with health status, permissions, and controls.
 */

import { useState, useEffect, useCallback } from "react";
import {
  isFirebaseConfigured,
  isGeminiConfigured,
  isVoiceConfigured,
} from "@/lib/env-validator";
import { localAIService } from "@/ai/local/LocalAIService";
import {
  Shield,
  Cloud,
  Cpu,
  Mic,
  Database,
  Zap,
  RefreshCw,
  CircleCheck,
  CircleAlert,
  CircleOff,
  KeyRound,
  ExternalLink,
} from "lucide-react";

export type ConnectorStatus = "healthy" | "degraded" | "offline" | "needs-auth";

export interface Connector {
  id: string;
  name: string;
  category: "core" | "ai" | "voice" | "storage" | "integration";
  status: ConnectorStatus;
  icon: typeof Shield;
  description: string;
  capabilities: string[];
  requiresKey: boolean;
  configured: boolean;
  lastCheck?: number;
}

function getStatusIcon(status: ConnectorStatus) {
  switch (status) {
    case "healthy":
      return <CircleCheck className="h-3.5 w-3.5 text-emerald-400" />;
    case "degraded":
      return <CircleAlert className="h-3.5 w-3.5 text-amber-400" />;
    case "needs-auth":
      return <KeyRound className="h-3.5 w-3.5 text-orange-400" />;
    case "offline":
      return <CircleOff className="h-3.5 w-3.5 text-zinc-500" />;
  }
}

function getStatusLabel(status: ConnectorStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "degraded":
      return "Degraded";
    case "needs-auth":
      return "Needs Key";
    case "offline":
      return "Offline";
  }
}

function getStatusColor(status: ConnectorStatus): string {
  switch (status) {
    case "healthy":
      return "bg-emerald-400/10 text-emerald-400 border-emerald-400/20";
    case "degraded":
      return "bg-amber-400/10 text-amber-400 border-amber-400/20";
    case "needs-auth":
      return "bg-orange-400/10 text-orange-400 border-orange-400/20";
    case "offline":
      return "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
  }
}

function useConnectors(): Connector[] {
  const [localAIReady, setLocalAIReady] = useState(false);

  useEffect(() => {
    localAIService.isCached().then(setLocalAIReady);
  }, []);

  const connectors: Connector[] = [
    {
      id: "firebase-auth",
      name: "Firebase Auth",
      category: "core",
      status: isFirebaseConfigured() ? "healthy" : "needs-auth",
      icon: Shield,
      description: "User authentication, sessions, and security rules",
      capabilities: ["Sign in", "Sign up", "Guest access", "Session sync"],
      requiresKey: true,
      configured: isFirebaseConfigured(),
    },
    {
      id: "firebase-db",
      name: "Realtime Database",
      category: "storage",
      status: isFirebaseConfigured() ? "healthy" : "needs-auth",
      icon: Database,
      description: "Cloud data persistence and real-time sync",
      capabilities: ["Read/Write", "Real-time sync", "Offline support"],
      requiresKey: true,
      configured: isFirebaseConfigured(),
    },
    {
      id: "gemini",
      name: "Gemini AI",
      category: "ai",
      status: isGeminiConfigured() ? "healthy" : "needs-auth",
      icon: Cloud,
      description: "Google's multimodal AI for chat, analysis, and generation",
      capabilities: ["Chat", "Analysis", "Code generation", "Vision"],
      requiresKey: true,
      configured: isGeminiConfigured(),
    },
    {
      id: "local-ai",
      name: "Qwen3 Local AI",
      category: "ai",
      status: localAIReady
        ? "healthy"
        : typeof navigator.gpu !== "undefined" || typeof WebAssembly !== "undefined"
        ? "degraded"
        : "offline",
      icon: Cpu,
      description: "On-device AI model — works offline, no API key needed",
      capabilities: ["Offline chat", "Intent classification", "Privacy-first"],
      requiresKey: false,
      configured: localAIReady,
    },
    {
      id: "voice",
      name: "Voice APIs",
      category: "voice",
      status: isVoiceConfigured()
        ? "healthy"
        : "degraded",
      icon: Mic,
      description: "Text-to-speech and speech recognition",
      capabilities: isVoiceConfigured()
        ? ["TTS (ElevenLabs)", "STT (Deepgram)", "Wake word"]
        : ["Browser TTS", "Browser STT", "Wake word"],
      requiresKey: false,
      configured: true,
    },
  ];

  return connectors;
}

export function ConnectorRegistry({ onClose }: { onClose?: () => void }) {
  const connectors = useConnectors();
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const healthy = connectors.filter((c) => c.status === "healthy").length;
  const total = connectors.length;

  const refresh = useCallback(() => {
    setLastRefresh(Date.now());
  }, []);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-200">Tool & Connector Registry</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500">
            {healthy}/{total} healthy
          </span>
          <button
            onClick={refresh}
            className="p-1 rounded hover:bg-[#0f2137] transition-colors"
            aria-label="Refresh connector status"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Connector list */}
      <div className="space-y-2">
        {connectors.map((connector) => {
          const Icon = connector.icon;
          return (
            <div
              key={connector.id}
              className="bg-[#0a1425] border border-[#1a2f4a] rounded-lg p-3 hover:border-[#2a4a6a] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-[#0f2137]">
                    <Icon className="h-4 w-4 text-slate-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-200">
                        {connector.name}
                      </span>
                      {connector.requiresKey && !connector.configured && (
                        <KeyRound className="h-3 w-3 text-orange-400" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{connector.description}</p>
                  </div>
                </div>
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${getStatusColor(
                    connector.status
                  )}`}
                >
                  {getStatusIcon(connector.status)}
                  {getStatusLabel(connector.status)}
                </div>
              </div>

              {/* Capabilities */}
              <div className="flex flex-wrap gap-1 mt-2 ml-10">
                {connector.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="text-[9px] font-mono text-slate-500 bg-[#0f2137] px-1.5 py-0.5 rounded"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
