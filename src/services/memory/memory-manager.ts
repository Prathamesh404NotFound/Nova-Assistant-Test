export type MemoryType =
  | "PREFERENCE"
  | "PERSON"
  | "PROJECT"
  | "FACT"
  | "HABIT"
  | "INSTRUCTION"
  | "CONVERSATION"
  | "TASK_CONTEXT";

export interface Memory {
  id: string;
  type: MemoryType;
  key: string;
  value: string;
  importance: number;
  confidence: number;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  source: "user" | "assistant" | "inferred";
}

class MemoryManager {
  private STORAGE_KEY = "nova_memories_v2";

  async getAllMemories(): Promise<Memory[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      /* ignore */
    }
    return [];
  }

  async addMemory(memoryData: {
    type?: MemoryType;
    key: string;
    value: string;
    importance?: number;
    confidence?: number;
    source?: "user" | "assistant" | "inferred";
  }): Promise<Memory> {
    const memories = await this.getAllMemories();
    const source = memoryData.source || "user";
    const confidence = memoryData.confidence ?? (source === "inferred" ? 0.7 : 1.0);

    const newMemory: Memory = {
      id: "mem_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      type: memoryData.type || "FACT",
      key: memoryData.key,
      value: memoryData.value,
      importance: memoryData.importance ?? 0.8,
      confidence,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
      source,
    };

    memories.unshift(newMemory);
    this.saveAll(memories);
    return newMemory;
  }

  async updateMemory(id: string, updates: Partial<Memory>): Promise<Memory | null> {
    const memories = await this.getAllMemories();
    const idx = memories.findIndex((m) => m.id === id);
    if (idx === -1) return null;

    memories[idx] = {
      ...memories[idx],
      ...updates,
      updatedAt: Date.now(),
    };

    this.saveAll(memories);
    return memories[idx];
  }

  async deleteMemory(id: string): Promise<boolean> {
    const memories = await this.getAllMemories();
    const filtered = memories.filter((m) => m.id !== id);
    this.saveAll(filtered);
    return filtered.length < memories.length;
  }

  async clearAll(): Promise<void> {
    this.saveAll([]);
  }

  private saveAll(memories: Memory[]) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(memories));
    } catch {
      /* ignore */
    }
  }
}

export const memoryManager = new MemoryManager();
