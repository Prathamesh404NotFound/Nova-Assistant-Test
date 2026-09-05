/**
 * Nova AI OS — Emotion-Aware Response Modulation
 *
 * Detects emotional cues in text (frustration, excitement, urgency, sadness)
 * and adjusts response tone, length, and action priority accordingly.
 */

export type Emotion =
  | "neutral"
  | "frustrated"
  | "excited"
  | "urgent"
  | "sad"
  | "angry"
  | "confused"
  | "grateful"
  | "playful";

export interface EmotionDetection {
  primary: Emotion;
  confidence: number;
  secondary?: Emotion;
  urgencyScore: number; // 0-1
}

// ─── Emotion Pattern Signals ───────────────────────────────────────────────

interface EmotionPattern {
  emotion: Emotion;
  patterns: RegExp[];
  weight: number;
}

const EMOTION_PATTERNS: EmotionPattern[] = [
  {
    emotion: "frustrated",
    patterns: [
      /\b(stuck|broken|doesn't work|not working|fail|failing|error|bug)\b/i,
      /\b(annoying|frustrat|irritat)\b/i,
      /\b(still not|haven't|hasn't|can't seem to)\b/i,
      /\b(why won't|how come|what's wrong)\b/i,
      /!!!/,
      /\b(asdf|ugh|argh|smh)\b/i,
    ],
    weight: 0.8,
  },
  {
    emotion: "excited",
    patterns: [
      /\b(amazing|awesome|great|fantastic|wonderful|excellent|perfect)\b/i,
      /\b(yay|woohoo|wow|hurray|brilliant)\b/i,
      /[!]{2,}/,
      /😄|🎉|🔥|❤️|👍/,
      /\b(can't wait|excited|thrilled|love it)\b/i,
    ],
    weight: 0.7,
  },
  {
    emotion: "urgent",
    patterns: [
      /\b(urgent|asap|immediately|right now|emergency|hurry|quick)\b/i,
      /\b(need it now|can't wait|time critical|deadline)\b/i,
      /\b(important|critical|priority|crucial)\b/i,
      /!!!/,
    ],
    weight: 0.9,
  },
  {
    emotion: "sad",
    patterns: [
      /\b(sad|unhappy|depressed|down|upset|crying|tears)\b/i,
      /\b(miss|lonely|alone|heartbroken)\b/i,
      /\b(not feeling|feeling low|feeling bad)\b/i,
      /😢|😞|😔|💔/,
    ],
    weight: 0.75,
  },
  {
    emotion: "angry",
    patterns: [
      /\b(angry|furious|mad|pissed|hate|terrible)\b/i,
      /\b(unacceptable|ridiculous|absurd|incompetent)\b/i,
      /\b(worst|horrible|disgusting)\b/i,
      /😠|😡|🤬/,
    ],
    weight: 0.85,
  },
  {
    emotion: "confused",
    patterns: [
      /\b(confused|don't understand|not sure|what do you mean)\b/i,
      /\b(huh|what|how does|how do|why)\b/i,
      /\b(not clear|unclear|doesn't make sense)\b/i,
      /\?\?+/,
    ],
    weight: 0.6,
  },
  {
    emotion: "grateful",
    patterns: [
      /\b(thank|thanks|thank you|appreciate|grateful)\b/i,
      /\b(helpful|perfect|exactly what|great job)\b/i,
      /🙏|❤️|👍/,
    ],
    weight: 0.65,
  },
  {
    emotion: "playful",
    patterns: [
      /\b(joke|funny|fun|entertain|laugh|haha|lol)\b/i,
      /\b(tell me a|say something|random)\b/i,
      /😄|😂|🤣|😆/,
    ],
    weight: 0.5,
  },
];

// ─── Hindi Emotion Patterns ────────────────────────────────────────────────

const HINDI_EMOTION_PATTERNS: EmotionPattern[] = [
  {
    emotion: "frustrated",
    patterns: [
      /काम नहीं कर रहा/,
      /टूट गया/,
      /गलत है/,
      /परेशान/,
      /क्यों नहीं/,
    ],
    weight: 0.8,
  },
  {
    emotion: "sad",
    patterns: [
      /दुखी|उदास|रो रहा|अकेला|मिस कर/,
    ],
    weight: 0.75,
  },
  {
    emotion: "excited",
    patterns: [
      /बहुत अच्छा|शानदार|जबरदस्त|क्या बात है/,
    ],
    weight: 0.7,
  },
  {
    emotion: "grateful",
    patterns: [
      /धन्यवाद|शुक्रिया|बहुत मदद|अच्छा काम/,
    ],
    weight: 0.65,
  },
];

// ─── Detection ─────────────────────────────────────────────────────────────

/**
 * Detect the emotion in a user message.
 * Uses pattern matching with confidence scoring.
 */
export function detectEmotion(text: string): EmotionDetection {
  const scores = new Map<Emotion, number>();
  let maxUrgency = 0;

  // Check English patterns
  for (const { emotion, patterns, weight } of EMOTION_PATTERNS) {
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(text)) matchCount++;
    }
    if (matchCount > 0) {
      scores.set(emotion, (scores.get(emotion) || 0) + matchCount * weight);
    }
  }

  // Check Hindi patterns
  for (const { emotion, patterns, weight } of HINDI_EMOTION_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        scores.set(emotion, (scores.get(emotion) || 0) + weight);
      }
    }
  }

  // Urgency score
  const urgentPatterns = /\b(urgent|asap|immediately|right now|emergency|hurry|quick|now)\b/i;
  const urgentHindiPattern = /अभी|जल्दी|तुरंत|फौरन/;
  if (urgentPatterns.test(text) || urgentHindiPattern.test(text)) {
    maxUrgency = 0.9;
  }

  // Sort by score
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    return { primary: "neutral", confidence: 0.8, urgencyScore: 0 };
  }

  const [primary, primaryScore] = sorted[0];
  const confidence = Math.min(1, primaryScore / 3); // Normalize

  return {
    primary,
    confidence,
    secondary: sorted.length > 1 ? sorted[1][0] : undefined,
    urgencyScore: maxUrgency,
  };
}

// ─── Response Modulation ───────────────────────────────────────────────────

/**
 * Get a tone prefix to prepend to Nova's response based on detected emotion.
 * Returns empty string for neutral emotion.
 */
export function getEmotionPrefix(detection: EmotionDetection): string {
  if (detection.confidence < 0.3) return "";

  switch (detection.primary) {
    case "frustrated":
      return "I understand this is frustrating. ";
    case "urgent":
      return "On it right away. ";
    case "sad":
      return "I hear you. ";
    case "angry":
      return "I'm sorry about this experience. ";
    case "confused":
      return "Let me clarify. ";
    case "excited":
      return "Great! ";
    case "grateful":
      return "Happy to help! ";
    case "playful":
      return "";
    default:
      return "";
  }
}

/**
 * Get response style guidelines based on detected emotion.
 * Injected into the system prompt for Gemini.
 */
export function getEmotionGuidelines(detection: EmotionDetection): string {
  if (detection.confidence < 0.3) return "";

  const guidelines: string[] = [];

  switch (detection.primary) {
    case "frustrated":
      guidelines.push(
        "The user is frustrated. Be extra patient and empathetic.",
        "Acknowledge their frustration before providing solutions.",
        "Offer concrete, actionable steps to resolve the issue.",
        "Keep response focused and solution-oriented."
      );
      break;
    case "urgent":
      guidelines.push(
        "The user needs help urgently. Be concise and action-oriented.",
        "Skip pleasantries and get straight to the point.",
        "Provide the most important information first."
      );
      break;
    case "sad":
      guidelines.push(
        "The user seems down. Be warm and supportive.",
        "Don't dismiss their feelings. Acknowledge and validate.",
        "Keep the tone gentle and caring."
      );
      break;
    case "angry":
      guidelines.push(
        "The user is upset. Stay calm and professional.",
        "Don't be defensive. Focus on solving the problem.",
        "Acknowledge the issue genuinely."
      );
      break;
    case "confused":
      guidelines.push(
        "The user is confused. Use clear, simple language.",
        "Break down your explanation into steps.",
        "Use examples if helpful."
      );
      break;
    case "excited":
      guidelines.push(
        "Match the user's positive energy.",
        "Be enthusiastic and encouraging."
      );
      break;
    case "grateful":
      guidelines.push(
        "Acknowledge their thanks warmly.",
        "Offer continued assistance."
      );
      break;
    case "playful":
      guidelines.push(
        "Keep the mood light and fun.",
        "Be creative and entertaining."
      );
      break;
    default:
      return "";
  }

  return `\n\nEmotion Response Guidelines:\n${guidelines.map((g) => `- ${g}`).join("\n")}`;
}
