/**
 * Nova Memory Retriever — Hybrid Retrieval Engine
 * 
 * Provides context-aware memory retrieval for the AI pipeline:
 * - Keyword matching
 * - Metadata scoring (importance, confidence, recency)
 * - Semantic similarity (cosine/Jaccard)
 * - Entity and tag matching
 * - Conversation-aware relevance boosting
 */

import { unifiedMemory, type Memory } from "./MemoryService";
import type { MemoryCategory, MemoryContextInput } from "./MemoryTypes";

// ─── Text Similarity Helpers ────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function cosineSimilarity(a: string[], b: string[]): number {
  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();
  
  for (const t of a) freqA.set(t, (freqA.get(t) || 0) + 1);
  for (const t of b) freqB.set(t, (freqB.get(t) || 0) + 1);
  
  const allTerms = new Set([...freqA.keys(), ...freqB.keys()]);
  let dot = 0, normA = 0, normB = 0;
  
  for (const term of allTerms) {
    const fA = freqA.get(term) || 0;
    const fB = freqB.get(term) || 0;
    dot += fA * fB;
    normA += fA * fA;
    normB += fB * fB;
  }
  
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Memory Retriever ───────────────────────────────────────────────────────

export class MemoryRetriever {
  /**
   * Retrieve relevant memories for a given input using hybrid scoring.
   */
  static async retrieveRelevant(
    input: string,
    limit = 5,
    options?: {
      categories?: MemoryCategory[];
      minImportance?: number;
    }
  ): Promise<Memory[]> {
    const results = await unifiedMemory.search({
      query: input,
      limit,
      categories: options?.categories,
      minImportance: options?.minImportance,
      sortBy: "relevance",
    });

    return results.map((r) => r.memory);
  }

  /**
   * Retrieve context-aware memories for the AI pipeline.
   * Considers the current message, conversation history, and user preferences.
   */
  static async retrieveForContext(input: MemoryContextInput): Promise<Memory[]> {
    return unifiedMemory.recall(input);
  }

  /**
   * Format memories into a context string for injection into AI prompts.
   */
  static formatMemoriesForContext(memories: Memory[]): string {
    return unifiedMemory.formatForContext(memories);
  }

  /**
   * Quick search — returns just the content strings for simple use cases.
   */
  static async quickSearch(query: string, limit = 3): Promise<string[]> {
    const results = await unifiedMemory.search({ query, limit });
    return results.map((r) => r.memory.content);
  }

  /**
   * Check if a specific preference exists in memory.
   */
  static async hasPreference(topic: string): Promise<boolean> {
    const results = await unifiedMemory.search({
      query: topic,
      categories: ["preference"],
      limit: 1,
      minConfidence: 0.5,
    });
    return results.length > 0;
  }

  /**
   * Get all memories about a specific person.
   */
  static async getPersonMemory(personName: string): Promise<Memory[]> {
    return unifiedMemory.search({
      query: personName,
      categories: ["person"],
      limit: 10,
    }).then((results) => results.map((r) => r.memory));
  }

  /**
   * Get behavioral preferences (how Nova should act).
   */
  static async getBehavioralContext(): Promise<Memory[]> {
    return unifiedMemory.list("behavioral");
  }

  /**
   * Detect if the user is correcting Nova.
   */
  static detectCorrection(message: string): { isCorrection: boolean; correctedText?: string } {
    const lower = message.toLowerCase();
    
    const correctionPatterns = [
      /(?:that'?s|it'?s|that is) (?:wrong|incorrect|not right)/i,
      /(?:no|nah|nope),?\s*(?:i|it|that) (?:meant|meant to say|actually)/i,
      /(?:actually|in fact|to clarify|correction)/i,
      /(?:i|we) (?:prefer|like|want|need) (.+?) (?:not|instead of|rather than) (.+?)(?:\.|$)/i,
      /(?:don'?t|do not) (?:do that|say that|use that)/i,
      /(?:i'?m|i am) (?:not|never) (.+?)(?:\.|,|$)/i,
    ];

    for (const pattern of correctionPatterns) {
      if (pattern.test(message)) {
        return { isCorrection: true, correctedText: message };
      }
    }

    return { isCorrection: false };
  }
}

export default MemoryRetriever;
