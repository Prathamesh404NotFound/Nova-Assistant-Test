/**
 * Nova Local AI — Settings
 * Manages the user's AI mode preference (Auto/Local/Gemini).
 */

export type AIMode = "auto" | "local" | "gemini";

const AI_MODE_KEY = "nova_ai_mode";
const DEFAULT_MODE: AIMode = "auto";

export function getAIMode(): AIMode {
  try {
    const stored = localStorage.getItem(AI_MODE_KEY);
    if (stored === "auto" || stored === "local" || stored === "gemini") {
      return stored;
    }
  } catch { /* ignore */ }
  return DEFAULT_MODE;
}

export function setAIMode(mode: AIMode): void {
  try {
    localStorage.setItem(AI_MODE_KEY, mode);
  } catch { /* ignore */ }
}
