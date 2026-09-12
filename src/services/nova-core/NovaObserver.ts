/**
 * Nova Core — observer + verifier.
 * Observer: records what actually happened for every tool execution.
 * Verifier: for side-effecting tools, inspects the returned result to confirm
 * the requested state change actually occurred before success is reported.
 */

import { novaEventBus } from "./NovaEventBus";
import { novaWorld } from "./NovaContext";
import type { NovaActionRecord } from "./NovaTypes";

export interface ToolObservation {
  requestId: string;
  tool: string;
  args: Record<string, unknown>;
  success: boolean;
  verified: boolean;
  durationMs: number;
  error?: string;
  data?: unknown;
  at: number;
}

/** Tools whose effects must be verified before reporting success. */
const SIDE_EFFECTING = new Set([
  "memory.save",
  "memory.delete",
  "calendar.create",
  "calendar.delete",
  "task.create",
  "task.delete",
  "task.complete",
  "email.send",
  "email.compose",
  "device.control",
]);

class NovaObserver {
  private log: ToolObservation[] = [];

  record(obs: Omit<ToolObservation, "at">): void {
    const full: ToolObservation = { ...obs, at: Date.now() };
    this.log.unshift(full);
    if (this.log.length > 100) this.log.length = 100;

    if (full.success) {
      novaEventBus.emit("tool.completed", {
        requestId: full.requestId,
        tool: full.tool,
        success: true,
        durationMs: full.durationMs,
      });
    } else {
      novaEventBus.emit("tool.failed", {
        requestId: full.requestId,
        tool: full.tool,
        error: full.error ?? "unknown",
      });
    }
    novaWorld.recordAction(full.tool, full.success);
  }

  recent(count = 10): ToolObservation[] {
    return this.log.slice(0, count);
  }

  /**
   * Verify a result. For side-effecting tools the result must carry explicit
   * evidence of success (either `data.id` or `message` confirming persistence).
   * Never assumes success.
   */
  verify(tool: string, result: { success: boolean; data?: unknown; message?: string; error?: string }): {
    verified: boolean;
    reason?: string;
  } {
    if (!result.success) {
      return { verified: false, reason: result.error ?? "tool reported failure" };
    }
    if (!SIDE_EFFECTING.has(tool)) {
      return { verified: true };
    }
    const data = result.data as { id?: string; pending?: boolean } | undefined;
    if (data && typeof data === "object" && data.pending === true) {
      // Write is queued offline — honest but not yet confirmed.
      return { verified: false, reason: "queued offline — will sync when online" };
    }
    if (data && typeof data === "object" && typeof data.id === "string" && data.id.length > 0) {
      return { verified: true };
    }
    return { verified: false, reason: "no confirmation id returned" };
  }
}

export const novaObserver = new NovaObserver();

export function toActionRecord(obs: ToolObservation): NovaActionRecord {
  return {
    tool: obs.tool,
    args: {},
    success: obs.success,
    verified: obs.verified,
    durationMs: obs.durationMs,
    error: obs.error,
  };
}
