/**
 * Nova AI OS — Intent Router
 * Classifies user input into actionable intents.
 * Routes to tools, LLM, or handles locally.
 */

import { IntentResult, type Intent } from "./types";

/**
 * Intent categories for classification.
 */
export type IntentCategory =
  | "TOOL_EXECUTION"     // Smart home, device control, automations
  | "KNOWLEDGE_QUERY"    // Questions, explanations, reasoning
  | "TASK_MANAGEMENT"    // Tasks, reminders, to-dos
  | "CONVERSATION"       // Casual chat, greetings
  | "NAVIGATION"         // App navigation
  | "MEMORY_OPERATION"   // Remember/forget
  | "UTILITY";           // Time, date, calculations

export interface ClassifiedIntent extends IntentResult {
  category: IntentCategory;
  /** Extracted entities from the input */
  entities?: {
    action?: string;
    target?: string;
    content?: string;
    title?: string;
    datetime?: string;
  };
}

// ── Hindi / Mixed-Language Helpers ───────────────────────────────
// Detect if input contains Devanagari (Hindi) characters using actual Unicode chars
const DEVANAGARI_RE = /[\u0900-\u097F]/u;
function hasDevanagari(text: string): boolean {
  return DEVANAGARI_RE.test(text);
}

// Transliterate common Hindi phrases to English for pattern matching.
// Uses actual Devanagari characters for reliable matching.
const HI_MAP: [RegExp, string][] = [
  // Time / Date
  [/समय क्या है/g, "time is it"],
  [/(?:आज|आज के) मौसम कैसा है/g, "what is the weather today"],
  [/(?:आज की|आज का) तारीख है/g, "what date is it today"],
  [/(?:अभी|आज) दिन हो/g, "date today"],
  // Greetings
  [/(?:नमस्ते|नमस्कार|हैलो|हेलो)/g, "hello"],
  [/शुभ प्रभात/g, "good morning"],
  [/(?:शुभ रात|शुभ रात्रि)/g, "good night"],
  [/(?:कैसे है|आप कैसे है)/g, "how are you"],
  [/शुक्रिया|धन्यवाद/g, "thank you"],
  [/(?:तो|मैं)/g, "bye"],
  // Tasks
  [/(?:कार्य बनाओ|काम जोड़ो|नया कार्य|कार्य बनाएं)/g, "create task"],
  [/(?:कार्य दिखाओ|काम दिखाओ|मेरे कार्य|मेरे काम)/g, "show tasks"],
  [/(?:याद रखो|याद रखना|इसे याद रखो)/g, "remember that"],
  // Navigation
  [/(?:खोलो|जाओ|खोलों|खोले में)/g, "open"],
];

/**
 * Normalize input by transliterating Hindi to English equivalents.
 * Preserves original meaning for pattern matching.
 */
function normalizeForRouting(input: string): string {
  let result = input;
  for (const [pattern, replacement] of HI_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Detect the primary language of input.
 */
export type InputLanguage = "english" | "hindi" | "mixed";
export function detectLanguage(input: string): InputLanguage {
  if (!hasDevanagari(input)) return "english";
  const devanagariCount = (input.match(/[\u0900-\u097F]/gu) || []).length;
  const latinCount = (input.match(/[a-zA-Z]/g) || []).length;
  if (devanagariCount > 0 && latinCount > 0) return "mixed";
  return "hindi";
}

export class IntentRouter {
  /**
   * Classify user input and return actionable intent.
   */
  static classify(input: string): ClassifiedIntent {
    const raw = input.trim();
    const lower = raw.toLowerCase();

    // 1. EMERGENCY / STOP / CANCEL COMMANDS
    if (/^(stop|cancel|abort|pause|quiet|shut up|mute)$/i.test(lower)) {
      return {
        intent: "DEVICE_ACTION",
        category: "TOOL_EXECUTION",
        confidence: 0.99,
        requiresGemini: false,
        requiresTool: true,
        extractedData: { action: "stop" },
        entities: { action: "stop" },
      };
    }

    // 2. GREETINGS & SIMPLE GREETING ALIASES (English + Hindi)
    // Use Set for O(1) lookup instead of Array.includes
    const GREETINGS_SET = new Set([
      "hello", "hi", "hey", "hey nova", "hello nova", "hi nova",
      "good morning", "good night", "good evening", "good afternoon",
      "how are you", "how are you doing", "what is your name", "who are you",
      "thank you", "thanks", "bye", "goodbye", "are you there", "repeat that",
      "namaste", "namaskar", "kaise ho", "kaise hai",
      "kya hal hai", "tumhara naam kya hai", "aap kaun hai",
      "shukriya", "dhanyavaad", "alvida", "theek hai",
      "subah ki namaskar",
    ]);

    // Hindi greeting patterns (use literal Devanagari characters)
    const hindiGreetingPatterns = [
      /^(?:नमस्ते|नमस्कार|हैलो|हेलो)/i,
      /^(?:कैसे हो|कैसे है|क्या हाल है)/i,
      /^(?:तुम्हारा नाम क्या है|आप कौन है)/i,
      /^(?:शुभ प्रभात|सुप्रभात)/i,
      /^(?:शुभ रात्रि)/i,
      /^(?:शुक्रिया|धन्यवाद)/i,
      /^(?:अलविदा|बाय)/i,
      /^(?:मदद करो|मेरी मदद करो)/i,
      /^(?:मैं उदास हूँ|मैं खुश हूँ|मैं थक गया)/i,
      /^(?:मज़ाक|joke)/i,
    ];

    const normalizedLower = normalizeForRouting(raw).toLowerCase();
    if (
      GREETINGS_SET.has(lower) ||
      GREETINGS_SET.has(normalizedLower) ||
      /^hey nova|^hello nova|^hi nova/i.test(lower) ||
      hindiGreetingPatterns.some((p) => p.test(raw)) ||
      hindiGreetingPatterns.some((p) => p.test(normalizedLower))
    ) {
      return {
        intent: "GREETING",
        category: "CONVERSATION",
        confidence: 0.98,
        requiresGemini: false,
        requiresTool: false,
      };
    }

    // 3. TIME & DATE (English + Hindi)
    if (/\b(what time|time is it|current time|what's the time|check time|clock)\b/i.test(lower) ||
        /\b(समय क्या है|वर्तमान समय|समय बताओ|अभी कितने बजे)/i.test(raw)) {
      return {
        intent: "TIME",
        category: "UTILITY",
        confidence: 0.98,
        requiresGemini: false,
        requiresTool: true,
        entities: { action: "get_time" },
      };
    }
    if (/\b(what date|today's date|current date|what day is it|what is today's date|today date)\b/i.test(lower) ||
        /\b(आज की तारीख|तारीख क्या है|आज क्या दिन है|आज का दिन)/i.test(raw)) {
      return {
        intent: "DATE",
        category: "UTILITY",
        confidence: 0.98,
        requiresGemini: false,
        requiresTool: true,
        entities: { action: "get_date" },
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
        category: "NAVIGATION",
        confidence: 0.95,
        requiresGemini: false,
        requiresTool: true,
        extractedData: { target: page },
        entities: { target: page, action: "navigate" },
      };
    }

    // 5. MEMORY WRITE COMMANDS (English + Hindi)
    if (/\b(remember that|remember this|keep in mind|note that|save this memory|memorize that)\b/i.test(lower) ||
        /\b(याद रखो|याद रखना|यह याद रखो|नोट करो|इसे याद रखो|याद रखे)/i.test(raw)) {
      const content = raw.replace(/^.*?(remember that|remember this|keep in mind|note that|save this memory|memorize that|याद रखो|याद रखना|यह याद रखो|नोट करो|इसे याद रखो|याद रखे)\s*/i, "");
      return {
        intent: "MEMORY_WRITE",
        category: "MEMORY_OPERATION",
        confidence: 0.95,
        requiresGemini: false,
        requiresTool: true,
        extractedData: { content: content || raw },
        entities: { content: content || raw, action: "remember" },
      };
    }

    // 6. MEMORY READ / FORGET COMMANDS (English + Hindi)
    if (/\b(what do you remember|show memories|my memories|what is my preference|list memories)\b/i.test(lower) ||
        /\b(क्या याद है|मेरी यादें|मेरी यादें दिखाओ|प्राथमिकता क्या है)/i.test(raw)) {
      return {
        intent: "MEMORY_READ",
        category: "MEMORY_OPERATION",
        confidence: 0.92,
        requiresGemini: false,
        requiresTool: true,
        entities: { action: "recall" },
      };
    }
    if (/\b(forget this|forget memory|clear memory|erase memory)\b/i.test(lower) ||
        /\b(भूल जाओ|यादें मिटाओ|साफ़ करो|हटाओ)/i.test(raw)) {
      return {
        intent: "MEMORY_READ",
        category: "MEMORY_OPERATION",
        confidence: 0.9,
        requiresGemini: false,
        requiresTool: true,
        extractedData: { action: "forget" },
        entities: { action: "forget" },
      };
    }

    // 7. TASK CREATION (English + Hindi)
    if (/\b(create task|add task|new task|remind me to|create a task|add a task|make a task|set a reminder|set reminder)\b/i.test(lower) ||
        /\b(कार्य बनाओ|काम जोड़ो|नया कार्य|कार्य बनाएं|काम बनाओ|कार्य करो)/i.test(raw)) {
      const taskTitle = raw.replace(
        /^.*?(create task|add task|new task|remind me to|create a task|add a task|make a task|set a? ?reminder|कार्य बनाओ|काम जोड़ो|नया कार्य|कार्य बनाएं|काम बनाओ|कार्य करो)\s*(to|for)?\s*/i,
        ""
      );
      return {
        intent: "TASK_CREATE",
        category: "TASK_MANAGEMENT",
        confidence: 0.95,
        requiresGemini: false,
        requiresTool: true,
        extractedData: { title: taskTitle || "New Task" },
        entities: { title: taskTitle || "New Task", action: "create" },
      };
    }

    // 7b. TASK COMPLETION (English + Hindi)
    if (/\b(complete task|finish task|mark done|task done|done with|finished with|mark as done|mark complete)\b/i.test(lower) ||
        /\b(कार्य पूरा|काम पूरा|कार्य समाप्त|काम समाप्त|पूरा करो)/i.test(raw)) {
      const taskRef = raw.replace(
        /^.*?(complete task|finish task|mark done|task done|done with|finished with|mark as done|mark complete|कार्य पूरा|काम पूरा|कार्य समाप्त|काम समाप्त|पूरा करो)\s*/i,
        ""
      );
      return {
        intent: "TASK_UPDATE",
        category: "TASK_MANAGEMENT",
        confidence: 0.92,
        requiresGemini: false,
        requiresTool: true,
        extractedData: { title: taskRef || "", action: "complete" },
        entities: { title: taskRef, action: "complete" },
      };
    }

    // 8. TASK READ (English + Hindi)
    if (/\b(show tasks|list tasks|my tasks|what do i have today|view tasks|show my tasks|get tasks)\b/i.test(lower) ||
        /\b(कार्य दिखाओ|काम दिखाओ|मेरे कार्य|मेरे काम)/i.test(raw)) {
      return {
        intent: "TASK_READ",
        category: "TASK_MANAGEMENT",
        confidence: 0.95,
        requiresGemini: false,
        requiresTool: true,
        entities: { action: "list" },
      };
    }

    // 9. CALCULATIONS & BASIC MATH
    if (
      /^(\d+[\s\+\-\*\/\%\^]\d+|\d+\s*(plus|minus|times|divided by|multiplied by)\s*\d+|what is \d+[\s\+\-\*\/]|calculate|compute)/i.test(
        lower
      )
    ) {
      return {
        intent: "CALCULATION",
        category: "UTILITY",
        confidence: 0.92,
        requiresGemini: false,
        requiresTool: true,
        entities: { action: "calculate", content: raw },
      };
    }

    // 9b. TYPING / TEXT SPEED
    if (/\b(what(?:'s| is) my (?:typing )?speed|words per minute|wpm|typing speed|how fast do i type)\b/i.test(lower)) {
      return {
        intent: "TIME",
        category: "UTILITY",
        confidence: 0.9,
        requiresGemini: false,
        requiresTool: false,
        entities: { action: "typing_speed" },
      };
    }

    // 10. DEVICE / AUTOMATION ACTIONS (English + Hindi)
    if (/\b(turn on|turn off|switch on|switch off|toggle light|lock doors|run automation)\b/i.test(lower) ||
        /\b(चालू करो|बंद करो|लाइट चालू|लाइट बंद|दरवाज़ा बंद|ऑटोमेशन चलाओ)/i.test(raw)) {
      const actionMatch = lower.match(/\b(turn on|turn off|switch on|switch off|toggle|lock|unlock|run)\b/i);
      const targetMatch = lower.match(/\b(light|lights|door|doors|thermostat|fan|camera|lock|automation)\b/i);
      return {
        intent: "DEVICE_ACTION",
        category: "TOOL_EXECUTION",
        confidence: 0.9,
        requiresGemini: false,
        requiresTool: true,
        extractedData: { command: lower },
        entities: {
          action: actionMatch?.[1] || "toggle",
          target: targetMatch?.[1] || "device",
        },
      };
    }

    // 11. WEB SEARCH / CURRENT INFORMATION (requires Gemini, English + Hindi)
    if (/\b(search|look up|find|google|what happened|latest news|current|today|weather|stock|price)\b/i.test(lower) ||
        /\b(खोजो|सर्च|गूगल|ताज़ा खबर|मौसम|शेयर|कीमत|क्या हुआ)/i.test(raw) ||
        /\b(मौसम कैसा है|आज का मौसम|तापमान क्या है)/i.test(raw)) {
      return {
        intent: "KNOWLEDGE_QUERY",
        category: "KNOWLEDGE_QUERY",
        confidence: 0.88,
        requiresGemini: true,
        requiresTool: false,
        entities: { action: "search", content: raw },
      };
    }

    // 12. COMPLEX REASONING & KNOWLEDGE QUERIES (requires Gemini, English + Hindi)
    if (
      /\b(explain|why|how does|analyze|code|summarize|compare|write|draft|generate|solve|debug|quantum|history of|opinion|essay|algorithm|step-by-step)\b/i.test(
        lower
      ) ||
      /\b(समझाओ|क्यों|कैसे काम करता है|विश्लेषण|कोड|संक्षेप|तुलना|लिखो|बनाओ|हल|समस्या)/i.test(raw) ||
      /\b(क्वांटम|इतिहास|राय|निबंध|एल्गोरिदम|विस्तार से)/i.test(raw) ||
      lower.length > 80
    ) {
      return {
        intent: "COMPLEX_REASONING",
        category: "KNOWLEDGE_QUERY",
        confidence: 0.85,
        requiresGemini: true,
        requiresTool: false,
        entities: { action: "reason", content: raw },
      };
    }

    // 13. COMMAND-LIKE PHRASES (short imperative that maps to a tool)
    if (/\b(switch to|change to|set mode|ai mode|local mode|gemini mode|auto mode)\b/i.test(lower)) {
      return {
        intent: "NAVIGATION",
        category: "NAVIGATION",
        confidence: 0.88,
        requiresGemini: false,
        requiresTool: true,
        entities: { target: lower.includes("local") ? "settings" : lower.includes("gemini") ? "settings" : "settings", action: "mode_switch" },
      };
    }

    // 14. CONVERSATIONAL FALLBACK (Short text without keywords)
    if (lower.split(/\s+/).length <= 6) {
      return {
        intent: "CONVERSATION",
        category: "CONVERSATION",
        confidence: 0.75,
        requiresGemini: false,
        requiresTool: false,
      };
    }

    // Default to Complex Reasoning if ambiguous and longer
    return {
      intent: "COMPLEX_REASONING",
      category: "KNOWLEDGE_QUERY",
      confidence: 0.6,
      requiresGemini: true,
      requiresTool: false,
      entities: { content: raw },
    };
  }
}
