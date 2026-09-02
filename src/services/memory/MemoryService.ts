/**
 * Nova Unified Memory Service
 * 
 * Replaces the existing MemoryService/MemoryManager with a complete memory system:
 * - 10 memory types (working, short_term, episodic, semantic, preference, person, project, correction, important_event, behavioral)
 * - Hybrid retrieval (keyword + metadata + semantic scoring)
 * - Correction-learning loop
 * - Conflict resolution (superseding old memories)
 * - Explainability (memory origins)
 * - Working memory with TTL decay
 * - Import/export support
 */

import type {
  Memory,
  MemoryCategory,
  MemorySearchInput,
  MemorySearchResult,
  MemoryContextInput,
  SaveMemoryInput,
  UpdateMemoryInput,
  CorrectMemoryInput,
  MemoryExplanation,
  MemoryStats,
  CorrectionRecord,
} from "./MemoryTypes";

import { WORKING_MEMORY_CONFIG } from "./MemoryTypes";

// ─── Storage ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "nova_unified_memories_v3";
const CORRECTIONS_KEY = "nova_memory_corrections_v1";

function loadMemories(): Memory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveMemories(memories: Memory[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  } catch { /* ignore */ }
}

function loadCorrections(): CorrectionRecord[] {
  try {
    const raw = localStorage.getItem(CORRECTIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveCorrections(corrections: CorrectionRecord[]): void {
  try {
    localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(corrections));
  } catch { /* ignore */ }
}

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// ─── Text Similarity ────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.length / union.size;
}

function cosineSimilarity(a: string[], b: string[]): number {
  const termFreqA = new Map<string, number>();
  const termFreqB = new Map<string, number>();
  
  for (const t of a) termFreqA.set(t, (termFreqA.get(t) || 0) + 1);
  for (const t of b) termFreqB.set(t, (termFreqB.get(t) || 0) + 1);
  
  const allTerms = new Set([...termFreqA.keys(), ...termFreqB.keys()]);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (const term of allTerms) {
    const freqA = termFreqA.get(term) || 0;
    const freqB = termFreqB.get(term) || 0;
    dotProduct += freqA * freqB;
    normA += freqA * freqA;
    normB += freqB * freqB;
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ─── Memory Service ─────────────────────────────────────────────────────────

class UnifiedMemoryService {
  private memories: Memory[] = [];
  private corrections: CorrectionRecord[] = [];
  private initialized = false;

  // ─── Initialization ─────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.memories = loadMemories();
    this.corrections = loadCorrections();
    this.initialized = true;
    this.pruneWorkingMemory();
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.memories = loadMemories();
      this.corrections = loadCorrections();
      this.initialized = true;
    }
  }

  // ─── Save ───────────────────────────────────────────────────────────────

  async save(input: SaveMemoryInput): Promise<Memory> {
    this.ensureInitialized();

    const category: MemoryCategory = input.category || "semantic";
    const content = input.content.trim();
    
    if (!content) throw new Error("Memory content cannot be empty");

    // Check for duplicates
    const existing = this.memories.find(
      (m) =>
        m.content.toLowerCase().trim() === content.toLowerCase().trim() &&
        m.category === category &&
        !m.supersededBy
    );

    if (existing) {
      // Update access time and confidence instead of creating duplicate
      existing.lastAccessedAt = Date.now();
      existing.accessCount += 1;
      existing.confidence = Math.min(1.0, existing.confidence + 0.05);
      this.persist();
      return existing;
    }

    // Extract entities from content (simple heuristic)
    const entities = input.entities || this.extractEntities(content);
    const tags = input.tags || this.extractTags(content);

    const memory: Memory = {
      id: generateId(),
      category,
      content,
      importance: input.importance ?? this.estimateImportance(content, category),
      confidence: input.confidence ?? (input.source === "inferred" ? 0.7 : 1.0),
      source: input.source || "user",
      sourceContext: input.sourceContext,
      tags,
      entities,
      relationships: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 1,
      metadata: input.metadata || {},
    };

    this.memories.unshift(memory);
    this.persist();
    return memory;
  }

  // ─── Search (Hybrid Retrieval) ──────────────────────────────────────────

  async search(input: MemorySearchInput): Promise<MemorySearchResult[]> {
    this.ensureInitialized();
    
    const queryTokens = tokenize(input.query);
    const queryLower = input.query.toLowerCase();

    let candidates = this.memories.filter((m) => {
      // Filter superseded memories
      if (!input.includeSuperseded && m.supersededBy) return false;
      
      // Filter by category
      if (input.categories && input.categories.length > 0) {
        if (!input.categories.includes(m.category)) return false;
      }
      
      // Filter by tags
      if (input.tags && input.tags.length > 0) {
        if (!input.tags.some((t) => m.tags.includes(t))) return false;
      }
      
      // Filter by entities
      if (input.entities && input.entities.length > 0) {
        if (!input.entities.some((e) => m.entities.some((me) => me.toLowerCase() === e.toLowerCase()))) return false;
      }
      
      // Filter by importance
      if (input.minImportance !== undefined && m.importance < input.minImportance) return false;
      
      // Filter by confidence
      if (input.minConfidence !== undefined && m.confidence < input.minConfidence) return false;
      
      return true;
    });

    // Score each candidate using hybrid scoring
    const results: MemorySearchResult[] = candidates.map((memory) => {
      const score = this.scoreMemory(memory, queryTokens, queryLower);
      const matchReason = this.explainMatch(memory, queryTokens, queryLower);
      return { memory, score, matchReason };
    });

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    // Limit
    const limit = input.limit ?? 10;
    const limited = results.slice(0, limit);

    // Update access times for returned results
    for (const r of limited) {
      r.memory.lastAccessedAt = Date.now();
      r.memory.accessCount += 1;
    }
    this.persist();

    return limited;
  }

  private scoreMemory(memory: Memory, queryTokens: string[], queryLower: string): number {
    const memTokens = tokenize(`${memory.tags.join(" ")} ${memory.entities.join(" ")} ${memory.content}`);
    const memLower = `${memory.tags.join(" ")} ${memory.entities.join(" ")} ${memory.content}`.toLowerCase();

    // 1. Keyword similarity (Jaccard + Cosine)
    const keywordScore = (jaccardSimilarity(queryTokens, memTokens) + cosineSimilarity(queryTokens, memTokens)) / 2;

    // 2. Exact substring match bonus
    const exactMatch = memLower.includes(queryLower) ? 0.3 : 0;

    // 3. Entity match bonus
    const entityMatch = memory.entities.some(
      (e) => queryLower.includes(e.toLowerCase()) || e.toLowerCase().includes(queryLower)
    )
      ? 0.2
      : 0;

    // 4. Tag match bonus
    const tagMatch = memory.tags.some(
      (t) => queryLower.includes(t.toLowerCase()) || t.toLowerCase().includes(queryLower)
    )
      ? 0.15
      : 0;

    // 5. Recency bonus (memories from last 24h get a boost)
    const hoursOld = (Date.now() - memory.lastAccessedAt) / (1000 * 60 * 60);
    const recencyBonus = Math.max(0, 0.2 * (1 - hoursOld / 168)); // Decays over 1 week

    // 6. Importance multiplier
    const importanceMultiplier = 0.5 + memory.importance * 0.5;

    // 7. Confidence multiplier
    const confidenceMultiplier = 0.5 + memory.confidence * 0.5;

    // 8. Access frequency bonus (log scale)
    const accessBonus = Math.min(0.1, Math.log(1 + memory.accessCount) * 0.02);

    // Combine
    const rawScore = (keywordScore + exactMatch + entityMatch + tagMatch + recencyBonus + accessBonus)
      * importanceMultiplier
      * confidenceMultiplier;

    return Math.max(0, Math.min(1, rawScore));
  }

  private explainMatch(memory: Memory, queryTokens: string[], queryLower: string): string {
    const reasons: string[] = [];
    
    if (memory.content.toLowerCase().includes(queryLower)) {
      reasons.push("direct content match");
    }
    if (memory.entities.some((e) => queryLower.includes(e.toLowerCase()))) {
      reasons.push("entity match");
    }
    if (memory.tags.some((t) => queryLower.includes(t.toLowerCase()))) {
      reasons.push("tag match");
    }
    
    const memTokens = tokenize(memory.content);
    const overlap = queryTokens.filter((t) => memTokens.includes(t));
    if (overlap.length > 0) {
      reasons.push(`keyword match: ${overlap.join(", ")}`);
    }
    
    if (memory.importance > 0.8) reasons.push("high importance");
    if (memory.accessCount > 5) reasons.push("frequently accessed");
    
    return reasons.length > 0 ? reasons.join("; ") : "general relevance";
  }

  // ─── Recall (Context-Aware Retrieval for AI) ────────────────────────────

  async recall(input: MemoryContextInput): Promise<Memory[]> {
    this.ensureInitialized();
    this.pruneWorkingMemory();

    const results: Memory[] = [];
    const seen = new Set<string>();

    // 1. Get relevant memories via search
    const searchResults = await this.search({
      query: input.currentMessage,
      limit: input.maxMemories ?? 8,
      categories: input.categories,
    });

    for (const r of searchResults) {
      if (!seen.has(r.memory.id)) {
        results.push(r.memory);
        seen.add(r.memory.id);
      }
    }

    // 2. Add recent short-term memories (last 24h)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentMemories = this.memories
      .filter(
        (m) =>
          !seen.has(m.id) &&
          !m.supersededBy &&
          m.createdAt > oneDayAgo &&
          (m.category === "short_term" || m.category === "working")
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 3);

    for (const m of recentMemories) {
      if (!seen.has(m.id)) {
        results.push(m);
        seen.add(m.id);
      }
    }

    // 3. Always include high-importance preferences
    const keyPrefs = this.memories
      .filter(
        (m) =>
          !seen.has(m.id) &&
          !m.supersededBy &&
          m.category === "preference" &&
          m.importance > 0.7
      )
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 3);

    for (const m of keyPrefs) {
      if (!seen.has(m.id)) {
        results.push(m);
        seen.add(m.id);
      }
    }

    return results.slice(0, input.maxMemories ?? 10);
  }

  // ─── Correction Learning Loop ───────────────────────────────────────────

  async correct(input: CorrectMemoryInput): Promise<Memory> {
    this.ensureInitialized();

    const originalMemory = this.memories.find((m) => m.id === input.memoryId);
    if (!originalMemory) throw new Error(`Memory ${input.memoryId} not found`);

    // Save the new corrected memory
    const correctedMemory = await this.save({
      content: input.newContent,
      category: originalMemory.category,
      importance: originalMemory.importance,
      confidence: 1.0,
      source: "user",
      sourceContext: `Correction of: "${originalMemory.content}"${input.reason ? ` — ${input.reason}` : ""}`,
      tags: originalMemory.tags,
      entities: originalMemory.entities,
    });

    // Mark original as superseded
    originalMemory.supersededBy = correctedMemory.id;
    originalMemory.confidence *= 0.3; // Drastically reduce confidence
    originalMemory.updatedAt = Date.now();

    // Record the correction
    const correction: CorrectionRecord = {
      id: generateId(),
      originalMemoryId: originalMemory.id,
      correctedMemoryId: correctedMemory.id,
      originalContent: originalMemory.content,
      correctedContent: input.newContent,
      correctionReason: input.reason,
      createdAt: Date.now(),
    };

    this.corrections.push(correction);
    correctedMemory.parentMemoryId = originalMemory.id;
    
    this.persist();
    return correctedMemory;
  }

  // ─── Conflict Resolution ────────────────────────────────────────────────

  async resolveConflict(memoryId: string, keepNewer: boolean = true): Promise<Memory[]> {
    this.ensureInitialized();

    const memory = this.memories.find((m) => m.id === memoryId);
    if (!memory) throw new Error(`Memory ${memoryId} not found`);

    // Find conflicting memories (same category, similar content, different values)
    const conflicts = this.memories.filter(
      (m) =>
        m.id !== memoryId &&
        !m.supersededBy &&
        m.category === memory.category &&
        this.hasConflict(m, memory)
    );

    if (conflicts.length === 0) return [memory];

    const resolved: Memory[] = [];
    
    for (const conflict of conflicts) {
      if (keepNewer) {
        // The newer memory supersedes the older
        if (memory.createdAt > conflict.createdAt) {
          conflict.supersededBy = memory.id;
          memory.supersedes = [...(memory.supersedes || []), conflict.id];
          resolved.push(conflict);
        } else {
          memory.supersededBy = conflict.id;
          conflict.supersedes = [...(conflict.supersedes || []), memory.id];
          resolved.push(memory);
        }
      } else {
        // Higher confidence wins
        if (memory.confidence >= conflict.confidence) {
          conflict.supersededBy = memory.id;
          memory.supersedes = [...(memory.supersedes || []), conflict.id];
          resolved.push(conflict);
        } else {
          memory.supersededBy = conflict.id;
          conflict.supersedes = [...(conflict.supersedes || []), memory.id];
          resolved.push(memory);
        }
      }
    }

    this.persist();
    return resolved;
  }

  private hasConflict(a: Memory, b: Memory): boolean {
    // Simple conflict detection: similar entities/tags but different content
    const aTokens = new Set(tokenize(a.content));
    const bTokens = new Set(tokenize(b.content));
    
    // If they share entities/tags but content differs significantly
    const entityOverlap = a.entities.some((e) => b.entities.includes(e));
    const tagOverlap = a.tags.some((t) => b.tags.includes(t));
    
    if (!entityOverlap && !tagOverlap) return false;
    
    // Check if content is meaningfully different (not just minor rewording)
    const similarity = jaccardSimilarity([...aTokens], [...bTokens]);
    return similarity < 0.7 && similarity > 0.1; // Not too similar, not too different
  }

  // ─── Explainability ─────────────────────────────────────────────────────

  async explain(memoryId: string): Promise<MemoryExplanation | null> {
    this.ensureInitialized();

    const memory = this.memories.find((m) => m.id === memoryId);
    if (!memory) return null;

    // Find related memories
    const related = this.memories
      .filter(
        (m) =>
          m.id !== memoryId &&
          !m.supersededBy &&
          (memory.relationships.some((r) => r.targetMemoryId === m.id) ||
            m.tags.some((t) => memory.tags.includes(t)) ||
            m.entities.some((e) => memory.entities.includes(e)))
      )
      .slice(0, 5)
      .map((m) => ({
        id: m.id,
        content: m.content,
        relationship: memory.relationships.find((r) => r.targetMemoryId === m.id)?.type || "related_to",
      }));

    return {
      memoryId: memory.id,
      content: memory.content,
      source: memory.source,
      sourceContext: memory.sourceContext,
      createdAt: new Date(memory.createdAt),
      confidence: memory.confidence,
      importance: memory.importance,
      accessCount: memory.accessCount,
      lastAccessed: new Date(memory.lastAccessedAt),
      relatedMemories: related,
    };
  }

  // ─── Update ─────────────────────────────────────────────────────────────

  async update(id: string, input: UpdateMemoryInput): Promise<Memory | null> {
    this.ensureInitialized();

    const memory = this.memories.find((m) => m.id === id);
    if (!memory) return null;

    if (input.content !== undefined) memory.content = input.content;
    if (input.importance !== undefined) memory.importance = input.importance;
    if (input.confidence !== undefined) memory.confidence = input.confidence;
    if (input.tags !== undefined) memory.tags = input.tags;
    if (input.entities !== undefined) memory.entities = input.entities;
    if (input.metadata !== undefined) memory.metadata = { ...memory.metadata, ...input.metadata };
    
    memory.updatedAt = Date.now();
    this.persist();
    return memory;
  }

  // ─── Delete ─────────────────────────────────────────────────────────────

  async delete(id: string): Promise<boolean> {
    this.ensureInitialized();
    const before = this.memories.length;
    this.memories = this.memories.filter((m) => m.id !== id);
    this.persist();
    return this.memories.length < before;
  }

  // ─── Forget (bulk delete by query) ──────────────────────────────────────

  async forget(query: string): Promise<number> {
    const results = await this.search({ query, includeSuperseded: true });
    let deleted = 0;
    for (const r of results) {
      if (await this.delete(r.memory.id)) deleted++;
    }
    return deleted;
  }

  // ─── Promote (increase importance) ──────────────────────────────────────

  async promote(id: string, newImportance?: number): Promise<Memory | null> {
    this.ensureInitialized();
    const memory = this.memories.find((m) => m.id === id);
    if (!memory) return null;
    
    memory.importance = newImportance ?? Math.min(1.0, memory.importance + 0.2);
    memory.updatedAt = Date.now();
    this.persist();
    return memory;
  }

  // ─── Archive (set expiry or mark archived) ──────────────────────────────

  async archive(id: string): Promise<Memory | null> {
    this.ensureInitialized();
    const memory = this.memories.find((m) => m.id === id);
    if (!memory) return null;
    
    // Move to low importance and set short TTL
    memory.importance = Math.max(0.1, memory.importance - 0.3);
    memory.metadata.archived = true;
    memory.updatedAt = Date.now();
    this.persist();
    return memory;
  }

  // ─── List ───────────────────────────────────────────────────────────────

  async list(category?: MemoryCategory): Promise<Memory[]> {
    this.ensureInitialized();
    const active = this.memories.filter((m) => !m.supersededBy);
    return category ? active.filter((m) => m.category === category) : active;
  }

  // ─── Stats ──────────────────────────────────────────────────────────────

  async getStats(): Promise<MemoryStats> {
    this.ensureInitialized();
    
    const active = this.memories.filter((m) => !m.supersededBy);
    const byCategory = {} as Record<MemoryCategory, number>;
    
    for (const m of active) {
      byCategory[m.category] = (byCategory[m.category] || 0) + 1;
    }

    const totalConfidence = active.reduce((s, m) => s + m.confidence, 0);
    const totalImportance = active.reduce((s, m) => s + m.importance, 0);
    const totalAccesses = active.reduce((s, m) => s + m.accessCount, 0);

    return {
      total: active.length,
      byCategory,
      averageConfidence: active.length ? totalConfidence / active.length : 0,
      averageImportance: active.length ? totalImportance / active.length : 0,
      oldestMemory: active.length ? Math.min(...active.map((m) => m.createdAt)) : undefined,
      newestMemory: active.length ? Math.max(...active.map((m) => m.createdAt)) : undefined,
      totalAccesses,
    };
  }

  // ─── Format for AI Context ──────────────────────────────────────────────

  formatForContext(memories: Memory[]): string {
    if (memories.length === 0) return "";
    
    const lines = ["User Context & Stored Memories:"];
    
    for (const m of memories) {
      const prefix = m.category === "preference" ? "Preference" :
                     m.category === "person" ? "Person" :
                     m.category === "correction" ? "Corrected" :
                     m.category === "behavioral" ? "Behavior" :
                     m.category === "project" ? "Project" :
                     m.category === "important_event" ? "Important" :
                     "Info";
      
      lines.push(`- [${prefix}] ${m.content}`);
      if (m.sourceContext) lines.push(`  Source: ${m.sourceContext}`);
    }
    
    return lines.join("\n");
  }

  // ─── Export / Import ────────────────────────────────────────────────────

  async exportData(): Promise<string> {
    this.ensureInitialized();
    return JSON.stringify({
      version: 3,
      exportedAt: Date.now(),
      memories: this.memories.filter((m) => !m.supersededBy),
      corrections: this.corrections,
    }, null, 2);
  }

  async importData(jsonString: string): Promise<{ imported: number; skipped: number }> {
    this.ensureInitialized();
    
    try {
      const data = JSON.parse(jsonString);
      if (!data.memories || !Array.isArray(data.memories)) {
        throw new Error("Invalid import format");
      }

      let imported = 0;
      let skipped = 0;
      const existingIds = new Set(this.memories.map((m) => m.id));

      for (const m of data.memories) {
        if (existingIds.has(m.id)) {
          skipped++;
          continue;
        }
        this.memories.push(m);
        imported++;
      }

      if (data.corrections) {
        this.corrections = [...this.corrections, ...data.corrections];
      }

      this.persist();
      return { imported, skipped };
    } catch (e) {
      throw new Error(`Import failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async clear(): Promise<void> {
    this.memories = [];
    this.corrections = [];
    this.persist();
  }

  // ─── Working Memory Management ──────────────────────────────────────────

  private pruneWorkingMemory(): void {
    const now = Date.now();
    const workingMemories = this.memories.filter((m) => m.category === "working");
    
    // Remove expired working memories
    for (const m of workingMemories) {
      if (m.expiresAt && m.expiresAt < now) {
        m.supersededBy = "__pruned__";
      }
    }

    // Enforce max items (remove oldest)
    const activeWorking = workingMemories.filter((m) => !m.supersededBy);
    if (activeWorking.length > WORKING_MEMORY_CONFIG.maxItems) {
      const sorted = activeWorking.sort((a, b) => a.createdAt - b.createdAt);
      const toPrune = sorted.slice(0, activeWorking.length - WORKING_MEMORY_CONFIG.maxItems);
      for (const m of toPrune) {
        m.supersededBy = "__pruned__";
      }
    }

    this.persist();
  }

  // ─── Entity & Tag Extraction ────────────────────────────────────────────

  private extractEntities(content: string): string[] {
    const entities: string[] = [];
    
    // Simple capitalized word extraction (names, places)
    const capitalWords: string[] = content.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g) || [];
    entities.push(...capitalWords.filter((w) => w.length > 2));
    
    // Time/date references
    const timeRefs = content.match(/\b(?:today|tomorrow|yesterday|next\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi) || [];
    entities.push(...timeRefs.map((t) => t.toLowerCase()));
    
    return [...new Set(entities)].slice(0, 10);
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const lower = content.toLowerCase();
    
    const tagPatterns: [RegExp, string][] = [
      [/\b(?:schedule|meeting|calendar|event|appointment)\b/, "calendar"],
      [/\b(?:task|todo|to-do|finish|complete|deadline)\b/, "task"],
      [/\b(?:remember|preference|like|dislike|prefer)\b/, "preference"],
      [/\b(?:email|mail|inbox|send|draft)\b/, "email"],
      [/\b(?:file|document|folder|pdf|image)\b/, "file"],
      [/\b(?:code|programming|develop|build|deploy)\b/, "code"],
      [/\b(?:search|look up|find|research)\b/, "search"],
      [/\b(?:play|music|song|video|movie)\b/, "media"],
      [/\b(?:buy|purchase|order|shop|price)\b/, "shopping"],
      [/\b(?:health|doctor|medication|exercise)\b/, "health"],
    ];

    for (const [pattern, tag] of tagPatterns) {
      if (pattern.test(lower)) tags.push(tag);
    }

    return tags;
  }

  private estimateImportance(content: string, category: MemoryCategory): number {
    let score = 0.5;
    
    // Category-based base importance
    if (category === "preference") score = 0.7;
    if (category === "correction") score = 0.85;
    if (category === "important_event") score = 0.8;
    if (category === "person") score = 0.65;
    if (category === "behavioral") score = 0.7;
    if (category === "working") score = 0.4;
    if (category === "short_term") score = 0.3;
    
    // Content-based adjustments
    const lower = content.toLowerCase();
    if (lower.includes("important") || lower.includes("critical")) score += 0.1;
    if (lower.includes("always") || lower.includes("never")) score += 0.1;
    if (lower.includes("remember") || lower.includes("don't forget")) score += 0.1;
    if (content.length > 100) score += 0.05;
    
    return Math.min(1.0, Math.max(0.1, score));
  }

  // ─── Persistence ────────────────────────────────────────────────────────

  private persist(): void {
    saveMemories(this.memories);
    saveCorrections(this.corrections);
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const unifiedMemory = new UnifiedMemoryService();

// Backward-compatible export for existing code
export const memoryService = {
  save: (input: SaveMemoryInput) => unifiedMemory.save(input),
  search: async (input: { query: string; type?: string; limit?: number }) => {
    const results = await unifiedMemory.search({
      query: input.query,
      limit: input.limit,
    });
    return results.map((r) => r.memory);
  },
  list: (type?: string) => unifiedMemory.list(type as MemoryCategory | undefined),
  update: (id: string, updates: Record<string, unknown>) => unifiedMemory.update(id, updates as UpdateMemoryInput),
  delete: (id: string) => unifiedMemory.delete(id),
  forget: (query: string) => unifiedMemory.forget(query),
  clear: () => unifiedMemory.clear(),
  getStats: () => unifiedMemory.getStats(),
};

export type { Memory, MemoryCategory, MemorySearchResult, MemoryExplanation, CorrectionRecord } from "./MemoryTypes";
