/**
 * Nova Unified Memory System — Types & Interfaces
 * 
 * 10 memory types covering the full spectrum of what Nova should remember:
 * 1. Working memory — current conversation context
 * 2. Short-term conversational — recent interactions
 * 3. Episodic — specific events and experiences
 * 4. Semantic — facts, knowledge, world understanding
 * 5. User preferences — likes, dislikes, settings
 * 6. People/contact — information about people
 * 7. Project/context — project-specific knowledge
 * 8. Learned corrections — when user corrects Nova
 * 9. Important events — milestones, deadlines, significant dates
 * 10. Behavioral preferences — how Nova should behave
 */

// ─── Memory Types ───────────────────────────────────────────────────────────

export type MemoryCategory =
  | "working"          // Current conversation context (short-lived)
  | "short_term"       // Recent interactions (days/weeks)
  | "episodic"         // Specific events and experiences
  | "semantic"         // Facts, knowledge, world understanding
  | "preference"       // User likes, dislikes, settings
  | "person"           // Information about people
  | "project"          // Project-specific knowledge and context
  | "correction"       // When user corrects Nova's understanding
  | "important_event"  // Milestones, deadlines, significant dates
  | "behavioral";      // How Nova should behave in certain situations

// ─── Memory Interface ───────────────────────────────────────────────────────

export interface Memory {
  id: string;
  category: MemoryCategory;
  content: string;
  
  // Retrieval & ranking
  importance: number;      // 0.0 - 1.0 (how important is this)
  confidence: number;      // 0.0 - 1.0 (how confident are we this is accurate)
  
  // Provenance
  source: "user" | "assistant" | "inferred" | "observed";
  sourceContext?: string;  // What prompted this memory
  
  // Relationships
  tags: string[];
  entities: string[];      // People, places, things mentioned
  relationships: MemoryRelationship[];
  parentMemoryId?: string; // For corrections/updates to existing memories
  
  // Temporal
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  expiresAt?: number;      // Optional TTL (e.g., working memory)
  accessCount: number;     // How often this memory has been recalled
  
  // Conflict resolution
  supersededBy?: string;   // ID of memory that replaced this one
  supersedes?: string[];   // IDs of memories this one replaces
  
  // Metadata
  metadata: Record<string, unknown>;
}

// ─── Relationships ──────────────────────────────────────────────────────────

export interface MemoryRelationship {
  type: "related_to" | "contradicts" | "supports" | "caused_by" | "part_of";
  targetMemoryId: string;
  strength: number; // 0.0 - 1.0
}

// ─── Correction Record ──────────────────────────────────────────────────────

export interface CorrectionRecord {
  id: string;
  originalMemoryId: string;
  correctedMemoryId: string;
  originalContent: string;
  correctedContent: string;
  correctionReason?: string;
  createdAt: number;
  userId?: string;
}

// ─── Memory Search & Retrieval ──────────────────────────────────────────────

export interface MemorySearchInput {
  query: string;
  categories?: MemoryCategory[];
  tags?: string[];
  entities?: string[];
  limit?: number;
  minImportance?: number;
  minConfidence?: number;
  includeSuperseded?: boolean;
  sortBy?: "relevance" | "recency" | "importance" | "access_frequency";
}

export interface MemorySearchResult {
  memory: Memory;
  score: number;
  matchReason: string;  // Why this memory was returned
}

export interface MemoryContextInput {
  currentMessage: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  maxMemories?: number;
  categories?: MemoryCategory[];
}

// ─── Memory Operations ──────────────────────────────────────────────────────

export interface SaveMemoryInput {
  content: string;
  category?: MemoryCategory;
  importance?: number;
  confidence?: number;
  source?: "user" | "assistant" | "inferred" | "observed";
  sourceContext?: string;
  tags?: string[];
  entities?: string[];
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateMemoryInput {
  content?: string;
  importance?: number;
  confidence?: number;
  tags?: string[];
  entities?: string[];
  metadata?: Record<string, unknown>;
}

export interface CorrectMemoryInput {
  memoryId: string;
  newContent: string;
  reason?: string;
}

// ─── Memory Explainability ──────────────────────────────────────────────────

export interface MemoryExplanation {
  memoryId: string;
  content: string;
  source: string;
  sourceContext?: string;
  createdAt: Date;
  confidence: number;
  importance: number;
  accessCount: number;
  lastAccessed: Date;
  relatedMemories: Array<{
    id: string;
    content: string;
    relationship: string;
  }>;
}

// ─── Memory Stats ───────────────────────────────────────────────────────────

export interface MemoryStats {
  total: number;
  byCategory: Record<MemoryCategory, number>;
  averageConfidence: number;
  averageImportance: number;
  oldestMemory?: number;
  newestMemory?: number;
  totalAccesses: number;
}

// ─── Working Memory Config ──────────────────────────────────────────────────

export const WORKING_MEMORY_CONFIG = {
  maxItems: 20,
  defaultTTL: 30 * 60 * 1000, // 30 minutes
  decayRate: 0.1,              // Confidence decay per access window
};

// ─── Memory Category Display Names ──────────────────────────────────────────

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  working: "Working Memory",
  short_term: "Short-term",
  episodic: "Episodic",
  semantic: "Semantic",
  preference: "Preference",
  person: "Person",
  project: "Project",
  correction: "Correction",
  important_event: "Important Event",
  behavioral: "Behavioral",
};

export const MEMORY_CATEGORY_ICONS: Record<MemoryCategory, string> = {
  working: "⚡",
  short_term: "🕐",
  episodic: "📅",
  semantic: "📚",
  preference: "⚙️",
  person: "👤",
  project: "📁",
  correction: "✏️",
  important_event: "🎯",
  behavioral: "🧠",
};
