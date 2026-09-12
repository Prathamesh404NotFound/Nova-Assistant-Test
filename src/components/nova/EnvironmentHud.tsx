import { useEffect, useState } from "react";
import { environmentService } from "@/services/environment";
import type { EnvironmentCapabilities, SystemStatus } from "@/services/environment";
import { novaEventBus } from "@/services/nova-core/NovaEventBus";
import { computerService } from "@/services/computer/ComputerService";
import { useLocation } from "react-router";

/**
 * Environment HUD — unobtrusive status strip.
 * Shows active application, network, system status, bridge/devices, and the
 * current environment action. Collapses on mobile; never blocks content.
 */

interface HudState {
  bridge: boolean;
  caps: EnvironmentCapabilities | null;
  status: SystemStatus | null;
  activeApp: string | null;
  lastEvent: string | null;
  expanded: boolean;
}

export function EnvironmentHud() {
  const [state, setState] = useState<HudState>({
    bridge: false,
    caps: null,
    status: null,
    activeApp: null,
    lastEvent: null,
    expanded: false,
  });
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const bridge = await computerService.checkBridge();
      if (cancelled) return;
      const caps = await environmentService.capabilities();
      if (cancelled) return;
      const status = await environmentService.systemStatus();
      if (cancelled) return;
      let activeApp: string | null = null;
      if (bridge) {
        const win = await computerService.getActiveWindow();
        activeApp = win?.application ?? null;
      }
      setState((s) => ({ ...s, bridge, caps, status, activeApp }));
    }

    refresh();
    const interval = window.setInterval(refresh, 30_000);

    const offOnline = novaEventBus.on("network.online", () =>
      setState((s) => ({ ...s, lastEvent: "Network online" })));
    const offOffline = novaEventBus.on("network.offline", () =>
      setState((s) => ({ ...s, lastEvent: "Network offline" })));
    const offApp = novaEventBus.on("app.opened", (p) =>
      setState((s) => ({ ...s, lastEvent: `Opened ${p.application}`, activeApp: p.application })));
    const offFile = novaEventBus.on("file.created", (p) =>
      setState((s) => ({ ...s, lastEvent: `Created ${p.name}` })));
    const offScreen = novaEventBus.on("screen.changed", () =>
      setState((s) => ({ ...s, lastEvent: "Screen changed" })));

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      offOnline();
      offOffline();
      offApp();
      offFile();
      offScreen();
    };
  }, []);

  // Route changes belong to world state, not an interval — recompute page label cheaply.
  const page = location.pathname;

  const net = state.status?.network;
  const battery = state.status?.battery;
  const online = net?.online ?? navigator.onLine;

  return (
    <div
      className="fixed bottom-3 right-3 z-40 max-w-[calc(100vw-1.5rem)]"
      role="status"
      aria-label="Nova environment status"
    >
      <div
        className="jarvis-card rounded-lg px-3 py-2 text-xs text-cyan-100/80 shadow-lg cursor-pointer select-none backdrop-blur"
        onClick={() => setState((s) => ({ ...s, expanded: !s.expanded }))}
      >
        <div className="flex items-center gap-3 whitespace-nowrap">
          <span className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${state.bridge ? "bg-emerald-400" : "bg-amber-400/70"}`} />
            {state.bridge ? "Desktop" : "Browser"}
          </span>
          <span className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-red-400"}`} />
            {online ? "Online" : "Offline"}
          </span>
          {state.activeApp && <span className="hidden sm:inline">{state.activeApp}</span>}
          {state.lastEvent && <span className="text-cyan-300/70 hidden md:inline">{state.lastEvent}</span>}
        </div>

        {state.expanded && state.status && (
          <div className="mt-2 space-y-1 border-t border-cyan-400/10 pt-2 text-[11px]">
            <div>{state.status.browser} on {state.status.os} · {state.status.cpuCores} cores</div>
            {state.status.memory.heapUsedMB !== null && (
              <div>Heap {state.status.memory.heapUsedMB} / {state.status.memory.heapLimitMB} MB</div>
            )}
            {battery?.supported && battery.level !== null && (
              <div>Battery {Math.round(battery.level * 100)}%{battery.charging ? " · charging" : ""}</div>
            )}
            {net?.effectiveType && <div>Network {net.effectiveType}{net.downlinkMbps !== null ? ` · ${net.downlinkMbps} Mbps` : ""}</div>}
            <div>Page {page}</div>
            {state.caps && state.caps.unsupportedInBrowser.length > 0 && (
              <div className="text-amber-300/70">
                Unavailable in this session: {state.caps.unsupportedInBrowser[0]}
                {state.caps.unsupportedInBrowser.length > 1 ? ` +${state.caps.unsupportedInBrowser.length - 1} more` : ""}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default EnvironmentHud;
