import { IntentResult } from "./types";
import { usageManager } from "./usage-manager";

export class EscalationEngine {
  static shouldEscalateToGemini(input: string, result: IntentResult): boolean {
    // 1. Hard check: If intent router determined local path, do NOT escalate
    if (!result.requiresGemini) {
      return false;
    }

    // 2. Budget & Rate limit check
    if (!usageManager.canUseGemini()) {
      if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
        console.warn("[Nova] Gemini rate/budget limit reached. Falling back to local handler.");
      }
      return false;
    }

    // 3. Complexity & Ambiguity evaluation
    const text = input.trim();
    const words = text.split(/\s+/);

    let reasoningRequirement = 0;
    let knowledgeRequirement = 0;
    let ambiguityScore = 0;

    if (/\b(explain|why|how does|architecture|algorithm|compare|synthesize|code|function|debug|refactor)\b/i.test(text)) {
      reasoningRequirement += 0.8;
    }

    if (/\b(history of|quantum|science|biology|physics|literature|deep research|details on|what is the concept of)\b/i.test(text)) {
      knowledgeRequirement += 0.8;
    }

    if (words.length > 15 || text.length > 90) {
      ambiguityScore += 0.5;
    }

    const complexityScore = reasoningRequirement + knowledgeRequirement + ambiguityScore;

    return complexityScore >= 0.5 || result.confidence < 0.65;
  }
}
