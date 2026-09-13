import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { proactiveContext, proactiveEngine } from "@/services/proactive";
import type {
  ProactiveSettings,
  ProactiveCategory,
} from "@/services/proactive";
import { cn } from "@/lib/utils";
import { Sparkles, BellRing, Volume2, Moon } from "lucide-react";

const CATEGORIES: Array<{ id: ProactiveCategory; label: string }> = [
  { id: "calendar", label: "Calendar" },
  { id: "tasks", label: "Tasks" },
  { id: "email", label: "Email" },
  { id: "automation", label: "Automations" },
  { id: "system", label: "System" },
  { id: "devices", label: "Devices" },
  { id: "browser", label: "Browser" },
  { id: "memory", label: "Memory" },
  { id: "activity", label: "Activity" },
];

const URGENCY_LEVELS: Array<{ id: ProactiveSettings["minUrgency"]; label: string; hint: string }> = [
  { id: "low", label: "Everything", hint: "All relevant events" },
  { id: "medium", label: "Balanced", hint: "Recommended" },
  { id: "high", label: "Important only", hint: "Meetings, failures, urgent tasks" },
  { id: "urgent", label: "Critical only", hint: "Only time-critical alerts" },
];

/**
 * Proactive Intelligence settings — real controls backed by the engine:
 * master toggle, urgency floor, category opt-ins, quiet hours,
 * notification budget, and proactive voice (opt-in).
 */
export function ProactiveSettingsCard({ userId }: { userId?: string }) {
  const [settings, setSettings] = useState<ProactiveSettings>(() => proactiveContext.getSettings());
  const [syncState, setSyncState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const update = useCallback(
    async (partial: Partial<ProactiveSettings>) => {
      setSyncState("saving");
      setSettings((s) => ({ ...s, ...partial }));
      try {
        await proactiveContext.updateSettings(partial, userId);
        setSyncState("saved");
      } catch {
        setSyncState("error");
      }
    },
    [userId]
  );

  // Proactive voice changes take effect immediately; nothing else needs restarts.
  useEffect(() => {
    proactiveEngine.setUser(userId);
  }, [userId]);

  const toggleCategory = (cat: ProactiveCategory) => {
    update({ categories: { ...settings.categories, [cat]: !settings.categories[cat] } });
  };

  return (
    <Card className="nova-glass p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#00d4ff]" />
          <div>
            <p className="text-sm font-medium text-[#e8e8f8]">Proactive Intelligence</p>
            <p className="text-xs text-[#5a7a9a]">
              Nova notices meaningful changes and suggests actions — conservatively.
            </p>
          </div>
        </div>
        <button
          onClick={() => update({ enabled: !settings.enabled })}
          aria-label={settings.enabled ? "Disable proactive intelligence" : "Enable proactive intelligence"}
          className={cn(
            "w-10 h-6 rounded-full transition-colors relative shrink-0",
            settings.enabled ? "bg-[#00d4ff]" : "bg-[#252540]"
          )}
        >
          <span
            className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
              settings.enabled ? "left-5" : "left-1"
            )}
          />
        </button>
      </div>

      {settings.enabled && (
        <>
          {/* Urgency floor */}
          <div className="pt-1">
            <p className="text-xs text-[#5a7a9a] mb-2 flex items-center gap-1">
              <BellRing className="h-3 w-3" /> Notification level
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {URGENCY_LEVELS.map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => update({ minUrgency: lvl.id })}
                  className={cn(
                    "p-2 rounded-lg border text-left transition-colors",
                    settings.minUrgency === lvl.id
                      ? "border-[#00d4ff]/50 bg-[#00d4ff]/10"
                      : "border-[#1a2f4a] hover:border-[#00d4ff]/30"
                  )}
                >
                  <p className={cn("text-xs font-medium", settings.minUrgency === lvl.id ? "text-[#00d4ff]" : "text-[#c8d6e5]")}>
                    {lvl.label}
                  </p>
                  <p className="text-[10px] text-[#5a7a9a]">{lvl.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="pt-1">
            <p className="text-xs text-[#5a7a9a] mb-2">Categories</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-xs transition-colors",
                    settings.categories[cat.id]
                      ? "border-[#00d4ff]/40 bg-[#00d4ff]/10 text-[#00d4ff]"
                      : "border-[#1a2f4a] text-[#5a7a9a] hover:text-[#c8d6e5]"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quiet hours + budget + voice */}
          <div className="space-y-3 pt-1 border-t border-[#1a2f4a]">
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Moon className="h-3.5 w-3.5 text-[#5a7a9a]" />
                <div>
                  <p className="text-xs text-[#c8d6e5]">Quiet hours ({settings.quietHoursStart}:00 – {settings.quietHoursEnd}:00)</p>
                  <p className="text-[10px] text-[#5a7a9a]">Urgent events still get through</p>
                </div>
              </div>
              <button
                onClick={() => update({ quietHoursEnabled: !settings.quietHoursEnabled })}
                aria-label="Toggle quiet hours"
                className={cn(
                  "w-10 h-6 rounded-full transition-colors relative shrink-0",
                  settings.quietHoursEnabled ? "bg-[#00d4ff]" : "bg-[#252540]"
                )}
              >
                <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-transform", settings.quietHoursEnabled ? "left-5" : "left-1")} />
              </button>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs text-[#c8d6e5]">Hourly limit</p>
                <p className="text-[10px] text-[#5a7a9a]">Max notifications per hour (anti-spam)</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm" variant="ghost"
                  className="h-6 w-6 p-0 text-[#c8d6e5]"
                  onClick={() => update({ budgetPerHour: Math.max(1, settings.budgetPerHour - 1) })}
                  aria-label="Decrease hourly limit"
                >−</Button>
                <span className="text-sm font-mono text-[#00d4ff] w-6 text-center">{settings.budgetPerHour}</span>
                <Button
                  size="sm" variant="ghost"
                  className="h-6 w-6 p-0 text-[#c8d6e5]"
                  onClick={() => update({ budgetPerHour: Math.min(20, settings.budgetPerHour + 1) })}
                  aria-label="Increase hourly limit"
                >+</Button>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Volume2 className="h-3.5 w-3.5 text-[#5a7a9a]" />
                <div>
                  <p className="text-xs text-[#c8d6e5]">Proactive voice</p>
                  <p className="text-[10px] text-[#5a7a9a]">Nova speaks urgent/high events aloud (opt-in)</p>
                </div>
              </div>
              <button
                onClick={() => update({ proactiveVoice: !settings.proactiveVoice })}
                aria-label="Toggle proactive voice"
                className={cn(
                  "w-10 h-6 rounded-full transition-colors relative shrink-0",
                  settings.proactiveVoice ? "bg-[#00d4ff]" : "bg-[#252540]"
                )}
              >
                <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-transform", settings.proactiveVoice ? "left-5" : "left-1")} />
              </button>
            </div>
          </div>
        </>
      )}

      {syncState === "saving" && <p className="text-[10px] text-[#5a7a9a]">Saving…</p>}
      {syncState === "saved" && <p className="text-[10px] text-[#10b981]">Saved{userId ? " · syncing to cloud" : " (local only — sign in to sync)"}</p>}
      {syncState === "error" && <p className="text-[10px] text-[#f43f5e]">Couldn't sync to cloud — saved locally and will retry.</p>}
    </Card>
  );
}
