/**
 * LocalConversationEngine — DETERMINISTIC-ONLY fallback.
 *
 * This engine is allowed to answer only clearly deterministic lightweight
 * intents: greetings, thanks, goodbyes, "who are you", simple "how are you",
 * jokes, and bare acknowledgements. It must NEVER answer an arbitrary
 * knowledge/reasoning/coding question.
 *
 * API contract (explicit, never hides "not handled"):
 *   tryGenerateResponse(input) →
 *     { handled: true,  text, category }   — deterministic match
 *     { handled: false, category }         — NO deterministic match
 *
 * The old `generateResponse(input): string` API returned a random generic
 * acknowledgement for ANY unmatched input ("Sure thing! What else can I do
 * for you?") — that was the root cause of Nova answering real questions with
 * canned text. It now throws if called, so any stale caller fails loudly in
 * development instead of silently producing garbage.
 */

// ── Language Detection ──────────────────────────────────────────
const DEVANAGARI_RE = /[\u0900-\u097F]/;

function detectLanguage(text: string): "hindi" | "english" | "mixed" {
  const hasDevanagari = DEVANAGARI_RE.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);
  if (hasDevanagari && hasLatin) return "mixed";
  if (hasDevanagari) return "hindi";
  return "english";
}

export type DeterministicCategory =
  | "greeting" | "thanks" | "goodbye" | "identity" | "wellbeing"
  | "help" | "joke" | "feeling" | "acknowledgement" | "repeat";

export interface DeterministicResult {
  handled: boolean;
  text?: string;
  category?: DeterministicCategory | "unknown";
}

// ── Hindi Response Maps ─────────────────────────────────────────

const HINDI_GREETINGS: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/^नमस्ते[!.।]?$/i, /^नमस्कार[!.।]?$/i, /^हैलो[!.।]?$/i, /^हेलो[!.।]?$/i, /^hey\s*nova[!. ]*$/i],
    responses: [
      "नमस्ते! मैं Nova हूँ, आपकी AI पर्सनल ऑपरेटिंग सिस्टम। आपकी क्या मदद कर सकती हूँ?",
      "नमस्ते! बताइए, मैं आपकी क्या सेवा कर सकती हूँ?",
      "नमस्ते! Nova आपकी सेवा में हाज़िर है। क्या करना है?",
    ],
  },
  {
    patterns: [/^शुभ\s*प्रभात[!.।]?$/i, /^सुप्रभात[!.।]?$/i, /^good\s*morning[!. ]*$/i],
    responses: [
      "शुभ प्रभात! आज का दिन शानदार होने वाला है। बताइए, क्या करना है?",
      "सुप्रभात! मैं आपके लिए तैयार हूँ। बोलिए!",
    ],
  },
  {
    patterns: [/^शुभ\s*रात्रि[!.।]?$/i, /^good\s*night[!. ]*$/i],
    responses: [
      "शुभ रात्रि! अच्छी नींद आए। सुबह मिलते हैं!",
      "शुभ रात्रि! सपने में भी Nova आपके साथ है। 😊",
    ],
  },
  {
    patterns: [/^शुभ\s*संध्या[!.।]?$/i, /^good\s*evening[!. ]*$/i],
    responses: [
      "शुभ संध्या! आज का दिन कैसा रहा?",
      "शुभ संध्या! बताइए, क्या काम है?",
    ],
  },
  {
    patterns: [/^शुभ\s*दोपहर[!.।]?$/i, /^good\s*afternoon[!. ]*$/i],
    responses: [
      "शुभ दोपहर! बताइए, कैसे मदद करूँ?",
    ],
  },
];

const HINDI_WHO_AM_I: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/तुम्हारा नाम क्या है/i, /आप का नाम क्या है/i, /^नाम क्या है[?.!।]*$/i, /^who are you[?.! ]*$/i, /तुम कौन हो/i, /आप कौन हो/i],
    responses: [
      "मैं Nova हूँ — आपकी AI पर्सनल ऑपरेटिंग सिस्टम। मैं काम करती हूँ, सवालों के जवाब देती हूँ, और आपकी ज़िंदगी आसान बनाती हूँ!",
      "मेरा नाम Nova है! मैं एक AI असिस्टेंट हूँ जो आपकी हर मदद कर सकती है।",
    ],
  },
];

const HINDI_HOW_ARE_YOU: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/^(कैसे हो|कैसे हैं आप|क्या हाल है|कैसी हो|आप कैसे हैं)[?.!।]*$/i, /^how are you[?.! ]*$/i],
    responses: [
      "मैं बिल्कुल ठीक हूँ! 100% क्षमता पर काम कर रही हूँ। आप बताइए, कैसे मदद करूँ?",
      "मैं शानदार हूँ! आपकी सेवा में हमेशा तैयार। बोलिए!",
    ],
  },
];

const HINDI_THANKS: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/^(शुक्रिया|धन्यवाद|मेहरबानी|thanks?|thank you|thx)[!. ]*$/i],
    responses: [
      "आपका स्वागत है! और कुछ चाहिए तो बताइए।",
      "कोई बात नहीं! हमेशा मदद के लिए तैयार हूँ। 😊",
    ],
  },
];

const HINDI_BYE: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/^(अलविदा|बाय|goodbye|bye|फिर मिलते हैं)[!. ]*$/i],
    responses: [
      "अलविदा! फिर मिलते हैं। अच्छा रहे आपका दिन!",
      "बाय बाय! जब भी मदद चाहिए, Nova हमेशा यहाँ है।",
    ],
  },
];

const HINDI_HELP: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/^(मदद करो|सहायता|help|मदद)[!. ]*$/i],
    responses: [
      "मैं आपकी ये मदद कर सकती हूँ:\n• सवालों के जवाब देना\n• कार्य (tasks) बनाना और देखना\n• यादें सेव करना\n• समय और तारीख बताना\n• कैलेंडर और ईमेल मैनेज करना\n• स्मार्ट होम डिवाइस कंट्रोल करना\n\nबस बोलिए या टाइप करिए!",
    ],
  },
];

const HINDI_JOKE: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/^(joke सुनाओ|जोक|हँसाओ|मज़ाक|tell me a joke|say something funny|make me laugh)[?.!। ]*$/i],
    responses: [
      "😄 एक प्रोग्रामर अपनी पत्नी से कहता है: 'कृपया दूध ले आओ।' पत्नी: 'कितना?' प्रोग्रामर: 'if (quantity === undefined) throw new Error(\"Specify quantity!\");' 😂",
      "😄 एक डेवलपर की ज़िंदगी: कॉफ़ी → बग फिक्स → नया बग → कॉफ़ी। रिपीट! ☕🐛",
    ],
  },
];

const HINDI_FEELINGS: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/^(मैं उदास हूँ|मैं दुखी हूँ|मैं थक गया|i'?m (bored|tired|sad|frustrated))[!. ]*$/i],
    responses: [
      "अरे, ऐसा मत सोचो! थोड़ा आराम करो, कोई अच्छा गाना सुनो। मैं हमेशा यहाँ हूँ आपके साथ! 🤗",
      "हर बुरा दिन बीत जाता है। थोड़ा ब्रेक लो, और याद रखो — Nova आपके साथ है!",
    ],
  },
  {
    patterns: [/^(मैं खुश हूँ|i'?m (happy|excited))[!. ]*$/i],
    responses: [
      "बहुत अच्छा! ख़ुशी देखकर मुझे भी अच्छा लगता है! बताइए, क्या करना है?",
    ],
  },
];

// ── Hindi pattern matcher helper ────────────────────────────────
function matchPatterns(
  text: string,
  lower: string,
  groups: Array<{ patterns: RegExp[]; responses: string[] }>
): string | null {
  for (const group of groups) {
    for (const pattern of group.patterns) {
      if (pattern.test(text) || pattern.test(lower)) {
        const responses = group.responses;
        return responses[Math.floor(Math.random() * responses.length)];
      }
    }
  }
  return null;
}

// ── English Deterministic Patterns ──────────────────────────────
// All patterns are anchored (^...$) or tightly scoped so that arbitrary
// questions never accidentally match a deterministic intent.

const ENGLISH_PATTERNS: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/^(thanks?|thank you|thx|ty|cheers|appreciate it)[!. ]*$/i],
    responses: [
      "You're welcome! Let me know if you need anything else.",
      "Happy to help! Anything else I can do for you?",
      "Anytime! That's what Nova is here for. 😊",
    ],
  },
  {
    patterns: [/^(how are you|how do you do|how'?s it going|what'?s up)[?.! ]*$/i],
    responses: [
      "I'm running at 100% capacity and ready to help! What can I do for you?",
      "All systems operational! How can I assist you today?",
    ],
  },
  {
    patterns: [/^(who are you|what are you|what is your name|your name)[?.! ]*$/i],
    responses: [
      "I am Nova — your AI Personal Operating System. I help with daily tasks, answer questions, manage your calendar, and much more!",
      "I'm Nova, your personal AI assistant! Think of me as your digital co-pilot for life.",
    ],
  },
  {
    patterns: [/^good (morning|night|evening|afternoon)[!. ]*$/i],
    responses: [
      "Good morning! Ready to tackle today's goals?",
      "Good evening! How can I help tonight?",
    ],
  },
  {
    patterns: [/^(repeat that|say that again)[!. ]*$/i],
    responses: [
      "Of course — what would you like me to repeat?",
      "Sure, what part did you want me to go over again?",
    ],
  },
  {
    patterns: [/^(tell me a joke|say something funny|make me laugh)[?.! ]*$/i],
    responses: [
      "Why do programmers prefer dark mode? Because light attracts bugs! 🐛😄",
      "Why did the developer go broke? Because he used up all his cache! 💸😂",
    ],
  },
  {
    patterns: [/^(help|help me|assist me|can you help me)[?.! ]*$/i],
    responses: [
      "Of course! I can help with:\n• Answering questions\n• Creating and managing tasks\n• Saving notes and memories\n• Time, date, and calculations\n• Calendar and email management\n• Smart home control\n\nJust ask me anything!",
    ],
  },
  {
    patterns: [/^(yes|no|ok|okay|sure|yep|nope|yeah|nah|cool|nice|great|awesome|perfect|theek hai)[!. ]*$/i],
    responses: [
      "Got it! Let me know what's next.",
      "Understood! What else can I do for you?",
      "Alright! I'm here whenever you need me.",
    ],
  },
  {
    patterns: [/^(bye|goodbye|see ya|see you later|later|gtg|good night)[!. ]*$/i],
    responses: [
      "Goodbye! Come back anytime. 😊",
      "See you later! Nova will be here when you need me.",
    ],
  },
  {
    patterns: [/^(hello|hi|hey|howdy|yo|sup|greetings|hiya|namaste)[!. ]*$/i],
    responses: [
      "Hello! How can I help you today?",
      "Hi there! What can I do for you?",
      "Hey! Nova here — what do you need?",
    ],
  },
];

// Map groups to categories for the explicit result contract.
function classifyGroupIndex(index: number): DeterministicCategory {
  const order: DeterministicCategory[] = [
    "thanks", "wellbeing", "identity", "greeting", "repeat",
    "joke", "help", "acknowledgement", "goodbye", "greeting",
  ];
  return order[index] ?? "acknowledgement";
}

// ── Main Engine ─────────────────────────────────────────────────

export class LocalConversationEngine {
  /**
   * Deterministic-only generation. Returns `handled: false` for anything that
   * is not a clear greeting/pleasantry/utility — the real AI pipeline must
   * handle those. NEVER returns a generic filler for unmatched input.
   */
  static tryGenerateResponse(input: string): DeterministicResult {
    const trimmedInput = input.trim();
    if (!trimmedInput) return { handled: false, category: "unknown" };

    const lang = detectLanguage(trimmedInput);
    const lower = trimmedInput.toLowerCase().trim();

    // Hindi deterministic intents
    if (lang === "hindi" || lang === "mixed") {
      const hindiChecks: Array<{ groups: Array<{ patterns: RegExp[]; responses: string[] }>; category: DeterministicCategory }> = [
        { groups: HINDI_GREETINGS, category: "greeting" },
        { groups: HINDI_WHO_AM_I, category: "identity" },
        { groups: HINDI_HOW_ARE_YOU, category: "wellbeing" },
        { groups: HINDI_THANKS, category: "thanks" },
        { groups: HINDI_BYE, category: "goodbye" },
        { groups: HINDI_HELP, category: "help" },
        { groups: HINDI_JOKE, category: "joke" },
        { groups: HINDI_FEELINGS, category: "feeling" },
      ];
      for (const { groups, category } of hindiChecks) {
        const response = matchPatterns(trimmedInput, lower, groups);
        if (response) return { handled: true, text: response, category };
      }
      if (lang === "hindi") {
        // Unmatched Hindi input is NOT deterministic — real AI handles it.
        // (Hindi AI answers are produced by the normal router with the
        // language-matching system prompt.)
        return { handled: false, category: "unknown" };
      }
    }

    // English deterministic intents
    if (lang === "english" || lang === "mixed") {
      for (let i = 0; i < ENGLISH_PATTERNS.length; i++) {
        const group = ENGLISH_PATTERNS[i];
        for (const pattern of group.patterns) {
          if (pattern.test(lower)) {
            const responses = group.responses;
            const text = responses[Math.floor(Math.random() * responses.length)];
            return { handled: true, text, category: classifyGroupIndex(i) };
          }
        }
      }
    }

    // No deterministic match — hand off to the real AI pipeline.
    return { handled: false, category: "unknown" };
  }

  /**
   * @deprecated Legacy string API. Throws to prevent silent canned responses.
   * Use `tryGenerateResponse` instead.
   */
  static generateResponse(_input: string): string {
    throw new Error(
      "LocalConversationEngine.generateResponse was removed — it returned generic canned text for arbitrary questions. Use tryGenerateResponse(input) and handle `handled: false` by continuing to the real AI pipeline."
    );
  }
}
