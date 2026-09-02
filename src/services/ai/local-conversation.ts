import { responseCache } from "./response-cache";

export class LocalConversationEngine {
  static generateResponse(input: string): string {
    const cached = responseCache.get(input, "local");
    if (cached) return cached;

    const lower = input.toLowerCase().trim();

    if (lower.includes("thank")) {
      return "You're welcome! Let me know if you need anything else.";
    }
    if (lower.includes("how are you") || lower.includes("how do you do")) {
      return "I'm operating at 100% capacity and ready to help!";
    }
    if (lower.includes("who are you") || lower.includes("what are you") || lower.includes("what is your name")) {
      return "I am Nova — your local-first AI Personal Operating System.";
    }
    if (lower.includes("good morning")) {
      return "Good morning! Ready to tackle today's goals?";
    }
    if (lower.includes("good night") || lower.includes("going to sleep")) {
      return "Good night! Sleep well.";
    }
    if (lower.includes("repeat that") || lower.includes("say that again")) {
      return "I'm here and ready for your command.";
    }

    const response = "Got it! I'm here whenever you need me.";
    responseCache.set(input, "local", response, "local");
    return response;
  }
}
