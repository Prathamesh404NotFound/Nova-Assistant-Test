/**
 * AmbientNovaCore — the primary Nova presence.
 *
 * A single unified component that makes Nova feel like an OS, not a page:
 *   - central orb communicating idle / listening / thinking / planning /
 *     acting / observing / speaking / confirmation / error
 *   - live operation timeline (what Nova is doing right now)
 *   - tool execution visuals (Calendar → Searching… → Found → Verified)
 *   - transcript of the current exchange (accessibility captions)
 *
 * Driven entirely by the typed Nova event bus and the voice state machine —
 * no duplicated state, no polling, no fake activity.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { JarvisOrb, type JarvisOrbState } from "./JarvisOrb";
import { voiceSession } from "@/services/voice-core/VoiceSession";
import { voiceOutput } from "@/services/voice-core/VoiceOutput";
import { voiceStateMachine } from "@/services/voice-core/VoiceStateMachine";
import { novaEventBus } from "@/services/nova-core/NovaEventBus";
import { useAuth } from "@/hooks/use-auth";
import { Mic, MicOff, Volume2, VolumeX, Keyboard, X, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Live operation model ───────────────────────────────────────────────────

export interface OperationStep {
  id: string;
  label: string;
  detail?: string;
  status: "active" | "done" | "failed";
  at: number;
}

interface ToolVisual {
  requestId: string;
  tool: string;
  phase: "started" | "completed" | "failed";
  durationMs?: number;
  at: number;
}

type CoreState =
  | "idle" | "listening" | "thinking" | "planning"
  | "acting" | "observing" | "speaking" | "confirmation" | "error";

const STATE_LABEL: Record<CoreState, string> = {
  idle: "Nova is present",
  listening: "Listening",
  thinking: "Understanding request",
  planning: "Planning",
  acting: "Acting",
  observing: "Observing",
  speaking: "Speaking",
  confirmation: "Waiting for confirmation",
  error: "Something went wrong",
};

/** Friendly tool names for the live visuals. */
function toolLabel(tool: string): string {
  const [domain] = tool.split(".");
  const names: Record<string, string> = {
    calendar: "Calendar",
    task: "Tasks",
    memory: "Memory",
    email: "Email",
    desktop: "Desktop",
    screen: "Screen",
    file: "Files",
    browser: "Browser",
    search: "Search",
    system: "System",
    device: "Devices",
    notify: "Notification",
  };
  return names[domain] ?? domain.charAt(0).toUpperCase() + domain.slice(1);
}

/** Map voice states + AI/tool events onto the full core state range. */
function useCoreState(): { state: CoreState; activeTool: string | null } {
  const [voice, setVoice] = useState<CoreState>("idle");
  const [activeTool, setActiveTool] = useState<string | null>(null);

  useEffect(() => {
    const offSession = voiceSession.subscribe((status) => {
      setActiveTool(null);
      switch (status.state) {
        case "listening": setVoice("listening"); break;
        case "processing": setVoice("thinking"); break;
        case "speaking": setVoice("speaking"); break;
        case "interrupted": setVoice("listening"); break;
        case "error": setVoice("error"); break;
        case "sleeping": setVoice("idle"); break;
        default: break;
      }
    });
    return offSession;
  }, []);

  useEffect(() => {
    const offs = [
      novaEventBus.on("ai.started", () => {
        setVoice("thinking");
      }),
      novaEventBus.on("ai.completed", () => {
        if (voiceStateMachine.current === "processing") setVoice("speaking");
      }),
      novaEventBus.on("ai.failed", () => setVoice("error")),
      novaEventBus.on("tool.started", ({ tool }) => {
        setActiveTool(tool);
        setVoice("acting");
      }),
      novaEventBus.on("tool.completed", ({ tool, success }) => {
        setActiveTool(null);
        setVoice(success ? "observing" : "error");
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  return { state: voice, activeTool };
}

// ─── Main component ─────────────────────────────────────────────────────────

export function AmbientNovaCore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state, activeTool } = useCoreState();

  const [isMuted, setIsMuted] = useState(voiceOutput.isMuted());
  const [textDraft, setTextDraft] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ role: "user" | "nova"; text: string; at: number }>>([]);
  const [steps, setSteps] = useState<OperationStep[]>([]);
  const [toolVisuals, setToolVisuals] = useState<ToolVisual[]>([]);
  const stepsEndRef = useRef<HTMLDivElement>(null);

  const orbState: JarvisOrbState =
    state === "idle" ? "idle"
    : state === "listening" ? "listening"
    : state === "speaking" ? "speaking"
    : state === "error" ? "error"
    : "processing";

  // Voice session on/off
  const sessionActive = state !== "idle";
  const toggleVoice = useCallback(() => {
    if (sessionActive) {
      voiceSession.stop();
    } else {
      voiceSession.setUserId(user?.uid || "");
      void voiceSession.start();
    }
  }, [sessionActive, user?.uid]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    voiceOutput.setMuted(next);
  }, [isMuted]);

  // Event-driven operation timeline
  useEffect(() => {
    const offs = [
      // user / nova transcript (captions)
      novaEventBus.on("voice.transcript", ({ text }) => {
        if (!text.trim()) return;
        setTranscript((t) => [...t.slice(-20), { role: "user", text, at: Date.now() }]);
      }),
      novaEventBus.on("ai.completed", ({ text }) => {
        if (text?.trim()) {
          setTranscript((t) => [...t.slice(-20), { role: "nova", text, at: Date.now() }]);
          setSteps((s) => [...s, { id: `done-${Date.now()}`, label: "Complete", status: "done" as const, at: Date.now() }]);
        }
      }),
      novaEventBus.on("ai.failed", ({ errorCode }) => {
        setSteps((s) => [...s, { id: `fail-${Date.now()}`, label: "Failed", detail: errorCode, status: "failed" as const, at: Date.now() }]);
      }),
      // tool lifecycle → "Calendar · Searching…" visuals
      novaEventBus.on("tool.started", ({ requestId, tool }) => {
        setToolVisuals((v) => [...v.slice(-3), { requestId, tool, phase: "started", at: Date.now() }]);
        setSteps((s) => [...s.slice(-8), {
          id: `tool-${requestId}-${tool}`, label: toolLabel(tool), detail: "Executing…", status: "active" as const, at: Date.now(),
        }]);
      }),
      novaEventBus.on("tool.completed", ({ requestId, tool, success, durationMs }) => {
        setToolVisuals((v) => v.map((x) => x.requestId === requestId && x.tool === tool ? { ...x, phase: success ? "completed" : "failed", durationMs } : x));
        setSteps((s) => s.map((st) => st.id === `tool-${requestId}-${tool}`
          ? { ...st, detail: success ? "Verified" : "Failed", status: success ? ("done" as const) : ("failed" as const) }
          : st));
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  // Auto-scroll steps
  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [steps.length, transcript.length]);

  // Text fallback (keyboard / accessibility / voice-off)
  const submitText = useCallback(() => {
    const text = textDraft.trim();
    if (!text) return;
    setTextDraft("");
    void voiceSession.submitText(text);
  }, [textDraft]);

  const lastUser = [...transcript].reverse().find((t) => t.role === "user");
  const lastNova = [...transcript].reverse().find((t) => t.role === "nova");

  return (
    <div className="relative flex flex-col items-center w-full">
      {/* ── Central orb ──────────────────────────────────── */}
      <div className="relative flex flex-col items-center gap-5 py-6">
        <button
          onClick={toggleVoice}
          className="relative outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]/70 rounded-full transition-transform hover:scale-[1.02] active:scale-[0.98]"
          aria-label={sessionActive ? "Stop voice session" : "Talk to Nova"}
          aria-pressed={sessionActive}
        >
          <JarvisOrb
            state={orbState}
            size={200}
            rings
            panels={state === "acting" || state === "speaking"}
          />
        </button>

        {/* State label + live indicator */}
        <div className="text-center" role="status" aria-live="polite">
          <p className="text-sm font-medium text-[#c8d6e5] tracking-wide">
            {STATE_LABEL[state]}
            {activeTool && <span className="text-[#00d4ff]"> · {toolLabel(activeTool)}</span>}
          </p>
          <p className="text-[10px] text-[#5a7a9a] mt-0.5">
            {sessionActive ? "Say “Nova” or tap the orb to interrupt" : "Tap the core, or press Shift+Space to talk"}
          </p>
        </div>

        {/* Primary controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleVoice}
            className={cn(
              "h-11 px-6 rounded-full text-sm font-semibold transition-all flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-[#00d4ff]/70",
              sessionActive
                ? "bg-[#f43f5e]/90 text-white hover:bg-[#f43f5e]"
                : "bg-gradient-to-r from-[#00d4ff] to-[#0ea5e9] text-[#060e1a] hover:brightness-110 shadow-lg shadow-[#00d4ff]/20"
            )}
          >
            {sessionActive ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {sessionActive ? "Stop" : "Talk to Nova"}
          </button>
          <button
            onClick={toggleMute}
            className="h-11 w-11 rounded-full flex items-center justify-center text-[#5a7a9a] hover:text-[#c8d6e5] hover:bg-[#0f2035]/60 transition-colors focus-visible:ring-2 focus-visible:ring-[#00d4ff]/70"
            aria-label={isMuted ? "Unmute voice output" : "Mute voice output"}
            aria-pressed={isMuted}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setShowTextInput((v) => !v)}
            className="h-11 w-11 rounded-full flex items-center justify-center text-[#5a7a9a] hover:text-[#c8d6e5] hover:bg-[#0f2035]/60 transition-colors focus-visible:ring-2 focus-visible:ring-[#00d4ff]/70"
            aria-label="Type to Nova instead"
            aria-expanded={showTextInput}
          >
            <Keyboard className="h-4 w-4" />
          </button>
        </div>

        {/* Text input (secondary, always available) */}
        <AnimatePresence>
          {showTextInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full max-w-lg overflow-hidden"
            >
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitText(); }}
                  placeholder="Type to Nova…"
                  aria-label="Type a message to Nova"
                  className="flex-1 h-10 rounded-lg bg-[#0a1523] border border-[#1a2f4a] px-3 text-sm text-[#c8d6e5] placeholder:text-[#5a7a9a] focus:outline-none focus:border-[#00d4ff]/50"
                />
                <button
                  onClick={submitText}
                  className="h-10 px-4 rounded-lg bg-[#00d4ff]/15 text-[#00d4ff] text-sm hover:bg-[#00d4ff]/25 transition-colors focus-visible:ring-2 focus-visible:ring-[#00d4ff]/70"
                >
                  Send
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Live operation timeline ──────────────────────── */}
      <AnimatePresence>
        {(steps.length > 0 || toolVisuals.length > 0) && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            aria-label="Current Nova operation"
            className="w-full max-w-2xl jarvis-card rounded-xl p-4 mb-4"
          >
            <h3 className="text-[10px] text-[#5a7a9a] uppercase tracking-wider mb-2">Current operation</h3>

            {/* Tool visuals */}
            <div className="space-y-1.5 mb-2">
              {toolVisuals.map((tv) => (
                <div key={`${tv.requestId}-${tv.tool}`} className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-[#c8d6e5]">{toolLabel(tv.tool)}</span>
                  {tv.phase === "started" ? (
                    <>
                      <span className="text-[#00d4ff] flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Executing…
                      </span>
                    </>
                  ) : tv.phase === "completed" ? (
                    <span className="text-[#10b981] flex items-center gap-1">
                      <Check className="h-3 w-3" /> Verified{tv.durationMs ? ` · ${tv.durationMs}ms` : ""}
                    </span>
                  ) : (
                    <span className="text-[#f43f5e] flex items-center gap-1"><X className="h-3 w-3" /> Failed</span>
                  )}
                </div>
              ))}
            </div>

            {/* Step timeline */}
            <ol className="space-y-1" aria-label="Operation steps">
              {steps.slice(-6).map((step, i, arr) => (
                <li key={step.id} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      step.status === "active" ? "bg-[#00d4ff] animate-pulse"
                      : step.status === "done" ? "bg-[#10b981]"
                      : "bg-[#f43f5e]"
                    )}
                    aria-hidden="true"
                  />
                  <span className={cn(step.status === "done" ? "text-[#5a7a9a]" : "text-[#c8d6e5]")}>
                    {step.label}
                    {step.detail && <span className="text-[#5a7a9a]"> · {step.detail}</span>}
                  </span>
                  {i === arr.length - 1 && step.status === "active" && (
                    <span className="sr-only">(in progress)</span>
                  )}
                </li>
              ))}
            </ol>
            <div ref={stepsEndRef} />
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Conversation presence (captions) ─────────────── */}
      {(lastUser || lastNova) && (
        <section aria-label="Conversation transcript" className="w-full max-w-2xl space-y-2 mb-4">
          {lastUser && (
            <motion.div
              key={`u-${lastUser.at}`}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="ml-auto max-w-[85%] w-fit px-4 py-2.5 rounded-2xl rounded-br-md bg-[#0f2035]/70 border border-[#1a2f4a] text-sm text-[#c8d6e5]"
            >
              {lastUser.text}
            </motion.div>
          )}
          {lastNova && (
            <motion.div
              key={`n-${lastNova.at}`}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="max-w-[85%] w-fit px-4 py-2.5 rounded-2xl rounded-bl-md bg-[#0a1523]/80 border border-[#00d4ff]/20 text-sm text-[#e0ecf5] leading-relaxed"
            >
              {lastNova.text}
            </motion.div>
          )}
        </section>
      )}

      {/* Explore destinations — contextual, not a card grid */}
      <nav aria-label="Explore" className="flex flex-wrap justify-center gap-2 text-xs">
        {[
          { label: "Conversation", to: "/chat" },
          { label: "Calendar", to: "/calendar" },
          { label: "Tasks", to: "/tasks" },
          { label: "Memory", to: "/memory" },
        ].map((l) => (
          <button
            key={l.to}
            onClick={() => navigate(l.to)}
            className="px-3 py-1.5 rounded-full bg-[#0f2035]/40 hover:bg-[#162a42] border border-[#1a2f4a]/50 hover:border-[#00d4ff]/30 text-[#5a7a9a] hover:text-[#c8d6e5] transition-colors focus-visible:ring-2 focus-visible:ring-[#00d4ff]/70"
          >
            {l.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
