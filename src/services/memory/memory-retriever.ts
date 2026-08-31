import { memoryManager, Memory } from "./memory-manager";

export class MemoryRetriever {
  static async retrieveRelevant(input: string, limit = 5): Promise<Memory[]> {
    const memories = await memoryManager.getAllMemories();
    if (memories.length === 0) return [];

    const lowerInput = input.toLowerCase();
    const words = lowerInput
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const scored = memories.map((mem) => {
      let score = 0;
      const memText = `${mem.key} ${mem.value} ${mem.type}`.toLowerCase();

      words.forEach((word) => {
        if (memText.includes(word)) {
          score += 2.5;
        }
      });

      // Recency bonus: if updated within the last 7 days
      const hoursOld = (Date.now() - mem.updatedAt) / (1000 * 60 * 60);
      const recencyBonus = Math.max(0, 1 - hoursOld / 168);
      score += mem.importance * 1.5 + recencyBonus;

      // Confidence factor
      score *= mem.confidence;

      return { mem, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.mem);
  }

  static formatMemoriesForContext(memories: Memory[]): string {
    if (memories.length === 0) return "";
    return (
      "User Context & Stored Memories:\n" +
      memories.map((m) => `- [${m.type}] ${m.key}: ${m.value} (source: ${m.source})`).join("\n")
    );
  }
}
