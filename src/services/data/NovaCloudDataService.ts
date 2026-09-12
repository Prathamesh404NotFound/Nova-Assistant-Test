/**
 * Nova Cloud Data Service — canonical per-user persistence layer.
 *
 * Firebase Realtime Database is the authoritative source of truth for
 * conversations, messages, memories, tasks, calendar, settings, and activity.
 * localStorage is used ONLY as:
 *   - offline cache (reads when disconnected)
 *   - pending-write queue (flushed when connection returns)
 *   - nothing else for cloud data
 *
 * Every write returns a structured result. We NEVER return a success-looking
 * id when Firebase rejected the write.
 *
 * RTDB structure (individual message nodes, not one giant blob):
 *   users/{uid}/conversations/{conversationId}/            { id, title, createdAt, updatedAt }
 *   users/{uid}/conversations/{conversationId}/messages/{messageId} { id, role, content, createdAt, source, latencyMs }
 *   users/{uid}/memories/{memoryId}
 *   users/{uid}/tasks/{taskId}
 *   users/{uid}/calendar/{eventId}
 *   users/{uid}/settings/{key}
 *   users/{uid}/activity/{activityId}
 */

import {
  ref,
  set,
  get,
  push,
  remove,
  update,
  onValue,
} from "firebase/database";
import { db, isFirebaseReady, isRealtimeDatabaseReady } from "@/services/firebase/FirebaseService";
import { auth } from "@/services/firebase/FirebaseService";

// ── Structured results ───────────────────────────────────────────────────────

export type CloudErrorCode =
  | "FIREBASE_NOT_CONFIGURED"
  | "FIREBASE_AUTH"
  | "FIREBASE_PERMISSION_DENIED"
  | "FIREBASE_NETWORK"
  | "FIREBASE_WRITE"
  | "FIREBASE_READ";

export interface CloudWriteResult<T = string> {
  success: boolean;
  id?: T;
  errorCode?: CloudErrorCode;
  message: string;
  /** True when the operation was queued offline and not yet synced. */
  pending?: boolean;
}

export type CloudSyncStatus = "SYNCED" | "PENDING" | "OFFLINE" | "FAILED";

// ── Offline write queue (localStorage, flushed on reconnect) ─────────────────

export interface QueuedOperation {
  id: string;
  operation: "set" | "update" | "remove";
  path: string;
  payload: unknown;
  createdAt: number;
  retryCount: number;
  status: "pending" | "synced" | "failed";
}

const QUEUE_KEY = "nova_offline_write_queue_v1";

function loadQueue(): QueuedOperation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOperation[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedOperation[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-200)));
  } catch { /* ignore */ }
}

function queueOperation(op: Omit<QueuedOperation, "id" | "retryCount" | "status">): void {
  const queue = loadQueue();
  queue.push({
    ...op,
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    retryCount: 0,
    status: "pending",
  });
  saveQueue(queue);
}

/** Human-readable message for an RTDB error code. */
function describeError(err: unknown): { code: CloudErrorCode; message: string } {
  const code = (err as { code?: string })?.code ?? "";
  if (code.includes("permission")) {
    return {
      code: "FIREBASE_PERMISSION_DENIED",
      message: "Firebase rejected the write — permission denied. Check Security Rules.",
    };
  }
  if (code.includes("network")) {
    return { code: "FIREBASE_NETWORK", message: "Network unavailable — write queued for sync." };
  }
  if (code.includes("unavailable")) {
    return { code: "FIREBASE_NETWORK", message: "Firebase temporarily unavailable — write queued." };
  }
  return {
    code: "FIREBASE_WRITE",
    message: err instanceof Error ? err.message : "Firebase write failed",
  };
}

function isOfflineError(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? "";
  return code.includes("network") || code.includes("unavailable");
}

// ── Base helpers ─────────────────────────────────────────────────────────────

function requireDb() {
  if (!db || !isRealtimeDatabaseReady()) {
    throw Object.assign(new Error("Firebase Realtime Database is not configured"), { code: "FIREBASE_NOT_CONFIGURED" });
  }
  return db;
}

function userRef(userId: string, ...segments: string[]) {
  if (!userId) {
    throw Object.assign(new Error("No authenticated user"), { code: "FIREBASE_AUTH" });
  }
  return ref(requireDb(), `users/${userId}/${segments.join("/")}`);
}

/** Core write: try Firebase; on failure, queue for offline sync unless fatal. */
async function cloudWrite(
  writePath: string,
  buildRef: () => { op: "set" | "update" | "remove"; target: ReturnType<typeof ref>; payload?: unknown },
  opts: { queueOffline?: boolean } = {}
): Promise<CloudWriteResult> {
  try {
    const { op, target, payload } = buildRef();
    if (op === "set") await set(target, payload);
    else if (op === "update") await update(target, payload as Record<string, unknown>);
    else await remove(target);
    return { success: true, message: "Synced" };
  } catch (err) {
    const { code, message } = describeError(err);
    // Permission/config failures are fatal — queueing would never succeed.
    // Network failures are queued for automatic retry.
    if (code === "FIREBASE_NETWORK" && opts.queueOffline !== false) {
      queueOperation({
        operation: (buildRef().op) as QueuedOperation["operation"],
        path: writePath,
        payload: buildRef().payload,
        createdAt: Date.now(),
      });
      return { success: false, errorCode: code, message, pending: true };
    }
    return { success: false, errorCode: code, message };
  }
}

// ── Conversations & messages ─────────────────────────────────────────────────

export interface CloudConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface CloudMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  source?: string;
  latencyMs?: number;
}

export async function createConversation(
  userId: string,
  title: string
): Promise<CloudWriteResult> {
  try {
    const convRef = push(userRef(userId, "conversations"));
    const id = convRef.key;
    if (!id) return { success: false, errorCode: "FIREBASE_WRITE", message: "Failed to allocate id" };
    const result = await cloudWrite(`users/${userId}/conversations/${id}`, () => ({
      op: "set" as const,
      target: convRef,
      payload: { id, title, createdAt: Date.now(), updatedAt: Date.now() },
    }));
    return result.success ? { success: true, id, message: "Synced" } : result;
  } catch (err) {
    const { code, message } = describeError(err);
    return { success: false, errorCode: code, message };
  }
}

export async function getConversations(userId: string): Promise<
  { success: true; data: CloudConversation[] } | { success: false; errorCode: CloudErrorCode; message: string }
> {
  try {
    const snap = await get(userRef(userId, "conversations"));
    if (!snap.exists()) return { success: true, data: [] };
    const val = snap.val() as Record<string, CloudConversation>;
    const list = Object.values(val).filter(Boolean);
    list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return { success: true, data: list };
  } catch (err) {
    const { code, message } = describeError(err);
    return { success: false, errorCode: code, message };
  }
}

export async function addMessage(
  userId: string,
  conversationId: string,
  data: Omit<CloudMessage, "id" | "createdAt">
): Promise<CloudWriteResult> {
  try {
    const msgRef = push(userRef(userId, "conversations", conversationId, "messages"));
    const id = msgRef.key;
    if (!id) return { success: false, errorCode: "FIREBASE_WRITE", message: "Failed to allocate id" };
    const message: CloudMessage = { ...data, id, createdAt: Date.now() };
    const result = await cloudWrite(
      `users/${userId}/conversations/${conversationId}/messages/${id}`,
      () => ({ op: "set" as const, target: msgRef, payload: message })
    );
    // Touch conversation metadata in parallel (best effort)
    update(userRef(userId, "conversations", conversationId), { updatedAt: Date.now() }).catch(() => {});
    return result.success ? { success: true, id, message: "Synced" } : result;
  } catch (err) {
    const { code, message } = describeError(err);
    return { success: false, errorCode: code, message };
  }
}

export async function getMessages(
  userId: string,
  conversationId: string
): Promise<
  { success: true; data: CloudMessage[] } | { success: false; errorCode: CloudErrorCode; message: string }
> {
  try {
    const snap = await get(userRef(userId, "conversations", conversationId, "messages"));
    if (!snap.exists()) return { success: true, data: [] };
    const val = snap.val() as Record<string, CloudMessage>;
    const list = Object.values(val).filter(Boolean);
    list.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    return { success: true, data: list };
  } catch (err) {
    const { code, message } = describeError(err);
    return { success: false, errorCode: code, message };
  }
}

export async function deleteConversation(
  userId: string,
  conversationId: string
): Promise<CloudWriteResult> {
  try {
    return await cloudWrite(`users/${userId}/conversations/${conversationId}`, () => ({
      op: "remove" as const,
      target: userRef(userId, "conversations", conversationId),
    }));
  } catch (err) {
    const { code, message } = describeError(err);
    return { success: false, errorCode: code, message };
  }
}

// ── Memories ─────────────────────────────────────────────────────────────────

export interface CloudMemory {
  id: string;
  category: "fact" | "preference" | "person" | "project" | "note";
  key: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export async function saveMemory(
  userId: string,
  data: Omit<CloudMemory, "id" | "createdAt" | "updatedAt">
): Promise<CloudWriteResult> {
  try {
    const memRef = push(userRef(userId, "memories"));
    const id = memRef.key;
    if (!id) return { success: false, errorCode: "FIREBASE_WRITE", message: "Failed to allocate id" };
    const memory: CloudMemory = { ...data, id, createdAt: Date.now(), updatedAt: Date.now() };
    const result = await cloudWrite(`users/${userId}/memories/${id}`, () => ({
      op: "set" as const,
      target: memRef,
      payload: memory,
    }));
    return result.success ? { success: true, id, message: result.message } : result;
  } catch (err) {
    const { code, message } = describeError(err);
    return { success: false, errorCode: code, message };
  }
}

export async function getMemories(userId: string): Promise<
  { success: true; data: CloudMemory[] } | { success: false; errorCode: CloudErrorCode; message: string }
> {
  try {
    const snap = await get(userRef(userId, "memories"));
    if (!snap.exists()) return { success: true, data: [] };
    const val = snap.val() as Record<string, CloudMemory>;
    const list = Object.values(val).filter(Boolean);
    list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return { success: true, data: list };
  } catch (err) {
    const { code, message } = describeError(err);
    return { success: false, errorCode: code, message };
  }
}

export async function deleteMemory(
  userId: string,
  memoryId: string
): Promise<CloudWriteResult> {
  try {
    return await cloudWrite(`users/${userId}/memories/${memoryId}`, () => ({
      op: "remove" as const,
      target: userRef(userId, "memories", memoryId),
    }));
  } catch (err) {
    const { code, message } = describeError(err);
    return { success: false, errorCode: code, message };
  }
}

// ── Realtime listeners (auto-unsubscribe returned) ───────────────────────────

export function onConversationsChange(
  userId: string,
  callback: (conversations: CloudConversation[]) => void,
  onError?: (err: unknown) => void
): () => void {
  try {
    return onValue(
      userRef(userId, "conversations"),
      (snap) => {
        if (!snap.exists()) { callback([]); return; }
        const val = snap.val() as Record<string, CloudConversation>;
        const list = Object.values(val).filter(Boolean);
        list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
        callback(list);
      },
      (err) => onError?.(err)
    );
  } catch (err) {
    onError?.(err);
    return () => {};
  }
}

export function onMessagesChange(
  userId: string,
  conversationId: string,
  callback: (messages: CloudMessage[]) => void,
  onError?: (err: unknown) => void
): () => void {
  try {
    return onValue(
      userRef(userId, "conversations", conversationId, "messages"),
      (snap) => {
        if (!snap.exists()) { callback([]); return; }
        const val = snap.val() as Record<string, CloudMessage>;
        const list = Object.values(val).filter(Boolean);
        list.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
        callback(list);
      },
      (err) => onError?.(err)
    );
  } catch (err) {
    onError?.(err);
    return () => {};
  }
}

export function onMemoriesChange(
  userId: string,
  callback: (memories: CloudMemory[]) => void,
  onError?: (err: unknown) => void
): () => void {
  try {
    return onValue(
      userRef(userId, "memories"),
      (snap) => {
        if (!snap.exists()) { callback([]); return; }
        const val = snap.val() as Record<string, CloudMemory>;
        const list = Object.values(val).filter(Boolean);
        list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        callback(list);
      },
      (err) => onError?.(err)
    );
  } catch (err) {
    onError?.(err);
    return () => {};
  }
}

// ── Tasks / calendar / settings / activity (thin wrappers, structured results)

export async function createTaskCloud(
  userId: string,
  data: Record<string, unknown>
): Promise<CloudWriteResult> {
  try {
    const taskRef = push(userRef(userId, "tasks"));
    const id = taskRef.key;
    if (!id) return { success: false, errorCode: "FIREBASE_WRITE", message: "Failed to allocate id" };
    const payload = { ...data, id, createdAt: Date.now(), updatedAt: Date.now() };
    const result = await cloudWrite(`users/${userId}/tasks/${id}`, () => ({
      op: "set" as const, target: taskRef, payload,
    }));
    return result.success ? { success: true, id, message: "Synced" } : result;
  } catch (err) {
    const { code, message } = describeError(err);
    return { success: false, errorCode: code, message };
  }
}

export async function saveCalendarEventCloud(
  userId: string,
  event: Record<string, unknown> & { id: string }
): Promise<CloudWriteResult> {
  try {
    return await cloudWrite(`users/${userId}/calendar/${event.id}`, () => ({
      op: "set" as const,
      target: userRef(userId, "calendar", event.id),
      payload: { ...event, updatedAt: Date.now() },
    }));
  } catch (err) {
    const { code, message } = describeError(err);
    return { success: false, errorCode: code, message };
  }
}

export async function deleteCalendarEventCloud(
  userId: string,
  eventId: string
): Promise<CloudWriteResult> {
  try {
    return await cloudWrite(`users/${userId}/calendar/${eventId}`, () => ({
      op: "remove" as const,
      target: userRef(userId, "calendar", eventId),
    }));
  } catch (err) {
    const { code, message } = describeError(err);
    return { success: false, errorCode: code, message };
  }
}

export async function saveSettingCloud(
  userId: string,
  key: string,
  value: string
): Promise<CloudWriteResult> {
  try {
    return await cloudWrite(`users/${userId}/settings/${key}`, () => ({
      op: "set" as const,
      target: userRef(userId, "settings", key),
      payload: value,
    }));
  } catch (err) {
    const { code, message } = describeError(err);
    return { success: false, errorCode: code, message };
  }
}

export async function logActivityCloud(
  userId: string,
  type: string,
  description: string
): Promise<CloudWriteResult> {
  try {
    const actRef = push(userRef(userId, "activity"));
    const id = actRef.key;
    if (!id) return { success: false, errorCode: "FIREBASE_WRITE", message: "Failed to allocate id" };
    const result = await cloudWrite(`users/${userId}/activity/${id}`, () => ({
      op: "set" as const,
      target: actRef,
      payload: { id, type, description, createdAt: Date.now() },
    }));
    return result.success ? { success: true, id, message: "Synced" } : result;
  } catch (err) {
    const { code, message } = describeError(err);
    return { success: false, errorCode: code, message };
  }
}

// ── Offline queue flush ──────────────────────────────────────────────────────

let flushing = false;

export async function flushOfflineQueue(): Promise<{ flushed: number; failed: number }> {
  if (flushing) return { flushed: 0, failed: 0 };
  if (!db || !isRealtimeDatabaseReady()) return { flushed: 0, failed: 0 };
  if (!navigator.onLine) return { flushed: 0, failed: 0 };

  const queue = loadQueue().filter((q) => q.status === "pending");
  if (queue.length === 0) return { flushed: 0, failed: 0 };

  flushing = true;
  let flushed = 0;
  let failed = 0;

  for (const op of queue) {
    try {
      const target = ref(db, op.path);
      if (op.operation === "set") await set(target, op.payload);
      else if (op.operation === "update") await update(target, op.payload as Record<string, unknown>);
      else await remove(target);
      op.status = "synced";
      flushed++;
    } catch {
      op.retryCount++;
      if (op.retryCount >= 5) {
        op.status = "failed"; // stop retrying — surface in UI
        failed++;
      } else {
        failed++; // will retry on next flush
      }
    }
  }

  // Drop synced entries, keep pending/failed with updated state
  saveQueue(loadQueue().filter((q) => q.status !== "synced"));
  flushing = false;
  return { flushed, failed };
}

/** Get current sync status for the Settings UI. */
export function getSyncStatus(): { status: CloudSyncStatus; pending: number; failed: number } {
  const queue = loadQueue();
  const pending = queue.filter((q) => q.status === "pending").length;
  const failed = queue.filter((q) => q.status === "failed").length;
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  let status: CloudSyncStatus = "SYNCED";
  if (!online) status = "OFFLINE";
  else if (failed > 0) status = "FAILED";
  else if (pending > 0) status = "PENDING";
  return { status, pending, failed };
}

// ── Firebase health diagnostics ──────────────────────────────────────────────

export interface FirebaseHealth {
  configured: boolean;
  authReady: boolean;
  databaseReady: boolean;
  currentUser: string | null;
  readTest: boolean;
  writeTest: boolean;
  latencyMs: number;
  error: string | null;
}

/**
 * Real lightweight read/write health probe. Writes to a diagnostics node
 * under the authenticated user's own path (never touches user data) and
 * cleans up afterwards.
 */
export async function checkFirebaseHealth(userId?: string): Promise<FirebaseHealth> {
  const start = performance.now();
  const health: FirebaseHealth = {
    configured: isFirebaseReady(),
    authReady: isFirebaseReady(),
    databaseReady: isRealtimeDatabaseReady(),
    currentUser: auth?.currentUser?.uid ?? null,
    readTest: false,
    writeTest: false,
    latencyMs: 0,
    error: null,
  };

  if (!health.databaseReady) {
    health.error = "Firebase Realtime Database is not configured";
    health.latencyMs = Math.round(performance.now() - start);
    return health;
  }

  const uid = userId || health.currentUser;
  if (!uid) {
    health.error = "Not signed in — sign in to test Firebase read/write";
    health.latencyMs = Math.round(performance.now() - start);
    return health;
  }

  try {
    const testPath = `users/${uid}/_diagnostics/health`;
    const testRef = ref(db!, testPath);
    const marker = `ok-${Date.now()}`;
    await set(testRef, { marker, at: Date.now() });
    health.writeTest = true;

    const snap = await get(testRef);
    health.readTest = snap.exists() && snap.val()?.marker === marker;

    // Clean up the diagnostic node
    await remove(testRef);
  } catch (err) {
    const { message } = describeError(err);
    health.error = message;
  }

  health.latencyMs = Math.round(performance.now() - start);
  return health;
}

// ── Reconnect handling ───────────────────────────────────────────────────────

let listenersAttached = false;

/** Attach global online/offline listeners that flush the queue on reconnect. Call once at startup. */
export function initCloudSync(): void {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  window.addEventListener("online", () => {
    void flushOfflineQueue();
  });
  // Also attempt a flush shortly after startup (covers reload while queued)
  setTimeout(() => void flushOfflineQueue(), 3000);
}
