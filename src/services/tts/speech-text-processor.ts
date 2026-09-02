/**
 * Nova TTS — Speech Text Processor
 * Converts Nova's written responses into speech-friendly text.
 * Strips markdown, URLs, code, internal metadata, and emoji.
 */

/** Remove markdown formatting, URLs, code, emoji, internal IDs */
export function processForSpeech(text: string): string {
  if (!text || !text.trim()) return "";

  let t = text;

  // Remove markdown bold/italic
  t = t.replace(/\*{1,3}(.+?)\*{1,3}/g, "$1");
  t = t.replace(/_{1,3}(.+?)_{1,3}/g, "$1");

  // Remove markdown headers
  t = t.replace(/^#{1,6}\s+/gm, "");

  // Remove markdown links — keep text
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Remove raw URLs
  t = t.replace(/https?:\/\/\S+/g, "");

  // Remove code fences
  t = t.replace(/```[\s\S]*?```/g, "code block");
  t = t.replace(/`([^`]+)`/g, "$1");

  // Remove blockquotes
  t = t.replace(/^>\s*/gm, "");

  // Remove emoji
  t = t.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+/gu,
    ""
  );

  // Remove internal IDs and metadata
  t = t.replace(/(?:Event|Task|Memory|File|Email)\s*(?:ID|id):\s*\S+/g, "");
  t = t.replace(/(?:✓|✗|●|☁|⚠️|📅|📧|📁|🔒)\s*/g, "");

  // Remove JSON-like structures (long ones)
  t = t.replace(/\{[^}]{30,}\}/g, "");
  t = t.replace(/\[[^\]]{30,}\]/g, "");

  // Remove tool execution results format
  t = t.replace(/^✓\s+/gm, "");
  t = t.replace(/^✗\s+/gm, "");

  // Normalize newlines
  t = t.replace(/\n{2,}/g, ". ");
  t = t.replace(/\n/g, " ");

  // Collapse whitespace
  t = t.replace(/\s+/g, " ").trim();

  // Add period at end if missing
  if (t && !/[.!?…]$/.test(t)) {
    t += ".";
  }

  return t;
}

/** Convert numbers and special formats to speech-friendly text */
export function normalizeForSpeech(text: string): string {
  if (!text) return text;

  // Time: "3:00 PM" → "3 PM" (Bark handles this fine)
  // Keep as-is for natural reading

  // Remove excessive punctuation
  text = text.replace(/[.]{3,}/g, ".");
  text = text.replace(/[!]{2,}/g, "!");
  text = text.replace(/[?]{2,}/g, "?");

  // Clean up any double spaces from removals
  text = text.replace(/\s{2,}/g, " ").trim();

  return text;
}

/** Full preprocessing pipeline */
export function prepareTextForSpeech(text: string): string {
  let result = processForSpeech(text);
  result = normalizeForSpeech(result);
  return result;
}
