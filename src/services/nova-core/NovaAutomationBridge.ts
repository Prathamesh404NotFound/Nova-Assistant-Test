/**
 * Nova Core — automation/system-event bridge.
 * System events (automation triggers, upcoming calendar, network changes)
 * become NovaCore requests so proactive behavior uses the same brain as chat
 * and voice — not a separate decision path.
 */

import { novaCore } from "./NovaCore";
import { novaEventBus } from "./NovaEventBus";
import { novaWorld } from "./NovaContext";
import type { NovaResponse } from "./NovaTypes";

class NovaAutomationBridge {
  private started = false;

  start(userId: string): void {
    if (this.started) return;
    this.started = true;
    novaWorld.start();

    // Automation engine triggered → let Core decide the response
    novaEventBus.on("automation.triggered", ({ automationId, input }) => {
      void this.submitSystemRequest({
        input,
        source: "automation",
        metadata: { automationId },
      });
    });

    // Network recovery → flush pending writes happen in the data layer;
    // Core can optionally notify the user of restored connectivity.
    novaEventBus.on("network.online", () => {
      novaWorld.patch({ networkOnline: true });
    });
    novaEventBus.on("network.offline", () => {
      novaWorld.patch({ networkOnline: false });
    });
    void userId;
  }

  /** Fire a system-initiated request through Core. Never throws. */
  async submitSystemRequest(opts: {
    input: string;
    source: "automation" | "system_event" | "notification";
    metadata?: Record<string, unknown>;
  }): Promise<NovaResponse | null> {
    try {
      const response = await novaCore.handle({
        id: "",
        userId: novaWorld.getState().currentUser ?? "system",
        input: opts.input,
        source: opts.source,
        timestamp: Date.now(),
        context: {},
      });
      // System-initiated responses are NOT spoken by default — the UI decides
      // whether to surface them as notifications.
      return response;
    } catch {
      return null;
    }
  }
}

export const novaAutomationBridge = new NovaAutomationBridge();
