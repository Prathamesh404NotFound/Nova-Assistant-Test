/**
 * Nova Bark TTS — Voice Presets
 * These are actual Bark voice presets (history prompts) from suno/bark.
 * See: https://huggingface.co/suno/bark#voice-prompts
 */

export interface BarkVoicePreset {
  id: string;
  name: string;
  description: string;
  /** Bark history prompt key (v2/*) */
  historyPrompt: string;
  /** Best-suited language */
  language: string;
}

/**
 * Bark supports these voice presets via history prompts.
 * Format: "v2/{speaker_name}_{language}"
 * Available speakers: bark_multispeaker (sample speaker set)
 */
export const BARK_VOICE_PRESETS: BarkVoicePreset[] = [
  {
    id: "nova-default",
    name: "Nova Default",
    description: "Clear, friendly English voice",
    historyPrompt: "v2/en_speaker_6",
    language: "en",
  },
  {
    id: "nova-calm",
    name: "Nova Calm",
    description: "Calm, measured English voice",
    historyPrompt: "v2/en_speaker_2",
    language: "en",
  },
  {
    id: "nova-professional",
    name: "Nova Professional",
    description: "Professional, clear English voice",
    historyPrompt: "v2/en_speaker_3",
    language: "en",
  },
  {
    id: "nova-energetic",
    name: "Nova Energetic",
    description: "Upbeat, energetic English voice",
    historyPrompt: "v2/en_speaker_9",
    language: "en",
  },
  {
    id: "nova-assistant",
    name: "Nova Assistant",
    description: "Warm, helpful assistant voice",
    historyPrompt: "v2/en_speaker_0",
    language: "en",
  },
  {
    id: "nova-deep",
    name: "Nova Deep",
    description: "Deeper, authoritative English voice",
    historyPrompt: "v2/en_speaker_4",
    language: "en",
  },
  {
    id: "nova-soft",
    name: "Nova Soft",
    description: "Soft, gentle English voice",
    historyPrompt: "v2/en_speaker_1",
    language: "en",
  },
  {
    id: "nova-narrator",
    name: "Nova Narrator",
    description: "Clear narration-style voice",
    historyPrompt: "v2/en_speaker_5",
    language: "en",
  },
  {
    id: "hindi-1",
    name: "Hindi Voice 1",
    description: "Hindi language voice",
    historyPrompt: "v2/hi_speaker_0",
    language: "hi",
  },
  {
    id: "french-1",
    name: "French Voice 1",
    description: "French language voice",
    historyPrompt: "v2/fr_speaker_0",
    language: "fr",
  },
  {
    id: "spanish-1",
    name: "Spanish Voice 1",
    description: "Spanish language voice",
    historyPrompt: "v2/es_speaker_0",
    language: "es",
  },
  {
    id: "japanese-1",
    name: "Japanese Voice 1",
    description: "Japanese language voice",
    historyPrompt: "v2/ja_speaker_0",
    language: "ja",
  },
  {
    id: "chinese-1",
    name: "Chinese Voice 1",
    description: "Chinese language voice",
    historyPrompt: "v2/zh_speaker_0",
    language: "zh",
  },
  {
    id: "german-1",
    name: "German Voice 1",
    description: "German language voice",
    historyPrompt: "v2/de_speaker_0",
    language: "de",
  },
];

export function getPresetById(id: string): BarkVoicePreset | undefined {
  return BARK_VOICE_PRESETS.find((p) => p.id === id);
}

export function getPresetsForLanguage(lang: string): BarkVoicePreset[] {
  return BARK_VOICE_PRESETS.filter((p) => p.language === lang || p.id.startsWith("nova-"));
}
