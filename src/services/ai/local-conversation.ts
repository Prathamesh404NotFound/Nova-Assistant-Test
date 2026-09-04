import { responseCache } from "./response-cache";

// ── Language Detection ──────────────────────────────────────────
const DEVANAGARI_RE = /[\u0900-\u097F]/;

function detectLanguage(text: string): "hindi" | "english" | "mixed" {
  const hasDevanagari = DEVANAGARI_RE.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);
  if (hasDevanagari && hasLatin) return "mixed";
  if (hasDevanagari) return "hindi";
  return "english";
}

// ── Hindi Response Maps ─────────────────────────────────────────

const HINDI_GREETINGS: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/नमस्ते/i, /नमस्कार/i, /हैलो/i, /हेलो/i, /hey\s*nova/i],
    responses: [
      "नमस्ते! मैं Nova हूँ, आपकी AI पर्सनल ऑपरेटिंग सिस्टम। आपकी क्या मदद कर सकती हूँ?",
      "नमस्ते! बताइए, मैं आपकी क्या सेवा कर सकती हूँ?",
      "नमस्ते! Nova आपकी सेवा में हाज़िर है। क्या करना है?",
    ],
  },
  {
    patterns: [/शुभ\s*प्रभात/i, /सुप्रभात/i, /good\s*morning/i],
    responses: [
      "शुभ प्रभात! आज का दिन शानदार होने वाला है। बताइए, क्या करना है?",
      "सुप्रभात! मैं आपके लिए तैयार हूँ। बोलिए!",
      "सुप्रभात! आज के दिन की शुरुआत बहुत अच्छी है। क्या मदद चाहिए?",
    ],
  },
  {
    patterns: [/शुभ\s*रात्रि/i, /good\s*night/i],
    responses: [
      "शुभ रात्रि! अच्छी नींद आए। सुबह मिलते हैं!",
      "शुभ रात्रि! सपने में भी Nova आपके साथ है। 😊",
    ],
  },
  {
    patterns: [/शुभ\s*संध्या/i, /good\s*evening/i],
    responses: [
      "शुभ संध्या! आज का दिन कैसा रहा?",
      "शुभ संध्या! बताइए, क्या काम है?",
    ],
  },
  {
    patterns: [/शुभ\s*दोपहर/i, /good\s*afternoon/i],
    responses: [
      "शुभ दोपहर! खाना खाया या अभी बाकी है?",
      "शुभ दोपहर! बताइए, कैसे मदद करूँ?",
    ],
  },
];

const HINDI_WHO_AM_I: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/तुम्हारा नाम क्या है/i, /आप का नाम क्या है/i, /नाम क्या है/i, /who are you/i, /तुम कौन/i, /आप कौन/i],
    responses: [
      "मैं Nova हूँ — आपकी AI पर्सनल ऑपरेटिंग सिस्टम। मैं काम करती हूँ, सवालों के जवाब देती हूँ, और आपकी ज़िंदगी आसान बनाती हूँ!",
      "मेरा नाम Nova है! मैं एक AI असिस्टेंट हूँ जो आपकी हर मदद कर सकती है।",
    ],
  },
];

const HINDI_HOW_ARE_YOU: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/कैसे हो/i, /कैसे है/i, /क्या हाल है/i, /how are you/i, /कैसी हो/i, /आप कैसे है/i],
    responses: [
      "मैं बिल्कुल ठीक हूँ! 100% क्षमता पर काम कर रही हूँ। आप बताइए, कैसे मदद करूँ?",
      "मैं शानदार हूँ! आपकी सेवा में हमेशा तैयार। बोलिए!",
      "बिल्कुल फ़र्स्ट-क्लास! आप बताइए, क्या काम है?",
    ],
  },
];

const HINDI_THANKS: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/शुक्रिया/i, /धन्यवाद/i, /thank/i, /thanks/i, /मेहरबानी/i],
    responses: [
      "आपका स्वागत है! और कुछ चाहिए तो बताइए।",
      "कोई बात नहीं! हमेशा मदद के लिए तैयार हूँ। 😊",
      "शुक्रिया! ख़ुशी हुई मदद करके।",
    ],
  },
];

const HINDI_BYE: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/अलविदा/i, /बाय/i, /bye/i, /goodbye/i, /फिर मिलते/i, /चलते हैं/i],
    responses: [
      "अलविदा! फिर मिलते हैं। अच्छा रहे आपका दिन!",
      "बाय बाय! जब भी मदद चाहिए, Nova हमेशा यहाँ है।",
    ],
  },
];

const HINDI_HELP: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/मदद करो/i, /help/i, /सहायता/i, /बताओ/i, /क्या कर सकते ho/i],
    responses: [
      "मैं आपकी ये मदद कर सकती हूँ:\n• सवालों के जवाब देना\n• कार्य (tasks) बनाना और देखना\n• यादें सेव करना\n• समय और तारीख बताना\n• कैलेंडर और ईमेल मैनेज करना\n• स्मार्ट होम डिवाइस कंट्रोल करना\n\nबस बोलिए या टाइप करिए!",
      "Nova के पास बहुत सारी सुविधाएँ हैं! टास्क बनाना हो, याद रखना हो, या कोई सवाल हो — बस पूछ लीजिए!",
    ],
  },
];

const HINDI_JOKE: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/joke/i, /हँसाओ/i, /मज़ाक/i, /funny/i],
    responses: [
      "😄 एक प्रोग्रामर अपनी पत्नी से कहता है: 'कृपया दूध ले आओ।' पत्नी: 'कितना?' प्रोग्रामर: 'if (quantity === undefined) throw new Error(\"Specify quantity!\");' 😂",
      "😄 एक डेवलपर की ज़िंदगी: कॉफ़ी → बग फिक्स → नया बग → कॉफ़ी। रिपीट! ☕🐛",
      "😄 प्रोग्रामर: 'मेरा कोड काम क्यों नहीं कर रहा?' Stack Overflow: 'आपने semicolon कहाँ छोड़ा?' 😅",
    ],
  },
];

const HINDI_FEELINGS: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/मैं उदास हूँ/i, /दुखी हूँ/i, /मैं थक गया/i, /bored/i, /tired/i, /sad/i, /frustrated/i],
    responses: [
      "अरे, ऐसा मत सोचो! थोड़ा आराम करो, कोई अच्छा गाना सुनो। मैं हमेशा यहाँ हूँ आपके साथ! 🤗",
      "हर बुरा दिन बीत जाता है। थोड़ा ब्रेक लो, और याद रखो — Nova आपके साथ है!",
    ],
  },
  {
    patterns: [/मैं खुश हूँ/i, /happy/i, /excited/i, /मज़े में/i],
    responses: [
      "बहुत अच्छा! ख़ुशी देखकर मुझे भी अच्छा लगता है! बताइए, क्या करना है?",
      "शानदार! आपकी ख़ुशी में मैं भी शामिल हूँ! 🎉",
    ],
  },
];

// ── Hindi pattern matcher helper ────────────────────────────────
function matchHindiPatterns(
  text: string,
  groups: Array<{ patterns: RegExp[]; responses: string[] }>
): string | null {
  for (const group of groups) {
    for (const pattern of group.patterns) {
      if (pattern.test(text)) {
        const responses = group.responses;
        return responses[Math.floor(Math.random() * responses.length)];
      }
    }
  }
  return null;
}

// ── English Fallback Patterns ───────────────────────────────────

const ENGLISH_PATTERNS: Array<{ patterns: RegExp[]; responses: string[] }> = [
  {
    patterns: [/thank/i, /thanks/i, /thx/i],
    responses: [
      "You're welcome! Let me know if you need anything else.",
      "Happy to help! Anything else I can do for you?",
      "Anytime! That's what Nova is here for. 😊",
    ],
  },
  {
    patterns: [/how are you/i, /how.do you do/i, /how's it going/i, /what's up/i],
    responses: [
      "I'm running at 100% capacity and ready to help! What can I do for you?",
      "All systems operational! How can I assist you today?",
      "I'm great, thanks for asking! Ready to tackle anything.",
    ],
  },
  {
    patterns: [/who are you/i, /what are you/i, /what is your name/i, /your name/i],
    responses: [
      "I am Nova — your AI Personal Operating System. I help with daily tasks, answer questions, manage your calendar, and much more!",
      "I'm Nova, your personal AI assistant! Think of me as your digital co-pilot for life.",
    ],
  },
  {
    patterns: [/good morning/i],
    responses: [
      "Good morning! Ready to tackle today's goals?",
      "Morning! Let's make today productive.",
    ],
  },
  {
    patterns: [/good night/i, /going to sleep/i],
    responses: [
      "Good night! Sleep well and dream big. 🌙",
      "Sweet dreams! I'll be here when you wake up.",
    ],
  },
  {
    patterns: [/good evening/i],
    responses: [
      "Good evening! How was your day?",
      "Evening! How can I help tonight?",
    ],
  },
  {
    patterns: [/good afternoon/i],
    responses: [
      "Good afternoon! What can I help you with?",
      "Afternoon! Hope you're having a great day.",
    ],
  },
  {
    patterns: [/repeat that/i, /say that again/i],
    responses: [
      "Of course — what would you like me to repeat?",
      "Sure, what part did you want me to go over again?",
    ],
  },
  {
    patterns: [/tell me a joke/i, /say something funny/i, /make me laugh/i],
    responses: [
      "Why do programmers prefer dark mode? Because light attracts bugs! 🐛😄",
      "Why did the developer go broke? Because he used up all his cache! 💸😂",
    ],
  },
  {
    patterns: [/^(i'?m|im) (bored|tired|sad|happy|excited|frustrated)/i],
    responses: [
      "I hear you! Whatever you're feeling, I'm here. Want to talk about it, or shall we do something fun?",
      "Thanks for sharing! Want to chat, or would you like me to suggest something to brighten your day?",
    ],
  },
  {
    patterns: [/help me/i, /assist me/i, /can you help/i, /^help$/i],
    responses: [
      "Of course! I can help with:\n• Answering questions\n• Creating and managing tasks\n• Saving notes and memories\n• Time, date, and calculations\n• Calendar and email management\n• Smart home control\n\nJust ask me anything!",
      "I'm here to help! You can ask me questions, set reminders, manage tasks, or just chat. What would you like to do?",
    ],
  },
  {
    patterns: [/^(yes|no|ok|okay|sure|yep|nope|yeah|nah|cool|nice|great|awesome|perfect|theek hai)/i],
    responses: [
      "Got it! Let me know what's next.",
      "Understood! What else can I do for you?",
      "Alright! I'm here whenever you need me.",
    ],
  },
  {
    patterns: [/bye/i, /goodbye/i, /see ya/i, /later/i, /gtg/i],
    responses: [
      "Goodbye! Come back anytime. 😊",
      "See you later! Nova will be here when you need me.",
    ],
  },
];

// ── Main Engine ─────────────────────────────────────────────────

export class LocalConversationEngine {
  static generateResponse(input: string): string {
    const cached = responseCache.get(input, "local");
    if (cached) return cached;

    const lang = detectLanguage(input);
    let response: string;

    // For Hindi, try Hindi-specific patterns first
    if (lang === "hindi" || lang === "mixed") {
      const hindiResponse =
        matchHindiPatterns(input, HINDI_GREETINGS) ||
        matchHindiPatterns(input, HINDI_WHO_AM_I) ||
        matchHindiPatterns(input, HINDI_HOW_ARE_YOU) ||
        matchHindiPatterns(input, HINDI_THANKS) ||
        matchHindiPatterns(input, HINDI_BYE) ||
        matchHindiPatterns(input, HINDI_HELP) ||
        matchHindiPatterns(input, HINDI_JOKE) ||
        matchHindiPatterns(input, HINDI_FEELINGS);

      if (hindiResponse) {
        responseCache.set(input, "local", hindiResponse, "local");
        return hindiResponse;
      }

      // For mixed language, also try English patterns
      if (lang === "mixed") {
        const engResponse = matchHindiPatterns(input, ENGLISH_PATTERNS);
        if (engResponse) {
          responseCache.set(input, "local", engResponse, "local");
          return engResponse;
        }
      }
    }

    // English patterns
    if (lang === "english" || lang === "mixed") {
      const engResponse = matchHindiPatterns(input, ENGLISH_PATTERNS);
      if (engResponse) {
        responseCache.set(input, "local", engResponse, "local");
        return engResponse;
      }
    }

    // Hindi fallback for unmatched Hindi input
    if (lang === "hindi") {
      const fallbacks = [
        "समझ गई! बताइए, और क्या करना है?",
        "ठीक है! आपकी क्या मदद करूँ?",
        "जी, बताइए! मैं सुन रही हूँ।",
        "हाँ जी! क्या काम है?",
      ];
      response = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    } else {
      const fallbacks = [
        "Got it! I'm here whenever you need me.",
        "Understood! Let me know how I can help.",
        "Sure thing! What else can I do for you?",
        "I hear you! Ready for the next thing.",
      ];
      response = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    responseCache.set(input, "local", response, "local");
    return response;
  }
}
