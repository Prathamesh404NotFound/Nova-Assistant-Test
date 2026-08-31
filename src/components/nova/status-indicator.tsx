import { cn } from "@/lib/utils";
import type { AvatarState } from "./avatar";

const stateConfig: Record<AvatarState, { label: string; color: string; dotColor: string }> = {
  idle: { label: "Idle", color: "text-muted-foreground", dotColor: "bg-muted-foreground" },
  listening: { label: "Listening", color: "text-[#00d4ff]", dotColor: "bg-[#00d4ff]" },
  thinking: { label: "Thinking", color: "text-[#8b5cf6]", dotColor: "bg-[#8b5cf6]" },
  speaking: { label: "Speaking", color: "text-[#00d4ff]", dotColor: "bg-[#00d4ff]" },
  error: { label: "Error", color: "text-[#f43f5e]", dotColor: "bg-[#f43f5e]" },
};

export function StatusIndicator({ state }: { state: AvatarState }) {
  const config = stateConfig[state];

  return (
    <div className={cn("flex items-center gap-2 text-xs font-medium", config.color)}>
      <div className={cn("w-2 h-2 rounded-full", config.dotColor, state !== "idle" && "animate-pulse")} />
      <span>{config.label}</span>
    </div>
  );
}
