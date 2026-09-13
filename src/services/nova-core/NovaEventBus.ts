/**
 * Nova Core — typed event bus.
 * All cross-service signals flow through here with typed payloads.
 * No arbitrary string-only handling; every event has a declared payload type.
 */

import type { VoicePhase } from "./NovaTypes";

export interface NovaEventPayloads {
  "voice.wake": { source: string; confidence?: number };
  "voice.started": { lang: string };
  "voice.transcript": { text: string; isFinal: boolean };
  "voice.ended": { reason: "user" | "silence" | "error" };
  "voice.phase": { phase: VoicePhase };
  "ai.started": { requestId: string; taskClass: string };
  "ai.chunk": { requestId: string; text: string };
  "ai.completed": { requestId: string; text: string; source: string };
  "ai.failed": { requestId: string; errorCode: string };
  "tool.started": { requestId: string; tool: string };
  "tool.completed": { requestId: string; tool: string; success: boolean; durationMs: number };
  "tool.failed": { requestId: string; tool: string; error: string };
  "memory.created": { id: string; category: string };
  "memory.updated": { id: string };
  "calendar.upcoming": { eventId: string; title: string; startAt: number };
  "email.received": { subject: string; from: string };
  "task.overdue": { taskId: string; title: string };
  "device.connected": { deviceId: string; kind: string };
  "device.disconnected": { deviceId: string };
  "network.offline": Record<string, never>;
  "network.online": Record<string, never>;
  "automation.triggered": { automationId: string; input: string };
  "agent.started": { agent: string; userId?: string };
  "agent.completed": { agent: string };
  // Environment layer events
  "screen.changed": { hash: string };
  "app.opened": { application: string; bridge: boolean };
  "app.closed": { application: string };
  "network.changed": { online: boolean };
  "battery.changed": { level: number | null; charging: boolean | null };
  "file.created": { name: string; size: number };
  "file.modified": { name: string };
  "file.downloaded": { name: string };
}

export type NovaEventName = keyof NovaEventPayloads;
export type NovaEventHandler<E extends NovaEventName> = (
  payload: NovaEventPayloads[E]
) => void;
type AnyHandler = (payload: never) => void;

class NovaEventBus {
  private handlers = new Map<NovaEventName, Set<AnyHandler>>();

  on<E extends NovaEventName>(event: E, handler: NovaEventHandler<E>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as AnyHandler);
    return () => this.off(event, handler);
  }

  once<E extends NovaEventName>(event: E, handler: NovaEventHandler<E>): () => void {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<E extends NovaEventName>(event: E, handler: NovaEventHandler<E>): void {
    this.handlers.get(event)?.delete(handler as AnyHandler);
  }

  emit<E extends NovaEventName>(event: E, payload: NovaEventPayloads[E]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        (handler as NovaEventHandler<E>)(payload);
      } catch (err) {
        // A faulty listener must never break other listeners or the emitter.
        if (import.meta.env.DEV) console.warn(`[Nova Events] listener error for ${event}:`, err);
      }
    }
  }

  /** Remove all listeners for an event (or everything when omitted). */
  clear(event?: NovaEventName): void {
    if (event) this.handlers.delete(event);
    else this.handlers.clear();
  }
}

export const novaEventBus = new NovaEventBus();
