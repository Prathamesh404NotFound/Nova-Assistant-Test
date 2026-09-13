/**
 * NovaPhaseStrip — Listening → Processing → Planning → Acting → Completed.
 * Renders Nova's current pipeline progress in the app shell top rail.
 * Live-driven by the typed Nova event bus; nothing is decorative:
 * - Listening tracks the voice state machine.
 * - Thinking/Planning/Acting derive from real ai.started / tool.started events.
 * - Completed shows for a beat after ai.completed / tool.completed.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { novaEventBus } from "@/services/nova-core/NovaEventBus";
import { voiceStateMachine } from "@/services/voice-core/VoiceStateMachine";
import { cn } from "@/lib/utils";

type Phase = "idle" | "listening" | "processing" | "planning" | "acting" | "completed";

const PHASES: Array<{ key: Phase; label: string }> = [
  { key: "listening", label: "Listening" },
  { key: "processing", label: "Processing" },
  { key: "planning", label: "Planning" },
  { key: "acting", label: "Acting" },
  { key: "completed", label: "Completed" },
];

/** Steps between the current phase and the end are dimmed (not yet reached). */
const PHASE_ORDER: Phase[] = ["idle", "listening", "processing", "planning", "acting", "completed"];

export function NovaPhaseStrip() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeTool, setActiveTool] = useState<string | null>(null);

  useEffect(() => {
    let completedTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReset = () => {
      if (completedTimer) clearTimeout(completedTimer);
      completedTimer = setTimeout(() => {
        setPhase("idle");
        setActiveTool(null);
      }, 2600);
    };

    const offVoice = voiceStateMachine.subscribe((state) => {
      if (state === "listening") {
        setPhase("listening");
        if (completedTimer) clearTimeout(completedTimer);
      }
    });

    const offAiStart = novaEventBus.on("ai.started", () => {
      if (completedTimer) clearTimeout(completedTimer);
      setPhase("processing");
    });

    const offToolStart = novaEventBus.on("tool.started", ({ tool }) => {
      setActiveTool(tool);
      // Planning steps register as tools before side-effecting ones run.
      setPhase((prev) => (prev === "processing" ? "planning" : "acting"));
    });

    const offAiDone = novaEventBus.on("ai.completed", () => {
      setPhase("completed");
      scheduleReset();
    });

    const offToolDone = novaEventBus.on("tool.completed", () => {
      setPhase("completed");
      scheduleReset();
      setActiveTool(null);
    });

    const offAiFail = novaEventBus.on("ai.failed", () => {
      setPhase("idle");
      setActiveTool(null);
    });

    return () => {
      offVoice();
      offAiStart();
      offToolStart();
      offAiDone();
      offToolDone();
      offAiFail();
      if (completedTimer) clearTimeout(completedTimer);
    };
  }, []);

  const currentIndex = PHASE_ORDER.indexOf(phase);
  if (phase === "idle") {
    return (
      <div className="hidden md:flex items-center gap-2" aria-hidden="true">
        <span className="h-1.5 w-1.5 rounded-full bg-[#5a7a9a]/60" />
        <span className="font-mono text-[10px] tracking-[0.2em] text-[#5a7a9a]/70 uppercase">
          Nova Standing By
        </span>
      </div>
    );
  }

  return (
    <div
      className="hidden md:flex items-center gap-3"
      role="status"
      aria-live="polite"
      aria-label={`Nova is ${phase}`}
    >
      {PHASES.map((p) => {
        const idx = PHASE_ORDER.indexOf(p.key);
        const reached = idx <= currentIndex;
        const isCurrent = p.key === phase;
        return (
          <div key={p.key} className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                isCurrent ? "w-5 bg-[#00d4ff] nova-phase-dot" : reached ? "w-1.5 bg-[#00d4ff]/50" : "w-1.5 bg-[#5a7a9a]/40"
              )}
            />
            <span
              className={cn(
                "font-mono text-[10px] tracking-[0.15em] uppercase transition-colors duration-300",
                isCurrent ? "text-[#00d4ff]" : reached ? "text-[#c8d6e5]/70" : "text-[#5a7a9a]/50"
              )}
            >
              {p.label}
            </span>
          </div>
        );
      })}
      <AnimatePresence>
        {activeTool && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="font-mono text-[10px] text-[#a78bfa]/80 border border-[#a78bfa]/25 rounded px-1.5 py-0.5"
          >
            {activeTool}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NovaPhaseStrip;
