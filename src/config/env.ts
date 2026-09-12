/**
 * Nova Central Environment Configuration
 * Single authoritative source for environment variables.
 * All modules should import from here instead of reading import.meta.env directly.
 */

// ── Raw values ──────────────────────────────────────────────────────────────

const raw = {
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY as string | undefined,
  firebaseApiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  firebaseAuthDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  firebaseDatabaseUrl: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
  firebaseStorageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  firebaseMessagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  firebaseAppId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

// ── Validation helpers ──────────────────────────────────────────────────────

const PLACEHOLDER_PATTERNS = [
  /^my[_-]/i,
  /^your[_-]/i,
  /^xxx+$/i,
  /^changeme/i,
  /^placeholder/i,
  /^demo/i,
  /^example/i,
  /^<.*>$/,
  /^\{.*\}$/,
];

function isMissing(value: string | undefined | null): boolean {
  return !value || value.trim().length === 0;
}

function isPlaceholder(value: string | undefined | null): boolean {
  if (isMissing(value)) return false;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(value!.trim()));
}

function looksReal(value: string | undefined, minLength = 10): boolean {
  return !isMissing(value) && !isPlaceholder(value) && value!.trim().length >= minLength;
}

// ── Config state ────────────────────────────────────────────────────────────

export type EnvStatus = "ok" | "missing" | "placeholder" | "invalid";

export interface EnvEntry {
  name: string;
  status: EnvStatus;
  /** Human-readable problem description (only set when status !== "ok"). */
  problem?: string;
}

export interface EnvConfig {
  /** Resolved Gemini API key — empty string when unavailable. */
  geminiApiKey: string;
  /** Gemini key availability status. */
  gemini: EnvEntry;

  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    databaseURL: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  /** True when all required Firebase values are present and look real. */
  firebaseReady: boolean;
  firebaseEntries: EnvEntry[];
}

function evaluate(name: string, value: string | undefined, minLength = 10): EnvEntry {
  if (isMissing(value)) {
    return { name, status: "missing", problem: "Not set in environment" };
  }
  if (isPlaceholder(value)) {
    return { name, status: "placeholder", problem: "Value is still a placeholder" };
  }
  if (value!.trim().length < minLength) {
    return { name, status: "invalid", problem: `Value too short (min ${minLength} chars)` };
  }
  return { name, status: "ok" };
}

const geminiEntry = evaluate("VITE_GEMINI_API_KEY", raw.geminiApiKey, 20);

const firebaseKeys: Array<{ key: keyof typeof raw; name: string; min: number }> = [
  { key: "firebaseApiKey", name: "VITE_FIREBASE_API_KEY", min: 20 },
  { key: "firebaseAuthDomain", name: "VITE_FIREBASE_AUTH_DOMAIN", min: 8 },
  { key: "firebaseProjectId", name: "VITE_FIREBASE_PROJECT_ID", min: 4 },
  { key: "firebaseDatabaseUrl", name: "VITE_FIREBASE_DATABASE_URL", min: 12 },
  { key: "firebaseStorageBucket", name: "VITE_FIREBASE_STORAGE_BUCKET", min: 6 },
  { key: "firebaseMessagingSenderId", name: "VITE_FIREBASE_MESSAGING_SENDER_ID", min: 6 },
  { key: "firebaseAppId", name: "VITE_FIREBASE_APP_ID", min: 10 },
];

const firebaseEntries: EnvEntry[] = firebaseKeys.map(({ key, name, min }) =>
  evaluate(name, raw[key], min)
);

const firebaseReady = firebaseEntries.every((e) => e.status === "ok");

export const env: EnvConfig = {
  geminiApiKey: geminiEntry.status === "ok" ? raw.geminiApiKey!.trim() : "",
  gemini: geminiEntry,

  firebase: {
    apiKey: raw.firebaseApiKey?.trim() ?? "",
    authDomain: raw.firebaseAuthDomain?.trim() ?? "",
    projectId: raw.firebaseProjectId?.trim() ?? "",
    databaseURL: raw.firebaseDatabaseUrl?.trim() ?? "",
    storageBucket: raw.firebaseStorageBucket?.trim() ?? "",
    messagingSenderId: raw.firebaseMessagingSenderId?.trim() ?? "",
    appId: raw.firebaseAppId?.trim() ?? "",
  },
  firebaseReady,
  firebaseEntries,
};

/**
 * Human-readable summary of what is configured and what is missing.
 * Safe to display in Settings UI — contains no secret values.
 */
export function getEnvSummary(): { service: string; ok: boolean; detail: string }[] {
  return [
    {
      service: "Gemini",
      ok: geminiEntry.status === "ok",
      detail:
        geminiEntry.status === "ok"
          ? "Connected"
          : geminiEntry.status === "placeholder"
          ? "API key is a placeholder — set a real key"
          : "Missing — set VITE_GEMINI_API_KEY",
    },
    {
      service: "Firebase",
      ok: firebaseReady,
      detail: firebaseReady
        ? "Connected"
        : `Not configured — missing: ${firebaseEntries
            .filter((e) => e.status !== "ok")
            .map((e) => e.name)
            .join(", ")}`,
    },
  ];
}

/** Dev-only console diagnostics — never logs secret values. */
if (import.meta.env.DEV) {
  const problems = [
    ...(geminiEntry.status !== "ok"
      ? [`Gemini: ${geminiEntry.problem}`]
      : []),
    ...firebaseEntries
      .filter((e) => e.status !== "ok")
      .map((e) => `${e.name}: ${e.problem}`),
  ];
  if (problems.length > 0) {
    console.info("[Nova Env] Configuration issues (dev only):\n  " + problems.join("\n  "));
  }
}
