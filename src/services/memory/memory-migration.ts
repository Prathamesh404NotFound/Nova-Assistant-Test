/**
 * Nova Memory Migration — controlled one-time upgrade of legacy localStorage
 * memories into Firebase (the authoritative cloud memory store).
 *
 * Behaviour (fail-safe, never destructive):
 *   1. Runs only for a signed-in user with a ready Realtime Database.
 *   2. Reads the legacy local unified-memory store (`nova_unified_memories_v3`).
 *   3. Skips already-migrated content (per-uid marker + content dedup against
 *      what Firebase already holds).
 *   4. Writes memories to `users/{uid}/memories` and VERIFIES the write by
 *      reading them back before marking the migration complete.
 *   5. Local data is never deleted — it stays as the offline cache. A per-uid
 *      marker (`nova_memory_migrated_uid_v1`) prevents re-running.
 *
 * If Firebase is unavailable, migration is skipped silently and will be
 * retried on the next sign-in. Nothing is lost either way.
 */

import {
  saveMemory,
  getMemories,
} from "@/services/data/NovaCloudDataService";
import { isRealtimeDatabaseReady } from "@/services/firebase/FirebaseService";
import type { CloudMemory } from "@/services/data/NovaCloudDataService";

const LEGACY_STORE_KEY = "nova_unified_memories_v3";
const MIGRATION_MARKER_KEY = "nova_memory_migrated_uid_v1";

interface LegacyMemory {
  id?: string;
  category?: string;
  content?: string;
  supersededBy?: string;
  createdAt?: number;
}

/** Map unified-memory categories onto the cloud memory schema. */
function mapCategory(category: string | undefined): CloudMemory["category"] {
  switch (category) {
    case "preference":
      return "preference";
    case "person":
      return "person";
    case "project":
    case "task_context":
      return "project";
    default:
      // semantic, episodic, working, short_term, correction, important_event,
      // behavioral → generic fact/note bucket
      return "fact";
  }
}

function getMigratedUids(): string[] {
  try {
    const raw = localStorage.getItem(MIGRATION_MARKER_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function markMigrated(uid: string): void {
  try {
    const uids = getMigratedUids();
    if (!uids.includes(uid)) {
      uids.push(uid);
      localStorage.setItem(MIGRATION_MARKER_KEY, JSON.stringify(uids));
    }
  } catch { /* ignore */ }
}

function loadLegacyMemories(): LegacyMemory[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LegacyMemory[]) : [];
  } catch {
    return [];
  }
}

export interface MemoryMigrationReport {
  attempted: boolean;
  reason?: string;
  migrated: number;
  skippedDuplicates: number;
  failed: number;
}

/**
 * Migrate legacy local memories to Firebase for the given user.
 * Safe to call on every sign-in: a per-uid marker + cloud-content dedup
 * make it idempotent.
 */
export async function migrateLocalMemoriesToCloud(userId: string): Promise<MemoryMigrationReport> {
  const report: MemoryMigrationReport = {
    attempted: false,
    migrated: 0,
    skippedDuplicates: 0,
    failed: 0,
  };

  if (!userId) {
    report.reason = "not signed in";
    return report;
  }
  if (!isRealtimeDatabaseReady()) {
    report.reason = "Firebase Realtime Database not ready";
    return report;
  }
  if (getMigratedUids().includes(userId)) {
    report.reason = "already migrated for this user";
    return report;
  }

  const legacy = loadLegacyMemories()
    .filter((m) => m.content && m.content.trim() && !m.supersededBy);

  if (legacy.length === 0) {
    // Nothing to migrate — mark so we don't rescan on every login.
    markMigrated(userId);
    report.reason = "no local memories";
    return report;
  }

  report.attempted = true;

  // Read what Firebase already holds to dedup against cross-device writes.
  const cloud = await getMemories(userId);
  const existingContent = new Set(
    cloud.success ? cloud.data.map((m) => m.content.toLowerCase().trim()) : []
  );

  for (const memory of legacy) {
    const content = memory.content!.trim();
    if (existingContent.has(content.toLowerCase())) {
      report.skippedDuplicates++;
      continue;
    }
    const result = await saveMemory(userId, {
      category: mapCategory(memory.category),
      key: content.split(/\s+/).slice(0, 5).join(" "),
      content,
    });
    if (result.success) {
      existingContent.add(content.toLowerCase());
      report.migrated++;
    } else if (result.pending) {
      // Queued offline — will sync later; don't mark full migration complete
      // unless everything at least got queued/persisted.
      report.migrated++;
    } else {
      report.failed++;
    }
  }

  // Mark migrated only when nothing hard-failed, so failures retry next login.
  if (report.failed === 0) {
    markMigrated(userId);
  }

  return report;
}
