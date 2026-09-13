/**
 * NovaUserContext — single point where authentication state enters the
 * service layer. On sign-in/out it updates every user-scoped service:
 *
 *   NovaWorld (world state) · VoiceSession · ProactiveEngine
 *
 * UI components must not propagate user ids themselves; they render whatever
 * the canonical services expose. Logout semantics are fail-closed:
 *
 *   - stops live voice + proactive processing
 *   - resets the voice state machine to sleeping
 *   - clears world state user fields (never "anonymous" as a hidden user)
 *   - fires the typed agent.completed lifecycle event
 *
 * Cloud data (NovaCloudDataService) receives the uid explicitly from callers,
 * so nothing to clear there — reads/writes with a null uid simply fail closed.
 */

import { novaWorld } from "./NovaContext";
import { novaEventBus } from "./NovaEventBus";
import { voiceSession } from "@/services/voice-core/VoiceSession";
import { proactiveEngine } from "@/services/proactive/ProactiveEngine";
import { migrateLocalMemoriesToCloud } from "@/services/memory/memory-migration";

let currentUserId: string | null = null;

export function getCurrentUserId(): string | null {
  return currentUserId;
}

/**
 * Propagate auth state across the service layer. Safe to call repeatedly —
 * work is skipped when the user id is unchanged.
 */
export function setNovaUser(userId: string | null | undefined): void {
  const uid = userId && userId.trim() ? userId.trim() : null;
  if (uid === currentUserId) return;
  const previous = currentUserId;
  currentUserId = uid;

  if (uid) {
    // Sign-in / user switch
    novaWorld.patch({ currentUser: uid });
    voiceSession.setUserId(uid);
    proactiveEngine.setUser(uid);
    novaEventBus.emit("agent.started", { agent: "nova-user-context", userId: uid });
    if (previous && previous !== uid) {
      // Different user — any running session belonged to someone else.
      voiceSession.stop();
    }
    // Fire-and-forget: controlled migration of legacy local memories to
    // Firebase. Idempotent (per-uid marker + content dedup); failures are
    // retried on the next sign-in. Never blocks the auth flow.
    void migrateLocalMemoriesToCloud(uid)
      .then((report) => {
        if (report.attempted && report.migrated > 0) {
          novaEventBus.emit("memory.updated", { id: `migration:${uid}` });
        }
      })
      .catch(() => { /* retried next sign-in */ });
  } else {
    // Sign-out: fail closed everywhere.
    if (voiceSession.isActive()) voiceSession.stop();
    voiceSession.setUserId("");
    proactiveEngine.setUser(undefined);
    novaWorld.patch({
      currentUser: null,
      currentConversationId: null,
      upcomingCalendarEvents: [],
      connectedDevices: [],
      pendingNotifications: 0,
      activeTaskCount: 0,
    });
    novaEventBus.emit("agent.completed", { agent: "nova-user-context" });
  }
}
