/**
 * Nova AI OS — Status Indicator
 * Shows the current AI health status with visual feedback.
 */

import { cn } from "@/lib/utils";
import { useAIHealth, type AIHealthStatus } from "@/hooks/use-ai-health";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

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
  const status = overrideStatus || health.status;
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
