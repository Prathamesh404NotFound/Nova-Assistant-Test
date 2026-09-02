/**
 * Nova AI OS — Configuration Status Indicator
 * Shows integration status with 4 levels:
 *   connected = green  — API key present, service verified working
 *   configured = yellow — API key present, not yet verified
 *   needs-key = orange — feature available but no API key
 *   unavailable = gray  — feature exists but dependencies missing
 */

import { useState, useEffect, useCallback } from "react";
import {
  isFirebaseConfigured,
  isGeminiConfigured,
  isVoiceConfigured,
} from "@/lib/env-validator";
import { localAIService } from "@/ai/local/LocalAIService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Shield,
  Cpu,
  Mic,
  Cloud,
  Settings,
  CircleCheck,
  CircleAlert,
  CircleDot,
  CircleOff,
  KeyRound,
  ExternalLink,
} from "lucide-react";

export type IntegrationStatus = "connected" | "configured" | "needs-key" | "unavailable";

interface ServiceInfo {
  id: string;
  name: string;
  status: IntegrationStatus;
  icon: typeof Shield;
  description: string;
  docsUrl?: string;
  settingsKey?: string;
}

function getStatusColor(status: IntegrationStatus): string {
  switch (status) {
    case "connected":
      return "text-emerald-400";
    case "configured":
      return "text-amber-400";
    case "needs-key":
      return "text-orange-400";
    case "unavailable":
      return "text-zinc-500";
  }
}

function getStatusBg(status: IntegrationStatus): string {
  switch (status) {
    case "connected":
      return "bg-emerald-400/15 hover:bg-emerald-400/25";
    case "configured":
      return "bg-amber-400/15 hover:bg-amber-400/25";
    case "needs-key":
      return "bg-orange-400/15 hover:bg-orange-400/25";
    case "unavailable":
      return "bg-zinc-500/15 hover:bg-zinc-500/25";
  }
}

function getStatusDot(status: IntegrationStatus): string {
  switch (status) {
    case "connected":
      return "bg-emerald-400";
    case "configured":
      return "bg-amber-400";
    case "needs-key":
      return "bg-orange-400";
    case "unavailable":
      return "bg-zinc-500";
  }
}

function getStatusLabel(status: IntegrationStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "configured":
      return "Configured";
    case "needs-key":
      return "Needs Key";
    case "unavailable":
      return "Unavailable";
  }
}

function StatusIcon({ status }: { status: IntegrationStatus }) {
  switch (status) {
    case "connected":
      return <CircleCheck className="h-3 w-3" />;
    case "configured":
      return <CircleAlert className="h-3 w-3" />;
    case "needs-key":
      return <KeyRound className="h-3 w-3" />;
    case "unavailable":
      return <CircleOff className="h-3 w-3" />;
  }
}

export function ConfigStatus() {
  const [services, setServices] = useState<ServiceInfo[]>([]);

  const checkStatus = useCallback(async () => {
    const localAIReady = await localAIService.isCached();
    const fbConfigured = isFirebaseConfigured();
    const geminiConfigured = isGeminiConfigured();
    const voiceConfigured = isVoiceConfigured();

    setServices([
      {
        id: "firebase",
        name: "Firebase Auth",
        status: fbConfigured ? "connected" : "needs-key",
        icon: Shield,
        description: fbConfigured
          ? "Authentication and database connected"
          : "Add VITE_FIREBASE_* keys to enable auth",
        docsUrl: "https://console.firebase.google.com",
        settingsKey: "VITE_FIREBASE_API_KEY",
      },
      {
        id: "gemini",
        name: "Gemini AI",
        status: geminiConfigured ? "connected" : "needs-key",
        icon: Cloud,
        description: geminiConfigured
          ? "AI model available for chat and analysis"
          : "Add VITE_GEMINI_API_KEY for AI responses",
        docsUrl: "https://aistudio.google.com/apikey",
        settingsKey: "VITE_GEMINI_API_KEY",
      },
      {
        id: "local-ai",
        name: "Local AI",
        status: localAIReady
          ? "connected"
          : typeof WebAssembly !== "undefined" || typeof navigator.gpu !== "undefined"
          ? "configured"
          : "unavailable",
        icon: Cpu,
        description: localAIReady
          ? "Qwen3-0.6B downloaded and ready offline"
          : "Download the model in Settings → Local AI",
      },
      {
        id: "voice",
        name: "Voice APIs",
        status: voiceConfigured ? "connected" : "configured",
        icon: Mic,
        description: voiceConfigured
          ? "Text-to-speech and speech recognition enabled"
          : "Using browser-native voice APIs (no API key needed)",
      },
    ]);
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const connectedCount = services.filter((s) => s.status === "connected").length;
  const totalCount = services.length;
  const allConnected = connectedCount === totalCount;
  const noneConnected = connectedCount === 0;

  // Determine overall badge status
  const overallStatus: IntegrationStatus = allConnected
    ? "connected"
    : connectedCount > 0
    ? "configured"
    : "needs-key";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono transition-colors ${getStatusBg(
            overallStatus
          )}`}
          aria-label={`Integration status: ${connectedCount} of ${totalCount} connected`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${getStatusDot(overallStatus)}`} />
          <span className={getStatusColor(overallStatus)}>
            {allConnected ? "All OK" : `${connectedCount}/${totalCount}`}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-[#0b1929] border-[#1a2f4a] shadow-xl" align="end">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1a2f4a]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-200">Integration Status</p>
            <span className="text-[10px] font-mono text-slate-400">
              {connectedCount}/{totalCount} active
            </span>
          </div>
        </div>

        {/* Services list */}
        <div className="divide-y divide-[#1a2f4a]/50">
          {services.map((service) => (
            <div key={service.id} className="px-4 py-3 hover:bg-[#0f2137] transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <service.icon className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-200">{service.name}</span>
                      <span
                        className={`flex items-center gap-1 text-[10px] font-mono ${getStatusColor(
                          service.status
                        )}`}
                      >
                        <StatusIcon status={service.status} />
                        {getStatusLabel(service.status)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{service.description}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#1a2f4a]">
          <div className="flex items-center justify-between">
            <button
              onClick={() => window.location.assign("/settings")}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-400 transition-colors"
            >
              <Settings className="h-3 w-3" />
              Settings
            </button>
            <span className="text-[10px] text-slate-600 font-mono">auto-check 30s</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
