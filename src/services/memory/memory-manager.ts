/**
 * Nova Memory Manager — Legacy Compatibility Layer
 * 
 * This module provides backward compatibility for code that imports
 * from memory-manager directly. All operations delegate to the unified
 * MemoryService.
 * 
 * New code should import from MemoryService.ts directly.
 */

import { unifiedMemory } from "./MemoryService";
import type { MemoryCategory } from "./MemoryTypes";

// ─── Types (preserved for backward compatibility) ───────────────────────────

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

// ─── Legacy Memory Type Mapping ─────────────────────────────────────────────

function legacyTypeToCategory(type: MemoryType): MemoryCategory {
  const map: Record<MemoryType, MemoryCategory> = {
    PREFERENCE: "preference",
    PERSON: "person",
    PROJECT: "project",
    FACT: "semantic",
    HABIT: "behavioral",
    INSTRUCTION: "behavioral",
    CONVERSATION: "short_term",
    TASK_CONTEXT: "project",
  };
  return map[type] || "semantic";
}

function categoryToLegacyType(category: MemoryCategory): MemoryType {
  const map: Record<MemoryCategory, MemoryType> = {
    working: "CONVERSATION",
    short_term: "CONVERSATION",
    episodic: "FACT",
    semantic: "FACT",
    preference: "PREFERENCE",
    person: "PERSON",
    project: "PROJECT",
    correction: "FACT",
    important_event: "FACT",
    behavioral: "HABIT",
  };
  return map[category] || "FACT";
}

function toLegacyMemory(m: import("./MemoryService").Memory): Memory {
  return {
    id: m.id,
    type: categoryToLegacyType(m.category),
    key: m.tags[0] || m.entities[0] || m.content.slice(0, 60),
    value: m.content,
    importance: m.importance,
    confidence: m.confidence,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    lastAccessedAt: m.lastAccessedAt,
    source: m.source === "observed" ? "inferred" : m.source as "user" | "assistant" | "inferred",
  };
}

// ─── Legacy MemoryManager ───────────────────────────────────────────────────

class MemoryManager {
  async getAllMemories(): Promise<Memory[]> {
    await unifiedMemory.initialize();
    const all = await unifiedMemory.list();
    return all.map(toLegacyMemory);
  }

  async addMemory(data: {
    type?: MemoryType;
    key: string;
    value: string;
    importance?: number;
    confidence?: number;
    source?: "user" | "assistant" | "inferred";
  }): Promise<Memory> {
    await unifiedMemory.initialize();
    const category = data.type ? legacyTypeToCategory(data.type) : "semantic";
    
    const result = await unifiedMemory.save({
      content: data.value,
      category,
      importance: data.importance,
      confidence: data.confidence,
      source: data.source || "user",
      tags: [data.key],
    });

    return toLegacyMemory(result);
  }

  async updateMemory(id: string, updates: Partial<Memory>): Promise<Memory | null> {
    await unifiedMemory.initialize();
    const result = await unifiedMemory.update(id, {
      content: updates.value,
      importance: updates.importance,
      confidence: updates.confidence,
    });
    return result ? toLegacyMemory(result) : null;
  }

  async deleteMemory(id: string): Promise<boolean> {
    return unifiedMemory.delete(id);
  }

  async clearAll(): Promise<void> {
    return unifiedMemory.clear();
  }
}

export const memoryManager = new MemoryManager();
