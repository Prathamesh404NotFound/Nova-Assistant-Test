/**
 * Nova Agent Architecture — Memory Service
 * Unified memory API used by both UI pages and the agent orchestrator.
 * Wraps existing MemoryManager with deduplication, search, and tool-compatible interface.
 */

import { memoryManager as manager, type Memory, type MemoryType } from "./memory-manager";

// ─── Public API ─────────────────────────────────────────────────────────────

export interface SaveMemoryInput {
  content: string;
  type?: MemoryType;
  key?: string;
  importance?: number;
  source?: "user" | "assistant" | "inferred";
}

export interface SearchMemoryInput {
  query: string;
  type?: MemoryType;
  limit?: number;
}

class MemoryService {
  /**
   * Save a memory. Auto-generates key from content if not provided.
   * Deduplicates by checking for existing memories with the same value.
   */
  async save(input: SaveMemoryInput): Promise<Memory> {
    const key = input.key || input.content.slice(0, 60);
    const value = input.content;

    // Deduplication: check if a memory with the same value already exists
    const allExisting = await manager.getAllMemories();
    const existing = allExisting.filter(
      (m) => m.value.toLowerCase().trim() === value.toLowerCase().trim()
    );
    if (existing.length > 0) {
      // Update the existing memory instead of creating a duplicate
      const updated = await manager.updateMemory(existing[0].id, {
        lastAccessedAt: Date.now(),
        importance: input.importance ?? existing[0].importance,
      });
      return updated || existing[0];
    }

    return manager.addMemory({
      type: input.type || "FACT",
      key,
      value,
      importance: input.importance,
      source: input.source || "user",
    });
  }

  /**
   * Search memories by query string.
   * Returns results ordered by relevance (confidence × importance × recency).
   */
  async search(input: SearchMemoryInput): Promise<Memory[]> {
    const all = await manager.getAllMemories();
    const query = input.query.toLowerCase();

    let results = all.filter((m) => {
      const matchesQuery =
        m.key.toLowerCase().includes(query) ||
        m.value.toLowerCase().includes(query) ||
        m.value.includes(input.query);
      const matchesType = !input.type || m.type === input.type;
      return matchesQuery && matchesType;
    });

    // Sort by relevance score
    results.sort((a, b) => {
      const scoreA = a.confidence * a.importance * (1 + Math.log(Date.now() - a.lastAccessedAt + 1) * -0.000001);
      const scoreB = b.confidence * b.importance * (1 + Math.log(Date.now() - b.lastAccessedAt + 1) * -0.000001);
      return scoreB - scoreA;
    });

    if (input.limit) {
      results = results.slice(0, input.limit);
    }

    // Touch lastAccessedAt for returned results
    for (const r of results) {
      await manager.updateMemory(r.id, { lastAccessedAt: Date.now() });
    }

    return results;
  }

  /**
   * List all memories, optionally filtered by type.
   */
  async list(type?: MemoryType): Promise<Memory[]> {
    const all = await manager.getAllMemories();
    return type ? all.filter((m) => m.type === type) : all;
  }

  /**
   * Update a memory by ID.
   */
  async update(id: string, updates: Partial<Pick<Memory, "key" | "value" | "type" | "importance">>): Promise<Memory | null> {
    return manager.updateMemory(id, updates);
  }

  /**
   * Delete a memory by ID.
   */
  async delete(id: string): Promise<boolean> {
    return manager.deleteMemory(id);
  }

  /**
   * Forget (delete) memories matching a query.
   * Returns the number of deleted memories.
   */
  async forget(query: string): Promise<number> {
    const results = await this.search({ query });
    let deleted = 0;
    for (const m of results) {
      const ok = await manager.deleteMemory(m.id);
      if (ok) deleted++;
    }
    return deleted;
  }

  /**
   * Clear all memories.
   */
  async clear(): Promise<void> {
    await manager.clearAll();
  }

  /**
   * Get a summary count of memories by type.
   */
  async getStats(): Promise<Record<MemoryType, number>> {
    const all = await manager.getAllMemories();
    const stats: Record<string, number> = {};
    for (const m of all) {
      stats[m.type] = (stats[m.type] || 0) + 1;
    }
    return stats as Record<MemoryType, number>;
  }
}

/** Singleton memory service. */
export const memoryService = new MemoryService();
