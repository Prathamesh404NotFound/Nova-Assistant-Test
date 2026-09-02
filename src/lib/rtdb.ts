import {
  ref,
  set,
  get,
  push,
  remove,
  update,
  onValue,
  query,
  orderByChild,
  equalTo,
} from "firebase/database";
import { db, isFirebaseReady } from "./firebase";

// ── Generic helpers ──────────────────────────────────────────────
function userPath(userId: string, ...segments: string[]) {
  if (!db || !isFirebaseReady()) throw new Error("Firebase not configured");
  return ref(db, `users/${userId}/${segments.join("/")}`);
}

// ── Tasks ────────────────────────────────────────────────────────
export interface RTDBTask {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_LOCAL_TASKS: RTDBTask[] = [];

export async function createTask(
  userId: string,
  data: Omit<RTDBTask, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const newTask: RTDBTask = {
    ...data,
    id: "task-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    const taskRef = push(userPath(userId, "tasks"));
    if (taskRef.key) {
      newTask.id = taskRef.key;
      await set(taskRef, newTask);
    }
  } catch (_err) {
    /* fallback to local storage */
  }

  try {
    const existing = JSON.parse(localStorage.getItem(`nova_tasks_${userId}`) || "null");
    const tasks = existing || DEFAULT_LOCAL_TASKS;
    tasks.unshift(newTask);
    localStorage.setItem(`nova_tasks_${userId}`, JSON.stringify(tasks));
  } catch (_e) {
    /* ignore */
  }

  return newTask.id;
}

export async function getTasks(userId: string): Promise<RTDBTask[]> {
  try {
    const snap = await get(userPath(userId, "tasks"));
    if (snap.exists()) {
      return Object.values(snap.val()) as RTDBTask[];
    }
  } catch (_err) {
    /* fallback */
  }

  try {
    const stored = localStorage.getItem(`nova_tasks_${userId}`);
    if (stored) return JSON.parse(stored);
    localStorage.setItem(`nova_tasks_${userId}`, JSON.stringify(DEFAULT_LOCAL_TASKS));
    return DEFAULT_LOCAL_TASKS;
  } catch (_e) {
    return DEFAULT_LOCAL_TASKS;
  }
}

export async function updateTask(
  userId: string,
  taskId: string,
  data: Partial<Omit<RTDBTask, "id" | "createdAt">>
) {
  try {
    await update(userPath(userId, "tasks", taskId), {
      ...data,
      updatedAt: Date.now(),
    });
  } catch (_err) {
    /* fallback */
  }

  try {
    const stored = localStorage.getItem(`nova_tasks_${userId}`);
    const tasks: RTDBTask[] = stored ? JSON.parse(stored) : DEFAULT_LOCAL_TASKS;
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, ...data, updatedAt: Date.now() } : t));
    localStorage.setItem(`nova_tasks_${userId}`, JSON.stringify(updated));
  } catch (_e) {
    /* ignore */
  }
}

export async function deleteTask(userId: string, taskId: string) {
  try {
    await remove(userPath(userId, "tasks", taskId));
  } catch (_err) {
    /* fallback */
  }

  try {
    const stored = localStorage.getItem(`nova_tasks_${userId}`);
    const tasks: RTDBTask[] = stored ? JSON.parse(stored) : DEFAULT_LOCAL_TASKS;
    const filtered = tasks.filter((t) => t.id !== taskId);
    localStorage.setItem(`nova_tasks_${userId}`, JSON.stringify(filtered));
  } catch (_e) {
    /* ignore */
  }
}

// ── Memories ─────────────────────────────────────────────────────
export interface RTDBMemory {
  id: string;
  category: "fact" | "preference" | "person" | "project" | "note";
  key: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_LOCAL_MEMORIES: RTDBMemory[] = [];

export async function addMemory(
  userId: string,
  data: Omit<RTDBMemory, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const newMem: RTDBMemory = {
    ...data,
    id: "mem-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    const memRef = push(userPath(userId, "memories"));
    if (memRef.key) {
      newMem.id = memRef.key;
      await set(memRef, newMem);
    }
  } catch (_e) {
    /* fallback */
  }

  try {
    const stored = localStorage.getItem(`nova_memories_${userId}`);
    const list: RTDBMemory[] = stored ? JSON.parse(stored) : DEFAULT_LOCAL_MEMORIES;
    list.unshift(newMem);
    localStorage.setItem(`nova_memories_${userId}`, JSON.stringify(list));
  } catch (_e) {
    /* ignore */
  }

  return newMem.id;
}

export async function getMemories(userId: string): Promise<RTDBMemory[]> {
  try {
    const snap = await get(userPath(userId, "memories"));
    if (snap.exists()) {
      return Object.values(snap.val()) as RTDBMemory[];
    }
  } catch (_e) {
    /* fallback */
  }

  try {
    const stored = localStorage.getItem(`nova_memories_${userId}`);
    if (stored) return JSON.parse(stored);
    localStorage.setItem(`nova_memories_${userId}`, JSON.stringify(DEFAULT_LOCAL_MEMORIES));
    return DEFAULT_LOCAL_MEMORIES;
  } catch (_e) {
    return DEFAULT_LOCAL_MEMORIES;
  }
}

export async function deleteMemory(userId: string, memoryId: string) {
  try {
    await remove(userPath(userId, "memories", memoryId));
  } catch (_e) {
    /* fallback */
  }

  try {
    const stored = localStorage.getItem(`nova_memories_${userId}`);
    const list: RTDBMemory[] = stored ? JSON.parse(stored) : DEFAULT_LOCAL_MEMORIES;
    const filtered = list.filter((m) => m.id !== memoryId);
    localStorage.setItem(`nova_memories_${userId}`, JSON.stringify(filtered));
  } catch (_e) {
    /* ignore */
  }
}

// ── Conversations ────────────────────────────────────────────────
export interface RTDBConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export async function createConversation(
  userId: string,
  title: string
): Promise<string> {
  const convRef = push(userPath(userId, "conversations"));
  const id = convRef.key!;
  await set(convRef, { id, title, createdAt: Date.now(), updatedAt: Date.now() });
  return id;
}

export async function getConversations(userId: string): Promise<RTDBConversation[]> {
  const snap = await get(userPath(userId, "conversations"));
  if (!snap.exists()) return [];
  return Object.values(snap.val()) as RTDBConversation[];
}

export interface RTDBMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
}

export async function addMessage(
  userId: string,
  conversationId: string,
  data: Omit<RTDBMessage, "id" | "createdAt">
): Promise<string> {
  const msgRef = push(userPath(userId, "conversations", conversationId, "messages"));
  const id = msgRef.key!;
  await set(msgRef, { ...data, id, createdAt: Date.now() });
  return id;
}

export async function getMessages(
  userId: string,
  conversationId: string
): Promise<RTDBMessage[]> {
  const snap = await get(userPath(userId, "conversations", conversationId, "messages"));
  if (!snap.exists()) return [];
  return Object.values(snap.val()) as RTDBMessage[];
}

// ── Activity ─────────────────────────────────────────────────────
export interface RTDBActivity {
  id: string;
  type: string;
  description: string;
  createdAt: number;
}

export async function logActivity(
  userId: string,
  type: string,
  description: string
): Promise<string> {
  const actRef = push(userPath(userId, "activity"));
  const id = actRef.key!;
  await set(actRef, { id, type, description, createdAt: Date.now() });
  return id;
}

export async function getActivities(userId: string): Promise<RTDBActivity[]> {
  const snap = await get(userPath(userId, "activity"));
  if (!snap.exists()) return [];
  const val = snap.val();
  return (Object.values(val) as RTDBActivity[]).sort(
    (a, b) => b.createdAt - a.createdAt
  );
}

// ── Settings ─────────────────────────────────────────────────────
export async function setSetting(userId: string, key: string, value: string) {
  await set(userPath(userId, "settings", key), value);
}

export async function getSetting(userId: string, key: string): Promise<string | null> {
  const snap = await get(userPath(userId, "settings", key));
  return snap.exists() ? snap.val() : null;
}

export async function getAllSettings(userId: string): Promise<Record<string, string>> {
  const snap = await get(userPath(userId, "settings"));
  if (!snap.exists()) return {};
  return snap.val() as Record<string, string>;
}

// ── Realtime listeners ───────────────────────────────────────────
export function onTasksChange(
  userId: string,
  callback: (tasks: RTDBTask[]) => void
): () => void {
  const tasksRef = userPath(userId, "tasks");
  return onValue(tasksRef, (snap) => {
    if (!snap.exists()) { callback([]); return; }
    callback(Object.values(snap.val()) as RTDBTask[]);
  });
}

export function onMemoriesChange(
  userId: string,
  callback: (memories: RTDBMemory[]) => void
): () => void {
  const memRef = userPath(userId, "memories");
  return onValue(memRef, (snap) => {
    if (!snap.exists()) { callback([]); return; }
    callback(Object.values(snap.val()) as RTDBMemory[]);
  });
}
