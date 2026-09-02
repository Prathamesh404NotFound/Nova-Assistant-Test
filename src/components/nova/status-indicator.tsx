/**
 * Nova AI OS — Status Indicator
 * Shows the current AI health status with visual feedback.
 */

import { cn } from "@/lib/utils";
import { useAIHealth, type AIHealthStatus } from "@/hooks/use-ai-health";
import { useAIService } from "@/contexts/AIServiceProvider";
import { useWakeWordContext } from "@/contexts/WakeWordProvider";
import { Wifi, WifiOff, Loader2, Mic, MicOff } from "lucide-react";

const statusConfig: Record<
  AIHealthStatus,
  { label: string; color: string; bgColor: string; icon: typeof Wifi }
> = {
  ready: {
    label: "Ready",
    color: "text-[#10b981]",
    bgColor: "bg-[#10b981]",
    icon: Wifi,
  },
  degraded: {
    label: "Partial",
    color: "text-[#f59e0b]",
    bgColor: "bg-[#f59e0b]",
    icon: Loader2,
  },
  offline: {
    label: "Offline",
    color: "text-[#f43f5e]",
    bgColor: "bg-[#f43f5e]",
    icon: WifiOff,
  },
};

interface StatusIndicatorProps {
  /** If true, show detailed health info */
  detailed?: boolean;
  /** Override status instead of using health hook */
  overrideStatus?: AIHealthStatus;
}

export function StatusIndicator({ detailed, overrideStatus }: StatusIndicatorProps) {
  const health = useAIHealth();
  const { isOnline, localAIModelCached } = useAIService();
  const { isListening: wakeWordActive, start: startWake, stop: stopWake, isSupported: wakeSupported } = useWakeWordContext();
  const status = overrideStatus || (isOnline ? health.status : "offline");
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-2 text-xs font-medium", config.color)}>
      <div
        className={cn(
          "w-2 h-2 rounded-full",
          config.bgColor,
          status !== "offline" && "animate-pulse"
        )}
      />
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>

      {/* Wake word listening indicator */}
      {wakeSupported && (
        <button
          onClick={wakeWordActive ? stopWake : startWake}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors",
            wakeWordActive
              ? "bg-[#00d4ff]/20 text-[#00d4ff]"
              : "text-[#6e6e8a] hover:text-[#c8d6e5]"
          )}
          aria-label={wakeWordActive ? "Stop wake word listening" : "Start wake word listening"}
        >
          {wakeWordActive ? (
            <Mic className="h-3 w-3 animate-pulse" />
          ) : (
            <MicOff className="h-3 w-3" />
          )}
          {wakeWordActive ? "Listening" : "Muted"}
        </button>
      )}

      {detailed && (
        <div className="ml-2 flex items-center gap-3 text-[10px] text-[#6e6e8a]">
          <span>
            Gemini:{" "}
            <span
              className={
                health.gemini === "ready"
                  ? "text-[#10b981]"
                  : health.gemini === "unconfigured"
                  ? "text-[#f59e0b]"
                  : "text-[#f43f5e]"
              }
            >
              {health.gemini === "ready"
                ? "Connected"
                : health.gemini === "unconfigured"
                ? "No API Key"
                : "Error"}
            </span>
          </span>
          <span>
            Local AI:{" "}
            <span
              className={
                health.localAI === "ready"
                  ? "text-[#10b981]"
                  : health.localAI === "unavailable"
                  ? "text-[#6e6e8a]"
                  : "text-[#f59e0b]"
              }
            >
              {health.localAI === "ready"
                ? "Ready"
                : health.localAI === "downloading"
                ? "Downloading..."
                : health.localAI === "loading"
                ? "Loading..."
                : "Not installed"}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
