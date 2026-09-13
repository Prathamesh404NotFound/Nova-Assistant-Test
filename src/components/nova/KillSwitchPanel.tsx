import { useSyncExternalStore } from "react";
import { Mic, MousePointer2, Zap, MonitorSmartphone, PowerOff, Power } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { killSwitch, type KillSwitchKey } from "@/services/safety/KillSwitch";

const SWITCHES: Array<{ key: KillSwitchKey; label: string; description: string; icon: React.ComponentType<any>; color: string }> = [
  {
    key: "microphone",
    label: "Microphone",
    description: "Voice input and wake word stop immediately.",
    icon: Mic,
    color: "#00d4ff",
  },
  {
    key: "computerControl",
    label: "Computer control",
    description: "Nova cannot click, type, open apps, or modify files.",
    icon: MousePointer2,
    color: "#8b5cf6",
  },
  {
    key: "automation",
    label: "Automation & proactivity",
    description: "Proactive engine and automations stop acting.",
    icon: Zap,
    color: "#f59e0b",
  },
  {
    key: "desktopConnection",
    label: "Desktop connection",
    description: "Commands to the paired Windows agent are blocked.",
    icon: MonitorSmartphone,
    color: "#10b981",
  },
];

/** Subscribe the component to kill-switch state changes. */
function useKillSwitchState() {
  return useSyncExternalStore(
    (cb) => killSwitch.subscribe(cb),
    () => killSwitch.getAll()
  );
}

export function KillSwitchPanel({ compact = false }: { compact?: boolean }) {
  const state = useKillSwitchState();
  const allOff = !state.microphone && !state.computerControl && !state.automation && !state.desktopConnection;

  return (
    <Card className="nova-glass p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#e8e8f8]">Nova kill switch</p>
          <p className="text-xs text-[#6e6e8a]">
            {allOff
              ? "All capabilities disabled — Nova is fully contained."
              : "Immediately disable any capability that can affect your system."}
          </p>
        </div>
        {allOff ? (
          <Button size="sm" variant="outline" onClick={() => killSwitch.enableAll()}>
            <Power className="h-4 w-4 mr-1" /> Restore all
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => killSwitch.shutdownAll()}
            title="Immediately disable microphone, computer control, automation, and desktop connection"
          >
            <PowerOff className="h-4 w-4 mr-1" /> Shut down all
          </Button>
        )}
      </div>

      <div className={compact ? "space-y-2" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
        {SWITCHES.map(({ key, label, description, icon: Icon, color }) => {
          const enabled = state[key];
          return (
            <div
              key={key}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                enabled ? "border-transparent bg-[#0a0a14]" : "border-[#f43f5e]/30 bg-[#f43f5e]/5"
              }`}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}15` }}
              >
                <Icon className="w-4 h-4" style={{ color: enabled ? color : "#f43f5e" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${enabled ? "text-[#e8e8f8]" : "text-[#f43f5e]"}`}>{label}</p>
                {!compact && <p className="text-[10px] text-[#6e6e8a] leading-tight">{description}</p>}
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(v) => killSwitch.set(key, v)}
                aria-label={`Toggle ${label}`}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Minimal one-button panic control for the HUD / status rail. */
export function KillSwitchPanicButton() {
  const state = useKillSwitchState();
  const allOff = !state.microphone && !state.computerControl && !state.automation && !state.desktopConnection;

  return (
    <button
      onClick={() => (allOff ? killSwitch.enableAll() : killSwitch.shutdownAll())}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f43f5e]/60 ${
        allOff
          ? "bg-[#f43f5e]/15 text-[#f43f5e] hover:bg-[#f43f5e]/25"
          : "bg-[#0a0a14]/80 text-[#6e6e8a] hover:text-[#f43f5e] hover:bg-[#f43f5e]/10"
      }`}
      title={allOff ? "Restore Nova capabilities" : "Panic: disable microphone, computer control, automation, desktop connection"}
      aria-label="Kill switch"
    >
      <PowerOff className="h-3 w-3" />
      {allOff ? "Nova off" : "Panic"}
    </button>
  );
}
