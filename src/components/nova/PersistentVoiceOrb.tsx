/**
 * PersistentVoiceOrb — Nova's always-available voice presence.
 * Lives in the app shell on every page so voice remains the primary
 * interaction model. Collapses to a compact beacon while the session
 * sleeps and expands into a state-aware mini orb during conversation.
 *
 * Fully driven by voiceStateMachine — no local voice state inference.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Square, AlertCircle, X } from "lucide-react";
import { voiceSession } from "@/services/voice-core";
import { voiceStateMachine } from "@/services/voice-core/VoiceStateMachine";
import type { VoiceStateName } from "@/services/voice-core";
import { novaEventBus } from "@/services/nova-core/NovaEventBus";
import { cn } from "@/lib/utils";

type Presence = "sleeping" | "listening" | "processing" | "speaking" | "error";

const PHASE_LABEL: Record<Presence, string> = {
  sleeping: "Nova is asleep — tap to talk",
  listening: "Listening…",
  processing: "Thinking…",
  speaking: "Speaking — tap to interrupt",
  error: "Voice error — tap to retry",
};

const PHASE_COLOR: Record<Presence, string> = {
  sleeping: "#5a7a9a",
  listening: "#00d4ff",
  processing: "#a78bfa",
  speaking: "#67e8f9",
  error: "#f43f5e",
};

/** Animated equalizer bars shown while listening/speaking. */
function Waveform({ color, active }: { color: string; active: boolean }) {
  return (
    <div className="flex items-end gap-[3px] h-4" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full"
          style={{ background: color }}
          animate={
            active
              ? { height: [4, 14 - Math.abs(1.5 - i) * 2, 4] }
              : { height: 4 }
          }
          transition={
            active
              ? { duration: 0.7, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }
              : { duration: 0.2 }
          }
        />
      ))}
    </div>
  );
}

export function PersistentVoiceOrb() {
  const [voiceState, setVoiceState] = useState<VoiceStateName>(voiceStateMachine.current);
  const [transcript, setTranscript] = useState("");
  const [dismissedError, setDismissedError] = useState(false);
  const startingRef = useRef(false);

  useEffect(() => {
    const off = voiceStateMachine.subscribe((state) => {
      setVoiceState(state);
      if (state !== "error") setDismissedError(false);
    });
    const offTranscript = novaEventBus.on("voice.transcript", ({ text }) => {
      setTranscript(text.slice(-120));
    });
    const offEnded = novaEventBus.on("voice.ended", () => setTranscript(""));
    return () => {
      off();
      offTranscript();
      offEnded();
    };
  }, []);

  const toggle = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      if (voiceSession.isActive()) {
        voiceSession.stop();
        setTranscript("");
      } else {
        await voiceSession.start();
      }
    } finally {
      startingRef.current = false;
    }
  }, []);

  const interrupt = useCallback(() => {
    if (voiceStateMachine.current === "speaking") voiceSession.bargeIn();
  }, []);

  const presence: Presence =
    voiceState === "error"
      ? "error"
      : voiceState === "sleeping" || voiceState === "wake_detected" || voiceState === "interrupted"
        ? voiceState === "wake_detected" ? "listening" : "sleeping"
        : voiceState;

  const active = presence !== "sleeping";
  const color = PHASE_COLOR[presence];
  const showError = presence === "error" && !dismissedError;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-end gap-2">
      {/* Orb button */}
      <motion.button
        onClick={presence === "speaking" ? interrupt : toggle}
        aria-label={PHASE_LABEL[presence]}
        aria-pressed={active}
        className={cn(
          "relative flex items-center justify-center rounded-full outline-none",
          "focus-visible:ring-2 focus-visible:ring-[#00d4ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#060e1a]",
          "transition-shadow duration-300"
        )}
        animate={{ width: active ? 56 : 44, height: active ? 56 : 44 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        style={{
          background: active
            ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.18) 0%, ${color}33 40%, rgba(6,14,26,0.95) 80%)`
            : "rgba(13,22,38,0.9)",
          border: `1px solid ${color}66`,
          boxShadow: active
            ? `0 0 ${presence === "speaking" ? 28 : 16}px ${color}55, inset 0 0 12px ${color}22`
            : "0 2px 10px rgba(0,0,0,0.4)",
        }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Pulsing halo while actively engaged */}
        {active && presence !== "error" && (
          <motion.span
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ border: `1px solid ${color}` }}
            animate={{ scale: [1, 1.45], opacity: [0.45, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <AnimatePresence mode="wait">
          {presence === "listening" || presence === "speaking" ? (
            <motion.span key="wave" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Waveform color={color} active />
            </motion.span>
          ) : presence === "processing" ? (
            <motion.span
              key="spin"
              className="h-5 w-5 rounded-full border-2 border-transparent"
              style={{ borderTopColor: color, borderRightColor: color }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            />
          ) : presence === "error" ? (
            <AlertCircle className="h-5 w-5" style={{ color }} aria-hidden="true" />
          ) : (
            <Mic className="h-5 w-5 text-[#5a7a9a]" aria-hidden="true" />
          )}
        </AnimatePresence>
      </motion.button>

      {/* Status bubble */}
      <AnimatePresence>
        {(active || showError) && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "mb-1 max-w-[min(300px,60vw)] rounded-xl px-3 py-2 backdrop-blur-md",
              "border bg-[#0b1626]/90 font-mono text-[11px] leading-snug",
              showError ? "border-[#f43f5e]/40" : "border-[#00d4ff]/20"
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="tracking-wide" style={{ color: showError ? "#fda4af" : color }}>
                {showError ? "Voice unavailable" : PHASE_LABEL[presence]}
              </span>
              {showError && (
                <button
                  onClick={() => setDismissedError(true)}
                  aria-label="Dismiss voice error"
                  className="text-[#fda4af]/70 hover:text-[#fda4af]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {!showError && (
                <button
                  onClick={() => { voiceSession.stop(); setTranscript(""); }}
                  aria-label="End voice session"
                  className="text-[#5a7a9a] hover:text-[#c8d6e5] shrink-0"
                >
                  <MicOff className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {presence === "listening" && transcript && (
              <p className="mt-1 text-[#c8d6e5]/80 truncate">“{transcript}”</p>
            )}
            <p className="mt-0.5 hidden md:block text-[9px] text-[#5a7a9a]">
              Shift+Space talk · ⌘J interrupt
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stop-generation affordance while speaking */}
      {presence === "speaking" && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={interrupt}
          aria-label="Stop speaking"
          className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-[#67e8f9]/40 bg-[#0b1626]/90 text-[#67e8f9] hover:bg-[#0f2035]"
        >
          <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        </motion.button>
      )}
    </div>
  );
}

export default PersistentVoiceOrb;
