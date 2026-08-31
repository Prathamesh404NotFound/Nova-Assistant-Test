import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface NovaAvatarProps {
  state?: AvatarState;
  size?: number;
  className?: string;
}

export function NovaAvatar({ state = "idle", size = 200, className }: NovaAvatarProps) {
  const colors = useMemo(
    () => ({
      idle: { primary: "#00d4ff", glow: "rgba(0,212,255,0.3)", particle: "#00d4ff" },
      listening: { primary: "#00d4ff", glow: "rgba(0,212,255,0.5)", particle: "#00d4ff" },
      thinking: { primary: "#8b5cf6", glow: "rgba(139,92,246,0.4)", particle: "#8b5cf6" },
      speaking: { primary: "#00d4ff", glow: "rgba(0,212,255,0.5)", particle: "#00d4ff" },
      error: { primary: "#f43f5e", glow: "rgba(244,63,94,0.4)", particle: "#f43f5e" },
    }),
    []
  );

  const c = colors[state];
  const isSpeaking = state === "speaking";
  const isListening = state === "listening";
  const isThinking = state === "thinking";
  const isError = state === "error";

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Outer glow ring */}
      <div
        className={cn(
          "absolute inset-0 rounded-full transition-all duration-500",
          isThinking ? "nova-avatar-pulse-violet" : "nova-avatar-pulse"
        )}
        style={{
          background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`,
        }}
      />

      {/* Rotating orbit ring */}
      <div
        className={cn(
          "absolute inset-2 rounded-full border border-dashed transition-colors duration-500",
          isThinking ? "border-[#8b5cf6]/30" : "border-[#00d4ff]/20"
        )}
        style={{ animation: "nova-spin-slow 20s linear infinite" }}
      />

      {/* SVG Face */}
      <svg
        viewBox="0 0 200 200"
        width={size * 0.75}
        height={size * 0.75}
        className={cn(
          "relative z-10 transition-all duration-500",
          state !== "error" && "nova-avatar-breathe"
        )}
      >
        <defs>
          <radialGradient id="faceGrad" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor={c.primary} stopOpacity="0.15" />
            <stop offset="100%" stopColor={c.primary} stopOpacity="0.02" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Face circle */}
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="url(#faceGrad)"
          stroke={c.primary}
          strokeWidth="2"
          strokeOpacity="0.4"
          filter="url(#glow)"
        />

        {/* Inner ring */}
        <circle
          cx="100"
          cy="100"
          r="65"
          fill="none"
          stroke={c.primary}
          strokeWidth="1"
          strokeOpacity="0.15"
        />

        {/* Left eye */}
        <g style={{ animation: "nova-blink 4s ease-in-out infinite" }}>
          <ellipse
            cx="75"
            cy="85"
            rx={isListening ? 8 : 6}
            ry={isListening ? 10 : 7}
            fill={c.primary}
            opacity={isError ? 0.6 : 0.9}
            className="transition-all duration-300"
          />
          {/* Eye highlight */}
          <circle cx="77" cy="82" r="2" fill="white" opacity="0.6" />
        </g>

        {/* Right eye */}
        <g style={{ animation: "nova-blink 4s ease-in-out infinite", animationDelay: "0.1s" }}>
          <ellipse
            cx="125"
            cy="85"
            rx={isListening ? 8 : 6}
            ry={isListening ? 10 : 7}
            fill={c.primary}
            opacity={isError ? 0.6 : 0.9}
            className="transition-all duration-300"
          />
          <circle cx="127" cy="82" r="2" fill="white" opacity="0.6" />
        </g>

        {/* Mouth */}
        {isSpeaking ? (
          <ellipse
            cx="100"
            cy="120"
            rx="12"
            ry="6"
            fill={c.primary}
            opacity="0.7"
            style={{ animation: "nova-lip-sync 0.15s ease-in-out infinite" }}
          />
        ) : isThinking ? (
          <circle cx="100" cy="120" r="5" fill={c.primary} opacity="0.5" />
        ) : isListening ? (
          <ellipse cx="100" cy="120" rx="8" ry="4" fill={c.primary} opacity="0.6" />
        ) : isError ? (
          <line
            x1="88"
            y1="122"
            x2="112"
            y2="118"
            stroke={c.primary}
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        ) : (
          <path
            d="M 90 118 Q 100 126 110 118"
            fill="none"
            stroke={c.primary}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.6"
          />
        )}

        {/* Thinking particles */}
        {isThinking && (
          <>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <circle
                key={i}
                cx={100 + Math.cos((i * Math.PI * 2) / 6) * 50}
                cy={100 + Math.sin((i * Math.PI * 2) / 6) * 50}
                r="2"
                fill="#8b5cf6"
                opacity="0.6"
                style={{
                  animation: `nova-particle 1.5s ease-out infinite`,
                  animationDelay: `${i * 0.25}s`,
                }}
              />
            ))}
          </>
        )}
      </svg>

      {/* Waveform bars for listening/speaking */}
      {(isListening || isSpeaking) && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-end gap-1 h-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full transition-colors duration-300"
              style={{
                backgroundColor: c.primary,
                animation: `nova-waveform 0.8s ease-in-out infinite`,
                animationDelay: `${i * 0.1}s`,
                minHeight: "3px",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
