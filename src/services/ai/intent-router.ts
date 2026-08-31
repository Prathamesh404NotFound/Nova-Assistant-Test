import { IntentResult } from "./types";

export class IntentRouter {
  static classify(input: string): IntentResult {
    const raw = input.trim();
    const lower = raw.toLowerCase();

    // 1. EMERGENCY / STOP / CANCEL COMMANDS
    if (/^(stop|cancel|abort|pause|quiet|shut up|mute)$/i.test(lower)) {
      return {
        intent: "DEVICE_ACTION",
        confidence: 0.99,
        requiresGemini: false,
        requiresTool: true,
        extractedData: { action: "stop" },
      };
    }

    // 2. GREETINGS & SIMPLE GREETING ALIASES
    const greetings = [
      "hello",
      "hi",
      "hey",
      "hey nova",
      "hello nova",
      "hi nova",
      "good morning",
      "good night",
      "good evening",
      "good afternoon",
      "how are you",
      "how are you doing",
      "what is your name",
      "who are you",
      "thank you",
      "thanks",
      "bye",
      "goodbye",
      "are you there",
      "repeat that",
    ];

    if (greetings.includes(lower) || /^hey nova|^hello nova|^hi nova/i.test(lower)) {
      return {
        intent: "GREETING",
        confidence: 0.98,
        requiresGemini: false,
        requiresTool: false,
      };
    }

    // 3. TIME & DATE
    if (/\b(what time|time is it|current time|what's the time|check time|clock)\b/i.test(lower)) {
      return {
        intent: "TIME",
        confidence: 0.98,
        requiresGemini: false,
        requiresTool: true,
      };
    }
    if (/\b(what date|today's date|current date|what day is it|what is today's date|today date)\b/i.test(lower)) {
      return {
        intent: "DATE",
        confidence: 0.98,
        requiresGemini: false,
        requiresTool: true,
      };
    }

    // 4. NAVIGATION COMMANDS
    const navMatch = lower.match(
      /\b(open|go to|show|view|navigate to|launch)\s+(settings|dashboard|tasks|memory|chat|devices|smart home|automations|coding|files|calendar|email|security|activity)\b/i
    );
    if (navMatch) {
      const page = navMatch[2].toLowerCase().replace(/\s+/g, "");
      return {
        intent: "NAVIGATION",
        confidence: 0.95,
        requiresGemini: false,
        requiresTool: true,
        extractedData: { target: page },
      };
    }

    // 5. MEMORY WRITE COMMANDS
    if (/\b(remember that|remember this|keep in mind|note that|save this memory|memorize that)\b/i.test(lower)) {
      const content = raw.replace(/^.*?(remember that|remember this|keep in mind|note that|save this memory|memorize that)\s*/i, "");
      return {
        intent: "MEMORY_WRITE",
        confidence: 0.95,
        requiresGemini: false,
        requiresTool: true,
        extractedData: { content: content || raw },
      };
    }

    // 6. MEMORY READ / FORGET COMMANDS
    if (/\b(what do you remember|show memories|my memories|what is my preference|list memories)\b/i.test(lower)) {
      return {
        intent: "MEMORY_READ",
        confidence: 0.92,
        requiresGemini: false,
        requiresTool: true,
      };
    }
    if (/\b(forget this|forget memory|clear memory|erase memory)\b/i.test(lower)) {
      return {
        intent: "MEMORY_READ",
        confidence: 0.9,
        requiresGemini: false,
        requiresTool: true,
        extractedData: { action: "forget" },
      };
    }

    // 7. TASK CREATION
    if (/\b(create task|add task|new task|remind me to|create a task|add a task|make a task)\b/i.test(lower)) {
      const taskTitle = raw.replace(
        /^.*?(create task|add task|new task|remind me to|create a task|add a task|make a task)\s*(to|for)?\s*/i,
        ""
      );
      return {
        intent: "TASK_CREATE",
        confidence: 0.95,
        requiresGemini: false,
        requiresTool: true,
        extractedData: { title: taskTitle || "New Task" },
      };
    }

    // 8. TASK READ
    if (/\b(show tasks|list tasks|my tasks|what do i have today|view tasks|show my tasks|get tasks)\b/i.test(lower)) {
      return {
        intent: "TASK_READ",
        confidence: 0.95,
        requiresGemini: false,
        requiresTool: true,
      };
    }

    // 9. CALCULATIONS & BASIC MATH
    if (
      /^(\d+[\s\+\-\*\/\%\^]\d+|\d+\s*(plus|minus|times|divided by|multiplied by)\s*\d+|what is \d+[\s\+\-\*\/])/i.test(
        lower
      )
    ) {
      return {
        intent: "CALCULATION",
        confidence: 0.92,
        requiresGemini: false,
        requiresTool: true,
      };
    }

    // 10. DEVICE / AUTOMATION ACTIONS
    if (/\b(turn on|turn off|switch on|switch off|toggle light|lock doors|run automation)\b/i.test(lower)) {
      return {
        intent: "DEVICE_ACTION",
        confidence: 0.9,
        requiresGemini: false,
        requiresTool: true,
        extractedData: { command: lower },
      };
    }

    // 11. COMPLEX REASONING & KNOWLEDGE QUERIES (Trigger Gemini)
    if (
      /\b(explain|why|how does|analyze|code|summarize|compare|write|draft|generate|solve|debug|quantum|history of|opinion|essay|algorithm|step-by-step)\b/i.test(
        lower
      ) ||
      lower.length > 80
    ) {
      return {
        intent: "COMPLEX_REASONING",
        confidence: 0.85,
        requiresGemini: true,
        requiresTool: false,
      };
    }

    // 12. CONVERSATIONAL FALLBACK (Short text without keywords)
    if (lower.split(/\s+/).length <= 6) {
      return {
        intent: "CONVERSATION",
        confidence: 0.75,
        requiresGemini: false,
        requiresTool: false,
      };
    }

    // Default to Complex Reasoning if ambiguous and longer
    return {
      intent: "COMPLEX_REASONING",
      confidence: 0.6,
      requiresGemini: true,
      requiresTool: false,
    };
  }
}
