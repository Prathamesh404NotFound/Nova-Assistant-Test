/**
 * ContextualPanels — ambient, relevance-driven panels for the Nova core
 * experience. Panels appear ONLY when something is actually happening:
 * an upcoming meeting, an overdue task, a proactive suggestion. No
 * permanently-visible card grids.
 *
 * Uses the existing proactive engine + live context (real data only).
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { proactiveEngine, proactiveContext } from "@/services/proactive";
import type { ProactiveDecision } from "@/services/proactive";
import { Calendar, CheckSquare, ArrowRight, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContextualPanelsProps {
  /** Hide the whole strip when nothing relevant (default true = hide). */
  className?: string;
}

export function ContextualPanels({ className }: ContextualPanelsProps) {
  const navigate = useNavigate();
  const [decisions, setDecisions] = useState<ProactiveDecision[]>([]);
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof proactiveContext.snapshot>> | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const off = proactiveEngine.onDecision((decision) => {
      if (decision.action !== "suggest" && decision.action !== "notify") return;
      setDecisions((prev) =>
        prev.some((d) => d.event.id === decision.event.id) ? prev : [decision, ...prev].slice(0, 2)
      );
    });
    return off;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const snap = await proactiveContext.snapshot();
      if (!cancelled) setSnapshot(snap);
    };
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  const nextEvent = snapshot?.upcomingEvent;
  const overdue = snapshot?.overdueTasks.length ?? 0;

  const showMeeting = !!nextEvent && nextEvent.startInMin > -60 && nextEvent.startInMin <= 60;
  const showTasks = overdue > 0;
  const showSuggestions = decisions.length > 0;

  if (!showMeeting && !showTasks && !showSuggestions) return null;

  return (
    <div className={cn("w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-3", className)} aria-live="polite">
      {/* Meeting imminent */}
      <AnimatePresence>
        {showMeeting && nextEvent && (
          <motion.div
            key={`mtg-${nextEvent.title}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="jarvis-card rounded-xl p-4 border-[#f59e0b]/25"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/15 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-[#f59e0b]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#e0ecf5] truncate">{nextEvent.title}</p>
                <p className="text-[11px] text-[#f59e0b]">
                  {nextEvent.startInMin <= 0 ? "Starting now" : `Starts in ${nextEvent.startInMin} minutes`}
                </p>
              </div>
              <button
                onClick={() => navigate("/calendar")}
                className="shrink-0 flex items-center gap-1 text-[11px] text-[#00d4ff] hover:underline focus-visible:ring-2 focus-visible:ring-[#00d4ff]/70 rounded px-1"
              >
                Open <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overdue tasks */}
      <AnimatePresence>
        {showTasks && (
          <motion.div
            key="tasks"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="jarvis-card rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#8b5cf6]/15 flex items-center justify-center shrink-0">
                <CheckSquare className="w-4 h-4 text-[#8b5cf6]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#e0ecf5]">
                  {overdue} overdue task{overdue === 1 ? "" : "s"}
                </p>
                <p className="text-[11px] text-[#5a7a9a]">
                  {snapshot?.overdueTasks[0]?.title ? `Next: ${snapshot.overdueTasks[0].title}` : "Tap to review"}
                </p>
              </div>
              <button
                onClick={() => navigate("/tasks")}
                className="shrink-0 flex items-center gap-1 text-[11px] text-[#00d4ff] hover:underline focus-visible:ring-2 focus-visible:ring-[#00d4ff]/70 rounded px-1"
              >
                Review <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Proactive interventions */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            key={`sug-${decisions[0].event.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              "jarvis-card rounded-xl p-4 sm:col-span-2",
              decisions[0].event.urgency === "urgent" ? "border-[#f59e0b]/40" : "border-[#00d4ff]/20"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#00d4ff]/15 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-[#00d4ff]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#e0ecf5]">{decisions[0].event.title}</p>
                <p className="text-[11px] text-[#c8d6e5] leading-snug mt-0.5">
                  {decisions[0].event.body || decisions[0].reason}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {decisions[0].suggestion && (
                    <button
                      onClick={() => {
                        proactiveEngine.acceptSuggestion(decisions[0]);
                        setDecisions((d) => d.slice(1));
                        if (decisions[0].suggestion?.route) navigate(decisions[0].suggestion!.route!);
                      }}
                      className="flex items-center gap-1 text-[11px] font-medium text-[#00d4ff] hover:underline focus-visible:ring-2 focus-visible:ring-[#00d4ff]/70 rounded px-1"
                    >
                      {decisions[0].suggestion.label} <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      proactiveEngine.dismissSuggestion(decisions[0]);
                      setDismissed((s) => new Set(s).add(decisions[0].event.id));
                      setDecisions((d) => d.slice(1));
                    }}
                    className="text-[11px] text-[#5a7a9a] hover:text-[#c8d6e5] focus-visible:ring-2 focus-visible:ring-[#5a7a9a]/50 rounded px-1"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  proactiveEngine.dismissSuggestion(decisions[0]);
                  setDecisions((d) => d.slice(1));
                }}
                aria-label="Dismiss suggestion"
                className="shrink-0 text-[#5a7a9a] hover:text-[#f43f5e] transition-colors focus-visible:ring-2 focus-visible:ring-[#f43f5e]/50 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
