/**
 * Nova AI OS — Adaptive Personality Engine
 *
 * Learns user communication style, formality level, humor preference,
 * and domain expertise from interactions. Nova adapts its tone naturally
 * without the user needing to configure anything.
 */

export interface PersonalityProfile {
  /** 0-1: how formal the user tends to be */
  formality: number;
  /** 0-1: how much humor the user appreciates */
  humorLevel: number;
  /** 0-1: user's apparent technical expertise */
  technicalDepth: number;
  /** Preferred response length: "brief" | "moderate" | "detailed" */
  responseLength: "brief" | "moderate" | "detailed";
  /** Detected language preference */
  primaryLanguage: "english" | "hindi" | "mixed";
  /** Topics the user frequently asks about */
  topTopics: string[];
  /** Total interactions tracked */
  interactionCount: number;
  /** Timestamp of last update */
  lastUpdated: number;
}

const STORAGE_KEY = "nova_personality_profile";
const MAX_TRACKED_TOPICS = 10;

// ─── Heuristic signals ─────────────────────────────────────────────────────

const FORMAL_SIGNALS = [
  /\bplease\b/i,
  /\bcould you\b/i,
  /\bwould you\b/i,
  /\bkindly\b/i,
  /\bthank you\b/i,
  /\bappreciate\b/i,
  /\bregards\b/i,
];

const CASUAL_SIGNALS = [
  /\bhey\b/i,
  /\bhi\b/i,
  /\byo\b/i,
  /\bthanks\b/i,
  /\bcool\b/i,
  /\bnice\b/i,
  /\bwow\b/i,
  /\blol\b/i,
  /\bhaha\b/i,
  /!!+/,
  /\.\.\./,
];

const TECHNICAL_SIGNALS = [
  /\b(api|sdk|function|variable|class|interface|type|async|await)\b/i,
  /\b(debug|compile|build|deploy|refactor|optimize)\b/i,
  /\btypescript|javascript|python|react|node|css|html\b/i,
  /\bbug|error|exception|stack trace|console\b/i,
  /\bdatabase|query|sql|schema|migration\b/i,
];

const HUMOR_SIGNALS = [
  /\bjoke\b/i,
  /\bfunny\b/i,
  /\bfun\b/i,
  /\blol\b/i,
  /\bhaha\b/i,
  /😄|😂|🤣|😆/,
  /\bentertain\b/i,
  /\bmaze\b/i, // Hindi: joke
];

const HINDI_RANGE = /[\u0900-\u097F]/;

function detectLanguagePreference(text: string): "english" | "hindi" | "mixed" {
  const hasDevanagari = HINDI_RANGE.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);
  if (hasDevanagari && hasLatin) return "mixed";
  if (hasDevanagari) return "hindi";
  return "english";
}

function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const lower = text.toLowerCase();

  const topicKeywords: [RegExp, string][] = [
    [/\b(task|todo|to-do|deadline|project)\b/, "tasks"],
    [/\b(meeting|calendar|event|schedule|appointment)\b/, "calendar"],
    [/\b(email|mail|inbox|draft)\b/, "email"],
    [/\b(weather|temperature|rain|forecast)\b/, "weather"],
    [/\b(code|program|develop|debug|api)\b/, "coding"],
    [/\b(remind|memory|remember)\b/, "memory"],
    [/\b(light|ac|device|home|smart)\b/, "smart-home"],
    [/\b(translate|hindi|english|language)\b/, "language"],
    [/\b(search|find|look up|research)\b/, "research"],
    [/\b(play|music|song|video)\b/, "media"],
    [/\b(health|exercise|meditation|sleep)\b/, "health"],
    [/\b(finance|money|budget|expense)\b/, "finance"],
    [/\b(drive|commute|traffic|route)\b/, "navigation"],
  ];

  for (const [pattern, topic] of topicKeywords) {
    if (pattern.test(lower)) topics.push(topic);
  }

  return topics;
}

// ─── Profile Management ────────────────────────────────────────────────────

function loadProfile(): PersonalityProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return createDefaultProfile();
}

function saveProfile(profile: PersonalityProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch { /* ignore */ }
}

function createDefaultProfile(): PersonalityProfile {
  return {
    formality: 0.5,
    humorLevel: 0.3,
    technicalDepth: 0.5,
    responseLength: "moderate",
    primaryLanguage: "english",
    topTopics: [],
    interactionCount: 0,
    lastUpdated: Date.now(),
  };
}

// ─── Learning ──────────────────────────────────────────────────────────────

/**
 * Update the personality profile based on a user message.
 * Call this on every user input to incrementally learn.
 */
export function learnFromMessage(text: string): void {
  const profile = loadProfile();
  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).length;

  // Formality detection
  const formalScore = FORMAL_SIGNALS.filter((r) => r.test(text)).length / FORMAL_SIGNALS.length;
  const casualScore = CASUAL_SIGNALS.filter((r) => r.test(text)).length / CASUAL_SIGNALS.length;
  const formalityDelta = (formalScore - casualScore) * 0.15;
  profile.formality = Math.max(0, Math.min(1, profile.formality + formalityDelta));

  // Humor detection
  const hasHumor = HUMOR_SIGNALS.some((r) => r.test(text));
  if (hasHumor) {
    profile.humorLevel = Math.min(1, profile.humorLevel + 0.05);
  }

  // Technical depth detection
  const techSignals = TECHNICAL_SIGNALS.filter((r) => r.test(text)).length;
  if (techSignals > 0) {
    profile.technicalDepth = Math.min(1, profile.technicalDepth + 0.05 * techSignals);
  } else if (wordCount < 8) {
    // Simple questions suggest lower technical depth preference
    profile.technicalDepth = Math.max(0.1, profile.technicalDepth - 0.01);
  }

  // Response length preference (based on question complexity)
  if (wordCount <= 5) {
    profile.responseLength = "brief";
  } else if (wordCount >= 15) {
    profile.responseLength = "detailed";
  }

  // Language preference
  const lang = detectLanguagePreference(text);
  if (lang !== "english") {
    profile.primaryLanguage = lang;
  }

  // Topic tracking
  const newTopics = extractTopics(text);
  for (const topic of newTopics) {
    if (!profile.topTopics.includes(topic)) {
      profile.topTopics.push(topic);
    }
  }
  // Keep only most recent topics
  if (profile.topTopics.length > MAX_TRACKED_TOPICS) {
    profile.topTopics = profile.topTopics.slice(-MAX_TRACKED_TOPICS);
  }

  profile.interactionCount++;
  profile.lastUpdated = Date.now();
  saveProfile(profile);
}

/**
 * Get the current personality profile.
 */
export function getPersonalityProfile(): PersonalityProfile {
  return loadProfile();
}

/**
 * Build a personality-aware system prompt suffix.
 * Injected into the Gemini system prompt to personalize responses.
 */
export function buildPersonalityPromptSuffix(): string {
  const profile = loadProfile();
  if (profile.interactionCount < 3) return "";

  const traits: string[] = [];

  // Formality
  if (profile.formality > 0.7) {
    traits.push("Use formal, professional language");
  } else if (profile.formality < 0.3) {
    traits.push("Use casual, friendly language");
  }

  // Humor
  if (profile.humorLevel > 0.6) {
    traits.push("Include light humor when appropriate");
  }

  // Technical depth
  if (profile.technicalDepth > 0.7) {
    traits.push("Provide detailed technical explanations");
  } else if (profile.technicalDepth < 0.3) {
    traits.push("Keep explanations simple and non-technical");
  }

  // Response length
  if (profile.responseLength === "brief") {
    traits.push("Keep responses short and concise (1-2 sentences)");
  } else if (profile.responseLength === "detailed") {
    traits.push("Provide thorough, detailed responses");
  }

  // Language
  if (profile.primaryLanguage === "hindi") {
    traits.push("Prefer responding in Hindi");
  } else if (profile.primaryLanguage === "mixed") {
    traits.push("Can mix English and Hindi naturally");
  }

  if (traits.length === 0) return "";

  return `\n\nPersonality Adaptation (based on ${profile.interactionCount} interactions):\n${traits.map((t) => `- ${t}`).join("\n")}`;
}

/**
 * Reset the personality profile.
 */
export function resetPersonality(): void {
  saveProfile(createDefaultProfile());
}
