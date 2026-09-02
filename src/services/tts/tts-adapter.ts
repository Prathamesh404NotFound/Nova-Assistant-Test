/**
 * Nova TTS Adapter — Multi-backend text-to-speech service.
 *
 * Backends:
 *   1. Gemini TTS (gemini-3.1-flash-tts-preview) — uses existing Gemini API key
 *   2. HuggingFace Inference API (ai4bharat/indic-parler-tts) — needs HF token
 *   3. Browser SpeechSynthesis — always-available fallback
 *
 * The adapter auto-selects the best available backend and degrades gracefully.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type TTSBackend = "gemini" | "huggingface" | "browser";

export type IndicLanguage =
  | "en"    // English
  | "hi"    // Hindi
  | "mr"    // Marathi
  | "bn"    // Bengali
  | "ta"    // Tamil
  | "te"    // Telugu
  | "kn"    // Kannada
  | "ml"    // Malayalam
  | "gu"    // Gujarati
  | "pa"    // Punjabi
  | "ur"    // Urdu
  | "or"    // Odia
  | "auto"; // Auto-detect

export interface SpeakerProfile {
  id: string;
  name: string;
  gender: "male" | "female" | "neutral";
  language: IndicLanguage;
  description: string;
  /** Parler-TTS voice caption — controls prosody, tone, pace */
  caption: string;
}

export interface TTSConfig {
  backend: TTSBackend;
  language: IndicLanguage;
  speaker: SpeakerProfile;
  speed: number;        // 0.5 – 2.0
  pitch: number;        // 0.5 – 2.0
  expressiveness: number; // 0.0 – 1.0
  audioQuality: "low" | "medium" | "high";
  /** HuggingFace API token (stored in localStorage, never sent to third parties) */
  hfToken: string;
  /** Custom HuggingFace Inference endpoint URL */
  hfEndpoint: string;
  /** Gemini API key */
  geminiKey: string;
}

export interface TTSResult {
  audioBlob: Blob;
  audioUrl: string;
  backend: TTSBackend;
  duration: number; // ms
  textLength: number;
}

export interface TTSState {
  isGenerating: boolean;
  isPlaying: boolean;
  error: string | null;
  lastResult: TTSResult | null;
  progress: number; // 0–100
}

// ─── Default Speakers ───────────────────────────────────────────────────────

export const INDIC_SPEAKERS: SpeakerProfile[] = [
  {
    id: "female-hindi-1",
    name: "Priya",
    gender: "female",
    language: "hi",
    description: "Warm, clear Hindi female voice",
    caption:
      "A young female speaker delivers warm, clear, close-sounding Hindi speech at a moderate pace and pitch. The tone is friendly and approachable.",
  },
  {
    id: "female-hindi-2",
    name: "Ananya",
    gender: "female",
    language: "hi",
    description: "Energetic, bright Hindi female voice",
    caption:
      "An energetic female speaker delivers bright, expressive Hindi speech at a slightly fast pace with varied intonation.",
  },
  {
    id: "male-hindi-1",
    name: "Arjun",
    gender: "male",
    language: "hi",
    description: "Deep, authoritative Hindi male voice",
    caption:
      "A male speaker delivers calm, deep, authoritative Hindi speech at a measured pace with clear enunciation.",
  },
  {
    id: "female-marathi-1",
    name: "Sakshi",
    gender: "female",
    language: "mr",
    description: "Gentle, melodic Marathi female voice",
    caption:
      "A female speaker delivers gentle, melodic Marathi speech at a moderate pace with warm intonation and natural pauses.",
  },
  {
    id: "male-marathi-1",
    name: "Rohan",
    gender: "male",
    language: "mr",
    description: "Steady, clear Marathi male voice",
    caption:
      "A male speaker delivers steady, clear Marathi speech at a measured pace with a confident tone.",
  },
  {
    id: "female-english-1",
    name: "Emma",
    gender: "female",
    language: "en",
    description: "Neutral English female voice",
    caption:
      "A female speaker delivers clear, neutral English speech at a moderate pace with natural prosody and warm tone.",
  },
  {
    id: "male-english-1",
    name: "James",
    gender: "male",
    language: "en",
    description: "Clear, professional English male voice",
    caption:
      "A male speaker delivers clear, professional English speech at a measured pace with precise enunciation.",
  },
  {
    id: "female-bengali-1",
    name: "Riya",
    gender: "female",
    language: "bn",
    description: "Warm Bengali female voice",
    caption:
      "A female speaker delivers warm, clear Bengali speech at a moderate pace with natural melodic intonation.",
  },
  {
    id: "female-tamil-1",
    name: "Kavitha",
    gender: "female",
    language: "ta",
    description: "Clear Tamil female voice",
    caption:
      "A female speaker delivers clear, warm Tamil speech at a moderate pace with natural pronunciation.",
  },
  {
    id: "neutral-auto",
    name: "Auto",
    gender: "neutral",
    language: "auto",
    description: "Automatically matches the input language",
    caption:
      "A speaker delivers clear, natural speech at a moderate pace with warm, friendly tone.",
  },
];

// ─── Config Persistence ─────────────────────────────────────────────────────

const TTS_CONFIG_KEY = "nova_tts_config";

export function loadTTSConfig(): TTSConfig {
  try {
    const raw = localStorage.getItem(TTS_CONFIG_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<TTSConfig>;
      return {
        ...getDefaultConfig(),
        ...saved,
        speaker: saved.speaker
          ? { ...getDefaultConfig().speaker, ...saved.speaker }
          : getDefaultConfig().speaker,
      };
    }
  } catch { /* ignore */ }
  return getDefaultConfig();
}

export function saveTTSConfig(config: TTSConfig): void {
  localStorage.setItem(TTS_CONFIG_KEY, JSON.stringify(config));
}

function getDefaultConfig(): TTSConfig {
  return {
    backend: "browser",
    language: "en",
    speaker: INDIC_SPEAKERS[6], // Emma — English female
    speed: 1.0,
    pitch: 1.0,
    expressiveness: 0.5,
    audioQuality: "medium",
    hfToken: "",
    hfEndpoint: "https://api-inference.huggingface.co/models/ai4bharat/indic-parler-tts",
    geminiKey:
      (import.meta.env.VITE_GEMINI_API_KEY as string) ||
      localStorage.getItem("nova_gemini_key") ||
      "",
  };
}

// ─── Auto-detect best backend ───────────────────────────────────────────────

export function detectBestBackend(config: TTSConfig): TTSBackend {
  // If user has HF token, prefer HuggingFace for Indic languages
  if (config.hfToken && config.language !== "en") return "huggingface";

  // If user has Gemini key, prefer Gemini TTS
  if (config.geminiKey) return "gemini";

  // Fallback to browser
  return "browser";
}

// ─── Backend: Gemini TTS ────────────────────────────────────────────────────

async function generateWithGemini(
  text: string,
  config: TTSConfig
): Promise<TTSResult> {
  const start = Date.now();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${config.geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["audio"],
          speechConfig: {
            languageCode: config.language === "auto" ? "en" : config.language,
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName:
                  config.speaker.gender === "male"
                    ? "Kore"
                    : config.speaker.gender === "female"
                    ? "Puck"
                    : "Charon",
              },
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini TTS failed (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const audioData =
    data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!audioData) throw new Error("No audio data in Gemini response");

  const audioBytes = Uint8Array.from(atob(audioData), (c) =>
    c.charCodeAt(0)
  );
  const audioBlob = new Blob([audioBytes], { type: "audio/wav" });
  const audioUrl = URL.createObjectURL(audioBlob);

  return {
    audioBlob,
    audioUrl,
    backend: "gemini",
    duration: Date.now() - start,
    textLength: text.length,
  };
}

// ─── Backend: HuggingFace Indic Parler TTS ──────────────────────────────────

async function generateWithHuggingFace(
  text: string,
  config: TTSConfig
): Promise<TTSResult> {
  const start = Date.now();

  const response = await fetch(config.hfEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.hfToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: text,
      parameters: {
        // Parler-TTS uses a descriptive caption to control voice characteristics
        description: config.speaker.caption,
        temperature: 0.7 + config.expressiveness * 0.6,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    if (response.status === 503) {
      throw new Error("Model is loading — please wait 30 seconds and try again");
    }
    throw new Error(`HuggingFace TTS failed (${response.status}): ${errBody}`);
  }

  const audioBlob = await response.blob();
  if (audioBlob.size === 0) throw new Error("Empty audio response from HuggingFace");

  const audioUrl = URL.createObjectURL(audioBlob);

  return {
    audioBlob,
    audioUrl,
    backend: "huggingface",
    duration: Date.now() - start,
    textLength: text.length,
  };
}

// ─── Backend: Browser SpeechSynthesis ───────────────────────────────────────

async function generateWithBrowser(
  text: string,
  config: TTSConfig
): Promise<TTSResult> {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    if (!("speechSynthesis" in window)) {
      reject(new Error("SpeechSynthesis not supported in this browser"));
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = config.speed;
    utterance.pitch = config.pitch;
    utterance.lang = config.language === "auto" ? "en-US" : `${config.language}-IN`;

    // Pick a voice matching the language
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = config.language === "auto" ? "en" : config.language;
    const matching = voices.find(
      (v) => v.lang.startsWith(langPrefix) && v.localService
    ) || voices.find((v) => v.lang.startsWith(langPrefix));
    if (matching) utterance.voice = matching;

    utterance.onend = () => {
      // Browser TTS can't produce a blob, so return empty blob as placeholder
      const emptyBlob = new Blob([], { type: "audio/wav" });
      resolve({
        audioBlob: emptyBlob,
        audioUrl: "", // No URL for browser TTS — it played directly
        backend: "browser",
        duration: Date.now() - start,
        textLength: text.length,
      });
    };

    utterance.onerror = (e) => {
      reject(new Error(`Browser TTS error: ${e.error}`));
    };

    window.speechSynthesis.speak(utterance);
  });
}

// ─── Main API ───────────────────────────────────────────────────────────────

/**
 * Generate speech from text using the configured backend.
 * Automatically selects backend if set to "auto".
 */
export async function generateSpeech(
  text: string,
  config: TTSConfig,
  onProgress?: (progress: number) => void
): Promise<TTSResult> {
  if (!text.trim()) throw new Error("No text to synthesize");

  // Resolve backend
  let backend = config.backend;
  if (backend === "browser" && config.language !== "en") {
    // For Indic languages, try HF if available
    backend = detectBestBackend(config);
  }

  onProgress?.(10);

  try {
    switch (backend) {
      case "gemini": {
        onProgress?.(30);
        const result = await generateWithGemini(text, config);
        onProgress?.(100);
        return result;
      }
      case "huggingface": {
        onProgress?.(20);
        const result = await generateWithHuggingFace(text, config);
        onProgress?.(100);
        return result;
      }
      default: {
        onProgress?.(50);
        const result = await generateWithBrowser(text, config);
        onProgress?.(100);
        return result;
      }
    }
  } catch (err) {
    // If primary backend fails, fall back to browser
    if (backend !== "browser") {
      console.warn(`[TTS] ${backend} failed, falling back to browser:`, err);
      onProgress?.(80);
      const result = await generateWithBrowser(text, config);
      onProgress?.(100);
      return result;
    }
    throw err;
  }
}

/**
 * Play an audio URL. Returns a cleanup function.
 */
export function playAudio(url: string): { stop: () => void; audio: HTMLAudioElement } {
  const audio = new Audio(url);
  audio.play().catch(() => {});
  return {
    stop: () => {
      audio.pause();
      audio.currentTime = 0;
    },
    audio,
  };
}

/**
 * Check which backends are available.
 */
export function getAvailableBackends(config: TTSConfig): {
  backend: TTSBackend;
  available: boolean;
  reason: string;
}[] {
  const browserSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  return [
    {
      backend: "gemini",
      available: !!config.geminiKey,
      reason: config.geminiKey ? "Gemini API key configured" : "No Gemini API key",
    },
    {
      backend: "huggingface",
      available: !!config.hfToken,
      reason: config.hfToken ? "HuggingFace token configured" : "No HuggingFace token",
    },
    {
      backend: "browser",
      available: browserSupported,
      reason: browserSupported
        ? "Browser SpeechSynthesis available"
        : "SpeechSynthesis not supported",
    },
  ];
}
