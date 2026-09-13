import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { proactiveEngine, proactiveContext } from "@/services/proactive";
import type { ProactiveDecision } from "@/services/proactive";
import { cn } from "@/lib/utils";
import { Sparkles, X, ArrowRight, Lightbulb } from "lucide-react";

/**
 * Nova Suggestions — live proactive decisions surfaced as dismissible cards.
 * Accepting/dismissing feeds the engine's learning loop. Nothing here is
 * static: cards appear only when the engine actually decided to suggest.
 */
export function NovaSuggestions() {
  const [decisions, setDecisions] = useState<ProactiveDecision[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const off = proactiveEngine.onDecision((decision) => {
      if (decision.action !== "suggest" || !decision.suggestion) return;
      setDecisions((prev) =>
        prev.some((d) => d.event.id === decision.event.id) ? prev : [decision, ...prev].slice(0, 3)
      );
    });
    return off;
  }, []);

  const handleAccept = useCallback((decision: ProactiveDecision) => {
    proactiveEngine.acceptSuggestion(decision);
    setDecisions((prev) => prev.filter((d) => d.event.id !== decision.event.id));
    if (decision.suggestion?.route) navigate(decision.suggestion.route);
  }, [navigate]);

  const handleDismiss = useCallback((decision: ProactiveDecision) => {
    proactiveEngine.dismissSuggestion(decision);
    setDecisions((prev) => prev.filter((d) => d.event.id !== decision.event.id));
  }, []);

  if (decisions.length === 0) {
    return (
      <div className="jarvis-card p-4">
        <h3 className="text-[10px] text-[#5a7a9a] uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> Nova Suggestions
        </h3>
        <p className="text-[11px] text-[#5a7a9a] flex items-center gap-2 py-2">
          <Lightbulb className="w-3.5 h-3.5 shrink-0" />
          Nova is watching for meaningful changes — suggestions will appear here when something needs your attention.
        </p>
      </div>
    );
  }

  return (
    <div className="jarvis-card p-4">
      <h3 className="text-[10px] text-[#5a7a9a] uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-[#00d4ff]" /> Nova Suggestions
      </h3>
      <div className="space-y-2">
        {decisions.map((decision) => (
          <div
            key={decision.event.id}
            className={cn(
              "p-3 rounded-lg border bg-[#0f2035]/50",
              decision.event.urgency === "urgent"
                ? "border-[#f59e0b]/40"
                : "border-[#1a2f4a]"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-[#e0ecf5] font-medium truncate">{decision.event.title}</p>
                <p className="text-[11px] text-[#c8d6e5] leading-snug mt-0.5">
                  {decision.suggestion ? decision.event.body : decision.reason}
                </p>
              </div>
              <button
                onClick={() => handleDismiss(decision)}
                aria-label="Dismiss suggestion"
                className="text-[#5a7a9a] hover:text-[#f43f5e] transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {decision.suggestion && (
              <button
                onClick={() => handleAccept(decision)}
                className="mt-2 flex items-center gap-1 text-[11px] text-[#00d4ff] hover:text-[#00d4ff]/80 transition-colors"
              >
                {decision.suggestion.label}
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Live context strip: next event, task pressure, system state — real data,
 * replacing static "insight" cards with useful current information.
 */
export function NovaLiveContext() {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof proactiveContext.snapshot>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const snap = await proactiveContext.snapshot();
      if (!cancelled) setSnapshot(snap);
    };
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const nextEvent = snapshot?.upcomingEvent;
  const overdue = snapshot?.overdueTasks.length ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div className="p-3 rounded-lg bg-[#0f2035]/50 border border-[#1a2f4a]/50">
        <p className="text-[10px] text-[#5a7a9a] uppercase tracking-wider mb-1">Next Event</p>
        {nextEvent && nextEvent.startInMin > -60 ? (
          <>
            <p className="text-xs text-[#e0ecf5] font-medium truncate">{nextEvent.title}</p>
            <p className="text-[10px] text-[#00d4ff]">
              {nextEvent.startInMin <= 0
                ? "Starting now"
                : `in ${nextEvent.startInMin} min`}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-[#5a7a9a]">Nothing scheduled next</p>
        )}
      </div>
      <div className="p-3 rounded-lg bg-[#0f2035]/50 border border-[#1a2f4a]/50">
        <p className="text-[10px] text-[#5a7a9a] uppercase tracking-wider mb-1">Task Pressure</p>
        <p className="text-xs text-[#e0ecf5] font-medium">
          {overdue === 0 ? "Nothing overdue" : `${overdue} overdue task${overdue === 1 ? "" : "s"}`}
        </p>
        <p className="text-[10px] text-[#5a7a9a]">
          {snapshot?.networkOnline ? "System online" : "Offline — changes queued"}
        </p>
      </div>
    </div>
  );
}
