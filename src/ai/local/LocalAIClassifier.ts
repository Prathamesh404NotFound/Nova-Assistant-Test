/**
 * Nova Local AI — Request Classifier
 * Determines whether a user message should be handled locally or by Gemini.
 * Uses layered heuristics — no heavy model needed.
 */

export type RouteDecision = "local" | "gemini";

// Keywords/patterns that strongly indicate cloud is needed
const CLOUD_STRONG = [
  /\b(search|google|look up|find online|browse|web)\b/i,
  /\b(weather|forecast|temperature outside)\b/i,
  /\b(news|latest|breaking|current events|today.?s)\b/i,
  /\b(stock|price|market|crypto|bitcoin|exchange rate)\b/i,
  /\b(sports|score|game results|world cup|nba|nfl)\b/i,
  /\b(send|email|message|sms|whatsapp|discord)\b/i,
  /\b(book|reserve|order|buy|purchase|schedule meeting)\b/i,
  /\b(translate to|translate this|what does .* mean in)\b/i,
  /\b(upload|download file|file from)\b/i,
  /\b(recipe|ingredients|cook|bake)\b/i,
  /https?:\/\//,
  /\b(live|real.?time|right now|as of today)\b/i,
  /\b(analyze|summarize this document|review this code|debug this)\b/i,
  /\b(generate|create.*image|write.*essay|write.*article)\b/i,
  /\b(step by step|complex|detailed explanation|comprehensive)\b/i,
];

// Keywords/patterns that are clearly local-suitable
const LOCAL_CLEAR = [
  /^(hello|hi|hey|howdy|yo|sup|greetings|good\s*(morning|afternoon|evening|night))$/i,
  /^(thanks?|thank you|thx|ty|cheers|appreciate)$/i,
  /^(bye|goodbye|see ya|later|gotta go|gtg)$/i,
  /^(how are you|how.?s it going|what.?s up|how do you do)$/i,
  /^(what is your name|who are you|what are you)$/i,
  /^(tell me a joke|say something funny|make me laugh)$/i,
  /^(i'?m (bored|tired|sad|happy|excited|frustrated))$/i,
  /^(good morning|good night|good evening|good afternoon)$/i,
  /^(what should i (watch|eat|do|read|listen to))$/i,
  /^(help me|assist me|can you help|help)$/i,
  /^(yes|no|ok|okay|sure|yep|nope|yeah|nah|cool|nice|great|awesome|perfect)$/i,
  /^(remember this|remember that|keep in mind|note that)$/i,
  /^(what time|time is it|what.?s the time|current time|what date|today.?s date)$/i,
  /^(stop|cancel|abort|pause|quiet|shut up|mute)$/i,
];

// Patterns for simple creative/conversational tasks suitable for local
const LOCAL_CREATIVE = [
  /^(rewrite|rephrase|reword|paraphrase)\s/i,
  /^(shorten|make (shorter|more concise|brief))\s/i,
  /^(what do you (think|feel|believe))/i,
  /^(do you (like|prefer|enjoy))/i,
  /^(my (name|favorite|preference))/i,
  /^(i (like|love|hate|prefer|enjoy|want))/i,
];

/**
 * Classify a user message for routing.
 *
 * Returns a decision with a confidence score and reasoning.
 */
export function classifyRequest(
  input: string
): { decision: RouteDecision; confidence: number; reason: string } {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  const wordCount = trimmed.split(/\s+/).length;

  // Layer 1: Strong cloud indicators (highest priority)
  for (const pattern of CLOUD_STRONG) {
    if (pattern.test(trimmed)) {
      return {
        decision: "gemini",
        confidence: 0.95,
        reason: `Cloud-required pattern matched: ${pattern.source}`,
      };
    }
  }

  // Layer 2: Clear local indicators
  for (const pattern of LOCAL_CLEAR) {
    if (pattern.test(trimmed)) {
      return {
        decision: "local",
        confidence: 0.95,
        reason: "Simple conversational pattern",
      };
    }
  }

  // Layer 3: Local creative patterns
  for (const pattern of LOCAL_CREATIVE) {
    if (pattern.test(lower)) {
      return {
        decision: "local",
        confidence: 0.85,
        reason: "Simple creative/conversational task",
      };
    }
  }

  // Layer 4: Length-based heuristic
  if (wordCount <= 5) {
    // Very short messages are almost always conversational
    return {
      decision: "local",
      confidence: 0.8,
      reason: "Short message, likely conversational",
    };
  }

  if (wordCount <= 12) {
    // Medium-length messages — lean local
    return {
      decision: "local",
      confidence: 0.7,
      reason: "Medium-length conversational message",
    };
  }

  // Layer 5: Longer messages — lean cloud for quality
  if (wordCount > 30) {
    return {
      decision: "gemini",
      confidence: 0.75,
      reason: "Longer message, likely needs stronger reasoning",
    };
  }

  // Layer 6: Default — lean local for casual, lean cloud for uncertain longer
  if (wordCount <= 20) {
    return {
      decision: "local",
      confidence: 0.6,
      reason: "Default: medium message routed to local for efficiency",
    };
  }

  return {
    decision: "gemini",
    confidence: 0.6,
    reason: "Default: routed to Gemini for quality",
  };
}

/**
 * Quick check: should this go to local AI?
 */
export function shouldUseLocal(input: string): boolean {
  return classifyRequest(input).decision === "local";
}
