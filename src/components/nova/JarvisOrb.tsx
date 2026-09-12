/**
 * JarvisOrb — holographic core visual for Nova.
 * Orb + three rotating data rings + floating glass panels.
 * Purely presentational: driven entirely by the `state` prop so it stays
 * in sync with the existing voice state machine in Chat.tsx.
 */

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type JarvisOrbState = "idle" | "listening" | "processing" | "speaking" | "error";

interface JarvisOrbProps {
  state?: JarvisOrbState;
  /** Overall diameter of the orb core in px. Rings extend beyond this. */
  size?: number;
  /** Show the surrounding data rings. */
  rings?: boolean;
  /** Show floating glass data panels around the orb. */
  panels?: boolean;
  className?: string;
}

// Palette per state — cyan base, violet for processing, amber/red for error.
const STATE_COLORS: Record<JarvisOrbState, { core: string; rim: string; glow: string }> = {
  idle: { core: "rgba(34,211,238,0.18)", rim: "#22d3ee", glow: "rgba(34,211,238,0.35)" },
  listening: { core: "rgba(34,211,238,0.28)", rim: "#00d4ff", glow: "rgba(0,212,255,0.55)" },
  processing: { core: "rgba(167,139,250,0.25)", rim: "#a78bfa", glow: "rgba(167,139,250,0.5)" },
  speaking: { core: "rgba(34,211,238,0.32)", rim: "#67e8f9", glow: "rgba(103,232,249,0.6)" },
  error: { core: "rgba(239,68,68,0.22)", rim: "#ef4444", glow: "rgba(239,68,68,0.45)" },
};

// Ring speed multipliers per state — processing/alerts spin everything faster.
const STATE_RING_SPEED: Record<JarvisOrbState, number> = {
  idle: 1,
  listening: 1.3,
  processing: 2.2,
  speaking: 1.6,
  error: 0.4,
};

function Ring({
  radius,
  duration,
  reverse,
  color,
  opacity,
  segments,
  speed,
  delay = 0,
}: {
  radius: number;
  duration: number;
  reverse?: boolean;
  color: string;
  opacity: number;
  segments: number;
  speed: number;
  delay?: number;
}) {
  const circumference = 2 * Math.PI * radius;
  const dash = circumference / segments;
  const gap = dash * 0.35;

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      animate={{ rotate: reverse ? -360 : 360 }}
      transition={{
        duration: duration / speed,
        repeat: Infinity,
        ease: "linear",
        delay,
      }}
    >
      <svg
        width={radius * 2 + 4}
        height={radius * 2 + 4}
        viewBox={`0 0 ${radius * 2 + 4} ${radius * 2 + 4}`}
        style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}
      >
        <circle
          cx={radius + 2}
          cy={radius + 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeOpacity={opacity}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={`${dash - gap} ${gap}`}
        />
      </svg>
    </motion.div>
  );
}

/** Expanding ripple emitted while processing. */
function Ripples({ color }: { color: string }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: 0,
            border: `1px solid ${color}`,
          }}
          animate={{
            scale: [1, 1.6],
            opacity: [0.5, 0],
          }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            delay: i * 0.55,
            ease: "easeOut",
          }}
        />
      ))}
    </>
  );
}

interface PanelSpec {
  title: string;
  value: string;
  /** Grid position class */
  pos: string;
  align: "left" | "right";
}

/** Floating glass data panels (purely decorative telemetry). */
function DataPanels({ state }: { state: JarvisOrbState }) {
  const panels: PanelSpec[] = useMemo(() => {
    const common: PanelSpec[] = [
      { title: "CORE", value: state === "idle" ? "STANDBY" : state.toUpperCase(), pos: "top-0 left-0", align: "left" },
      { title: "AUDIO", value: state === "listening" ? "INPUT LIVE" : state === "speaking" ? "OUTPUT LIVE" : "MUTED", pos: "bottom-0 left-0", align: "left" },
      { title: "NEURAL", value: state === "processing" ? "SYNTHESIZING" : "IDLE", pos: "top-0 right-0", align: "right" },
      { title: "LINK", value: state === "error" ? "FAULT" : "STABLE", pos: "bottom-0 right-0", align: "right" },
    ];
    return common;
  }, [state]);

  return (
    <div className="absolute inset-0 pointer-events-none hidden sm:block">
      <AnimatePresence>
        {panels.map((p) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{
              opacity: 1,
              y: [0, -5, 0],
              x: [0, 3, 0],
            }}
            exit={{ opacity: 0, y: 8 }}
            transition={{
              opacity: { duration: 0.3 },
              y: { duration: 7 + Math.random() * 2, repeat: Infinity, ease: "easeInOut" },
              x: { duration: 9, repeat: Infinity, ease: "easeInOut" },
            }}
            className={`absolute ${p.pos} px-3 py-2 rounded-lg border backdrop-blur-sm`}
            style={{
              borderColor: state === "error" ? "rgba(239,68,68,0.35)" : "rgba(34,211,238,0.25)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <p
              className="text-[9px] font-mono tracking-widest"
              style={{ color: state === "error" ? "#f87171" : "rgba(34,211,238,0.7)" }}
            >
              {p.title}
            </p>
            <p className="text-[11px] font-mono text-white/85">{p.value}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function JarvisOrb({
  state = "idle",
  size = 180,
  rings = true,
  panels = true,
  className,
}: JarvisOrbProps) {
  const colors = STATE_COLORS[state] ?? STATE_COLORS.idle;
  const speed = STATE_RING_SPEED[state] ?? 1;

  return (
    <div className={`relative flex items-center justify-center ${className ?? ""}`} style={{ width: size, height: size }}>
      {/* Data rings */}
      {rings && (
        <>
          <Ring radius={size / 2 + 18} duration={22} color={colors.rim} opacity={0.35} segments={14} speed={speed} />
          <Ring radius={size / 2 + 34} duration={16} reverse color={colors.rim} opacity={0.28} segments={22} speed={speed} delay={1} />
          <Ring radius={size / 2 + 50} duration={11} color={colors.rim} opacity={0.22} segments={30} speed={speed} delay={2} />
        </>
      )}

      {/* Processing ripples */}
      {state === "processing" && <Ripples color={colors.glow} />}

      {/* Orb core */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 38% 32%, rgba(255,255,255,0.22) 0%, ${colors.core} 38%, rgba(6,14,26,0.9) 78%)`,
          border: `1px solid ${colors.rim}55`,
          boxShadow: `0 0 ${size / 3}px ${colors.glow}, inset 0 0 ${size / 5}px rgba(255,255,255,0.08)`,
        }}
        animate={{
          scale: state === "speaking" ? [1, 1.04, 1] : state === "idle" ? [1, 1.02, 1] : 1,
        }}
        transition={{
          duration: state === "speaking" ? 0.9 : 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Inner filament arcs */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{ width: size * 0.8, height: size * 0.8 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 14 / speed, repeat: Infinity, ease: "linear" }}
      >
        <svg width="100%" height="100%" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r="46"
            fill="none"
            stroke={colors.rim}
            strokeOpacity={0.3}
            strokeWidth={0.8}
            strokeDasharray="20 80"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>

      {/* Floating panels */}
      {panels && (
        <div className="absolute" style={{ width: size * 2.1, height: size * 2.1 }}>
          <DataPanels state={state} />
        </div>
      )}
    </div>
  );
}
