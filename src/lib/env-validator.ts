/**
 * Nova AI OS — Environment Validator
 * Validates required environment variables at startup.
 * Shows warnings for missing keys instead of blocking the app.
 */

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

const REQUIRED_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
] as const;

const RECOMMENDED_KEYS = [
  "VITE_GEMINI_API_KEY",
  "VITE_FIREBASE_DATABASE_URL",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

/**
 * Check if a key has a real value (not demo/placeholder).
 */
function hasRealValue(key: string): boolean {
  const value = import.meta.env[key] as string | undefined;
  if (!value) return false;
  // Check for common demo/placeholder values
  if (value.includes("Demo") || value.includes("demo")) return false;
  if (value.length < 10) return false;
  return true;
}

/**
 * Validate all environment variables.
 */
export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required keys
  for (const key of REQUIRED_KEYS) {
    if (!hasRealValue(key)) {
      missing.push(key);
    }
  }

  // Check recommended keys
  for (const key of RECOMMENDED_KEYS) {
    if (!hasRealValue(key)) {
      warnings.push(key);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Get user-friendly error message for missing keys.
 */
export function getEnvErrorMessage(result: EnvValidationResult): string {
  if (result.valid) return "";

  const lines = [
    "Nova AI OS is missing required configuration.",
    "",
    "Please add these environment variables:",
    "",
  ];

  for (const key of result.missing) {
    const friendlyName = key
      .replace("VITE_", "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    lines.push(`• ${friendlyName} (${key})`);
  }

  lines.push("");
  lines.push("Get Firebase credentials from: https://console.firebase.google.com");

  return lines.join("\n");
}

/**
 * Check if Firebase is configured.
 */
export function isFirebaseConfigured(): boolean {
  return hasRealValue("VITE_FIREBASE_API_KEY") && 
         hasRealValue("VITE_FIREBASE_AUTH_DOMAIN") && 
         hasRealValue("VITE_FIREBASE_PROJECT_ID");
}

/**
 * Check if Gemini is configured.
 */
export function isGeminiConfigured(): boolean {
  return hasRealValue("VITE_GEMINI_API_KEY");
}

/**
 * Check if voice APIs are configured.
 */
export function isVoiceConfigured(): boolean {
  return hasRealValue("VITE_ELEVENLABS_API_KEY") || hasRealValue("VITE_DEEPGRAM_API_KEY");
}
